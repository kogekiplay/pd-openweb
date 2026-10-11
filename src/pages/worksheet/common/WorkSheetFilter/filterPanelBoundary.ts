import type { EditingFilter } from './filterModelTypes';

export function editingGroups(filter: EditingFilter) {
  if (!filter.conditionsGroups) throw new TypeError('Missing worksheet filter condition groups');
  return filter.conditionsGroups;
}
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function headerContext(value: unknown): {
  hideColumnFilter: boolean | undefined;
  isSingleView: boolean | undefined;
} {
  if (value === null || value === undefined) return { hideColumnFilter: undefined, isSingleView: undefined };
  if (!record(value)) throw new TypeError('Invalid worksheet column context');
  const config = value['config'];
  if (config !== undefined && !record(config)) throw new TypeError('Invalid worksheet column context config');
  const hideColumnFilterValue = config === undefined ? undefined : config['hideColumnFilter'];
  const isSingleView = value['isSingleView'];
  if (hideColumnFilterValue !== undefined && typeof hideColumnFilterValue !== 'boolean')
    throw new TypeError('Invalid worksheet column filter visibility');
  if (isSingleView !== undefined && typeof isSingleView !== 'boolean')
    throw new TypeError('Invalid single-view column context');
  return {
    hideColumnFilter: typeof hideColumnFilterValue === 'boolean' ? hideColumnFilterValue : undefined,
    isSingleView: typeof isSingleView === 'boolean' ? isSingleView : undefined,
  };
}
