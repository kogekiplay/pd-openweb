export const getCheckedPermissionIds = (permissionList = []) => {
  const checkedIds = [];
  permissionList.forEach(item => {
    if (item.isRolePermission) {
      checkedIds.push(item.permissionId);
    }

    if ((item.subPermission || []).length) {
      checkedIds.push(...getCheckedPermissionIds(item.subPermission));
    }
  });

  return checkedIds;
};

export const filterMyPermissions = permissionList => {
  return permissionList.reduce((acc, cur) => {
    const subPermission = (cur.subPermission || []).length ? filterMyPermissions(cur.subPermission || []) : [];

    if (cur.isRolePermission || subPermission.length) {
      acc.push({
        ...cur,
        subPermission,
      });
    }

    return acc;
  }, []);
};
/**
 * 判断「角色/默认功能」编辑内容相对初始值是否有未保存改动。
 *
 * 语义移植自上游 7.5.3 同名函数：
 *  - 先对 selectedIds 去重 + 归一化排序再比较，避免勾选顺序不同被误判成改动；
 *  - roleName 去首尾空格后比较、allowAddMembers 按布尔比较。
 * 入参全部可空（上游就是 `currentValue = {}` 的空值口径），**没有**为了绕开类型而编默认值。
 */
interface PermissionEditValue {
  /** 角色权限 id 既有数字也有字符串（默认功能抽屉用的是字符串键），故按两者联合声明。 */
  selectedIds?: Array<string | number> | undefined;
  roleName?: string | undefined;
  allowAddMembers?: boolean | undefined;
}

const normalizePermissionIds = (selectedIds: Array<string | number> = []) =>
  [...new Set(selectedIds)].sort((a, b) => String(a).localeCompare(String(b)));

export const hasPermissionEditChanged = (
  initialValue: PermissionEditValue | undefined,
  currentValue: PermissionEditValue = {},
): boolean => {
  if (!initialValue) return false;

  const initialIds = normalizePermissionIds(initialValue.selectedIds);
  const currentIds = normalizePermissionIds(currentValue.selectedIds);

  return (
    (initialValue.roleName || '').trim() !== (currentValue.roleName || '').trim() ||
    Boolean(initialValue.allowAddMembers) !== Boolean(currentValue.allowAddMembers) ||
    initialIds.length !== currentIds.length ||
    initialIds.some((id, index) => id !== currentIds[index])
  );
};
