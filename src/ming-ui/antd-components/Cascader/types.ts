import type { CSSProperties, ReactNode } from 'react';
import type { AlignType, TriggerProps } from '@rc-component/trigger';

/** Worksheet cascading choices use record IDs, not antd's path-value tuples. */
export type CascaderKey = string;
export type CascaderLabel = string | number;
export interface CascaderValue {
  value: CascaderKey;
  label?: CascaderLabel | null | undefined;
  [metadata: string]: unknown;
}
export interface FlattenedCascaderOption extends CascaderValue {
  children?: CascaderOption[] | null | undefined;
  path: CascaderKey[];
  fullPath: string;
}
export interface CascaderOption extends CascaderValue {
  children?: CascaderOption[] | null | undefined;
  isLeaf?: boolean | undefined;
  checkable?: boolean | undefined;
  /** Serialized display path on search results; non-search nodes can carry child IDs here. */
  path?: string | null | undefined;
}
/** Actual endpoint completion, including handled rejection/cancellation in the widget producer. */
export type CascaderLoadResult = { status: 'loaded' } | { status: 'cancelled' } | { status: 'failed'; error: unknown };
export type CascaderLoader = (node: CascaderOption) => void | Promise<void | CascaderLoadResult>;
export interface CascaderHandle {
  focus(): void;
  blur(): void;
}
export type CascaderPopupAlign = Omit<AlignType, '_experimental'> & { _experimental?: Record<string, unknown> };
export interface CascaderProps {
  options?: CascaderOption[] | undefined;
  value?: CascaderValue[] | undefined;
  onChange?: ((value: CascaderValue[]) => void) | undefined;
  placeholder?: ReactNode;
  allowClear?: boolean | undefined;
  multiple?: boolean | undefined;
  showSearch?: boolean | undefined;
  loadData?: CascaderLoader | undefined;
  /** Observable root/search request state from the actual producer. */
  loading?: boolean | undefined;
  loadError?: boolean | undefined;
  onRetry?: (() => void | Promise<void | CascaderLoadResult>) | undefined;
  disabled?: boolean | undefined;
  style?: CSSProperties | undefined;
  className?: string | undefined;
  popupClassName?: string | undefined;
  onSearch?: ((search: string) => void) | undefined;
  open?: boolean | undefined;
  searchValue?: string | undefined;
  notFoundContent?: ReactNode;
  changeOnSelect?: boolean | undefined;
  getPopupContainer?: TriggerProps['getPopupContainer'] | undefined;
  popupAlign?: CascaderPopupAlign | undefined;
  zIndex?: number | undefined;
  onDropdownVisibleChange?: ((visible: boolean) => void) | undefined;
  /** Legacy widget options are forwarded but have never been consumed by this wrapper. */
  popupPlacement?: string | undefined;
  maxTagCount?: number | undefined;
}
