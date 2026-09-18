/**
 * 七牛 v1 分片上传（mkblk / mkfile）—— 自己实现，不依赖第三方 SDK。
 *
 * 【为什么不用 qiniu-js —— 2026-09-16 在生产上实测过，走不通】
 * 换官方 SDK 看起来是显然的改进，真做了一遍，失败在两条结构性原因上：
 *
 * 1. 本仓的 md.global.FileStoreConfig.uploadHost 在私有化部署里是【同源的相对路径】
 *    ——线上实测是 `/file/mingdao/upload`，不是域名。而 qiniu-js 的主机模型是
 *    `Host.getUrl() => protocol + "://" + host`（它的 upload/hosts.js），
 *    【表达不了"当前源下的路径前缀"】。把那个路径当 uphost 传进去会拼成
 *    `https:///file/mingdao/upload`，浏览器直接 ERR_CONNECTION_CLOSED。
 * 2. qiniu-js 默认走七牛 v2 分片（/buckets/{b}/objects/{k}/uploads 三步），
 *    而这台文件服务实现的是 v1 的 mkblk/mkfile。
 *
 * 本文件因此【原样使用 url】，不解析主机、不拼协议 —— 相对路径和完整域名都能用。
 *
 * 【协议逐条照搬自换掉之前的实现】那份是把 v1 协议手工挂在 plupload 的通用分片上：
 *   分片   POST {url}/mkblk/{blockSize}
 *          头 Authorization: UpToken {token}，体 = 该片的原始字节
 *          返回 { ctx, ... }；ctx 按顺序用逗号拼起来
 *   收尾   POST {url}/mkfile/{fileSize}/key/{btoa(key)}
 *          头 Content-Type: text/plain;charset=UTF-8、Authorization: UpToken {token}
 *          体 = 逗号拼接的 ctx 列表
 *   直传   POST {url}  multipart 表单：token / key / x:* / file
 *
 * 【断点续传的存储格式也照搬】localStorage 以【文件名】为键，存
 * { ctx, percent, total, offset, time }，24 小时内有效，且要求 total 与当前文件
 * 大小一致才续。保持一致是为了：用户在旧版本传到一半、升级后仍能接着传。
 */
import { UploadError } from './constants';
import type { UploadErrorInfo } from './types';

export interface QiniuUploadParams {
  file: File;
  /** 七牛目标 key；save_key 场景下由服务端决定，传 null */
  key: string | null;
  token: string;
  /** 上传入口。【原样使用】—— 可能是同源相对路径，也可能是完整域名 */
  url: string;
  /** 分片大小（字节）。<=0 或文件小于它时走直传 */
  chunkSize?: number;
  /** x: 开头的自定义变量（只在直传时随表单发出，与换掉之前的实现一致） */
  customVars?: Record<string, string>;
  /** 表单里的文件名 */
  fname?: string;
}

export interface QiniuUploadHandlers {
  onProgress: (loaded: number, total: number, percent: number) => void;
  onComplete: (res: QiniuResponse) => void;
  onError: (err: UploadErrorInfo) => void;
}

export interface QiniuUploadTask {
  abort(): void;
}

/**
 * 七牛接口的返回体。直传 / mkfile 回的是「业务字段」（key/hash/…，具体键由 returnBody 决定），
 * mkblk 回的是续传上下文（ctx/crc32/…）。这里只列本模块真正读的那几个，
 * 其余交给调用方从 FileUploaded 的 response 里自取 —— 加字段就往这里补一行。
 */
export interface QiniuResponse {
  /** 对象 key（直传/合并成功后返回） */
  key?: string;
  /** 分片上下文，mkblk/bput 返回，下一片要带上 */
  ctx?: string;
  /** 七牛的错误文案 */
  error?: string;
  [field: string]: unknown;
}

/** 续传缓存的形状，与换掉之前的实现逐字段一致 */
interface ResumeCache {
  ctx: string;
  percent: number;
  total: number;
  offset: number;
  time: number;
}

/** abort 时用来 reject 的内部标记，不是给调用方看的 */
interface AbortSignalError {
  __aborted: true;
}

const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * 解析一段 JSON，失败返回 null。
 * 【泛型默认是 QiniuResponse】—— 绝大多数调用点在解析七牛的返回；
 * 续传缓存那处解的是 localStorage 里我们自己写的东西，显式传 ResumeCache。
 */
function parseJson<T = QiniuResponse>(text: string): T | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 把 XHR 的失败翻成本仓既有的错误形状（调用方按 code/status 分支） */
function httpError(xhr: XMLHttpRequest): UploadErrorInfo {
  return {
    code: UploadError.HTTP_ERROR,
    status: xhr.status,
    message: xhr.statusText || 'request failed',
    // 解析失败给 undefined 而不是 null：UploadErrorInfo.response 是可选字段
    response: parseJson(xhr.responseText || '') || undefined,
  };
}

type XhrOptions = {
  headers?: Record<string, string>;
  /** 这一片在整体里的起始偏移，用于把分片内进度换算成整体进度 */
  baseLoaded?: number;
  total?: number;
  onProgress?: (loaded: number, total: number, percent: number) => void;
};

