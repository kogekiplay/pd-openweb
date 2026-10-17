import type { Moment } from 'moment';

interface GanttDialogConfig {
  scrollingEle: string;
  scrollLeft: number;
  beginTime: Moment | '';
  endTime: Moment | '';
  TYPE_TO_WIDTH: { day: number; week: number; month: number };
}

const config: GanttDialogConfig = {
  scrollingEle: '', // 正在滚动的元素
  scrollLeft: 0,
  beginTime: '', // 经过处理后的开始时间
  endTime: '', // 经过处理后的结束时间

  // 显示类型对应的宽度
  TYPE_TO_WIDTH: {
    day: 44,
    week: 18,
    month: 6,
  },
};

export default config;
