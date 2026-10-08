export interface DepartmentTreeNode {
  departmentId: string;
  departmentName?: string | undefined;
  userCount?: number | undefined;
  haveSubDepartment?: boolean | undefined;
  subDepartments?: DepartmentTreeNode[] | undefined;
  open?: boolean | number | undefined;
  parentId?: string | undefined;
}
export function formatDepartmentTree(data: DepartmentTreeNode[], parentId?: string): DepartmentTreeNode[] {
  return data.map(item => {
    const { departmentId, departmentName, userCount, haveSubDepartment, subDepartments = [] } = item;
    return { departmentId, departmentName, userCount, haveSubDepartment, open: subDepartments.length > 0, subDepartments, parentId };
  });
}
export function formatSearchDepartmentTree(data: DepartmentTreeNode[]): DepartmentTreeNode[] {
  return data.map(item => {
    const { departmentId, departmentName, userCount, haveSubDepartment } = item;
    let { subDepartments = [] } = item;
    if (subDepartments.length) subDepartments = formatSearchDepartmentTree(subDepartments);
    return { departmentId, departmentName, userCount, haveSubDepartment, open: subDepartments.length, subDepartments };
  });
}
export function findDepartmentById<T extends DepartmentTreeNode>(departmentTree: T[] = [], id: string): DepartmentTreeNode | undefined {
  for (const department of departmentTree) {
    if (department.departmentId === id) return department;
    const matched = findDepartmentById(department.subDepartments || [], id);
    if (matched) return matched;
  }
  return undefined;
}
export function findDepartmentPathById(departmentTree: DepartmentTreeNode[] = [], id: string | number): DepartmentTreeNode[] | undefined {
  for (const department of departmentTree) {
    if (String(department.departmentId) === String(id)) return [department];
    const path = findDepartmentPathById(department.subDepartments || [], id);
    if (path) return path.concat(department);
  }
  return undefined;
}
