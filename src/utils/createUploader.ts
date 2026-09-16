import { assign, endsWith, find, forEach, throttle, trim } from 'lodash';
import { getToken } from 'src/utils/common';
import RegExpValidator from 'src/utils/expression';

const validateFileName = str => {
  str = trim(str);

  if (!str) {
    alert(_l('名称不能为空'), 3);
    return false;
  }

  if (str.length > 255) {
    alert(_l('文件名过长'), 3);
    return false;
  }

  return true;

  // ⚠【下面这段永远执行不到，本次刻意不动它】
  // 上面那句 `return true` 把非法字符校验整段挡在后面了，也就是说
  // 含 \ / : * ? " < > | 的文件名【现在一直是放行的】，那句 alert 从来没弹出过。
  // eslint 的 no-unreachable 是这次把文件从 src/library/（eslint 与类型检查都 ignore
  // 的目录）挪到 src/utils/ 之后才第一次报出来的。
  //
  // 【为什么不顺手让它生效】那会开始拒绝当前能传上去的文件，是用户可见的行为变更，
  // 而附件上传是全公司 OA 的核心路径、我没法实测。要开得单独一批、并确认产品预期。
  // eslint-disable-next-line no-unreachable
  const illegalChars = /[\/\\:\*\?"<>\|]/g;
  const valid = !illegalChars.test(str);

  if (!valid) {
    alert(_l('名称不能包含以下字符：') + '\\ / : * ? " < > |', 3);
  }

  return valid;
};

// 上传错误类型
const UPLOAD_ERROR = {
  INVALID_FILES: 1,
  TOO_MANY_FILES: 2,
};

export default option => {
  option = assign(
    {
      ext_blacklist: ['exe', 'bat', 'vbs', 'cmd', 'com', 'url'],
      max_file_count: 100,
      auto_start: true,
      url: md.global.FileStoreConfig.uploadHost,
      multipart_params: { token: '' },
      max_retries: 3,
      dragdrop: true,
      chunk_size: '4mb',
      max_file_size: md.global.SysSettings.fileUploadLimitSize + 'mb',
      bucket: 0,
      type: 0,
    },
    option,
  );

  // 验证文件有效性
  function validateFile(file) {
    if (!validateFileName(file.name)) {
      return false;
    }
    return !find(option.ext_blacklist, ext => endsWith(file.name.toLowerCase(), ext.toLowerCase()));
  }

  function triggerUploadError(up, file, message) {
    file.status = window.plupload.FAILED;
    up.trigger('Error', {
      file,
      code: undefined,
      message,
    });
    up.removeFile(file);
  }

  (function resetChunkSize() {
    // 七牛的分片上限是 4M，超过就把分片关掉（保持原有语义，没有改成截断）。
    //
    // 【这里删掉了两条永远走不到的分支】
    // 1. `if (ie && ie <= 9 && option.runtimes.indexOf('flash') >= 0)` ——
    //    ie 来自一个用 IE 条件注释（<!--[if gt IE n]>）探测版本的函数，
    //    非 IE 浏览器里恒为 false。而且这条分支还藏着个隐患：runtimes【不在默认值里】，
    //    真走到就是 `undefined.indexOf` —— 只是靠 ie 恒假短路才没抛。
    //    另外全部 8 个调用方都显式传了 runtimes: 'html5'，flash 从来没被启用过。
    // 2. isSpecialSafari —— 判的是 Windows 7 上的 Safari ≤ 5 和 iOS 7 的 Safari，
    //    分别是 2010 / 2013 年的东西；而本仓生成的 HTML 已经把 Chrome 50 以下
    //    重定向到升级页（CI/generate.ts）。
    //    它也是 createUploader 里唯一用到 mOxie 的地方。
    const BLOCK_BITS = 20;
    const MAX_CHUNK_SIZE = 4 << BLOCK_BITS; // 4M
    const chunkSize = plupload.parseSize(option.chunk_size);

    option.chunk_size = chunkSize > MAX_CHUNK_SIZE ? 0 : MAX_CHUNK_SIZE;
  })();

  const initFunc = assign({}, option.init);
  delete option.init.Error;
  delete option.init.FileUploaded;
  delete option.init.FilesAdded;
  const uploader = new plupload.Uploader(option);

  uploader.init();

  uploader.bind('FilesAdded', function FilesAdded(up, files) {
    const validFiles = [];
    const invalidFiles = [];
    const tokenFiles = [];
    forEach(files, file => {
      file.name = file.name.replace(/[\/\\:\*\?"<>\|]/g, '_');
      if (validateFile(file)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file);
      }
      let fileExt = `.${RegExpValidator.getExtOfFileName(file.name)}`;
      let isPic = RegExpValidator.fileIsPicture(fileExt);
      tokenFiles.push({ bucket: option.bucket || (isPic ? 4 : 3), ext: fileExt });
    });

    if (validFiles.length > option.max_file_count) {
      // 先清理超限文件，避免错误回调异常导致未获取 token 的文件残留在队列中。
      forEach(files, file => up.removeFile(file));
      if (typeof option.error_callback === 'function') {
        option.error_callback(UPLOAD_ERROR.TOO_MANY_FILES, files);
      }

      return;
    }

    if (invalidFiles.length) {
      forEach(invalidFiles, invalidFile => (invalidFile.mdUploadErrorType = UPLOAD_ERROR.INVALID_FILES));
      option.error_callback(UPLOAD_ERROR.INVALID_FILES, invalidFiles);
      forEach(invalidFiles, file => up.removeFile(file));
    }
    if (!validFiles.length) {
      return;
    }

    const start = () => {
      let autoStart = up.getOption && up.getOption('auto_start');
      autoStart = autoStart || (up.settings && up.settings.auto_start);
      let beforeUploadCheck;
      if (option.before_upload_check) {
        beforeUploadCheck = option.before_upload_check(up, validFiles);
        if (beforeUploadCheck === false) {
          beforeUploadCheck = Promise.reject(false);
        }
      }

      (option.getToken || getToken)(tokenFiles, option.type, option.getTokenParam).then(res => {
        const exceedFiles = [];
        files.forEach((item, i) => {
          if (!res[i]) {
            up.removeFile(item);
            return;
          }
          if (res[i].size && item.size > res[i].size * 1024 * 1024) {
            exceedFiles.push(item);
            up.removeFile(item);
          } else {
            item.token = res[i].uptoken;
            item.key = res[i].key;
            item.serverName = res[i].serverName;
            item.fileName = res[i].fileName;
            item.url = res[i].url;
          }
        });

        if (exceedFiles.length) {
          if (initFunc.FilesAdded) {
            initFunc.FilesAdded(up, []);
          }
          option.remove_files_callback && option.remove_files_callback(up, exceedFiles);
          alert(_l('%0个文件无法上传：单个文件大小超过%1MB', exceedFiles.length, res[0].size), 2);
        }

        if (autoStart) {
          plupload.each(validFiles, file => {
            Promise.all([beforeUploadCheck])
              .then(() => up.start())
              .catch(failResult => {
                file.status = window.plupload.FAILED;
                up.trigger('Error', {
                  file,
                  code: undefined,
                  message: failResult || '上传前检查失败',
                });
                up.removeFile(file);
              });
          });
        }
      });
      up.refresh();
    };

    if (initFunc.FilesAdded) {
      if (up.settings.source === 'h5') {
        // h5 有压缩、添加水印等异步操作，等 FilesAdded 处理完再执行 start
        initFunc.FilesAdded(up, validFiles, start);
      } else {
        initFunc.FilesAdded(up, validFiles);
        start();
      }
    } else {
      start();
    }
  });

  uploader.bind('Retry', function ClearStoredProgress(up, file: Record<string, any> = {}) {
    up.stop();
    localStorage.removeItem(file.name);
    file.loaded = 0;
    file.status = window.plupload.UPLOADING;
    up.state = window.plupload.STARTED;
    up.trigger('StateChanged');
    up.trigger('BeforeUpload', file);
    up.trigger('UploadFile', file);
  });

  uploader.bind('BeforeUpload', function BeforeUpload(up, file: Record<string, any> = {}) {
    try {
      const native = file.getNative();
      if (file.size && !native.size) {
        file.notExists = true;
      }
    } catch (e) {}

    const fileExt = `.${RegExpValidator.getExtOfFileName(file.name)}`;

    const token = file.token;

    const directUpload = function (up, file) {
      /* eslint no-shadow:0*/
      let multipartParamsObj;
      if (option.save_key) {
        multipartParamsObj = { token };
      } else {
        multipartParamsObj = {
          token,
          key: file.key,
        };
      }

      const xVars = option.x_vars;
      if (xVars !== undefined && typeof xVars === 'object') {
        multipartParamsObj['x:serverName'] = file.serverName;
        multipartParamsObj['x:filePath'] = file.key.replace(file.fileName, '');
        multipartParamsObj['x:fileName'] = file.fileName.replace(/\.[^\.]*$/, '');
        multipartParamsObj['x:originalFileName'] = encodeURIComponent(
          file.name.indexOf('.') > -1 ? file.name.split('.').slice(0, -1).join('.') : file.name,
        );
        multipartParamsObj['x:fileExt'] = fileExt;
      }

      up.setOption({
        url: option.url,
        multipart: true,
        chunk_size: undefined,
        multipart_params: multipartParamsObj,
      });
    };

    let chunkSize = up.getOption && up.getOption('chunk_size');
    chunkSize = chunkSize || (up.settings && up.settings.chunk_size);
    if (uploader.runtime === 'html5' && chunkSize) {
      if (file.size <= chunkSize) {
        directUpload(up, file);
      } else {
        const rawFileInfo = localStorage.getItem(file.name);
        let blockSize = chunkSize;
        if (rawFileInfo) {
          const localFileInfo = JSON.parse(rawFileInfo);
          const now = new Date().getTime();
          const before = localFileInfo.time || 0;
          const aDay = 24 * 60 * 60 * 1000; //  milliseconds
          if (now - before < aDay) {
            if (localFileInfo.percent !== 100) {
              if (file.size === localFileInfo.total) {
                // 通过文件名和文件大小匹配，找到对应的 localstorage 信息，恢复进度
                file.percent = localFileInfo.percent;
                file.loaded = localFileInfo.offset;
                file.ctx = localFileInfo.ctx;
                if (localFileInfo.offset + blockSize > file.size) {
                  blockSize = file.size - localFileInfo.offset;
                }
              } else {
                localStorage.removeItem(file.name);
              }
            } else {
              // 进度100%时，删除对应的localStorage，避免 499 bug
              localStorage.removeItem(file.name);
            }
          } else {
            localStorage.removeItem(file.name);
          }
        }
        up.setOption({
          url: option.url.replace(/(\/)$/, '') + '/mkblk/' + blockSize,
          multipart: false,
          chunk_size: chunkSize,
          required_features: 'chunks',
          headers: {
            Authorization: 'UpToken ' + token,
          },
          multipart_params: {},
        });
      }
    } else {
      directUpload(up, file);
    }
  });

  uploader.bind('ChunkUploaded', function ChunkUploaded(up, file, info) {
    const res = safeParse(info.response, 'object');
    if (!res.ctx) {
      triggerUploadError(up, file, _l('上传失败，请稍后再试。'));
      return;
    }

    file.ctx = file.ctx ? file.ctx + ',' + res.ctx : res.ctx;
    const leftSize = info.total - info.offset;
    let chunkSize = up.getOption && up.getOption('chunk_size');
    chunkSize = chunkSize || (up.settings && up.settings.chunk_size);
    if (leftSize < chunkSize) {
      up.setOption({
        url: option.url.replace(/(\/)$/, '') + '/mkblk/' + leftSize,
      });
    }
    safeLocalStorageSetItem(
      file.name,
      JSON.stringify({
        ctx: file.ctx,
        percent: file.percent,
        total: info.total,
        offset: info.offset,
        time: new Date().getTime(),
      }),
    );
  });

  uploader.bind('Error', function Error(up, err) {
    let errTip = '';
    let maxFileSize, errorObj, errorText;
    switch (err.code) {
      case plupload.FAILED:
        errTip = _l('上传失败。请稍后再试。');
        break;
      case plupload.FILE_SIZE_ERROR:
        maxFileSize = up.getOption && up.getOption('max_file_size');
        maxFileSize = maxFileSize || (up.settings && up.settings.max_file_size);
        errTip = _l('单个文件大小超过%0，无法支持上传', maxFileSize.toUpperCase());
        break;
      case plupload.FILE_EXTENSION_ERROR:
        errTip = _l('无法上传，不支持该格式的文件');
        break;
      case plupload.HTTP_ERROR:
        errorObj = JSON.stringify(err.response);
        errorText = errorObj.error;
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
            try {
              errorObj = JSON.parse(errorObj.error);
              errorText = errorObj.error || '';
            } catch (e) {
              errorText = errorObj.error || '';
            }
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
      case plupload.SECURITY_ERROR:
        errTip = _l('安全配置错误。请联系客服。');
        break;
      case plupload.GENERIC_ERROR:
        errTip = _l('上传失败。请稍后再试。');
        break;
      case plupload.IO_ERROR:
        errTip = _l('上传失败。请稍后再试。');
        break;
      case plupload.INIT_ERROR:
        errTip = _l('网站配置错误。请联系客服。');
        uploader.destroy();
        break;
      case plupload.FILE_DUPLICATE_ERROR:
        errTip = _l('文件重复。');
        break;
      default:
        errTip = (err.message || '') + (err.details || '');
        break;
    }
    if (initFunc.Error) {
      initFunc.Error(up, err, errTip);
    }
    up.refresh(); // 让 plupload 重新测量 browse_button 的位置（原注释写的是 Reposition Flash/Silverlight，已无 Flash 运行时）
  });

  uploader.bind('FileUploaded', function (up, file, info) {
    info.response = safeParse(info.response, 'object');
    if (!info.response.ctx && !info.response.key) {
      triggerUploadError(up, file, _l('上传失败，请稍后再试。'));
      return;
    }

    if (!info.response.ctx) {
      if (initFunc.FileUploaded) {
        info.originalFileName = decodeURIComponent(info.originalFileName);
        initFunc.FileUploaded(up, file, info);
      }
    } else {
      let fileExt = `.${RegExpValidator.getExtOfFileName(file.name)}`;
      let isPic = RegExpValidator.fileIsPicture(fileExt);

      let tokenInfo =
        file.key && file.token
          ? {
              key: file.key,
              uptoken: file.token,
              fileName: file.fileName,
              serverName: file.serverName,
              url: file.url,
            }
          : null;

      if (!tokenInfo) {
        try {
          tokenInfo = ((option.getToken || getToken)(
            [{ bucket: option.bucket || (isPic ? 4 : 3), ext: fileExt }],
            option.type,
            option.getTokenParam,
            { ajaxOptions: { sync: true } },
          ) || [])[0];
        } catch (err) {
          console.error(err);
          triggerUploadError(up, file, _l('获取上传凭证失败，请稍后重试。'));
          return;
        }
      }

      if (!tokenInfo || !tokenInfo.key || !tokenInfo.uptoken) {
        triggerUploadError(up, file, _l('获取上传凭证失败，请稍后重试。'));
        return;
      }

      file.key = file.key || tokenInfo.key;
      file.token = file.token || tokenInfo.uptoken;
      file.fileName = file.fileName || tokenInfo.fileName;
      file.serverName = file.serverName || tokenInfo.serverName;
      file.url = file.url || tokenInfo.url;

      $.ajax({
        url: option.url.replace(/(\/)$/, '') + '/mkfile/' + (file.size ? file.size : 0) + '/key/' + btoa(tokenInfo.key),
        type: 'POST',
        beforeSend: request => {
          request.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
          request.setRequestHeader('Authorization', 'UpToken ' + tokenInfo.uptoken);
        },
        data: file.ctx,
        processData: false,
        async: false,
      }).then(response => {
        if (typeof response === 'string') {
          response = safeParse(response, 'object');
        }

        if (!response.key) {
          triggerUploadError(up, file, _l('上传失败，请稍后再试。'));
          return;
        }

        const serverFileName = file.fileName || tokenInfo.fileName || '';
        const fileKey = file.key || tokenInfo.key;
        const oldKeyDir = fileKey.replace(serverFileName, '');
        const newKey = response.key || fileKey;
        const newKeyDir = newKey.replace(serverFileName, '');
        const url = file.url || tokenInfo.url || '';

        response.fileExt = fileExt;
        response.fileName = RegExpValidator.getNameOfFileName(serverFileName || file.name);
        response.filePath = newKeyDir;
        response.originalFileName = encodeURIComponent(RegExpValidator.getNameOfFileName(file.name));
        response.serverName = file.serverName;

        file.key = response.key;
        file.url = url.replace(oldKeyDir, newKeyDir) || response.url;

        if (initFunc.FileUploaded) {
          initFunc.FileUploaded(up, file, { response });
        }
      });
    }
  });

  uploader.bind('PostInit', function bindPluploadPaste(up) {
    var paste = document.getElementById(option.paste_element);
    if (paste) {
      const onPaste = throttle(e => {
        var items = e.originalEvent.clipboardData && e.originalEvent.clipboardData.items;
        var data = { files: [] };
        if (items && items.length) {
          $.each(items, function (index, item) {
            var file = item.getAsFile && item.getAsFile();
            if (file) {
              file.isFromClipBoard = true;
              data.files.push(file);
            }
          });
          if (data.files.length > 0) {
            up.addFile(data.files);
          }
        }
      }, 500);
      $(paste).on('paste', onPaste);
    }
  });

  return uploader;
};
