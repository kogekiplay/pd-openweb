export class RequestProtocolError extends TypeError {}

/** Only transport and cache metadata are typed here; endpoint payloads remain unknown. */
export interface RequestData {
  // A generic transport forwards endpoint-specific values. These names participate in cache keys,
  // but their endpoint-level constraints belong to each API wrapper rather than this shared layer.
  worksheetId?: unknown;
  workSheetId?: unknown;
  sourceId?: unknown;
  appId?: unknown;
  appLangId?: unknown;
  projectId?: unknown;
  langId?: unknown;
  targetLangId?: unknown;
  type?: unknown;
  correlationIds?: unknown;
  [key: string]: unknown;
}

export interface LocalizationParams {
  moduleType: number;
  sourceId: string;
  clearInterface: string[];
}
export interface LocalizationKey {
  key?: string | undefined;
  moduleType?: number | undefined;
  sourceId?: string | undefined;
  clearInterface?: string[] | undefined;
}
export interface CacheEnvelope {
  version?: string | undefined;
  data: unknown;
  time: string | null;
}
interface ApiEnvelopeMetadata {
  state?: number | undefined;
  exception?: string | null | undefined;
}
export interface PlainApiEnvelope extends ApiEnvelopeMetadata {
  data?: unknown;
  key?: string | undefined;
  encrypted?: false | undefined;
}
export interface EncryptedApiEnvelope extends ApiEnvelopeMetadata {
  data: string;
  key: string;
  encrypted: true;
}
export type StandardApiEnvelope = PlainApiEnvelope | EncryptedApiEnvelope;
export interface HttpFailure {
  status?: number | undefined;
  data?: unknown;
  responseJSON?: { exception?: string | undefined } | undefined;
}
export interface RequestFailure {
  response?: HttpFailure | undefined;
}
export interface AbortablePromise<T> extends Promise<T> {
  abort(): void;
}
export interface RequestHeaders {
  Authorization: string;
  AccountId?: string | undefined;
  'X-Requested-With': string;
  clientId?: string | null | undefined;
  shareAuthor?: string | undefined;
  'x-nonce'?: string | undefined;
  [name: string]: string | null | undefined;
}
function isStandardEnvelope(value: unknown): value is StandardApiEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if ('state' in value && value.state !== undefined && typeof value.state !== 'number') return false;
  if (
    'exception' in value &&
    value.exception !== undefined &&
    value.exception !== null &&
    typeof value.exception !== 'string'
  )
    return false;
  if ('encrypted' in value && value.encrypted !== undefined && typeof value.encrypted !== 'boolean') return false;
  if ('key' in value && value.key !== undefined && typeof value.key !== 'string') return false;
  if (
    'encrypted' in value &&
    value.encrypted === true &&
    (!('key' in value) || typeof value.key !== 'string' || !('data' in value) || typeof value.data !== 'string')
  )
    return false;
  return true;
}
export function parseStandardEnvelope(value: unknown): StandardApiEnvelope {
  if (!isStandardEnvelope(value)) throw new RequestProtocolError('Invalid API response envelope');
  return value;
}
export function parseRequestFailure(value: unknown): RequestFailure {
  if (!value || typeof value !== 'object' || !('response' in value)) return {};
  const response = value.response;
  if (!response || typeof response !== 'object' || Array.isArray(response)) return {};
  if ('status' in response && response.status !== undefined && typeof response.status !== 'number') return {};
  return { response };
}
export function readErrorEnvelope(value: unknown): {
  state?: number | undefined;
  exception?: string | undefined;
  errorMessage?: string | undefined;
  data?: unknown;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return {
    state: 'state' in value && typeof value.state === 'number' ? value.state : undefined,
    exception: 'exception' in value && typeof value.exception === 'string' ? value.exception : undefined,
    errorMessage: 'errorMessage' in value && typeof value.errorMessage === 'string' ? value.errorMessage : undefined,
    data: 'data' in value ? value.data : undefined,
  };
}
function isCacheEnvelope(value: unknown): value is CacheEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('data' in value) || !('time' in value))
    return false;
  if (value.time !== null && typeof value.time !== 'string') return false;
  if ('version' in value && value.version !== undefined && typeof value.version !== 'string') return false;
  return true;
}
export function parseCacheEnvelope(value: unknown): CacheEnvelope | null {
  if (value === null) return null;
  if (!isCacheEnvelope(value)) throw new RequestProtocolError('Invalid API localization cache');
  return value;
}
/** Keep WebIDL's string conversion of header values, including the legacy undefined entries. */
export function fetchRequestHeaders(headers: RequestHeaders): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, String(value)]));
}
