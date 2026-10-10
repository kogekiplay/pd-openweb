export type ResponseDecoder<Value> = (value: unknown) => Value;
export interface TokenRequestArgs {
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  appId?: string | undefined;
  projectId?: string | undefined;
  tokenType?: number | undefined;
  extend?: string | undefined;
  [metadata: string]: unknown;
}
export interface TokenHttpOptions {
  responseType?: XMLHttpRequestResponseType | undefined;
}
export type RequestBody = Record<string, unknown>;
export type FilledRequestParams<Params extends object> =
  Params | (Omit<Params, 'requestParams'> & { requestParams: Record<string, unknown> });
export interface LocalPushData {
  enableTip?: boolean | undefined;
  tipText?: string | undefined;
  triggerBtnId?: string | undefined;
  [metadata: string]: unknown;
}
export interface FileTokenRequest {
  bucket: number;
  ext: string;
}
export interface FileTokenInfo {
  uptoken?: string | undefined;
  key?: string | undefined;
  url?: string | undefined;
  serverName?: string | undefined;
  fileName?: string | undefined;
  size?: number | undefined;
  [metadata: string]: unknown;
}
export interface Base64FileToken extends FileTokenInfo {
  uptoken: string;
  key: string;
}
export interface ReadyFileToken extends Base64FileToken {
  serverName: string;
  fileName: string;
}
export interface ServerFileToken extends FileTokenInfo {
  serverName: string;
}
export interface FileTokenFailure {
  error: string;
  [metadata: string]: unknown;
}
export type FileTokenResult = FileTokenInfo[] | FileTokenFailure;
export interface FileTokenOptions {
  silent?: boolean;
  abortController?: AbortController;
  ajaxOptions?: { timeout?: number; header?: Record<string, string>; [metadata: string]: unknown };
  [metadata: string]: unknown;
}
export type AbortableRequest<Value> = Promise<Value> & { abort(): void; [metadata: string]: unknown };
export type DownloadBlob = Blob & { name?: string | undefined };
export interface TemporaryAttachmentArgs {
  fileUrl?: string | undefined;
  fileName?: string | undefined;
  fileSize?: number | undefined;
  fileExt?: string | undefined;
}
export interface TemporaryAttachment {
  fileID: string;
  fileSize: number;
  serverName: string;
  filePath: string;
  fileName: string;
  fileExt: string | undefined;
  originalFileName: string;
  key: string;
  oldOriginalFileName: string;
  url: string | undefined;
}
export interface ImportPreviewCell {
  controlId: string;
  value?: unknown;
  [metadata: string]: unknown;
}
export interface ImportPreviewHandledRow {
  rowIndex: string | number;
  cells: ImportPreviewCell[];
  [metadata: string]: unknown;
}
export interface ImportPreviewRow {
  cells: unknown[];
  [metadata: string]: unknown;
}
export interface ImportPreviewSheet {
  name?: string | undefined;
  value?: number | undefined;
  [metadata: string]: unknown;
}
export interface ImportPreview {
  rows?: ImportPreviewRow[] | undefined;
  sheets?: ImportPreviewSheet[] | undefined;
  [metadata: string]: unknown;
}

export interface ImportPreviewEntity {
  id?: string | undefined;
  name?: string | undefined;
  avatarUrl?: string | undefined;
  [metadata: string]: unknown;
}
