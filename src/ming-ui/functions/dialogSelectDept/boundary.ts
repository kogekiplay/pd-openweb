import departmentController from 'src/api/department';
import { decodeDepartments } from '../dialogSelectUser/GeneralSelect/boundary';
import type { AbortableRequest } from '../dialogSelectUser/GeneralSelect/types';
import type {
  DepartmentChoice,
  DepartmentPath,
  DepartmentRequest,
  DepartmentRootResult,
  DepartmentTree,
} from './types';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function optionalBoolean(value: unknown) {
  return value === undefined || typeof value === 'boolean';
}
function optionalNumber(value: unknown) {
  return value === undefined || typeof value === 'number';
}
function optionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}
function path(value: unknown): value is DepartmentPath {
  return (
    object(value) &&
    typeof value['departmentId'] === 'string' &&
    typeof value['departmentName'] === 'string' &&
    typeof value['depth'] === 'number'
  );
}
function choice(value: unknown): value is DepartmentChoice {
  return (
    object(value) &&
    typeof value['departmentId'] === 'string' &&
    optionalString(value['departmentName']) &&
    optionalBoolean(value['haveSubDepartment']) &&
    optionalBoolean(value['checkIncludeChilren']) &&
    optionalNumber(value['userCount']) &&
    (value['departmentPath'] === undefined ||
      (Array.isArray(value['departmentPath']) && Array.from(value['departmentPath']).every(path)))
  );
}
export function departmentChoices(value: unknown): DepartmentChoice[] {
  if (!Array.isArray(value) || !Array.from(value).every(choice)) throw new TypeError('Invalid selected departments');
  return value;
}
function acyclic(value: unknown, ancestors = new Set<object>()): void {
  if (!object(value)) throw new TypeError('Invalid department node');
  if (ancestors.has(value)) throw new TypeError('Cyclic department tree');
  const children = value['subDepartments'];
  if (children === undefined) return;
  if (!Array.isArray(children)) throw new TypeError('Invalid department children');
  ancestors.add(value);
  Array.from(children).forEach(child => acyclic(child, ancestors));
  ancestors.delete(value);
}
export function departmentTree(value: unknown): DepartmentTree[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid department tree');
  Array.from(value).forEach(item => acyclic(item));
  return decodeDepartments(value);
}
export function rootResult(value: unknown, wrapped: boolean, directArrayCompatible = false): DepartmentRootResult {
  if (directArrayCompatible && Array.isArray(value))
    return { departments: departmentTree(value), showProjectAll: true };
  if (!wrapped) return { departments: departmentTree(value), showProjectAll: true };
  if (!object(value) || !optionalBoolean(value['item1'])) throw new TypeError('Invalid department search envelope');
  return { departments: departmentTree(value['item2']), showProjectAll: !value['item1'] };
}
export function memberIds(value: unknown): string[] {
  if (!object(value)) throw new TypeError('Invalid department member result');
  const ids = (value: unknown): string[] => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || !Array.from(value).every(item => typeof item === 'string'))
      throw new TypeError('Invalid member department IDs');
    return value;
  };
  return ids(value['hasMemberIds']).concat(ids(value['hasMemberIdsInTree']));
}
export function rangeId(value: string | number): 10 | 20 | 30 | undefined {
  const ranges = [10, 20, 30] as const;
  return ranges[Number(value) - 1];
}
export function requestIds(value: unknown): string[] {
  if (!Array.isArray(value) || !Array.from(value).every(id => id == null || typeof id === 'string'))
    throw new TypeError('Invalid appointed department/user IDs');
  return value.filter((id): id is string => typeof id === 'string' && !!id);
}
export type DepartmentMethod =
  | 'appointedDepartment'
  | 'pagedProjectDepartmentTrees'
  | 'pagedDepartmentTrees'
  | 'searchProjectDepartment2'
  | 'searchDepartment2'
  | 'pagedSubDepartments'
  | 'getProjectSubDepartmentByDepartmentId'
  | 'keepHasMemberIds';
/** API payload stays unknown until the endpoint's actual response decoder runs. */
export function requestDepartments(method: DepartmentMethod, args: DepartmentRequest): AbortableRequest<unknown> {
  return departmentController[method]({ ...args });
}
