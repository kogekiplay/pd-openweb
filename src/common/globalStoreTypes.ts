import type homeAppApi from 'src/api/homeApp';
import type { WorksheetInfo } from 'src/pages/worksheet/types';

export type GlobalAppInfo = Awaited<ReturnType<typeof homeAppApi.getApp>>;
export interface CreateWorksheetCommand {
  action: 'createFromEmpty';
  worksheetInfo: Required<Pick<WorksheetInfo, 'appId' | 'projectId' | 'worksheetId' | 'name'>> & {
    desc?: string | undefined;
  };
}
export interface GlobalStoreState {
  appInfo?: GlobalAppInfo | undefined;
  activeWorksheet?: (WorksheetInfo & { isCharge?: boolean | undefined }) | undefined;
  mingoCreateWorksheetAction?: boolean | CreateWorksheetCommand | undefined;
  mingoIsCreatingWorksheetStatus?: false | 1 | 2 | undefined;
}
export interface GlobalStoreValue {
  store: GlobalStoreState;
  setValue<Key extends keyof GlobalStoreState>(key: Key, value: GlobalStoreState[Key]): void;
}
