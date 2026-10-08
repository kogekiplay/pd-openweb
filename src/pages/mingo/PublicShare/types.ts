export interface ShareData {
  clientId?: string | undefined;
  appId?: string | undefined;
  projectId?: string | undefined;
  sourceId?: string | undefined;
  shareId?: string | undefined;
  scope?: number | undefined;
  pageTitle?: string | undefined;
  customerPageName?: string | undefined;
}
export interface ShareEnvelope {
  resultCode: number;
  data?: ShareData | undefined;
}
