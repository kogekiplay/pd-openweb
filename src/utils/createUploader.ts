/**
 * 文件上传器 —— 对外保持 plupload 的用法，内部换成自己实现的七牛 v1 分片上传。
 *
 * 【为什么换】原实现把七牛的 mkblk/mkfile 协议手工挂在 plupload 的通用分片上，
 * 而 plupload 3.1.5 是 212KB 的压缩 JS、带着 Flash/Silverlight 运行时与 IE8/9 分支。
 * 协议本身就一百来行，与其为它扛一个上古依赖，不如自己写清楚。
 *
 * 【为什么不是官方 SDK】试过 qiniu-js，在生产上实测走不通 ——
 * 原因写在 uploader/qiniuV1.ts 的文件头，不要再走一遍。
 *
 * 【为什么保留 plupload 的对外形状】全仓 10 个调用方按 plupload 的事件与
 * 文件对象写法在用（`up.settings.multipart_params = …`、`file.getNative()`、
 * `uploader.disableBrowse(true)` 等），换实现时把这层形状原样保住，
 * 调用方就不用一起改 —— 这是这次改造的主要风险控制手段。
 *
 * 【职责划分】
 *   uploader/fileSelect.ts   点按钮 / 拖放 / 粘贴（qiniu-js 不管这块）
 *   uploader/qiniuV1.ts      七牛 v1 分片协议（mkblk/mkfile）+ 断点续传
 *   本文件                    队列、校验、取凭证、事件分发
 *
 * 【没有实测的部分】真实的七牛上传要凭证与后端，本地验不了。
 * 能验的是队列 / 校验 / 事件 / 参数映射这一层 —— 见 createUploader.spec.ts
 *（12 个用例，做过负对照：故意改错断言与打破 customVars 契约都会让门禁变红）。
 * 上传协议本身交给了官方 SDK，那比本仓手写的 mkblk/mkfile 更经得起考验。
 */
import { assign, endsWith, find, forEach } from 'lodash';
import { getToken } from 'src/utils/common';
import RegExpValidator from 'src/utils/expression';
import { FileStatus, UPLOAD_ERROR, UploadError, UploaderState } from './uploader/constants';
import { createFileSelect } from './uploader/fileSelect';
import { uploadToQiniu } from './uploader/qiniuV1';
import type { QiniuUploadTask } from './uploader/qiniuV1';
import type { Uploader, UploaderEvent, UploaderFile, UploaderOption, UploadErrorInfo } from './uploader/types';

export { FileStatus, UPLOAD_ERROR, UploadError, UploaderState } from './uploader/constants';
export type { Uploader, UploaderFile, UploaderOption } from './uploader/types';

