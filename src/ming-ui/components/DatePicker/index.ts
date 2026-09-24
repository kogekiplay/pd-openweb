import DateTime from 'ming-ui/components/NewDateTimePicker/date-time';
import RangePicker from 'ming-ui/components/NewDateTimePicker/date-time-range';

// 调用方写的是 DatePicker.RangePicker。原来是 DatePicker.RangePicker = RangePicker 事后挂上去，
// 类型里没有这个静态成员（15 处 TS2339）。Object.assign 做的是同一件事（改的就是 DateTime 本身），
// 只是返回值带上了 RangePicker 的类型
const DatePicker = Object.assign(DateTime, { RangePicker });

export default DatePicker;
