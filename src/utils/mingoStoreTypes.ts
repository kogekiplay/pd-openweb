export type MingoActiveModule = 'worksheet' | 'worksheetControlsEdit' | 'workflow';
/** No store-emitter events are named by current producers; callback payloads stay unknown. */
export interface MingoStoreEmitter {
  on: (event: string | symbol, listener: (...args: unknown[]) => void) => MingoStoreEmitter;
  once: (event: string | symbol, listener: (...args: unknown[]) => void) => MingoStoreEmitter;
  off: (event: string | symbol, listener: (...args: unknown[]) => void) => MingoStoreEmitter;
  emit: (event: string | symbol, ...args: unknown[]) => boolean;
  removeAllListeners: (event?: string | symbol) => MingoStoreEmitter;
}
/** Only AI-context and existing-widget matching fields are interpreted by consumers. */
export interface MingoWidget {
  controlId?: string | undefined;
  alias?: string | undefined;
  controlName?: string | undefined;
  description?: string | undefined;
  type?: number | undefined;
  [controlMetadata: string]: unknown;
}
export interface MingoStoreValues {
  emitter: MingoStoreEmitter | undefined;
  activeModule: MingoActiveModule | undefined;
  appId: string | undefined;
  appName: string | undefined;
  worksheetId: string | undefined;
  worksheetName: string | undefined;
  projectId: string | undefined;
  sectionId: string | undefined;
  appDescription: string | undefined;
  allWidgets: MingoWidget[] | undefined;
}
/** Clear removes every field, including the initial emitter. Other metadata is opaque. */
export type MingoGlobalStore = Partial<MingoStoreValues> & { [metadata: string]: unknown };
export type MingoStoreKey = keyof MingoStoreValues;
export type MingoStoreWriteArgs =
  | { [Key in MingoStoreKey]: [key: Key, value?: MingoStoreValues[Key]] }[MingoStoreKey]
  | [patch: MingoGlobalStore, mode?: 'clear' | undefined];
export type MingoStoreUpdater = (...args: MingoStoreWriteArgs) => void;
export interface MingoStoreGetter {
  (): MingoGlobalStore;
  (key: undefined | null | ''): MingoGlobalStore;
  <Key extends MingoStoreKey>(key: Key): MingoStoreValues[Key];
  (key: string): unknown;
}
export interface MingoWorksheetContext {
  workSheetId?: string | undefined;
  workSheetName?: string | undefined;
  remark?: string | undefined;
  type?: number | undefined;
  [metadata: string]: unknown;
}
export interface MingoAppContext {
  activeModule?: MingoActiveModule | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  worksheetName?: string | undefined;
  projectId?: string | undefined;
  sectionId?: string | undefined;
  appName?: string | undefined;
  appDescription?: string | undefined;
  worksheets?: MingoWorksheetContext[] | undefined;
}