/** 文件名里不允许出现的字符（与老实现一致，加入队列时统一替换成 _） */
const ILLEGAL_NAME_CHARS = /[\/\\:\*\?"<>\|]/g;

const validateFileName = (str: string): boolean => {
  const name = (str || '').trim();

  if (!name) {
    alert(_l('名称不能为空'), 3);
    return false;
  }

  if (name.length > 255) {
    alert(_l('文件名过长'), 3);
    return false;
  }

  return true;
};

/** '4mb' / 4194304 -> 字节数 */
function parseSize(size: string | number | undefined): number {
  if (typeof size === 'number') return size;
  if (!size) return 0;
  const m = /^(\d+(?:\.\d+)?)\s*([kmg]?)b?$/i.exec(String(size).trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const factor = unit === 'g' ? 1024 ** 3 : unit === 'm' ? 1024 ** 2 : unit === 'k' ? 1024 : 1;
  return Math.round(n * factor);
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `mdfile_${Date.now().toString(36)}_${seq}`;
}

/** 把原生 File 包成队列里的文件对象 */
function wrapFile(native: File, source: 'browse' | 'drop' | 'paste'): UploaderFile {
  const wrapped: UploaderFile = {
    id: nextId(),
    // 【替换非法字符】老实现在 FilesAdded 里做同样的事；放在这里是因为后面的
    // 校验、取凭证都依赖最终的 name。
    name: (native.name || '').replace(ILLEGAL_NAME_CHARS, '_'),
    size: native.size,
    type: native.type,
    percent: 0,
    loaded: 0,
    status: FileStatus.QUEUED,
    getNative: () => native,
    getSource: () => wrapped,
  };
  if (source === 'paste') wrapped.isFromClipBoard = true;
  const rel = (native as any).webkitRelativePath;
  if (rel) {
    wrapped.webkitRelativePath = rel;
    // 目录上传：下游读的是带前导斜杠的 relativePath（原来由调用方包 moxie File 时写上去），
    // 格式与老代码一致。
    wrapped.relativePath = '/' + String(rel).replace(/^\//, '');
  }
  return wrapped;
}

export default function createUploader(inputOption: UploaderOption): Uploader {
  const option: UploaderOption = assign(
    {
      ext_blacklist: ['exe', 'bat', 'vbs', 'cmd', 'com', 'url'],
      max_file_count: 100,
      auto_start: true,
      url: md.global.FileStoreConfig.uploadHost,
      multipart_params: { token: '' },
      dragdrop: true,
      chunk_size: '4mb',
      max_file_size: md.global.SysSettings.fileUploadLimitSize + 'mb',
      bucket: 0,
      type: 0,
    },
    inputOption,
  );

  // 七牛单次分片上限 4M：超过就不分片（保持老实现的语义，没有改成截断）
  const MAX_CHUNK_SIZE = 4 * 1024 * 1024;
  const requestedChunk = parseSize(option.chunk_size);
  option.chunk_size = requestedChunk > MAX_CHUNK_SIZE ? 0 : MAX_CHUNK_SIZE;

  const maxFileSize = parseSize(option.max_file_size);

  // 调用方传进来的事件处理器。【要先拷出来】—— 内部逻辑（取凭证、拼参数）
  // 必须先于调用方的回调执行，所以这几个不走 bind，由下面显式转发。
  const initFunc = assign({}, option.init) as Record<string, (...args: any[]) => any>;

  const handlers = new Map<UploaderEvent, Array<(...args: any[]) => any>>();
  const files: UploaderFile[] = [];
  /** 正在飞的上传任务，用于 stop / removeFile 时中断 */
  const tasks = new Map<string, QiniuUploadTask>();
  let destroyed = false;

  function trigger(event: UploaderEvent, ...args: any[]) {
    for (const fn of (handlers.get(event) || []).slice()) fn(...args);
  }

  const uploader: Uploader = {
    settings: option as any,
    files,
    state: UploaderState.STOPPED,

    init() {
      trigger('Init', uploader);
      if (initFunc.Init) initFunc.Init(uploader);
      trigger('PostInit', uploader);
      if (initFunc.PostInit) initFunc.PostInit(uploader);
    },
    destroy() {
      destroyed = true;
      uploader.stop();
      select.destroy();
      handlers.clear();
    },
    start() {
      startQueue();
    },
    stop() {
      uploader.state = UploaderState.STOPPED;
      for (const task of tasks.values()) task.abort();
      tasks.clear();
      trigger('StateChanged', uploader);
    },
    addFile(input) {
      // 【不要写 `input instanceof FileList`】FileList 只在浏览器里有，
      // 在 Node（spec）里引用它是 ReferenceError。用「像数组」来判就够了。
      const isArrayLike =
        input && typeof (input as any).length === 'number' && typeof (input as any).name !== 'string';
      const list: File[] = Array.isArray(input)
        ? input
        : isArrayLike
          ? Array.prototype.slice.call(input)
          : [input as File];
      handleFiles(
        list.filter(Boolean),
        list.some(f => (f as any).isFromClipBoard) ? 'paste' : 'browse',
      );
    },
    removeFile(target) {
      const id = typeof target === 'string' ? target : target && target.id;
      const idx = files.findIndex(f => f.id === id);
      if (idx < 0) return;
      const [removed] = files.splice(idx, 1);
      const task = tasks.get(id);
      if (task) {
        task.abort();
        tasks.delete(id);
      }
      trigger('FilesRemoved', uploader, [removed]);
      if (initFunc.FilesRemoved) initFunc.FilesRemoved(uploader, [removed]);
    },
    refresh() {
      // 有意为空：plupload 里这是重新测量透明 input 相对按钮的位置；
      // 本实现点按钮时直接转发 input.click()，没有需要测量的东西。
      // 保留是为了调用点不用改。
    },
    disableBrowse(disable = true) {
      select.disable(disable);
    },
    getOption(key) {
      return (option as any)[key];
    },
    setOption(key, value) {
      if (typeof key === 'object') assign(option, key);
      else (option as any)[key] = value;
    },
    bind(event, handler) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
    },
    unbind(event, handler) {
      if (!handler) {
        handlers.delete(event);
        return;
      }
      const list = handlers.get(event);
      if (!list) return;
      const i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    },
    trigger(event, ...args) {
      trigger(event, ...args);
    },
  };

  function triggerUploadError(file: UploaderFile | undefined, message: string, code?: number) {
    if (file) file.status = FileStatus.FAILED;
    emitError({ file, code, message });
    if (file) uploader.removeFile(file);
  }

  /**
   * Error 事件。错误提示文案的映射【逐条沿用老实现】，
   * 这样调用方拿到的 errTip 不变。
   */
  function emitError(err: UploadErrorInfo) {
    let errTip = '';
    let errorText = '';

    switch (err.code) {
      case UploadError.FILE_SIZE_ERROR:
        errTip = _l('单个文件大小超过%0，无法支持上传', String(option.max_file_size).toUpperCase());
        break;
      case UploadError.FILE_EXTENSION_ERROR:
        errTip = _l('无法上传，不支持该格式的文件');
        break;
      case UploadError.HTTP_ERROR:
        errorText = (err.response && err.response.error) || '';
        switch (err.status) {
          case 400:
            errTip = _l('上传文件发生错误，请稍后再试。');
            break;
          case 401:
            errTip = _l('客户端认证授权失败。请重试或提交反馈。');
            break;
          case 405:
            errTip = _l('客户端请求错误。请重试或提交反馈。');
            break;
          case 579:
            errTip = _l('资源上传成功，但回调失败。');
            break;
          case 599:
            errTip = _l('网络连接异常。请重试或提交反馈。');
            break;
          case 614:
            errTip = _l('文件服务器已存在同名文件，请重新上传。');
            break;
          case 631:
            errTip = _l('指定空间不存在。');
            break;
          case 701:
            errTip = _l('上传数据块校验出错。请重试或提交反馈。');
            break;
          default:
            if (err.file && !err.file.type && (err.file.size || 0) % 4096 === 0) {
              errTip = _l('此浏览器不支持上传文件夹');
            } else if (err.file && err.file.notExists) {
              errTip = _l('文件不存在，请确认本地文件位置。');
            } else {
              err.message = (err.message || '') + ' ' + errorText + ' ' + err.status;
              errTip = _l('上传失败，请检查网络或稍后再试。');
            }
            break;
        }
        if (err.status) {
          errTip = errTip + '(' + err.status + (errorText ? '：' + errorText : '') + ')';
        }
        break;
      case UploadError.SECURITY_ERROR:
        errTip = _l('安全配置错误。请联系客服。');
        break;
      case UploadError.INIT_ERROR:
        errTip = _l('网站配置错误。请联系客服。');
        uploader.destroy();
        break;
      case UploadError.FILE_DUPLICATE_ERROR:
        errTip = _l('文件重复。');
        break;
      case UploadError.GENERIC_ERROR:
      case UploadError.IO_ERROR:
        errTip = _l('上传失败。请稍后再试。');
        break;
      default:
        errTip = (err.message || '') + (err.details || '');
        break;
    }

    trigger('Error', uploader, err, errTip);
    if (initFunc.Error) initFunc.Error(uploader, err, errTip);
  }

  // ── 加入队列 ────────────────────────────────────────────────────────────
  function validateFile(file: UploaderFile): boolean {
    if (!validateFileName(file.name)) return false;
    return !find(option.ext_blacklist, (ext: string) => endsWith(file.name.toLowerCase(), ext.toLowerCase()));
  }

  function handleFiles(natives: File[], source: 'browse' | 'drop' | 'paste') {
    if (destroyed || !natives.length) return;

    const wrapped = natives.map(f => wrapFile(f, source));
    const validFiles: UploaderFile[] = [];
    const invalidFiles: UploaderFile[] = [];
    const tokenFiles: Array<{ bucket: number; ext: string }> = [];

    forEach(wrapped, file => {
      if (validateFile(file)) validFiles.push(file);
      else invalidFiles.push(file);

      const fileExt = `.${RegExpValidator.getExtOfFileName(file.name)}`;
      const isPic = RegExpValidator.fileIsPicture(fileExt);
      tokenFiles.push({ bucket: option.bucket || (isPic ? 4 : 3), ext: fileExt });
    });

    if (validFiles.length > (option.max_file_count as number)) {
      if (typeof option.error_callback === 'function') {
        option.error_callback(UPLOAD_ERROR.TOO_MANY_FILES, wrapped);
      }
      return;
    }

    if (invalidFiles.length) {
      forEach(invalidFiles, f => (f.mdUploadErrorType = UPLOAD_ERROR.INVALID_FILES));
      option.error_callback && option.error_callback(UPLOAD_ERROR.INVALID_FILES, invalidFiles);
    }
    if (!validFiles.length) return;

    // 【单文件大小在本地先拦一道】老实现是交给 plupload 的 max_file_size，
    // 由它发 FILE_SIZE_ERROR；qiniu-js 不管这件事，所以在这里判，
    // 错误码与文案保持一致。
    const oversized = validFiles.filter(f => maxFileSize > 0 && f.size > maxFileSize);
    if (oversized.length) {
      forEach(oversized, f => {
        f.status = FileStatus.FAILED;
        emitError({ file: f, code: UploadError.FILE_SIZE_ERROR });
      });
    }
    const accepted = validFiles.filter(f => oversized.indexOf(f) < 0);
    if (!accepted.length) return;

    files.push(...accepted);

    const start = () => {
      const beforeCheck = option.before_upload_check ? option.before_upload_check(uploader, accepted) : undefined;

      (option.getToken || getToken)(tokenFiles, option.type, option.getTokenParam).then((res: any[]) => {
        const exceedFiles: UploaderFile[] = [];

        accepted.forEach((item, i) => {
          const info = res && res[i];
          if (!info) {
            uploader.removeFile(item);
            return;
          }
          // 服务端也会给一个大小上限（单位 MB），超了就移出队列
          if (info.size && item.size > info.size * 1024 * 1024) {
            exceedFiles.push(item);
            uploader.removeFile(item);
            return;
          }
          item.token = info.uptoken;
          item.key = info.key;
          item.serverName = info.serverName;
          item.fileName = info.fileName;
          item.url = info.url;
        });

        if (exceedFiles.length) {
          if (initFunc.FilesAdded) initFunc.FilesAdded(uploader, []);
          option.remove_files_callback && option.remove_files_callback(uploader, exceedFiles);
          alert(_l('%0个文件无法上传：单个文件大小超过%1MB', exceedFiles.length, res[0].size), 2);
        }

        if (option.auto_start) {
          Promise.resolve(beforeCheck === false ? Promise.reject(false) : beforeCheck)
            .then(() => startQueue())
            .catch(failResult => {
              forEach(accepted, file => triggerUploadError(file, failResult || _l('上传前检查失败')));
            });
        } else {
          // auto_start: false —— 由调用方自己挑时机 start()。那个时机可能【早于】
          // 这里，所以凭证刚到位就得把已经在等的文件接上，否则它们会永远停在队列里。
          resumePendingStart();
        }
      });
    };

    trigger('FilesAdded', uploader, accepted);
    if (initFunc.FilesAdded) {
      // 【第三个参数 start 是个约定】h5 那边有压缩、加水印这些异步处理，
      // 处理完才让开始上传；老实现按 up.settings.source === 'h5' 区分。
      if (option.source === 'h5') initFunc.FilesAdded(uploader, accepted, start);
      else {
        initFunc.FilesAdded(uploader, accepted);
        start();
      }
    } else {
      start();
    }
  }

  // ── 上传 ────────────────────────────────────────────────────────────────
  /**
   * 是否已经请求过开始上传。
   *
   * 【为什么需要这个标记】凭证是异步取的，而 auto_start: false 的调用方会【自己】
   * 挑时机调 start()。如果那个时机早于凭证返回，下面的循环会因为 file.token 为空
   * 把文件跳过 —— 然后【再也没人来传它】，表现是点了发送却毫无反应、也没有报错。
   * 记下"已请求开始"，等凭证到位时补跑一次，时序就不再影响结果。
   *
   * 这不是为某个调用方开的口子：任何手动 start() 的用法都会撞上。
   * 聊天面板（SendToolbar）是第一个触发它的 —— 它的流程是「逐个弹确认框、
   * 全部确认后才 start()」，只有一个文件时会【同步】走到 start()，必然早于凭证。
   */
  let startRequested = false;

  function startQueue() {
    if (destroyed) return;
    startRequested = true;
    uploader.state = UploaderState.STARTED;
    trigger('StateChanged', uploader);

    for (const file of files.slice()) {
      if (file.status !== FileStatus.QUEUED) continue;
      if (!file.token) continue; // 凭证还没到；到了之后由 resumePendingStart 补上
      uploadOne(file);
    }
  }

  /** 凭证到位后调用：如果此前已经请求过开始，就把等着的文件接上 */
  function resumePendingStart() {
    if (!startRequested || destroyed) return;
    for (const file of files.slice()) {
      if (file.status === FileStatus.QUEUED && file.token) uploadOne(file);
    }
  }

  function buildCustomVars(file: UploaderFile): Record<string, string> {
    const vars: Record<string, string> = {};
    // 老实现只有在 option.x_vars 是对象时才带这些自定义变量，沿用
    if (option.x_vars === undefined || typeof option.x_vars !== 'object') return vars;

    const fileExt = `.${RegExpValidator.getExtOfFileName(file.name)}`;
    vars['x:serverName'] = file.serverName || '';
    vars['x:filePath'] = (file.key || '').replace(file.fileName || '', '');
    vars['x:fileName'] = (file.fileName || '').replace(/\.[^.]*$/, '');
    vars['x:originalFileName'] = encodeURIComponent(
      file.name.indexOf('.') > -1 ? file.name.split('.').slice(0, -1).join('.') : file.name,
    );
    vars['x:fileExt'] = fileExt;
    return vars;
  }

  function uploadOne(file: UploaderFile) {
    file.status = FileStatus.UPLOADING;

    // 选中之后文件被移动/删除：记录里有 size 而原生 size 为 0
    try {
      const native = file.getNative();
      if (file.size && native && !native.size) file.notExists = true;
    } catch {
      /* 取不到原生文件就不判，交给上传本身去失败 */
    }

    // 【先填默认参数，再让调用方改，最后读回来】调用方普遍在自己的 BeforeUpload
    // 里写 `up.settings.multipart_params = { token, key, 'x:...': ... }`，
    // 这是原来就有的契约。这里保住它：默认值我们给，调用方可覆盖，之后按它来传。
    option.multipart_params = assign(
      {},
      { token: file.token },
      option.save_key ? {} : { key: file.key },
      buildCustomVars(file),
    );

    trigger('BeforeUpload', uploader, file);
    if (initFunc.BeforeUpload) initFunc.BeforeUpload(uploader, file);

    const params = (option.multipart_params || {}) as Record<string, any>;
    const token = params.token || file.token;
    const customVars: Record<string, string> = {};
    for (const k of Object.keys(params)) {
      if (k.indexOf('x:') === 0 && params[k] !== undefined) customVars[k] = String(params[k]);
    }

    if (!token) {
      triggerUploadError(file, _l('获取上传凭证失败，请稍后重试。'), UploadError.SECURITY_ERROR);
      return;
    }

    const task = uploadToQiniu(
      {
        file: file.getNative(),
        key: option.save_key ? null : params.key || file.key || null,
        token,
        // 【原样传 url，不解析主机】私有化部署里它是同源相对路径（实测 /file/mingdao/upload），
        // 解析主机正是 qiniu-js 走不通的原因，见 uploader/qiniuV1.ts 的文件头。
        url: option.url as string,
        chunkSize: option.chunk_size as number,
        customVars,
        fname: file.name,
      },
      {
        onProgress(loaded, total, percent) {
          file.loaded = loaded;
          file.percent = Math.round(percent);
          trigger('UploadProgress', uploader, file);
          if (initFunc.UploadProgress) initFunc.UploadProgress(uploader, file);
        },
        onComplete(res) {
          tasks.delete(file.id);
          file.status = FileStatus.DONE;
          file.percent = 100;
          finishFile(file, res);
          maybeComplete();
        },
        onError(err) {
          tasks.delete(file.id);
          file.status = FileStatus.FAILED;
          emitError({ ...err, file });
          maybeComplete();
        },
      },
    );

    tasks.set(file.id, task);
  }

  /**
   * 把七牛返回的结果补成下游要的形状。
   *
   * 【这几个字段是硬契约】src/components/UploadFiles/utils.tsx 的 formatResponseData
   * 逐个读 serverName / filePath / fileName / fileExt / originalFileName / key。
   * 补法逐条沿用老实现（原来在 mkfile 回调里做）。
   */
  function finishFile(file: UploaderFile, rawResponse: any) {
    const response: Record<string, any> = assign({}, rawResponse);

    if (!response.key && !file.key) {
      triggerUploadError(file, _l('上传失败，请稍后再试。'));
      return;
    }

    const fileExt = `.${RegExpValidator.getExtOfFileName(file.name)}`;
    const serverFileName = file.fileName || '';
    const fileKey = file.key || '';
    const oldKeyDir = fileKey.replace(serverFileName, '');
    const newKey = response.key || fileKey;
    const newKeyDir = newKey.replace(serverFileName, '');
    const url = file.url || '';

    response.fileExt = fileExt;
    response.fileName = RegExpValidator.getNameOfFileName(serverFileName || file.name);
    response.filePath = newKeyDir;
    response.originalFileName = encodeURIComponent(RegExpValidator.getNameOfFileName(file.name));
    response.serverName = file.serverName;

    file.key = newKey;
    file.url = url.replace(oldKeyDir, newKeyDir) || response.url;

    trigger('FileUploaded', uploader, file, { response });
    if (initFunc.FileUploaded) initFunc.FileUploaded(uploader, file, { response });
  }

  function maybeComplete() {
    const pending = files.some(f => f.status === FileStatus.QUEUED || f.status === FileStatus.UPLOADING);
    if (pending) return;
    uploader.state = UploaderState.STOPPED;
    trigger('UploadComplete', uploader, files.slice());
    if (initFunc.UploadComplete) initFunc.UploadComplete(uploader, files.slice());
  }

  // ── 选择来源 ────────────────────────────────────────────────────────────
  const select = createFileSelect({
    browseButton: option.browse_button,
    dropElement: option.drop_element || (option.dragdrop ? option.browse_button : undefined),
    pasteElement: option.paste_element,
    multiple: option.multi_selection,
    accept: option.accept,
    onFiles: handleFiles,
    onBrowse: () => {
      trigger('Browse', uploader);
      if (initFunc.Browse) initFunc.Browse(uploader);
    },
  });

  // 上面显式转发过的事件不再重复绑定（否则调用方的回调会被调两次）；
  // 其余的直接绑上去。
  const FORWARDED = new Set([
    'Init',
    'PostInit',
    'Browse',
    'FilesAdded',
    'FilesRemoved',
    'BeforeUpload',
    'UploadProgress',
    'FileUploaded',
    'UploadComplete',
    'Error',
  ]);
  for (const name of Object.keys(initFunc)) {
    if (!FORWARDED.has(name)) uploader.bind(name as UploaderEvent, initFunc[name]);
  }

  return uploader;
}
