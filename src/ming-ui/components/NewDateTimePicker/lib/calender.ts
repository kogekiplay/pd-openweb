import type { ClockTime, TimeMode } from '../../NewTimePicker/types';
import type { RangeMode } from '../types';

const padZero = (value: number) => {
  return value < 10 ? `0${value}` : value.toString();
};

const isTimeEarly = (a: Readonly<ClockTime>, b: Readonly<ClockTime>) => {
  const _a = a.hour * 10000 + a.minute * 100 + a.second;
  const _b = b.hour * 10000 + b.minute * 100 + b.second;
  return _a < _b;
};

const isTimeLater = (a: Readonly<ClockTime>, b: Readonly<ClockTime>) => {
  const _a = a.hour * 10000 + a.minute * 100 + a.second;
  const _b = b.hour * 10000 + b.minute * 100 + b.second;
  return _a > _b;
};

const Calender = {
  /**
   * 是否为同一天
   */
  isSameDate: (a: Date | null | undefined, b: Date | null | undefined) => {
    return (
      !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
    );
  },
  /**
   * 计算指定月份的天数
   */
  daysOfMonth: (year: number, month: number) => {
    const nextMonth = month >= 11 ? 0 : month + 1;
    const nextYear = month >= 11 ? year + 1 : year;

    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(nextYear, nextMonth, 1));

    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    return days;
  },
  /**
   * 计算日期是否在范围内
   */
  dateInRange: (date: Date, min?: Date | null, max?: Date | null) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    let n: Date | null = null;

    if (min && min.getFullYear) {
      n = new Date(min.getFullYear(), min.getMonth(), min.getDate());
    }

    let x: Date | null = null;

    if (max && max.getFullYear) {
      x = new Date(max.getFullYear(), max.getMonth(), max.getDate());
    }

    let inRange = true;

    if ((n && d < n) || (x && d > x)) {
      inRange = false;
    }

    return inRange;
  },
  /**
   * 计算月份是否在范围内
   */
  monthInRange: (month: Date, min?: Date | null, max?: Date | null) => {
    const d = new Date(month.getFullYear(), month.getMonth());
    let n: Date | null = null;

    if (min && min.getFullYear) {
      n = new Date(min.getFullYear(), min.getMonth());
    }

    let x: Date | null = null;

    if (max && max.getFullYear) {
      x = new Date(max.getFullYear(), max.getMonth());
    }

    let inRange = true;

    if ((n && d < n) || (x && d > x)) {
      inRange = false;
    }

    return inRange;
  },
  /**
   * 上个月
   */
  prevMonth: (time: Date) => {
    const year = time.getFullYear();
    const month = time.getMonth();

    const prevYear = month <= 0 ? year - 1 : year;
    const prevMonth = month <= 0 ? 11 : month - 1;

    const prev = new Date(time);
    prev.setDate(1);
    prev.setMonth(prevMonth);
    prev.setFullYear(prevYear);

    return prev;
  },
  /**
   * 下个月
   */
  nextMonth: (time: Date) => {
    const year = time.getFullYear();
    const month = time.getMonth();

    const nextYear = month >= 11 ? year + 1 : year;
    const nextMonth = month >= 11 ? 0 : month + 1;

    const next = new Date(time);
    next.setDate(1);
    next.setMonth(nextMonth);
    next.setFullYear(nextYear);

    return next;
  },
  /**
   * 分钟是否在范围内
   */
  minuteInRange: (
    time: Pick<ClockTime, 'hour' | 'minute'>,
    min?: Readonly<ClockTime> | null,
    max?: Readonly<ClockTime> | null,
  ) => {
    let inRange = true;

    if (min) {
      if (time.hour < min.hour) {
        inRange = false;
      } else if (time.hour === min.hour && time.minute < min.minute) {
        inRange = false;
      }
    }

    if (max) {
      if (time.hour > max.hour) {
        inRange = false;
      } else if (time.hour === max.hour && time.minute > max.minute) {
        inRange = false;
      }
    }

    return inRange;
  },
  /**
   * 秒是否在范围内
   */
  secondInRange: (time: Readonly<ClockTime>, min?: Readonly<ClockTime> | null, max?: Readonly<ClockTime> | null) => {
    let inRange = true;

    if ((min && isTimeEarly(time, min)) || (max && isTimeLater(time, max))) {
      inRange = false;
    }

    return inRange;
  },
  /**
   * 左侧补 0
   */
  padZero: (value: number) => {
    return padZero(value);
  },
  /**
   * 格式化时间
   */
  formatTime: (time: Date | null | undefined, type: RangeMode = 'date', timeType: TimeMode = 'minute') => {
    if (!time) {
      return '';
    }

    const labelData = [];
    // date
    let dateData = [time.getFullYear().toString()];

    if (type === 'month') {
      dateData = [time.getFullYear().toString(), padZero(time.getMonth() + 1)];
    } else if (type === 'date' || type === 'datetime' || type === 'task' || type === 'half') {
      dateData = [time.getFullYear().toString(), padZero(time.getMonth() + 1), padZero(time.getDate())];
    }

    labelData.push(dateData.join('-'));

    if (type === 'datetime' || type === 'task') {
      // time
      let timeData = [padZero(time.getHours())];

      if (timeType === 'minute') {
        timeData = [padZero(time.getHours()), padZero(time.getMinutes())];
      } else if (timeType === 'second') {
        timeData = [padZero(time.getHours()), padZero(time.getMinutes()), padZero(time.getSeconds())];
      }

      labelData.push(timeData.join(':'));
    }

    return labelData.join(' ');
  },
  /**
   * 时间 a 是否早于 b
   */
  isTimeEarly: (a: Readonly<ClockTime>, b: Readonly<ClockTime>) => {
    return isTimeEarly(a, b);
  },
  /**
   * 时间 a 是否晚于 b
   */
  isTimeLater: (a: Readonly<ClockTime>, b: Readonly<ClockTime>) => {
    return isTimeLater(a, b);
  },
};

export default Calender;
