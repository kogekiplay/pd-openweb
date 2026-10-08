export interface ShareParams {
  appId?: string | undefined;
  worksheetId?: string | undefined;
  sourceId?: string | undefined;
  title?: string | undefined;
  projectId?: string | undefined;
  rowId?: string | undefined;
  viewId?: string | undefined;
  pageId?: string | undefined;
  privateVisible?: boolean | undefined;
  disableShareQuery?: boolean | undefined;
  createShareSource?:
    ((params: { scope?: number | undefined; projectId?: string | undefined }) => Promise<string>) | undefined;
}
export interface ScopedShareProps {
  from: string;
  title?: string | undefined;
  params?: ShareParams | undefined;
  isCustomShare?: boolean | undefined;
  isCharge?: boolean | undefined;
  privateShare?: boolean | undefined;
  supportProjectScope?: boolean | undefined;
  autoEnable?: boolean | undefined;
  onClose?: (() => void) | undefined;
  onUpdate?: ((value: { visibleType?: number; shareRange?: number }) => void) | undefined;
}
export interface ShareResult {
  shareSourceId?: string | undefined;
  shareLink?: string | undefined;
  url?: string | undefined;
  scope?: number | undefined;
  sourceId?: string | undefined;
  pageTitle?: string | undefined;
  appEntityShare?: ShareResult | undefined;
  validTime?: unknown;
  password?: string | undefined;
}
export interface ShareArgs extends ShareParams {
  from: string;
  isPublic?: boolean | undefined;
  validTime?: unknown;
  password?: string | undefined;
  pageTitle?: string | undefined;
  isEdit?: boolean | undefined;
  scope?: number | undefined;
  reuseShareSource?: boolean | undefined;
  onUpdate?: ((value: { visibleType?: number; shareRange?: number }) => void) | undefined;
}
