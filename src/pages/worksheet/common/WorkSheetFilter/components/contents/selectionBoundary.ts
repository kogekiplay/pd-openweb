import type { SearchChange, SelectionItem, SelectionUser } from './selectionTypes';

export function selectionObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}
function id(value: unknown): value is string | number | undefined {
  return value === undefined || typeof value === 'string' || typeof value === 'number';
}
export function isSelectionItem(value: unknown): value is SelectionItem {
  return (
    selectionObject(value) &&
    id(value['id']) &&
    text(value['name']) &&
    (value['temp'] === undefined || typeof value['temp'] === 'boolean')
  );
}
export function selectionItem(value: unknown): SelectionItem {
  if (!isSelectionItem(value)) throw new TypeError('Invalid worksheet filter selection');
  return value;
}
export function selectionItems(value: unknown): SelectionItem[] {
  if (!Array.isArray(value) || !Array.from(value).every(isSelectionItem))
    throw new TypeError('Invalid worksheet filter selections');
  return value;
}
export function parsedSelection(value: string): SelectionItem {
  const parsed: unknown = JSON.parse(value);
  return selectionItem(parsed);
}
export function isSelectionUser(value: unknown): value is SelectionUser {
  return selectionObject(value) && text(value['accountId']) && text(value['fullname']) && text(value['avatar']);
}
export function selectionUsers(value: unknown): SelectionUser[] {
  if (!Array.isArray(value) || !Array.from(value).every(isSelectionUser))
    throw new TypeError('Invalid worksheet filter users');
  return value;
}
export function selectedUser(value: unknown): SelectionUser {
  if (!isSelectionUser(value)) throw new TypeError('Invalid worksheet filter user');
  return value;
}
export function userFromJson(value: string): SelectionUser | undefined {
  try {
    const source: unknown = JSON.parse(value);
    if (!selectionObject(source) || !text(source['id']) || !text(source['name']) || !text(source['avatar']))
      throw new TypeError('Invalid user account fields');
    return { accountId: source['id'], fullname: source['name'], avatar: source['avatar'] };
  } catch (error) {
    console.log(error);
    return undefined;
  }
}
export function searchChange(value: unknown): SearchChange {
  if (!selectionObject(value) || !text(value['keywords']) || !text(value['search']))
    throw new TypeError('Invalid worksheet filter search');
  const result: SearchChange = {};
  if ('keywords' in value) result.keywords = value['keywords'];
  if ('search' in value) result.search = value['search'];
  return result;
}
export function departments(
  value: unknown,
): Array<{ departmentId?: string | undefined; departmentName?: string | undefined }> {
  function valid(item: unknown): item is { departmentId?: string | undefined; departmentName?: string | undefined } {
    return selectionObject(item) && text(item['departmentId']) && text(item['departmentName']);
  }
  if (!Array.isArray(value) || !Array.from(value).every(valid)) throw new TypeError('Invalid filter departments');
  return value;
}
export function roles(value: unknown): Array<{ organizeId?: string | undefined; organizeName?: string | undefined }> {
  function valid(item: unknown): item is { organizeId?: string | undefined; organizeName?: string | undefined } {
    return selectionObject(item) && text(item['organizeId']) && text(item['organizeName']);
  }
  if (!Array.isArray(value) || !Array.from(value).every(valid)) throw new TypeError('Invalid filter roles');
  return value;
}
export function areas(value: unknown): Array<{ id?: string | number | undefined; path?: string | undefined }> {
  function valid(item: unknown): item is { id?: string | number | undefined; path?: string | undefined } {
    return selectionObject(item) && id(item['id']) && text(item['path']);
  }
  if (!Array.isArray(value) || !Array.from(value).every(valid)) throw new TypeError('Invalid filter areas');
  return value;
}
export function cascaderValues(value: string): SelectionItem[] {
  const parsed: unknown = JSON.parse(value);
  function valid(item: unknown): item is { sid?: string | number | undefined; name?: string | undefined } {
    return selectionObject(item) && id(item['sid']) && text(item['name']);
  }
  if (!Array.isArray(parsed) || !Array.from(parsed).every(valid)) throw new TypeError('Invalid filter cascader values');
  return parsed.map(item => ({ name: item.name, id: item.sid }));
}
