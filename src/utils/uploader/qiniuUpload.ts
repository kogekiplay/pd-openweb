/**
 * 把一个文件传到七牛 —— 这一层现在交给 qiniu-js（七牛官方浏览器 SDK，TypeScript）。
 *
 * 【原来是怎么做的】老实现是【手工在 plupload 的通用分片之上实现七牛的
 * mkblk/mkfile 断点续传协议】：
 *   BeforeUpload   把 url 改成 `.../mkblk/<blockSize>`、塞 Authorization: UpToken
 *   ChunkUploaded  累积每片返回的 ctx、改写下一片的 mkblk URL、写 localStorage
 *   FileUploaded   拿累积的 ctx 发 `.../mkfile/<size>/key/<base64>` 收尾
 * 一共约 150 行协议代码，还带一个自己维护的 localStorage 续传缓存。
 * qiniu-js 把这一整套做在内部（而且是官方实现、还支持 v2 分片），所以这里只剩
 * 参数映射。
 *
 * 【保留下来的行为】
 * · 小于一个分片的文件直传（对应老代码的 directUpload）—— 用 forceDirect。
 * · 自定义变量 x:serverName / x:filePath / x:fileName / x:originalFileName / x:fileExt
 *   —— qiniu-js 的 putExtra.customVars 就是干这个的，键名要带 `x:` 前缀。
 * · 上传域名沿用 md.global.FileStoreConfig.uploadHost（option.url）。
 */
import * as qiniu from 'qiniu-js';
import { UploadError } from './constants';
import type { UploadErrorInfo } from './types';

export interface QiniuUploadParams {
  file: File;
  /** 七牛目标 key；save_key 场景下由服务端决定，传 null */
  key: string | null;
  token: string;
  /** 上传域名，来自 option.url */
  uphost?: string;
  /** 分片大小（字节）。0 或小于文件大小以外的情况见下面的 forceDirect 判断 */
  chunkSize?: number;
  /** x: 开头的自定义变量 */
  customVars?: Record<string, string>;
  /** 原始文件名，走 putExtra.fname */
  fname?: string;
}

export interface QiniuUploadHandlers {
  onProgress: (loaded: number, total: number, percent: number) => void;
  onComplete: (res: any) => void;
  onError: (err: UploadErrorInfo) => void;
}

export interface QiniuUploadTask {
  abort(): void;
}

/**
 * 把 qiniu-js 的错误翻成本仓既有的错误形状。
 *
 * 【为什么要翻】调用方的 Error 回调一直按 `{ code, message, status, response }` 读，
 * 其中 code 会跟 UploadError.* 比较（原来是 window.plupload.*）。
 * 直接把 QiniuError 抛给它们，那些分支会全部落到 default。
 */
export function toUploadErrorInfo(err: any): UploadErrorInfo {
  // QiniuRequestError / QiniuNetworkError 带 HTTP code
  if (err && typeof err.code === 'number') {
    return {
      code: UploadError.HTTP_ERROR,
      status: err.code,
      message: err.message,
      response: err.data,
    };
  }

  // 其余按 QiniuErrorName 归类。只翻本仓的 Error 分支认得出来的几类，
  // 其它一律 GENERIC_ERROR —— 与其编一个精确映射，不如让消息原样透出去。
  const name = err && err.name;
  if (name === qiniu.QiniuErrorName.InvalidFile || name === qiniu.QiniuErrorName.UnsupportedFileType) {
    return { code: UploadError.FILE_EXTENSION_ERROR, message: err.message };
  }
  if (name === qiniu.QiniuErrorName.InvalidToken) {
    return { code: UploadError.SECURITY_ERROR, message: err.message };
  }
  if (name === qiniu.QiniuErrorName.NotAvailableUploadHost) {
    return { code: UploadError.INIT_ERROR, message: err.message };
  }
  return { code: UploadError.GENERIC_ERROR, message: (err && err.message) || String(err) };
}

/** 从 option.url 里取出 qiniu-js 要的 uphost（它要的是域名，不含协议后的路径） */
export function normalizeUpHost(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/+$/, '');
}

export function uploadToQiniu(params: QiniuUploadParams, handlers: QiniuUploadHandlers): QiniuUploadTask {
  const { file, key, token, uphost, chunkSize, customVars, fname } = params;

  // qiniu-js 的 chunkSize 单位是 MB，本仓的 option.chunk_size 是字节
  const chunkSizeMb = chunkSize && chunkSize > 0 ? Math.max(1, Math.round(chunkSize / (1024 * 1024))) : undefined;

  // 【小文件直传】老实现里 `file.size <= chunkSize` 走 directUpload（一次 multipart POST）。
  // qiniu-js 用 forceDirect 表达同一件事。
  const forceDirect = !!(chunkSize && chunkSize > 0 && file.size <= chunkSize);

  const observable = qiniu.upload(
    file,
    key,
    token,
    {
      fname: fname || file.name,
      ...(customVars && Object.keys(customVars).length ? { customVars } : {}),
    },
    {
      ...(uphost ? { uphost } : {}),
      ...(chunkSizeMb ? { chunkSize: chunkSizeMb } : {}),
      forceDirect,
    },
  );

  const subscription = observable.subscribe({
    next(progress) {
      const total = progress && progress.total;
      if (!total) return;
      handlers.onProgress(total.loaded, total.size, total.percent);
    },
    error(err) {
      handlers.onError(toUploadErrorInfo(err));
    },
    complete(res) {
      handlers.onComplete(res);
    },
  });

  return {
    abort() {
      subscription.unsubscribe();
    },
  };
}
