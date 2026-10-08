import type { FocusEvent, ReactNode } from 'react';

export type QuotaValue = number | string;
export interface QuotaApp {
  appId?: string | undefined;
  appName?: string | undefined;
  appIconColor?: string | undefined;
  appIconUrl?: string | undefined;
  name?: string | undefined;
  iconColor?: string | undefined;
  iconUrl?: string | undefined;
}
export interface QuotaWorksheet {
  workSheetId: string;
  workSheetName: string;
  iconColor?: string | undefined;
  iconUrl?: string | undefined;
  app?: QuotaApp | undefined;
}
export interface QuotaRow {
  entityId: string;
  size: QuotaValue;
  createTime?: string | undefined;
  _isDraft?: boolean | undefined;
  app?: QuotaApp | undefined;
  appItem?:
    | { id?: string | undefined; name?: string | undefined; color?: string | undefined; iconUrl?: string | undefined }
    | undefined;
  user?: { accountId?: string | undefined; fullname?: string | undefined; avatar?: string | undefined } | undefined;
}
export interface QuotaOption {
  label: string;
  value: string;
}
export interface QuotaColumn {
  title: string;
  dataIndex: string;
  width?: number | undefined;
  unit?: string | undefined;
  className?: string | undefined;
  sorter?: boolean | undefined;
}
export interface QuotaCard {
  type: string;
  subTitle?: string;
  title: string;
  desc: string;
  quotaUnit: string;
  extraSetting: string;
  businessType: number;
  globalDesc: string;
  globalUnit: string;
  columns: QuotaColumn[];
}
export interface QuotaState {
  initialLimits: QuotaRow[];
  limits: QuotaRow[];
  total: number;
  initialTotal: number;
  size: QuotaValue;
  initialSize: QuotaValue;
  appList: QuotaOption[];
  appIds: string[];
  worksheetList: QuotaOption[];
  worksheetIds: string[];
  pageIndex: number;
  appPageIndex: number;
  selectedIds: string[];
  lastSelectedId?: string | undefined;
  sortField: string;
  sortType: number;
  batchEditVisible: boolean;
  resetSelectedCount: number;
  loading: boolean;
  loadingMore: boolean;
  loadingApp: boolean;
  saveLoading: boolean;
  isMoreApp: boolean;
  resetLoading: boolean;
  resetVisible: boolean;
  resetRows: QuotaRow[];
  batchSize?: number | undefined;
  limitRowTotal?: number | undefined;
  limitSize?: number | undefined;
  keyword: string;
  clickSubmit: boolean;
}
export type QuotaPatch = Partial<QuotaState>;
export type SetQuotaState = (patch: QuotaPatch | ((previous: QuotaState) => QuotaPatch)) => void;
export type QuotaLoad = (overrides?: QuotaPatch & { append?: boolean }) => Promise<void>;
export type QuotaBlur = (event: FocusEvent<HTMLInputElement>, callback: (value: number) => void) => void;
export interface SettingsProps {
  projectId: string;
  title: string;
  columns?: QuotaColumn[] | undefined;
  globalDesc: string;
  globalUnit: string;
  globalSize?: number | undefined;
  businessType?: number | undefined;
  updateData?: () => void;
  onClose?: () => void;
}
export interface QuotaActionProps {
  projectId: string;
  businessType: number;
  globalUnit: string;
  state: QuotaState;
  setState: SetQuotaState;
  loadLimits: QuotaLoad;
  loadAppList: (overrides?: QuotaPatch) => void;
}
export interface QuotaCellProps {
  col: QuotaColumn;
  data: QuotaRow;
  projectId: string;
  businessType: number;
  clickSubmit: boolean;
  limitRowTotal?: number | undefined;
  onChangeItemSize: (value: QuotaValue, row: QuotaRow) => void;
  onBlur: QuotaBlur;
  onReset: (rows: QuotaRow[], selectedCount?: number) => void;
  onRemove: (id: string) => void;
}
export interface BatchActionProps {
  loading: boolean;
  saveLoading: boolean;
  disabled: boolean;
  onSave: () => void;
  onCancel: () => void;
  businessType: number;
  resetLoading: boolean;
  batchEditVisible: boolean;
  batchSize?: number | undefined;
  batchMax?: number | undefined;
  globalUnit: string;
  onBatchSizeChange: (value: number) => void;
  onApplyBatchEdit: () => void;
  onCloseBatchEdit: () => void;
  resetVisible: boolean;
  resetDescription: ReactNode;
  selectedCount: number;
  resetRows: QuotaRow[];
  loadedCount: number;
  total: number;
  onConfirmReset: () => void;
  onCloseReset: () => void;
}
export interface QuotaTableProps extends Omit<QuotaCellProps, 'col' | 'data'> {
  columns: QuotaColumn[];
  limits: QuotaRow[];
  selectedIds: string[];
  sortField: string;
  sortType: number;
  loading: boolean;
  pageIndex: number;
  loadingMore: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onSort: (field: string) => void;
}
export interface ToolbarProps {
  businessType: number;
  appIds: string[];
  appList: QuotaOption[];
  worksheetIds: string[];
  worksheetList: QuotaOption[];
  isMoreApp: boolean;
  appPageIndex: number;
  loadingApp?: boolean;
  selectedIds?: string[];
  resetLoading: boolean;
  resettableRows?: QuotaRow[];
  onSearchApps: (value: string) => void;
  onClearApps: () => void;
  onLoadMoreApps: () => void;
  onCloseApps: () => void;
  onChangeApps: (ids: string[]) => void;
  onChangeWorksheets: (ids: string[]) => void;
  onQuery: () => void;
  onResetFilters: () => void;
  onResetUsage: (rows: QuotaRow[], count?: number) => void;
  onBatchEdit: () => void;
  onBatchRemove: () => void;
  onAdd: () => void;
}
export interface LimitPage {
  data: QuotaRow[];
  total: number;
}
export interface LimitRequest {
  projectId: string;
  businessType: number;
  pageIndex: number;
  entityIds: string[];
  sortField: string;
  sortType: number;
}
