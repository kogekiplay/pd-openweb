import twemoji from '@twemoji/api';
import emotionData from './data';
import Emotion, { isRetina, TWEMOJI_OPTIONS } from './emotion';

/** The existing catalog remains the sole producer; only classic entries are interpreted here. */
export interface ClassicEmotionGroup {
  tab: { path: string; size?: number | string | undefined; showRetina?: boolean | undefined };
  content: readonly unknown[];
  itemClassName: string;
}
export interface ClassicEmotionItem { key: string; img: string; originalKey?: unknown; }
interface EmotionParseRule { group: ClassicEmotionGroup; item: ClassicEmotionItem; pattern: RegExp; }
type CatalogField = 'tab' | 'path' | 'size' | 'showRetina' | 'content' | 'itemClassName' | 'key' | 'img' | 'originalKey' | 'zh-Hans' | 'en';
function field(value: unknown, key: CatalogField): unknown {
  return value !== null && (typeof value === 'object' || typeof value === 'function') ? Reflect.get(value, key) : undefined;
}
function isClassicGroup(value: unknown): value is ClassicEmotionGroup {
  const tab = field(value, 'tab'), size = field(tab, 'size'), retina = field(tab, 'showRetina');
  return typeof field(tab, 'path') === 'string' && typeof field(value, 'itemClassName') === 'string' &&
    Array.isArray(field(value, 'content')) &&
    (size === undefined || typeof size === 'string' || typeof size === 'number') &&
    (retina === undefined || typeof retina === 'boolean');
}
function isClassicItem(value: unknown): value is ClassicEmotionItem {
  return typeof field(value, 'key') === 'string' && typeof field(value, 'img') === 'string';
}
function aliases(item: ClassicEmotionItem): string[] {
  const original = item.originalKey;
  const names = [field(original, 'zh-Hans'), field(original, 'en')].filter((value): value is string => typeof value === 'string');
  return Array.from(new Set(names.length ? names : [typeof original === 'string' ? original : item.key]));
}
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const catalog: unknown = emotionData;
if (!Array.isArray(catalog)) throw new TypeError('Invalid emotion catalog');
export const EMOTION_PARSE_RULES: EmotionParseRule[] = catalog.flatMap((group: unknown) => {
  if (!isClassicGroup(group)) return [];
  return group.content.flatMap((item: unknown) => {
    if (!field(item, 'key')) return [];
    if (!isClassicItem(item)) throw new TypeError('Invalid classic emotion entry');
    return aliases(item).map(alias => ({ group, item, pattern: new RegExp(`\\[${escapeRegExp(alias)}\\]`, 'gi') }));
  });
});

export function buildEmotionImageHtml(group: ClassicEmotionGroup, item: ClassicEmotionItem): string {
  const image = group.tab.path === 'bear/' ? item.img.replace('.png', '.gif') : item.img;
  const src = Emotion.options.imgPath + group.tab.path + (isRetina && group.tab.showRetina ? 'retina/' : '') + image;
  const height = group.tab.size ? ` height="${group.tab.size}"` : '';
  return `<img src="${src}" class="${group.itemClassName}"${height} />`;
}
export function transformHtmlText(html: unknown, transform: (text: string) => string): string {
  let result = '', text = '', inTag = false, quote = '';
  const flushText = () => { result += transform(text); text = ''; };
  for (const character of String(html || '')) {
    if (!inTag && character === '<') { flushText(); inTag = true; result += character; continue; }
    if (inTag) {
      result += character;
      if (quote) { if (character === quote) quote = ''; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === '>') inTag = false;
    } else text += character;
  }
  flushText(); return result;
}
export function parseUnicodeEmotion(value: unknown): string {
  return transformHtmlText(value, text => twemoji.parse(text, TWEMOJI_OPTIONS));
}
export default function parseEmotion(value: unknown): string {
  const result = transformHtmlText(value, text => {
    let parsedText = text;
    EMOTION_PARSE_RULES.forEach(({ group, item, pattern }) => {
      pattern.lastIndex = 0;
      if (!pattern.test(parsedText)) return;
      pattern.lastIndex = 0;
      parsedText = parsedText.replace(pattern, buildEmotionImageHtml(group, item));
    });
    return parsedText;
  });
  return parseUnicodeEmotion(result);
}
