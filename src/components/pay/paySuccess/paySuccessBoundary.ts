/** Only the fields rendered by the payment result page belong to this boundary. */
export interface PaySuccessResult {
  orderType?: number | undefined;
  unLimited?: boolean | undefined;
  totalUserCount?: number | undefined;
  projectId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  totalPrice?: number | string | undefined;
  version?: { name?: string | undefined } | undefined;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
function optionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}
function result(value: unknown): value is PaySuccessResult {
  if (!record(value)) return false;
  const version = value['version'];
  return (
    ['orderType', 'totalUserCount'].every(key => optionalNumber(value[key])) &&
    (value['unLimited'] === undefined || typeof value['unLimited'] === 'boolean') &&
    ['projectId', 'startDate', 'endDate'].every(key => optionalString(value[key])) &&
    (optionalString(value['totalPrice']) || optionalNumber(value['totalPrice'])) &&
    (version === undefined || (record(version) && optionalString(version['name'])))
  );
}

/** Invalid responses follow the page's existing load-failure path. Valid objects keep their identity. */
export function decodePaySuccessResult(value: unknown): PaySuccessResult | undefined {
  return result(value) ? value : undefined;
}
