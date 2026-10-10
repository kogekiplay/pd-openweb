export interface TemplateWorksheetPermission {
  worksheetId: string;
  name?: string | undefined;
  roleType?: number | undefined;
  [metadata: string]: unknown;
}
function permission(value: unknown): value is TemplateWorksheetPermission {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    'worksheetId' in value &&
    typeof value.worksheetId === 'string' &&
    (!('name' in value) || value.name === undefined || typeof value.name === 'string') &&
    (!('roleType' in value) || value.roleType === undefined || typeof value.roleType === 'number')
  );
}
export function decodeTemplatePermissions(value: unknown): TemplateWorksheetPermission[] {
  if (!Array.isArray(value) || !Array.from(value).every(permission))
    throw new TypeError('Invalid template worksheet permissions');
  return value;
}
