export type SidebarKey =
  'overview' | 'roles' | 'worksheets' | 'customPages' | 'customActions' | 'workflows' | 'aiAssistants';
export interface FileEntry {
  key: SidebarKey | 'appMeta';
  file: string;
  type: 'markdown' | 'json';
  initial: unknown;
  object?: boolean | undefined;
  wrapperKey?: string | undefined;
}
export interface SidebarEntry extends FileEntry {
  key: SidebarKey;
  title: string;
  icon: string;
  description: string;
}
export interface SidebarItem extends SidebarEntry {
  count?: number | undefined;
  streaming?: boolean | undefined;
}
export interface FileState {
  content: string;
  /** JSON remains opaque until a consumer validates the fields it reads. */
  parsed: unknown;
  status: 'idle' | 'streaming' | 'ready';
}
export type FileMap = Record<string, FileState>;
export interface AppFileMetadata {
  appName?: string | undefined;
  appIcon?: string | undefined;
  appColor?: string | undefined;
  language?: string | undefined;
}
export function isFileRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function fileArray(value: unknown): unknown[] {
  return Array.isArray(value) ? Array.from(value) : [];
}
export function readAppFileMetadata(value: unknown): AppFileMetadata {
  if (!isFileRecord(value)) return {};
  const string = (key: string) => {
    const field = value[key];
    return typeof field === 'string' ? field : undefined;
  };
  return {
    appName: string('appName'),
    appIcon: string('appIcon'),
    appColor: string('appColor'),
    language: string('language'),
  };
}
