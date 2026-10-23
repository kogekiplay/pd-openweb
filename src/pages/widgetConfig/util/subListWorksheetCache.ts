import _ from 'lodash';
import type { FieldStoreWorksheet } from 'src/utils/subListStoreTypes';

/** Only worksheet-response producers register here. Copied controls stored under sheetInfo are a different family. */
const worksheetResponses = new WeakSet<object>();
export function rememberSubListWorksheet<T extends FieldStoreWorksheet>(worksheet: T): T {
  if (worksheet !== null && typeof worksheet === 'object') worksheetResponses.add(worksheet);
  return worksheet;
}
function rememberedWorksheet(value: unknown): value is FieldStoreWorksheet {
  return value !== null && typeof value === 'object' && worksheetResponses.has(value);
}
/** Ownership proof, not a template-presence DTO assertion. Preserve cache-before-control getter evaluation order. */
export function getSubListWorksheet(getControlId: () => string | undefined): FieldStoreWorksheet | undefined {
  const cache: unknown = Reflect.get(window, 'subListSheetConfig');
  const controlId = getControlId();
  const sheetInfo: unknown = _.get(cache, [controlId === undefined ? 'undefined' : controlId, 'sheetInfo']);
  return rememberedWorksheet(sheetInfo) ? sheetInfo : undefined;
}
