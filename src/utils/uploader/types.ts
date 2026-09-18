/**
 * 上传器对外的类型。形状【刻意贴着 plupload】，因为 10 个调用方的事件回调
 * 和 2 处原先直接 new plupload.Uploader 的地方都按那套写法读字段。
 * 换实现时保持形状不变，调用方才不用一起改。
 */
import type { FileStatusValue } from './constants';

/**
 * 队列里的一个文件。
 *
 * 【为什么不直接用原生 File】调用方要往上面挂一堆东西：
 * 取到的七牛凭证（token/key/serverName/fileName/url）、上传进度（percent/loaded）、
 * 状态（status）、以及 mdUploadErrorType、isFromClipBoard 这类本仓自己的标记。
 * plupload 当年就是包了一层，这里沿用 —— 原生 File 通过 getNative() 取。
 */
export interface UploaderFile {
  /** 队列内唯一 id（plupload 也有，调用方用它做 React key） */
  id: string;
  /** 文件名。注意：会被 FilesAdded 里的非法字符替换改写 */
  name: string;
  size: number;
  type?: string;
  /** 0-100 */
  percent: number;
  /** 已上传字节数 */
  loaded: number;
  status: FileStatusValue;
  /** 拿到原生 File —— 老代码里有 `file.getNative()` 的用法 */
  getNative(): File;
  /**
   * plupload 里 getSource() 返回底层的 moxie File。本仓只用它取 relativePath
   *（UploadAssistant 与 ImportExcel 的目录上传各一处），所以这里返回本对象即可。
   */
  getSource(): UploaderFile;

  // ---- 以下是本仓挂上去的，不是 plupload 的 ----
  /** 七牛上传凭证 */
  token?: string;
  /** 七牛目标 key */
  key?: string;
  serverName?: string;
  /** 服务端给的文件名（与 name 不同，name 是用户本地的） */
  fileName?: string;
  url?: string;
  /** 从剪贴板粘进来的 */
  isFromClipBoard?: boolean;
  /** 校验不通过的原因分类，见 constants 的 UPLOAD_ERROR */
  mdUploadErrorType?: number;
  /** 选中后文件已被移动/删除（size 读得到但原生 size 为 0） */
  notExists?: boolean;
  /** 目录上传时的相对路径（原生 File 上的字段） */
  webkitRelativePath?: string;
  /**
   * 目录上传时的相对路径，带前导斜杠。
   * 【为什么与 webkitRelativePath 并存】老代码是自己包一层 moxie File 时写上去的
   *（`mFile.relativePath = '/' + file.webkitRelativePath.replace(/^\//, '')`），
   * 下游按这个名字和这个格式读，所以保留原样。
   */
  relativePath?: string;
  [key: string]: any;
}

/**
 * 事件名 -> 该事件回调的参数列表。与 plupload 一致，只保留本仓真正用到的那些。
 *
 * 【为什么写成参数元组的映射，而不是一律 (...args: any[]) => any】
 * 这些事件的参数个数和类型各不相同（Error 比别人多一个已本地化的提示串，
 * FileUploaded 多一个结果对象），一律 any 的话调用方写错参数位置也不会有人拦。
 * 参数名写在元组里，编辑器补全时能直接看到「第二个参数是 files 还是 file」。
 * 各事件的实参以 createUploader.ts 里的 trigger 调用点为准。
 */
export interface UploaderEventArgs {
  Init: [up: Uploader];
  PostInit: [up: Uploader];
  Browse: [up: Uploader];
  /**
   * 第三个参数只在 h5 场景下给（`option.source === 'h5'`）：那边有压缩、加水印这类异步处理，
   * 处理完了要自己调 start() 才开始上传。其余场景 createUploader 会替你调，所以不给这个参数。
   * 见 createUploader.ts 里 FilesAdded 的转发分支。
   */
  FilesAdded: [up: Uploader, files: UploaderFile[], start?: () => void];
  FilesRemoved: [up: Uploader, files: UploaderFile[]];
  BeforeUpload: [up: Uploader, file: UploaderFile];
  UploadProgress: [up: Uploader, file: UploaderFile];
  FileUploaded: [up: Uploader, file: UploaderFile, info: { response: UploadedFileResponse }];
  UploadComplete: [up: Uploader, files: UploaderFile[]];
  StateChanged: [up: Uploader];
  /** errTip 是已经本地化好的提示串，直接可以弹给用户 */
  Error: [up: Uploader, err: UploadErrorInfo, errTip: string];
}

export type UploaderEvent = keyof UploaderEventArgs;

export type UploaderEventHandler<E extends UploaderEvent = UploaderEvent> = (...args: UploaderEventArgs[E]) => void;

/** 向取凭证接口申请一份凭证时提交的一项。 */
export interface UploadTokenRequest {
  bucket: number;
  /** 带前导点的扩展名，如 '.png' */
  ext: string;
}

/**
 * 取凭证接口（getToken）为每个文件返回的一项。
 * 字段按 createUploader.ts 里实际读取的来：uptoken/key/url/serverName/fileName/size。
 */
export interface UploadTokenInfo {
  uptoken?: string;
  key?: string;
  url?: string;
  serverName?: string;
  fileName?: string;
  size?: number;
}

/**
 * FileUploaded 回调里带的上传结果。
 * key/url 来自七牛的返回，其余几项是本仓在 finishFile 里补上去的
 *（见 createUploader.ts：fileExt/fileName/filePath/originalFileName/serverName）。
 */
