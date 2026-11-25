import moment from 'moment';
import { getWeekNumber } from 'src/utils/domain/worksheet/calendar';
import { WEEKS } from '../../util';

export const FORMAT = 'YYYY-MM-DD';

export const getCurrentWeekDates = (date, weekBegin = 1) => {
  const day = date.day();
  // 计算本周第一天与传入日期差几天
  let diff = day - weekBegin;
  if (diff < 0) diff += 7;
  const startOfWeek = date.clone().subtract(diff, 'days').startOf('day');
  const dates = [];

  for (let i = 0; i < 7; i++) {
    dates.push(startOfWeek.clone().add(i, 'days'));
  }

  return dates;
};

export const formatDateWithWeekday = dateStr => {
  const date = moment(dateStr);
  if (!date.isValid()) return '';
  return `${date.year()}/${date.month() + 1}/${date.date()}  ${WEEKS[date.day()]}`;
};

export const getWeekTitle = (dates: moment.Moment[]) => {
  const start = dates[0];
  const end = dates.at(-1);
  if (!start || !end) return undefined;
  const sameYear = start.year() === end.year();
  const sameMonth = start.isSame(end, 'month');
  const endFormat = sameMonth ? 'DD' : sameYear ? 'MM/DD' : 'YYYY/MM/DD';
  const title = `${start.format('YYYY/MM/DD')} - ${end.format(endFormat)}`;

  // dates 由 getCurrentWeekDates 按视图的 weekBegin 配置生成。
  return `${title} ${_l('第%0周', getWeekNumber(start.format(FORMAT), start.day()))}`;
};

// 计算给定日期是所在周第几天（基于weekBegin起算）
export const calcDayIndex = (date, weekBegin) => {
  const day = moment(date).day(); // 0-6，0周日
  // 计算基于weekBegin调整后的索引，保证0~6循环
  return (day - weekBegin + 7) % 7;
};

// 根据周起始日期和dayIndex计算具体日期字符串
export const calcDateByWeekAndIndex = (weekStartDate, dayIndex) => {
  return moment(weekStartDate).add(dayIndex, 'days').format(FORMAT);
};
