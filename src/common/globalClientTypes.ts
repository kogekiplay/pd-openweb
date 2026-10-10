import type { MomentInput } from 'moment';

/** Generated pages always install the main service; additional service routes are optional. */
export interface ClientApiServers {
  main: string;
  report?: string | undefined;
  workflow?: string | undefined;
  integration?: string | undefined;
  datapipeline?: string | undefined;
  workflowPlugin?: string | undefined;
  cloudapi?: string | undefined;
  knowledge?: string | undefined;
  [service: string]: unknown;
}

/** Embedded hosts may supply translation data; each consumed value must be checked. */
export type ClientTranslations = Record<string, unknown>;
export type TimeSpanFormatter = (date: MomentInput, showType?: number) => string;

export function translationText(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('Invalid translation text');
  return value;
}
