/** URL templates may embed scalar context (including the numeric timestamp), never form arrays or records. */
export function embedUrlSegment(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

export function valueObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
export function parsedObjects(value: unknown): Record<string, unknown>[] {
  const parsed: unknown = safeParse(value, 'array');
  return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => !!valueObject(item)) : [];
}
export function fieldText(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === 'string' ? value[key] : undefined;
}
export function firstNativeRecord(value: unknown): Record<string, unknown> | undefined {
  return parsedObjects(value)[0];
}
export function nativeUsers(value: unknown): import('./widgetFunctionTypes').WidgetUser[] {
  return parsedObjects(value).map(user => ({
    accountId: fieldText(user, 'account_id'),
    avatar: fieldText(user, 'avatar'),
    fullname: fieldText(user, 'full_name') || fieldText(user, 'fullname'),
  }));
}
export function nativeDepartments(value: unknown): import('./widgetFunctionTypes').WidgetDepartment[] {
  return parsedObjects(value).map(department => ({
    departmentId: fieldText(department, 'department_id'),
    departmentName: fieldText(department, 'department_name'),
  }));
}
export function nativeOrgRoles(value: unknown): import('./widgetFunctionTypes').WidgetOrgRole[] {
  return parsedObjects(value).map(org => ({
    organizeId: fieldText(org, 'organizeId'),
    organizeName: fieldText(org, 'organizeName'),
  }));
}
export function nativeLocation(value: unknown): import('./widgetFunctionTypes').WidgetLocation | undefined {
  const parsed: unknown = safeParse(value);
  const location = valueObject(parsed);
  if (!location || !Object.keys(location).length) return undefined;
  const lat = location['lat'];
  const lng = location['lon'];
  return {
    address: fieldText(location, 'address'),
    lat: typeof lat === 'number' || typeof lat === 'string' ? lat : undefined,
    lng: typeof lng === 'number' || typeof lng === 'string' ? lng : undefined,
    name: fieldText(location, 'title'),
  };
}
/** Whitelisted controller entries expose functions whose single input is a JSON request parameter bag. */
export function isApiMethod(value: unknown): value is (args: Record<string, unknown> | undefined) => unknown {
  return typeof value === 'function';
}
