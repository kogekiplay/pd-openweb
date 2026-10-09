/** Storage contains numeric preferences or already serialized JSON, never a decoded style object. */
export interface WorksheetConfigValues {
  WORKSHEET_VIEW_PAGESIZE: number | string;
  WORKSHEET_VIEW_COLUMN_FROZON: number | string;
  SHEET_LAYOUT_UPDATE_TIME: number | string;
  WORKSHEET_VIEW_COLUMN_WIDTH: string;
  WORKSHEET_VIEW_COLUMN_STYLES: string;
  WORKSHEET_VIEW_SUMMARY_TYPES: string;
  GROUPED_WORKSHEET_VIEW_SUMMARY_TYPES: string;
}
export type WorksheetConfigKey = keyof WorksheetConfigValues;
export type WorksheetConfigWriteArgs = {
  [Key in WorksheetConfigKey]: [key: Key, id: string | undefined, value: WorksheetConfigValues[Key]];
}[WorksheetConfigKey];
function isConfigRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function numericPreference(value: unknown): number | string | undefined {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : undefined;
}
function serializedPreference(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
const decoders: { [Key in WorksheetConfigKey]: (value: unknown) => WorksheetConfigValues[Key] | undefined } = {
  WORKSHEET_VIEW_PAGESIZE: numericPreference,
  WORKSHEET_VIEW_COLUMN_FROZON: numericPreference,
  SHEET_LAYOUT_UPDATE_TIME: numericPreference,
  WORKSHEET_VIEW_COLUMN_WIDTH: serializedPreference,
  WORKSHEET_VIEW_COLUMN_STYLES: serializedPreference,
  WORKSHEET_VIEW_SUMMARY_TYPES: serializedPreference,
  GROUPED_WORKSHEET_VIEW_SUMMARY_TYPES: serializedPreference,
};
export function decodeWorksheetConfigCache<Key extends WorksheetConfigKey>(
  key: Key,
  serialized: string | null,
): Record<string, WorksheetConfigValues[Key]> {
  if (!serialized) return {};
  const value: unknown = JSON.parse(serialized);
  if (!isConfigRecord(value)) return {};
  const cache: Record<string, WorksheetConfigValues[Key]> = {};
  for (const [id, entry] of Object.entries(value)) {
    const decoded = decoders[key](entry);
    if (decoded === undefined) continue;
    Object.defineProperty(cache, id, { value: decoded, enumerable: true, writable: true, configurable: true });
  }
  return cache;
}
export function validateWorksheetConfigValue<Key extends WorksheetConfigKey>(
  key: Key,
  value: unknown,
): WorksheetConfigValues[Key] {
  const decoded = decoders[key](value);
  if (decoded === undefined) throw new TypeError('Invalid worksheet configuration cache value');
  return decoded;
}
