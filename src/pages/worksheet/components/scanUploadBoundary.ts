import type { TemporaryAttachmentArgs } from 'src/utils/commonRequestTypes';

export interface ScanSourceAttachment extends TemporaryAttachmentArgs {
  fileUrl: string;
}

export function scanRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isScanAttachment(value: unknown): value is ScanSourceAttachment {
  const item = scanRecord(value);
  return (
    !!item &&
    validUrl(item['fileUrl']) &&
    ['fileName', 'fileExt'].every(key => item[key] === undefined || typeof item[key] === 'string') &&
    (item['fileSize'] === undefined || (typeof item['fileSize'] === 'number' && Number.isFinite(item['fileSize'])))
  );
}

function isAttachmentArray(value: unknown): value is ScanSourceAttachment[] {
  return Array.isArray(value) && Array.from(value).every(isScanAttachment);
}

export function decodeScanResponse(value: unknown): { status: number; attachments: ScanSourceAttachment[] } {
  const record = scanRecord(value);
  if (!record || typeof record['status'] !== 'number' || !Number.isFinite(record['status']))
    throw new TypeError('Invalid scan attachment status');
  const details: unknown = record['attachmentScanSimpleDetail'];
  if (details === undefined) return { status: record['status'], attachments: [] };
  if (!isAttachmentArray(details)) throw new TypeError('Invalid scan attachments');
  return { status: record['status'], attachments: details };
}

export function decodeScanId(value: unknown): string {
  const url = scanRecord(value)?.['scanUrl'];
  const id = validUrl(url) ? url.match(/\/(\w{16})$/)?.[1] : undefined;
  if (!id) throw new TypeError('Invalid attachment scan URL');
  return id;
}

export function scanFlags(value: unknown): { fromIsDraft: boolean; fromIsWorkflow: boolean } {
  const base = scanRecord(scanRecord(value)?.['recordBaseInfo']);
  return { fromIsDraft: base?.['fromIsDraft'] === true, fromIsWorkflow: base?.['fromIsWorkflow'] === true };
}
