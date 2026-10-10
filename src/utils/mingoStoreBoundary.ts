import EventEmitter from 'events';
import type { MingoGlobalStore, MingoStoreKey, MingoWidget, MingoWorksheetContext } from './mingoStoreTypes';

const metadataStringKeys = [
  'appId',
  'appName',
  'worksheetId',
  'worksheetName',
  'projectId',
  'sectionId',
  'appDescription',
];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function optionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  throw new TypeError('Mingo metadata must be a string');
}
function isWidget(value: unknown): value is MingoWidget {
  if (!object(value)) return false;
  for (const key of ['controlId', 'alias', 'controlName', 'description'])
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  return value['type'] === undefined || (typeof value['type'] === 'number' && Number.isFinite(value['type']));
}
function widgets(value: unknown): MingoWidget[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !Array.from(value).every(isWidget)) throw new TypeError('Invalid Mingo widget context');
  return value;
}
function activeModule(value: unknown): MingoGlobalStore['activeModule'] {
  if (value === undefined) return undefined;
  if (value === 'worksheet' || value === 'worksheetControlsEdit' || value === 'workflow') return value;
  throw new TypeError('Invalid Mingo active module');
}
function emitter(value: unknown): MingoGlobalStore['emitter'] {
  if (value === undefined) return undefined;
  if (value instanceof EventEmitter) return value;
  throw new TypeError('Invalid Mingo emitter');
}
export function isMingoStoreKey(key: string): key is MingoStoreKey {
  return key === 'activeModule' || key === 'allWidgets' || key === 'emitter' || metadataStringKeys.includes(key);
}
export function mingoWidgets(value: unknown): MingoWidget[] | undefined {
  return widgets(value);
}
export function mingoString(value: unknown): string | undefined {
  return optionalString(value);
}
export function mingoObject(value: unknown): Record<string, unknown> | undefined {
  return object(value) ? value : undefined;
}
function worksheetContext(value: unknown): value is MingoWorksheetContext {
  if (!object(value)) return false;
  for (const key of ['workSheetId', 'workSheetName', 'remark'])
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  return value['type'] === undefined || typeof value['type'] === 'number';
}
export function mingoWorksheets(value: unknown): MingoWorksheetContext[] {
  if (!Array.isArray(value) || !Array.from(value).every(worksheetContext))
    throw new TypeError('Invalid Mingo worksheet context');
  return value;
}
/** Validate only known fields. Unknown future metadata and widget extras keep their identity. */
export function validateMingoStoreValue(key: string, value: unknown): void {
  if (metadataStringKeys.includes(key)) optionalString(value);
  else if (key === 'activeModule') activeModule(value);
  else if (key === 'allWidgets') widgets(value);
  else if (key === 'emitter') emitter(value);
}
export function mingoStorePatch(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new TypeError('Mingo store patch must be an object');
  for (const key of Object.keys(value)) validateMingoStoreValue(key, value[key]);
  return value;
}
export function writeMingoStoreValue(store: MingoGlobalStore, key: string, value: unknown): void {
  switch (key) {
    case 'activeModule':
      store.activeModule = activeModule(value);
      break;
    case 'allWidgets':
      store.allWidgets = widgets(value);
      break;
    case 'emitter':
      store.emitter = emitter(value);
      break;
    case 'appId':
    case 'appName':
    case 'worksheetId':
    case 'worksheetName':
    case 'projectId':
    case 'sectionId':
    case 'appDescription':
      store[key] = optionalString(value);
      break;
    default:
      Object.defineProperty(store, key, { value, writable: true, configurable: true, enumerable: true });
  }
}
