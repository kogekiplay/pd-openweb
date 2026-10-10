import type { CSSProperties, ReactNode } from 'react';
import type { OverlayScrollbars, PartialOptions } from 'overlayscrollbars';
import type { OverlayScrollbarsComponentProps } from 'overlayscrollbars-react';

export interface ScrollPluginOptions {
  disableParentScroll?: boolean | undefined;
  enableWheelDirectionControl?: boolean | undefined;
  isMobile?: boolean | undefined;
  enableSwipeBack?: boolean | undefined;
  [metadata: string]: unknown;
}
export type ScrollViewOptions = PartialOptions & { customOptions?: ScrollPluginOptions | undefined };
export interface ScrollInfo {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  clientHeight: number;
  maxScrollTop: number;
  viewport: HTMLElement;
}
export interface EmptyScrollInfo {
  scrollTop?: never;
  scrollLeft?: never;
  scrollHeight?: never;
  clientHeight?: never;
  maxScrollTop?: never;
  viewport?: never;
}
/** The div attributes and library initialization options actually forwarded by the wrapper. */
export interface ScrollViewProps extends Omit<
  OverlayScrollbarsComponentProps<'div'>,
  'ref' | 'children' | 'options' | 'onScroll' | 'onScrollEnd' | 'style' | 'className'
> {
  children?: ReactNode;
  className?: string | undefined;
  /** Legacy caller attribute, forwarded unchanged. */
  class?: string | undefined;
  theme?: string | undefined;
  disableParentScroll?: boolean | undefined;
  enableSwipeBack?: boolean | undefined;
  enableWheelDirectionControl?: boolean | undefined;
  springBackMode?: '' | 'disableSpringBack' | 'disableSpringBackX' | 'disableSpringBackY' | undefined;
  allowance?: number | undefined;
  style?: CSSProperties | undefined;
  onScrollEnd?: ((info: Pick<ScrollInfo, 'scrollTop' | 'scrollLeft' | 'clientHeight'>) => void) | undefined;
  onReachVerticalEdge?: ((info: { direction: 'up' | 'down' }) => void) | undefined;
  onReachHorizontalEdge?: ((info: { direction: 'left' | 'right' }) => void) | undefined;
  onScroll?: ((info: Pick<ScrollInfo, 'scrollTop' | 'scrollLeft'>) => void) | undefined;
  customScroll?: ((instance: OverlayScrollbars) => void) | undefined;
  setViewPortRef?: ((element: HTMLElement | null) => void) | undefined;
  scrollContentClassName?: string | undefined;
  options?: ScrollViewOptions | undefined;
  [attribute: `data-${string}`]: unknown;
}
