/**
 * FullCalendar 的语言：注册 locale 文件 + 把本仓的语言标签翻成库认的 code。
 *
 * 【两件事都得做，少一件都静默回落英文】
 * 1. **locale 必须显式注册**：只传 `locale: 'zh-cn'` 而不传 `locales`，日期名会是中文
 *    （那是 Intl 给的），但库自身的文案（"All-day"、"No events to display"、
 *    "+N more"）仍是英文。
 * 2. **标签对不上**：本仓用 BCP-47 风格的 `zh-Hans` / `zh-Hant`
 *    （见 src/common/langConfig.ts），FullCalendar 的 locale 文件里 code 写的是
 *    `zh-cn` / `zh-tw`。名字对不上时 v7 **不报错也不警告**，直接回落内置英文。
 *
 * 工作表的日历视图此前两件都没做：只传了 locale，还传的是 `zh-Hans`。
 * 能看到中文纯粹是因为按钮文案和 allDayText 都被我们自己覆盖掉了 ——
 * 一加列表视图，"No events to display" 就会露出来。
 *
 * ja / th / ms 两边同名，不需要映射。
 */
import jaLocale from '@fullcalendar/react/locales/ja';
import msLocale from '@fullcalendar/react/locales/ms';
import thLocale from '@fullcalendar/react/locales/th';
import zhCnLocale from '@fullcalendar/react/locales/zh-cn';
import zhTwLocale from '@fullcalendar/react/locales/zh-tw';

/** 传给 FullCalendar 的 `locales`。文件都很小（1KB 上下），一次性全注册比动态 import 简单。 */
export const FC_LOCALES = [zhCnLocale, zhTwLocale, jaLocale, thLocale, msLocale];

const LANG_TO_FC_LOCALE: Record<string, string> = {
  'zh-Hans': 'zh-cn',
  'zh-Hant': 'zh-tw',
};

/** 本仓语言标签 -> FullCalendar locale code；认不出来的原样返回（en 走库的内置默认） */
export function toFcLocale(lang?: string | null): string {
  if (!lang) return 'zh-cn';
  return LANG_TO_FC_LOCALE[lang] || lang;
}
