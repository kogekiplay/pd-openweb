import type { CSSProperties, ReactNode } from 'react';
import type { FormControl, RecordRow } from 'src/utils/controlTypes';
import type { SheetColumnStyle } from 'src/utils/worksheetTypes';

export interface ColumnWidthChange {
  controlId: string | undefined;
  value: number;
}
export interface BaseColumnHeadProps {
  control: FormControl;
  style?: CSSProperties | undefined;
  className?: string | undefined;
  worksheetId?: string | undefined;
  rows?: RecordRow[] | undefined;
  columnStyle?: SheetColumnStyle | undefined;
  columnIndex?: number | undefined;
  disabled?: boolean | undefined;
  disableSort?: boolean | undefined;
  canDrag?: boolean | undefined;
  showRequired?: boolean | undefined;
  showDropdown?: boolean | number | undefined;
  isAsc?: boolean | undefined;
  isLast?: boolean | undefined;
  isDraft?: boolean | undefined;
  /** Existing table consumers pass selection state; this base renderer does not read it. */
  selected?: boolean | undefined;
  hideMaskIcon?: boolean | undefined;
  changeSort?: ((isAsc: boolean | undefined) => unknown) | undefined;
  updateSheetColumnWidths?: ((change: ColumnWidthChange) => unknown) | undefined;
  renderPopup?: ((context: { closeMenu(): void }) => ReactNode) | undefined;
  getPopupContainer?: ((node: HTMLElement) => HTMLElement) | undefined;
}
export interface RowHeadColumnProps {
  control: FormControl;
  style?: CSSProperties | undefined;
  className?: string | undefined;
  showNumber?: boolean | undefined;
  showRequired?: boolean | undefined;
  rowIndex?: number | undefined;
  /** The vertical table supplies this legacy field; rendering uses rowIndex. */
  columnIndex?: number | undefined;
}
