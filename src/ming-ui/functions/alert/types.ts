import type { CSSProperties, ReactElement } from 'react';

export interface AlertOptions {
  /** Configured messages retain the existing String conversion; only top-level elements render as nodes. */
  msg?: unknown;
  type?: number | undefined;
  duration?: number | undefined;
  onClose?: (() => void) | undefined;
  key?: string | number | undefined;
  style?: CSSProperties | undefined;
  isPcAlert?: boolean | undefined;
  [metadata: string]: unknown;
}
export type AlertContent = string | number | boolean | bigint | symbol | null | undefined | ReactElement | AlertOptions;
