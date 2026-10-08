import type { ChangeResource, ContrastOptions } from 'src/components/AppSandbox/types';
import { CHANGE_STATUS } from '../constants';

/**
 * 统一差异语义：默认展示 current 相对 target 的变化；正式环境中 original/current 相关字段含义相反，
 * 调用方通过 reverse 显式交换前后侧。
 */
export function getContrastSides<T>(target: T, current: T, { reverse = false }: ContrastOptions = {}) {
  return reverse ? { before: current, after: target } : { before: target, after: current };
}

/** 生成统一的前后值变化文案，空值显示为“空”。 */
export const formatChangedValue = (before: unknown, after: unknown) =>
  _l('「%0」改成「%1」', String(before || _l('空')), String(after || _l('空')));

/** 生成可由 ChangeContentList 渲染为真实图标预览的结构化差异内容。 */
export const createIconChangeContent = (
  before: string | undefined,
  after: string | undefined,
  label: string = _l('图标'),
) => ({
  text: _l('%0：', label),
  type: 'iconChange' as const,
  before,
  after,
});

/** 创建统一的差异表格行；未提供具体内容时以动作作为默认内容。 */
export const createChangeRow = ({
  id,
  name,
  action = CHANGE_STATUS.UPDATED,
  content,
  ...rest
}: Omit<Partial<ChangeResource>, 'name'> & { name: string }): ChangeResource => ({
  id: id || '',
  name,
  itemName: name,
  action,
  content: content?.length ? content : [action],
  ...rest,
});
