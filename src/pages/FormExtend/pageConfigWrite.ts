import _ from 'lodash';
import { readPageProperty } from './pageConfig';

/** Current producers write numeric layout/preset keys, text URLs/colors and boolean QR flags. */
export interface PublicPageConfigPatch {
  layout?: number | null | undefined;
  themeColor?: number | null | undefined;
  themeBgColor?: string | null | undefined;
  cover?: string | null | undefined;
  showQrcode?: boolean | null | undefined;
}

export type PublicPageConfigUpdate = { pageConfigs: string };

function editableList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  throw new TypeError('Invalid public page configuration list');
}

function spreadProperties(value: unknown): object {
  // Object spread boxes primitives and skips null/undefined. It also preserves own symbol/prototype-named keys.
  return { ...Object(value) };
}

function validatePatch(value: object): void {
  for (const key of ['layout', 'themeColor', 'themeBgColor', 'cover', 'showQrcode']) {
    if (!Object.hasOwn(value, key)) continue;
    const field = readPageProperty(value, key);
    if (field === null || field === undefined) continue;
    const kind = key === 'layout' || key === 'themeColor' ? 'number' : key === 'showQrcode' ? 'boolean' : 'string';
    if (typeof field !== kind) throw new TypeError(`Invalid public page configuration write field: ${key}`);
  }
}

function serializedUpdate(value: unknown): PublicPageConfigUpdate {
  const encoded: unknown = JSON.stringify(value);
  // Native JSON.stringify produces valid JSON. Only an array encoding starts with '[';
  // a custom root toJSON must not turn the configuration list into a scalar/object or undefined.
  if (typeof encoded === 'string' && encoded.startsWith('[')) return { pageConfigs: encoded };
  throw new TypeError('Invalid public page configuration serialization');
}

export function changePageConfig(value: unknown, key: string, patch: PublicPageConfigPatch): PublicPageConfigUpdate {
  const list = editableList(value);
  const index = _.findIndex(list, item => readPageProperty(item, 'key') === key);
  // Evaluate the target before source getters, as the original computed assignment did.
  const target = index < 0 ? list.length : index;
  const previous = spreadProperties(list[index < 0 ? 0 : index]);
  const changes = spreadProperties(patch);
  // Validate the copied values: raw patch getters were read once, in their original spread order.
  validatePatch(changes);
  list[target] = { ...previous, ...changes, key };
  return serializedUpdate(list);
}

export function removePageConfig(value: unknown, key: string): PublicPageConfigUpdate {
  const list = editableList(value);
  const result: unknown = list.filter(item => readPageProperty(item, 'key') !== key);
  return serializedUpdate(result);
}

export function appendPageConfig(value: unknown, key: string): PublicPageConfigUpdate {
  const list = editableList(value);
  // Keep first-entry getters inside the native concat argument evaluation.
  const result: unknown = list.concat({ ...spreadProperties(list[0]), key });
  return serializedUpdate(result);
}
