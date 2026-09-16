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
  /** 目录上传时的相对路径 */
  webkitRelativePath?: string;
  [key: string]: any;
}

/** 事件名。与 plupload 一致，只保留本仓真正用到的那些。 */
export type UploaderEvent =
  | 'Init'
  | 'PostInit'
  | 'Browse'
  | 'FilesAdded'
  | 'FilesRemoved'
  | 'BeforeUpload'
  | 'UploadProgress'
  | 'FileUploaded'
  | 'UploadComplete'
  | 'StateChanged'
  | 'Error';

export interface UploadErrorInfo {
  code?: number;
  message?: string;
  status?: number;
  response?: any;
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
  getTokenParam?: any;
  /** 覆盖默认的取凭证实现（测试与特殊场景用） */
  getToken?: (...args: any[]) => any;
  /** 由服务端决定 key 时为 true —— 此时不把 key 放进上传参数 */
  save_key?: boolean;
  /** 需要带 x: 自定义变量时传一个对象（值本身不读，只当开关用，沿用原有语义） */
  x_vars?: any;
  /** 开始上传前的检查，返回 false 或 reject 即中止 */
  before_upload_check?: (up: Uploader, files: UploaderFile[]) => any;
  /** 校验失败 / 超数量时回调 */
  error_callback?: (type: number, files: UploaderFile[]) => void;
  /** 因超过单文件大小被移出队列时回调 */
  remove_files_callback?: (up: Uploader, files: UploaderFile[]) => void;
  /** 事件处理器集合，键是事件名 */
  init?: Partial<Record<UploaderEvent, (...args: any[]) => any>>;
  [key: string]: any;
}

export interface Uploader {
  /** 当前配置。【调用方会直接改它】，例如在 BeforeUpload 里写 up.settings.multipart_params */
  settings: UploaderOption & Record<string, any>;
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
  getOption(key: string): any;
  setOption(key: string | Record<string, any>, value?: any): void;
  bind(event: UploaderEvent, handler: (...args: any[]) => any): void;
  unbind(event: UploaderEvent, handler?: (...args: any[]) => any): void;
  trigger(event: UploaderEvent, ...args: any[]): void;
}
