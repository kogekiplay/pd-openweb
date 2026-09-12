/**
 * 基于 moment 的 antd 日期/时间选择器。
 *
 * 【为什么需要它】antd 5 起 DatePicker 的底层日期库从 moment 换成了 dayjs
 *（antd/es/date-picker/index.js 里写死 generatePicker(dayjsGenerateConfig)），
 * 但本仓的调用点【全都还是 moment】—— 传进去的 value 是 moment，
 * disabledDate / onChange 里拿到的也按 moment 用（.isSameOrAfter 等）。
 *
 * 两者混用不会报错，但日历会算错，而且【只有在传了值的时候才错】：
 * dayjs 的 add/startOf 返回新实例，moment 的是【原地修改并返回自身】。
 * rc-picker 逐格调用 addDate(base, i) 铺日历格，传 moment 时 base 被反复推进，
 * 于是第一行出现 1 2 4 7 11 16 22 这种【三角数】（差值 1 2 3 4 5 6），
 * 面板月份也一路飘走。没传值时用的是 generateConfig.getNow()，反倒是正常的 ——
 * 所以「刚打开是好的，选了个日期再打开就乱了」。
 *
 * 实测（antd 6.6.3，同一个 DatePicker，locale 都传 zh_CN）：
 *   传 moment 对象 → 头部「2029年1月」，第一行 1 2 4 7 11 16 22
 *   传 dayjs 对象  → 头部「2026年9月」，第一行 31 1 2 3 4 5 6
 *   不传值         → 头部「2026年9月」，第一行 31 1 2 3 4 5 6
 *
 * 【为什么是换 generateConfig，而不是把调用点改成 dayjs】
 * 调用点不是"传个值"那么简单，回调里全是 moment 语义（currentDate.isSameOrAfter(...)
 * 这类在 dayjs 上需要额外插件），逐个改动面大、且每处都要单独判断。
 * 换 generateConfig 是 antd 官方留的口子：让库跟调用点的语义重新对齐，
 * 调用点一行不用动，value / onChange / disabledDate 三处拿到的都是 moment。
 *
 * 顺带也修好了月份、星期显示为英文的问题：moment 的语言包由
 * MomentLocalesPlugin 保留、preall.tsx 里 moment.locale(...) 已经设过，
 * 而 dayjs 的语言包本仓此前从未加载（antd 的 zh_CN 只负责「今天」「YYYY年」
 * 这些自己的文案，月份/星期缩写取自底层日期库的 localeData）。
 *
 * ⚠ TimePicker 这里取的是 generatePicker 产出的那个（即 antd 自己的 TimePicker
 * 内部委托的 InternalTimePicker），少了 antd TimePicker 外层那几个包装：
 * variant/bordered 合并、semantic classNames/styles 合并、addon 的弃用告警。
 * 本仓没有通过 ConfigProvider 配 picker variant，实测渲染一致。
 */
import generatePicker from 'antd/es/date-picker/generatePicker';
import momentGenerateConfig from '@rc-component/picker/generate/moment';

const MomentPicker = generatePicker(momentGenerateConfig);

export const DatePicker = MomentPicker;
export const RangePicker = MomentPicker.RangePicker;
export const TimePicker = MomentPicker.TimePicker;

export default MomentPicker;
