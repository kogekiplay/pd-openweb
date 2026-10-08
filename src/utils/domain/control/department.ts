/**
 * 根据部门控件配置生成展示数据，并聚合已删除部门。
 */
import type { SelectedEntityValue, ControlAdvancedSetting } from 'src/utils/controlTypes';
export function formatDepartmentDisplayValue(value: SelectedEntityValue[] | string | null | undefined, advancedSetting: ControlAdvancedSetting = {}): SelectedEntityValue[] {
  const { showdelete, allpath } = advancedSetting;
  const departments: SelectedEntityValue[] = Array.isArray(value) ? value : safeParse(value || '[]');
  let deleteCount = 0;
  const result: SelectedEntityValue[] = [];

  departments.forEach(item => {
    if (item.isDelete) {
      deleteCount += 1;
      return;
    }

    const pathValue = (
      allpath === '1'
        ? [...(item.departmentPath || [])].sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0)).map(path => path.departmentName)
        : []
    ).concat([item.departmentName]);

    result.push({
      ...item,
      departmentName: pathValue.join('  /  '),
    });
  });

  if (showdelete === '1' && deleteCount) {
    result.push({
      departmentId: '',
      departmentName: _l('已删除'),
      isDelete: true,
      deleteCount,
    });
  }

  return result;
}
