import type { FormControl } from 'src/utils/controlTypes';

/** Opaque backend extensions are retained alongside the fields this component actually consumes. */
export type ShareCardIcon = string | 0 | false | null | undefined;
export interface ShareCardValue {
  title?: string | undefined;
  desc?: string | undefined;
  icon?: ShareCardIcon;
  iconUrl?: ShareCardIcon;
  [extension: string]: unknown;
  [extension: symbol]: unknown;
}
export type ShareCardPatch = Partial<Record<'title' | 'desc' | 'icon' | 'iconUrl', string | undefined>>;
export interface ShareCardHandle {
  shareConfigValue: ShareCardValue;
  onSave(info: ShareCardValue, shareCardId: string): void;
}
export interface ShareWorksheetInfo {
  appId?: string | undefined;
  groupId?: string | undefined;
  projectId?: string | undefined;
  worksheetId?: string | undefined;
  worksheetName?: string | undefined;
  name?: string | undefined;
}
export interface ShareCardSetProps {
  worksheetInfo?: ShareWorksheetInfo | undefined;
  controls?: FormControl[] | undefined;
  worksheetId?: string | undefined;
  appId?: string | undefined;
  type?: number | undefined;
  showTips?: boolean | undefined;
  showBaseImg?: boolean | undefined;
  canUseControl?: boolean | undefined;
  autoSave?: boolean | undefined;
  defaultValue?: Pick<ShareCardValue, 'title' | 'desc'> | undefined;
  titleTxt?: string | undefined;
  titlePlaceholder?: string | undefined;
  desTxt?: string | undefined;
  desPlaceholder?: string | undefined;
  handleSettingChanged?: (() => void) | undefined;
}
export interface ShareInputProps {
  className?: string | undefined;
  canUseControl?: boolean | undefined;
  controls?: FormControl[] | undefined;
  defaultValue?: string | undefined;
  onChangeValue: (value: string | undefined) => void;
  worksheetInfo?: ShareWorksheetInfo | undefined;
  placeholder?: string | undefined;
}

function property(value: unknown, key: PropertyKey): unknown {
  // Keep native primitive receivers and null/undefined errors; object spread alone boxes/skips them.
  if (value === null || value === undefined) return (value as never)[key];
  return Reflect.get(Object(value), key, value);
}

function validateSnapshot(value: object): asserts value is ShareCardValue {
  for (const key of ['title', 'desc', 'icon', 'iconUrl']) {
    if (!Object.hasOwn(value, key)) continue;
    const field = property(value, key);
    if (field === undefined || typeof field === 'string') continue;
    // Legacy falsy icon sentinels keep their original truthiness; current writers still produce text/undefined.
    if ((key === 'icon' || key === 'iconUrl') && (field === null || field === false || field === 0)) continue;
    throw new TypeError(`Invalid share card field: ${key}`);
  }
}

export function loadedShareCard(raw: unknown, fallback: { title: () => string; desc: () => string }): ShareCardValue {
  const snapshot: object = {
    ...Object(raw),
    title: property(raw, 'title') || fallback.title(),
    desc: property(raw, 'desc') || fallback.desc(),
  };
  // Validate the copy after all original spread/title/description reads; do not reread source getters.
  validateSnapshot(snapshot);
  return snapshot;
}

export function shareCardIconText(value: ShareCardIcon): string {
  if (typeof value === 'string') return value;
  throw new TypeError('Invalid share card icon text');
}

/** getDynamicValue's type-2 producer joins text; do not cast its wider public return type or stringify objects. */
export function shareCardDynamicText(value: unknown): string {
  if (typeof value === 'string') return value;
  throw new TypeError('Invalid share card dynamic text');
}