/** 发一个 POST，返回解析后的 JSON。失败时 reject 一个 UploadErrorInfo。 */
function post(
  url: string,
  body: XMLHttpRequestBodyInit,
  opts: XhrOptions,
  register: (x: XMLHttpRequest) => void,
): Promise<QiniuResponse | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open('POST', url, true);
    for (const [k, v] of Object.entries(opts.headers || {})) xhr.setRequestHeader(k, v);

    if (opts.onProgress && opts.total) {
      xhr.upload.onprogress = e => {
        if (!e.lengthComputable) return;
        const loaded = (opts.baseLoaded || 0) + e.loaded;
        opts.onProgress!(loaded, opts.total!, Math.round((loaded / opts.total!) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parseJson(xhr.responseText || '') ?? {});
      } else {
        reject(httpError(xhr));
      }
    };
    // 【status 为 0 的两种情况要分开】abort 是我们自己叫停的，不该报错给用户；
    // 其余的 0 是真的没连上（跨域被拦、断网、证书问题…）。
    xhr.onerror = () => reject({ code: UploadError.HTTP_ERROR, status: xhr.status, message: 'network error' });
    // 自己叫停的：用一个只有本模块认识的标记 reject，下面 fail() 见到它就静默
    xhr.onabort = () => reject({ __aborted: true } as AbortSignalError);

    xhr.send(body);
  });
}

export function uploadToQiniu(params: QiniuUploadParams, handlers: QiniuUploadHandlers): QiniuUploadTask {
  const { file, key, token, customVars, fname } = params;
  // 【原样使用，只去掉结尾的斜杠】相对路径（/file/mingdao/upload）与完整域名都成立
  const base = String(params.url || '').replace(/\/+$/, '');
  const chunkSize = params.chunkSize || 0;
  const auth = { Authorization: `UpToken ${token}` };

  let aborted = false;
  let current: XMLHttpRequest | null = null;
  const register = (x: XMLHttpRequest) => {
    current = x;
    if (aborted) x.abort();
  };

  // 这个函数挂在各处 .catch 上，收到的既可能是我们自己 reject 的 UploadErrorInfo，
  // 也可能是 abort 标记，还可能是运行时抛的任意异常，所以两边都标成可选。
  const fail = (err?: Partial<UploadErrorInfo> & Partial<AbortSignalError>) => {
    if (aborted || err?.__aborted) return; // 自己叫停的，不报错
    handlers.onError(
      err && err.code ? (err as UploadErrorInfo) : { code: UploadError.GENERIC_ERROR, message: String(err) },
    );
  };

  // ── 直传：一次 multipart POST ────────────────────────────────────────────
  async function direct() {
    const form = new FormData();
    form.append('token', token);
    if (key) form.append('key', key);
    for (const [k, v] of Object.entries(customVars || {})) form.append(k, v);
    // 字段名 file 与换掉之前的配置一致（plupload 的 file_data_name）
    form.append('file', file, fname || file.name);

    const res = await post(base, form, { total: file.size, onProgress: handlers.onProgress }, register);
    // 直传成功时七牛必定回一段 JSON；解析不出来就当作没返回内容，交空对象给回调，
    // 由上层的「没有 key」分支去报错（原先 res 是 any，这里本来就可能是 null）。
    handlers.onComplete(res || {});
  }

  // ── 分片：mkblk 逐片 + mkfile 收尾 ──────────────────────────────────────
  function readCache(): ResumeCache | null {
    const raw = localStorage.getItem(file.name);
    if (!raw) return null;
    const cached = parseJson<ResumeCache>(raw);
    if (!cached) return null;

    // 逐条照搬换掉之前的判据
    if (Date.now() - (cached.time || 0) >= ONE_DAY) return null;
    if (cached.percent === 100) return null; // 进度 100% 的残留会引发 499，直接丢弃
    if (cached.total !== file.size) return null; // 靠「文件名 + 大小」认定是同一个文件
    return cached;
  }

  async function chunked() {
    const cached = readCache();
    if (!cached) localStorage.removeItem(file.name);

    let offset = cached ? cached.offset : 0;
    const ctxList: string[] = cached && cached.ctx ? cached.ctx.split(',') : [];

    while (offset < file.size) {
      if (aborted) return;
      const blockSize = Math.min(chunkSize, file.size - offset);
      const blob = file.slice(offset, offset + blockSize);

      const res = await post(
        `${base}/mkblk/${blockSize}`,
        blob,
        { headers: auth, baseLoaded: offset, total: file.size, onProgress: handlers.onProgress },
        register,
      );

      if (!res || !res.ctx) {
        handlers.onError({ code: UploadError.HTTP_ERROR, status: 200, message: 'mkblk 未返回 ctx' });
        return;
      }

      ctxList.push(res.ctx);
      offset += blockSize;

      const percent = Math.round((offset / file.size) * 100);
      handlers.onProgress(offset, file.size, percent);

      // 每片成功后落一次续传点，与换掉之前的字段完全一致
      try {
        const cache: ResumeCache = { ctx: ctxList.join(','), percent, total: file.size, offset, time: Date.now() };
        safeLocalStorageSetItem(file.name, JSON.stringify(cache));
      } catch {
        /* 存不下就算了，只是丢掉续传能力，不影响本次上传 */
      }
    }

    if (aborted) return;

    // 收尾。【btoa 而不是 url-safe base64】与换掉之前的实现保持一致 ——
    // 那份在生产上跑了很久，改成 url-safe 反而是引入未经验证的差异。
    const res = await post(
      `${base}/mkfile/${file.size || 0}/key/${btoa(key || '')}`,
      ctxList.join(','),
      { headers: { ...auth, 'Content-Type': 'text/plain;charset=UTF-8' } },
      register,
    );

    // 传完就把续传点清掉，避免下次命中一个已完成的缓存
    localStorage.removeItem(file.name);
    // 同 direct()：mkfile 解析不出 JSON 时交空对象，由上层按「没有 key」报错
    handlers.onComplete(res || {});
  }

  const useChunk = chunkSize > 0 && file.size > chunkSize;
  (useChunk ? chunked() : direct()).catch(fail);

  return {
    abort() {
      aborted = true;
      if (current) current.abort();
    },
  };
}
