import { themes } from './enum';

/** Read-only access at the legacy JavaScript boundary, including primitive boxing and native null errors. */
export function readPageProperty(value: unknown, key: PropertyKey): unknown {
  // This access never returns normally. Keep the native error in both compiler modes.
  if (value === null || value === undefined) return (value as never)[key];
  return Reflect.get(Object(value), key, value);
}

/** Legacy scalar indices and flags retain native lookup, strict-equality and truthiness semantics. */
export type PageConfigScalar = string | number | boolean | null | undefined;
export interface PublicPageConfig {
  readonly key: string | null | undefined;
  readonly layout: PageConfigScalar;
  readonly themeColor: PageConfigScalar;
  readonly themeBgColor: string | null | undefined;
  readonly cover: string | null | undefined;
  readonly showQrcode: PageConfigScalar;
}

function invalidField(key: PropertyKey): never {
  throw new TypeError(`Invalid public page configuration field: ${String(key)}`);
}

function readText(value: unknown, key: PropertyKey): string | null | undefined {
  const field = readPageProperty(value, key);
  if (field === null) return null;
  if (field === undefined) return undefined;
  if (typeof field === 'string') return field;
  return invalidField(key);
}

function readIndex(value: unknown, key: PropertyKey): PageConfigScalar {
  const field = readPageProperty(value, key);
  if (field === null) return null;
  if (field === undefined) return undefined;
  if (typeof field === 'string' || typeof field === 'number' || typeof field === 'boolean') return field;
  return invalidField(key);
}

/**
 * Validate a field when it is consumed. Do not eagerly inspect other fields or cache getters:
 * source-key fallbacks and existing property-read order remain observable on the original value.
 * Unknown extension properties remain in the raw selection, without becoming a typed escape hatch.
 */
export function readPageConfig(value: unknown): PublicPageConfig {
  return {
    get key() {
      return readText(value, 'key');
    },
    get layout() {
      return readIndex(value, 'layout');
    },
    get themeColor() {
      return readIndex(value, 'themeColor');
    },
    get themeBgColor() {
      return readText(value, 'themeBgColor');
    },
    get cover() {
      return readText(value, 'cover');
    },
    get showQrcode() {
      return readIndex(value, 'showQrcode');
    },
  };
}

export function getPageThemeColor({
  themeBgColor,
  themeColor,
}: Pick<PublicPageConfig, 'themeBgColor' | 'themeColor'>): string | undefined {
  if (themeBgColor) return themeBgColor;
  const key = String(themeColor);
  // Keep both reads, including inherited array keys such as "constructor" and "toString".
  if (!readPageProperty(themes, key)) return '#1677ff';
  const main = readPageProperty(readPageProperty(themes, key) || {}, 'main');
  if (main === undefined) return undefined;
  if (typeof main === 'string') return main;
  return invalidField('theme.main');
}
