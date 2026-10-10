import type {
  Base64FileToken,
  DownloadBlob,
  FileTokenInfo,
  FileTokenRequest,
  FileTokenResult,
  ImportPreview,
  ImportPreviewCell,
  ImportPreviewEntity,
  ImportPreviewHandledRow,
  ImportPreviewRow,
  ImportPreviewSheet,
  LocalPushData,
  ReadyFileToken,
  ServerFileToken,
  TemporaryAttachmentArgs,
} from './commonRequestTypes';

export function requestObject(value: unknown): Record<string, unknown> | undefined {
  return isRequestObject(value) ? value : undefined;
}
function isRequestObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
function optionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}
export function decodeAuthToken(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new TypeError('Invalid request token');
  return value;
}
function isLocalPushData(value: unknown): value is LocalPushData {
  const data = requestObject(value);
  return (
    !!data &&
    (data['enableTip'] === undefined || typeof data['enableTip'] === 'boolean') &&
    optionalString(data['tipText']) &&
    optionalString(data['triggerBtnId'])
  );
}
export function decodeLocalPushData(value: unknown): LocalPushData {
  if (!isLocalPushData(value)) throw new TypeError('Invalid local push metadata');
  return value;
}

function isFileToken(value: unknown): value is FileTokenInfo {
  const token = requestObject(value);
  return (
    !!token &&
    ['uptoken', 'key', 'url', 'serverName', 'fileName'].every(key => optionalString(token[key])) &&
    optionalNumber(token['size'])
  );
}
function isFileTokens(value: unknown): value is FileTokenInfo[] {
  return Array.isArray(value) && Array.from(value).every((token: unknown) => isFileToken(token));
}
function isFileTokenFailure(value: unknown): value is { error: string; [metadata: string]: unknown } {
  const response = requestObject(value);
  return !!response && typeof response['error'] === 'string';
}
export function decodeFileTokens(value: unknown): FileTokenResult {
  if (isFileTokens(value)) return value;
  if (isFileTokenFailure(value)) return value;
  throw new TypeError('Invalid upload token response');
}
function isReadyFileToken(value: FileTokenInfo): value is ReadyFileToken {
  return (
    typeof value.uptoken === 'string' &&
    typeof value.key === 'string' &&
    typeof value.serverName === 'string' &&
    typeof value.fileName === 'string'
  );
}
function fileTokenAt(value: unknown, index: number): FileTokenInfo {
  const response = decodeFileTokens(value);
  if (!Array.isArray(response)) throw new Error(response.error);
  const token = response[index];
  if (!token) throw new TypeError('Missing upload token fields');
  return token;
}
function isBase64FileToken(value: FileTokenInfo): value is Base64FileToken {
  return typeof value.uptoken === 'string' && typeof value.key === 'string';
}
function isServerFileToken(value: FileTokenInfo): value is ServerFileToken {
  return typeof value.serverName === 'string';
}
export function requireBase64FileToken(value: unknown, index = 0): Base64FileToken {
  const token = fileTokenAt(value, index);
  if (!isBase64FileToken(token)) throw new TypeError('Missing upload token fields');
  return token;
}
export function requireServerFileToken(value: unknown, index = 0): ServerFileToken {
  const token = fileTokenAt(value, index);
  if (!isServerFileToken(token)) throw new TypeError('Missing upload token fields');
  return token;
}
export function requireFileToken(value: unknown, index = 0): ReadyFileToken {
  const token = fileTokenAt(value, index);
  if (!isReadyFileToken(token)) throw new TypeError('Missing upload token fields');
  return token;
}
export function validateFileTokenRequests(value: FileTokenRequest[]): void {
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(file => {
      const item = requestObject(file);
      return (
        !!item &&
        typeof item['bucket'] === 'number' &&
        Number.isFinite(item['bucket']) &&
        typeof item['ext'] === 'string'
      );
    })
  )
    throw new TypeError('Invalid upload token files');
}
function isDownloadBlob(value: unknown): value is DownloadBlob {
  if (!(value instanceof Blob)) return false;
  const name: unknown = Reflect.get(value, 'name');
  return name === undefined || typeof name === 'string';
}
export function decodeDownloadBlob(value: unknown): DownloadBlob {
  if (!isDownloadBlob(value)) throw new TypeError('Invalid download blob');
  return value;
}
export function validateTemporaryAttachment(value: TemporaryAttachmentArgs): void {
  if (
    !isRequestObject(value) ||
    !['fileUrl', 'fileName', 'fileExt'].every(key => optionalString(value[key])) ||
    !optionalNumber(value['fileSize'])
  )
    throw new TypeError('Invalid temporary attachment parameters');
}
function isPreviewCell(value: unknown): value is ImportPreviewCell {
  const cell = requestObject(value);
  return !!cell && typeof cell['controlId'] === 'string';
}
function isHandledRow(value: unknown): value is ImportPreviewHandledRow {
  const row = requestObject(value);
  return (
    !!row &&
    (typeof row['rowIndex'] === 'string' ||
      (typeof row['rowIndex'] === 'number' && Number.isFinite(row['rowIndex']))) &&
    Array.isArray(row['cells']) &&
    Array.from(row['cells']).every(isPreviewCell)
  );
}
export function decodeHandledPreview(value: unknown): ImportPreviewHandledRow[] {
  if (!Array.isArray(value) || !Array.from(value).every(isHandledRow))
    throw new TypeError('Invalid handled import preview');
  return value;
}
function isPreviewRow(value: unknown): value is ImportPreviewRow {
  const row = requestObject(value);
  return !!row && Array.isArray(row['cells']);
}
function isPreviewSheet(value: unknown): value is ImportPreviewSheet {
  const sheet = requestObject(value);
  return !!sheet && optionalString(sheet['name']) && optionalNumber(sheet['value']);
}
function isImportPreview(value: unknown): value is ImportPreview {
  const result = requestObject(value);
  if (!result) return false;
  const rows: unknown = result['rows'];
  const sheets: unknown = result['sheets'];
  return (
    (rows === undefined || (Array.isArray(rows) && Array.from(rows).every((row: unknown) => isPreviewRow(row)))) &&
    (sheets === undefined ||
      (Array.isArray(sheets) && Array.from(sheets).every((sheet: unknown) => isPreviewSheet(sheet))))
  );
}
export function decodeImportPreview(value: unknown): ImportPreview {
  if (!isImportPreview(value)) throw new TypeError('Invalid import preview');
  return value;
}

function isImportPreviewEntity(value: unknown): value is ImportPreviewEntity {
  const entity = requestObject(value);
  return !!entity && ['id', 'name', 'avatarUrl'].every(key => optionalString(entity[key]));
}
export function decodeImportPreviewEntities(value: unknown): ImportPreviewEntity[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || !Array.from(parsed).every((item: unknown) => isImportPreviewEntity(item)))
    throw new TypeError('Invalid import preview entities');
  return parsed;
}