export interface UploadedFileResponse {
  /* 聊天发文件时会把队列文件的 id / 名字 / 文件种类写回这个结果对象上再发出去
     （见 chat/SendToolbar），不是七牛返回的字段。 */
  id?: string;
  name?: string;
  /** 1 = 图片，2 = 其它文件（聊天消息用） */
  ft?: number;
  key?: string;
  url?: string;
  fileExt?: string;
  fileName?: string;
  filePath?: string;
  originalFileName?: string;
  serverName?: string;
}

export interface UploadErrorInfo {
  code?: number;
  message?: string;
  status?: number;
  /** HTTP 错误时后端返回体，本仓只读其中的 error 文案 */
  response?: { error?: string };
  file?: UploaderFile;
  details?: string;
}

export interface UploaderOption {
  /** 点它弹出文件选择框。可以是元素或 id */
  browse_button?: HTMLElement | string;
  /** 往它上面拖文件也能加入队列 */
  drop_element?: HTMLElement | string;
  /** 在它上面粘贴（Ctrl+V）也能加入队列。传 id */
  paste_element?: string;
  /** 允许多选，默认 true */
  multi_selection?: boolean;
  /** accept 过滤，形如 '.png,.jpg' */
  accept?: string;
  /** 后缀黑名单（小写，不带点） */
  ext_blacklist?: string[];
  /** 一次最多选多少个 */
  max_file_count?: number;
  /** 选完立刻开始上传 */
  auto_start?: boolean;
  /** 七牛上传域名 */
  url?: string;
  /** 分片大小，形如 '4mb' 或字节数；0 表示不分片 */
  chunk_size?: string | number;
  /** 单文件大小上限，形如 '100mb' */
  max_file_size?: string | number;
  /** 七牛 bucket 分类，传给取凭证接口 */
  bucket?: number;
  /** 取凭证接口的业务类型 */
  type?: number;
  /** 取凭证接口的额外参数 */
  getTokenParam?: Record<string, unknown>;
  /** 覆盖默认的取凭证实现（测试与特殊场景用） */
  getToken?: (
    /** 取凭证时【不传文件本身】，只按「bucket + 扩展名」问一份凭证，见 createUploader 的 tokenFiles */
    files: UploadTokenRequest[],
    type?: number,
    args?: Record<string, unknown>,
  ) => Promise<UploadTokenInfo[]>;
  /** 由服务端决定 key 时为 true —— 此时不把 key 放进上传参数 */
  save_key?: boolean;
  /** 需要带 x: 自定义变量时传一个对象（值本身不读，只当开关用，沿用原有语义） */
  x_vars?: unknown;
  /**
   * 上传时随表单发出的参数。createUploader 在每次 uploadOne 开头把它重填成
   * `{ token, key?, x:* }`，然后【调用方在 BeforeUpload 里改】，改完再读回来传给上传层
   *（10 个调用点都在用这条契约，见 createUploader.ts 的 uploadOne）。
   * 值一律是字符串：token/key 来自 UploaderFile，x: 那几个是 buildCustomVars 拼的。
   */
  multipart_params?: Record<string, string | undefined>;
  /** 开始上传前的检查，返回 false 或 reject 即中止 */
  before_upload_check?: (up: Uploader, files: UploaderFile[]) => unknown;
  /** 校验失败 / 超数量时回调 */
  error_callback?: (type: number, files: UploaderFile[]) => void;
  /** 因超过单文件大小被移出队列时回调 */
  remove_files_callback?: (up: Uploader, files: UploaderFile[]) => void;
  /** 事件处理器集合，键是事件名 */
  init?: { [E in UploaderEvent]?: UploaderEventHandler<E> };
  [key: string]: any;
}

export interface Uploader {
  /**
    * 当前配置。【调用方会直接改它】，例如在 BeforeUpload 里写 up.settings.multipart_params。
    * 【不再 & Record<string, any>】UploaderOption 自己就带 [key: string]: any，
    * 那个交集一个字段都没多加，纯属重复。
    */
  settings: UploaderOption;
  /** 队列 */
  files: UploaderFile[];
  /** UploaderState */
  state: number;

  init(): void;
  destroy(): void;
  start(): void;
  stop(): void;
  addFile(files: File | File[] | FileList): void;
  removeFile(file: UploaderFile | string): void;
  /** plupload 里是重新测量按钮位置；这里是空操作，保留是为了调用点不用改 */
  refresh(): void;
  disableBrowse(disable?: boolean): void;
  /** 【返回 unknown 而不是 any】取出来是什么由 key 决定，调用方该自己收窄 */
  getOption(key: string): unknown;
  setOption(key: string | Record<string, unknown>, value?: unknown): void;
  bind<E extends UploaderEvent>(event: E, handler: UploaderEventHandler<E>): void;
  unbind<E extends UploaderEvent>(event: E, handler?: UploaderEventHandler<E>): void;
  /**
   * 直接触发某个事件的所有处理器。
   * 【实参刻意标成可选】有调用方拿它当「重走一遍某个流程」用 —— 例如证书校验通过后
   * `up.trigger('Browse')`，并不会把 uploader 实参补上。这里如实反映现有用法，
   * 而不是把调用点改成传参（那会改变它们的语义）。
   */
  trigger<E extends UploaderEvent>(event: E, ...args: Partial<UploaderEventArgs[E]>): void;
}
