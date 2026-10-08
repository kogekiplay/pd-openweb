export { calcDate } from 'src/utils/common';

import moment from 'moment';
const padDatePart = (value: number) => String(value).padStart(2, '0');
export function getWeekNumber(date: moment.MomentInput, weekBegin = 1): number {
  const current = moment(date);
  const firstWeekDate = 7 + weekBegin - current.localeData().firstDayOfYear();
  const getFirstWeekStart = (year: number) => {
    const anchor = current.clone().year(year).startOf('year').add(firstWeekDate - 1, 'days');
    return anchor.subtract((anchor.day() - weekBegin + 7) % 7, 'days');
  };
  const year = current.year();
  let firstWeekStart = getFirstWeekStart(year);
  if (current.isBefore(firstWeekStart)) firstWeekStart = getFirstWeekStart(year - 1);
  else if (!current.isBefore(getFirstWeekStart(year + 1))) firstWeekStart = getFirstWeekStart(year + 1);
  return current.diff(firstWeekStart, 'week') + 1;
}
export function formatFileTimestamp(date = new Date()): string {
  return `${padDatePart(date.getFullYear() % 100)}${padDatePart(date.getMonth() + 1)}${padDatePart(date.getDate())}${padDatePart(date.getHours())}${padDatePart(date.getMinutes())}${padDatePart(date.getSeconds())}`;
}
