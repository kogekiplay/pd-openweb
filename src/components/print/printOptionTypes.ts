import type { PrintRequestInfo, PrintTaskItem, PrintWorkflowItem } from './PrintTypes';

export interface PrintDialogOptions {
  showWorkflowQrCode?: boolean | undefined;
  [metadata: string]: unknown;
}
export interface PrintOptDialogProps {
  visible?: boolean | undefined;
  reqInfo?: PrintRequestInfo | undefined;
  printCheckAll?: boolean | undefined;
  controlOption: string[] | 'all';
  changePrintVisible: (
    processOption: string,
    printCheckAll: boolean,
    controls: string[],
    options: PrintDialogOptions,
  ) => unknown;
  processOption?: string | undefined;
  worksheetId?: string | undefined;
  hidePrintOptDialog: () => void;
  type?: string | undefined;
  task?: PrintTaskItem[] | undefined;
  workflow?: PrintWorkflowItem[] | undefined;
  onUpdateTask?: ((task: PrintTaskItem[]) => void) | undefined;
  onUpdateWorkflow?: ((workflow: PrintWorkflowItem[]) => void) | undefined;
  options?: PrintDialogOptions | undefined;
}
export interface PrintOptDialogState {
  controlOption: string[];
  options: PrintDialogOptions;
  printCheckAll: boolean;
  processOption: string;
  reqInfo: PrintRequestInfo;
  task: PrintTaskItem[] | undefined;
  workflow: PrintWorkflowItem[] | undefined;
}
