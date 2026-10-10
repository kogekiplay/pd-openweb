import { cascaderOptions } from 'ming-ui/antd-components/Cascader/boundary';
import type { CascaderLabel, CascaderOption } from 'ming-ui/antd-components/Cascader/types';

/** The native TreeSelect branch consumes title; the Cascader branch consumes label. */
export interface WidgetCascaderOption extends CascaderOption {
  title?: CascaderLabel | null | undefined;
  children?: WidgetCascaderOption[];
  isLeaf?: boolean;
  checkable?: boolean;
}
function isWidgetOption(value: CascaderOption): value is WidgetCascaderOption {
  const title = value['title'];
  return (
    (!('children' in value) || Array.isArray(value.children)) &&
    (!('isLeaf' in value) || typeof value.isLeaf === 'boolean') &&
    (!('checkable' in value) || typeof value.checkable === 'boolean') &&
    (title == null || typeof title === 'string' || typeof title === 'number') &&
    (!value.children || value.children.every(isWidgetOption))
  );
}
export function widgetOptions(value: unknown): WidgetCascaderOption[] {
  const options = cascaderOptions(value);
  if (!options.every(isWidgetOption)) throw new TypeError('Invalid cascading title');
  return options;
}
export function requestErrorCode(value: unknown): number | undefined {
  if (value === null || typeof value !== 'object' || !('errorCode' in value)) return undefined;
  return typeof value.errorCode === 'number' ? value.errorCode : undefined;
}
