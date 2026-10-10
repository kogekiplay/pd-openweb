import type { OverlayScrollbars } from 'overlayscrollbars';
import type { ScrollPluginOptions } from '../types';

function isOptions(value: unknown): value is ScrollPluginOptions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  for (const name of ['disableParentScroll', 'enableWheelDirectionControl', 'isMobile', 'enableSwipeBack']) {
    const option: unknown = Reflect.get(value, name);
    if (option !== undefined && typeof option !== 'boolean') return false;
  }
  return true;
}
/** Only the plugin's four switches are interpreted; SDK options and metadata stay intact. */
export function readPluginOptions(instance: OverlayScrollbars, nullIsEmpty = false): ScrollPluginOptions {
  const options: unknown = Reflect.get(instance.options(), 'customOptions');
  if (options === undefined || (nullIsEmpty && !options)) return {};
  if (!isOptions(options)) throw new TypeError('Invalid scroll plugin options');
  return options;
}
