export const TAB_LIST = [
  { key: 'eventAll', txt: _l('全部') },
  { key: 'eventScheduled', txt: _l('已排期') },
  { key: 'eventNoScheduled', txt: _l('未排期') },
];

// v7：buttonText 被移除，改成 buttons 映射的 .text。
// 【视图按钮的 key 必须是精确视图名】v6 允许 month / week / day 这种模糊写法，
// v7 不再解析 —— 后果是按钮文案静默回退成英文，类型检查抓不到。
// 这里列全 btnList 会用到的 6 个（redux/actions/calendarview.ts:274，
// 按开始字段带不带时间在 timeGrid* 和 dayGrid* 两套之间切）。
export const CALENDAR_BUTTONS = {
  today: { text: _l('今天') },
  dayGridMonth: { text: _l('月%06010') },
  timeGridWeek: { text: _l('周%05034') },
  dayGridWeek: { text: _l('周%05034') },
  timeGridDay: { text: _l('天') },
  dayGridDay: { text: _l('天') },
};

export const CALENDAR_VIEW_FORMATS = {
  dayGridMonth: {
    titleFormat: { year: 'numeric', month: '2-digit', day: '2-digit' },
  },
  timeGridWeek: {
    titleFormat: { year: 'numeric', month: '2-digit', day: '2-digit' },
    // 【周视图一列只放一条】1440 宽下一列约 165px。并排 3 条 = 每条 53px，
    // 标题只剩「上午…」，等于什么都没显示。一条占满整列至少能读全，
    // 其余收进「+N 更多」（点开是完整弹层）。日视图列宽 1200+，放得下 3 条。
    eventMaxStack: 1,
  },
  timeGridDay: {
    titleFormat: { year: 'numeric', month: '2-digit', day: '2-digit' },
    eventMaxStack: 3,
  },
  dayGridWeek: {
    titleFormat: { year: 'numeric', month: '2-digit', day: '2-digit' },
  },
  dayGridDay: {
    titleFormat: { year: 'numeric', month: '2-digit', day: '2-digit' },
  },
  // as const 不能少：不加的话 'numeric' 被拓宽成 string，对不上 v7 收紧后的
  // NativeDateFormatterOptions（v6 的类型宽松，没这个问题）。
} as const;

export const DEFAULT_COLOR = 'var(--color-primary-transparent)';
export const DEFAULT_BORDER_COLOR_DARK = 'rgba(255, 255, 255, 0.12)';
export const DEFAULT_BORDER_COLOR_LIGHT = 'rgba(0, 0, 0, 0.12)';
export const DEFAULT_TEXT_COLOR = 'var(--color-text-primary)';

export const EVENT_TAB_KEY_BY_INDEX = {
  0: 'eventAll', //全部
  1: 'eventScheduled', //已排期
  2: 'eventNoScheduled', //未排期
};

export const CARD_WIDTH = 300; // 卡片宽度
