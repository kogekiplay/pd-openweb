// 函数库直接依赖此模块，请勿引入 Moment 或与函数运行时无关的依赖和逻辑。
export { calcDate } from 'src/utils/common';

const padDatePart = (value: number) => String(value).padStart(2, '0');
export function formatFileTimestamp(date = new Date()): string {
  return `${padDatePart(date.getFullYear() % 100)}${padDatePart(date.getMonth() + 1)}${padDatePart(date.getDate())}${padDatePart(date.getHours())}${padDatePart(date.getMinutes())}${padDatePart(date.getSeconds())}`;
}
