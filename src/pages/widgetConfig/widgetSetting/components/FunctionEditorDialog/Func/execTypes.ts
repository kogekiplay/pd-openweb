export interface FunctionRunOptions {
  update?: ((value: string) => void) | undefined;
  type?: string | undefined;
  forceSyncRun?: boolean | undefined;
  defaultExpression?: string | undefined;
  langCode?: string | number | undefined;
}
export interface FunctionRunResult {
  expression?: string | undefined;
  value?: unknown;
  error?: unknown;
}
export type FunctionCompletion = (error?: unknown, value?: unknown) => void;
export interface FunctionTask {
  code: string;
  cb: FunctionCompletion;
  timeout: number;
}
export interface FunctionWorker {
  worker: Worker;
  idle: boolean;
  id: number;
}
