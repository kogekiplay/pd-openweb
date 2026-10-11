export interface SavedFilterSelection {
  filterName: string;
  filterType: number;
}
export interface SaveWorksheetFilterOptions {
  title?: string | undefined;
  isCharge?: boolean | undefined;
  filterName?: string | undefined;
  filterType?: number | undefined;
  onSave: (selection: SavedFilterSelection) => unknown;
  onClose?: (() => unknown) | undefined;
  onCancel?: (() => unknown) | undefined;
}
export interface SaveWorksheetFilterProps extends Omit<SaveWorksheetFilterOptions, 'onClose'> {
  visible?: boolean | undefined;
  onClose: () => void;
}
