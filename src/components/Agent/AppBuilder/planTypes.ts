export interface PlanItem {
  label?: string;
  name?: string;
  title?: string;
  worksheetName?: string;
  dashboardName?: string;
  assistantName?: string;
  groupName?: string;
  group?: string;
  roleName?: string;
  roleScope?: string;
  description?: string;
  type?: string;
  fields?: unknown;
  views?: unknown;
  charts?: unknown;
  components?: unknown;
  permissions?: unknown;
  worksheet?: string;
  actions?: PlanItem[];
  intentHints?: Array<{ label?: string }>;
  targetWorksheet?: string;
  trigger?: { type?: string; source?: string; label?: string };
}
export interface PlanFile {
  content?: string;
  parsed?: unknown;
}
export type PlanFiles = Record<string, PlanFile>;
export interface PlanExportOptions {
  files?: PlanFiles;
  appName?: string;
  estimateCredits?: number | null;
  now?: Date;
}
