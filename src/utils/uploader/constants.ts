/**
 * 上传器的状态与错误码 —— 数值【与 plupload 3.1.5 逐个对齐】。
 *
 * 【为什么必须对齐而不是自己定义一套】全仓有 9 处在拿 `error.code` 跟
 * `window.plupload.FILE_SIZE_ERROR` 比较（UploadFiles、SendToolbar、
 * AttachmentFiles、ImportExcel …）。换掉 plupload 之后那个全局就没有了，
 * 这些比较必须改成引本文件的常量；数值保持一致，是为了让【改漏的地方
 * 也不会静默变错】—— 万一还有别处从别的路径拿到 code，语义仍然成立。
 *
 * 数值来自实测，不是照文档抄的：在 jsdom 里加载当时仓里的
 * src/library/plupload/plupload.full.min.js（随本次替换一并删除了），
 * 之后逐个读 window.plupload 上的常量记下来。
 */

/** 单个文件的状态（plupload: QUEUED/UPLOADING/FAILED/DONE） */
export const FileStatus = {
  QUEUED: 1,
  UPLOADING: 2,
  FAILED: 4,
  DONE: 5,
} as const;

/** 上传器整体状态（plupload: STOPPED/STARTED） */
export const UploaderState = {
  STOPPED: 1,
  STARTED: 2,
} as const;

/**
 * 错误码。负数段与 plupload 一致。
 * IMAGE_* / MEMORY_ERROR 是 plupload 图片处理运行时才会发的，本仓不做客户端图片
 * 处理，保留只为数值表完整、便于对照。
 */
export const UploadError = {
  GENERIC_ERROR: -100,
  HTTP_ERROR: -200,
  IO_ERROR: -300,
  SECURITY_ERROR: -400,
  INIT_ERROR: -500,
  FILE_SIZE_ERROR: -600,
  FILE_EXTENSION_ERROR: -601,
  FILE_DUPLICATE_ERROR: -602,
  IMAGE_FORMAT_ERROR: -700,
  MEMORY_ERROR: -701,
  IMAGE_DIMENSIONS_ERROR: -702,
} as const;

/** 本仓自己的错误分类，透传给 option.error_callback（原 createUploader 里的 UPLOAD_ERROR） */
export const UPLOAD_ERROR = {
  INVALID_FILES: 1,
  TOO_MANY_FILES: 2,
} as const;

export type FileStatusValue = (typeof FileStatus)[keyof typeof FileStatus];
export type UploadErrorValue = (typeof UploadError)[keyof typeof UploadError];
