/** Shared request boundary for generated Workflow API wrappers. */
export type ApiArgs = Record<string, unknown>;
export interface ApiOptions {
  isIntegration?: boolean;
  isPlugin?: boolean;
  isWorkflow?: boolean;
  [key: string]: unknown;
}
