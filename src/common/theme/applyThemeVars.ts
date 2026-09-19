/**
 * 把调色板写进 DOM。这一层【故意薄】—— 有逻辑的部分都在 palette.ts 里。
 *
 * 【为什么写 documentElement 的 inline style，而不是应用区域的包裹元素】
 * 设计文档原本写的是后者。核实时发现一条硬事实推翻了它：
 * ming-ui 的 Dialog 用 createPortal 挂到 document.body
 * （src/ming-ui/components/Dialog/DialogBase.tsx:120,375），
 * 在应用区域包裹元素【之外】。按原方案，应用里弹出的所有对话框都吃不到
 * 应用色 —— 而对话框正是主按钮最密集的地方。
 *
 * 反过来做还顺带解决了特异性问题：inline style 天然压过
 * `:root {}` 和 `[data-theme='dark'] {}`（两者特异性都是 0,1,0，
 * 谁后加载谁赢，靠加载顺序很脆）。
 *
 * 【没有「平台外壳保持平台色」这回事】最初设计给顶栏 / 聊天挂过一个
 * .platformThemeScope 类，把平台调色板重新声明回去。2026-09-19 看过真实效果后
 * 决定【整站一起跟随应用色】，那套作用域机制随即删除 —— 不在应用里的时候
 * activeSeed 本来就是 null、本来就得到平台色，不需要额外的岛。
 */
import { buildThemeVars, PLATFORM_PRIMARY } from './palette';
import type { ThemeMode, ThemeVars } from './palette';

/**
 * 只要求用得上的两个方法。
 * 窄到这个程度是有意的 —— spec 能用几行假对象测，不必引 jsdom（本仓没装）。
 */
export interface ElementLike {
  style: { setProperty(key: string, value: string): void; removeProperty(key: string): void };
}

/** 暗色的唯一真相是 setBodyThemeMode 设在 documentElement 上的 data-theme。 */
export function currentThemeMode(): ThemeMode {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyThemeVars(el: ElementLike, vars: ThemeVars): void {
  for (const [key, value] of Object.entries(vars)) el.style.setProperty(key, value);
}

/**
 * 【逐键删，不要整体清空】documentElement 的 inline style 不只有我们在写，
 * 一把 cssText = '' 会顺带抹掉别人的。
 */
export function clearThemeVars(el: ElementLike, vars: ThemeVars): void {
  for (const key of Object.keys(vars)) el.style.removeProperty(key);
}

/**
 * 当前生效的应用色；null = 平台色。
 *
 * 【为什么用模块级状态】它建模的本来就是一件全局的事 ——「此刻 document 上
 * 挂的是哪一套调色板」。把它收成唯一真相之后，明暗切换只需要一个观察者、
 * 重算时自己知道该用哪个种子，不存在「平台那一刷把应用色冲掉」的竞态。
 *
 * 【原方案为什么不行】最初是让 setBodyThemeMode 调 installPlatformTheme()、
 * 再让 AppThemeScope 各挂一个观察者把应用色盖回去。两个问题：
 *   1. setBodyThemeMode 在 src/utils/common.ts 里，而那个文件被 788 个文件引用。
 *      往它里面 import 主题引擎 = 把 antd 的 theme 模块拽进每一个入口，
 *      包括完全不用 antd 的分享页和打印页。
 *   2. 两个观察者写同一个属性，谁赢取决于注册顺序 —— 能用，但脆。
 */
let activeSeed: string | null = null;

/**
 * 按当前的 activeSeed + 明暗模式重刷 documentElement 上的调色板。
 * 整站【只有这一处】写主题变量，顶栏和聊天也跟着一起变。
 */
function repaint(): void {
  applyThemeVars(document.documentElement, buildThemeVars(activeSeed || PLATFORM_PRIMARY, currentThemeMode()));
}

let modeObserverInstalled = false;

/**
 * 启动时调一次（preall 模块级）。幂等。
 *
 * 【为什么自己盯 data-theme，而不是让切主题的人来通知】主题切换没有统一事件：
 * setBodyThemeMode 有 5 个调用点（chat 的 ThemeMode 抽屉、门户用户抽屉、
 * 移动端我的页，以及 globalEvents.ts 里两处跟随系统配色的）。
 * documentElement 上的 data-theme 属性本身才是那条唯一可靠的信号。
 */
export function installPlatformTheme(): void {
  repaint();

  if (modeObserverInstalled || typeof MutationObserver === 'undefined') return;
  modeObserverInstalled = true;

  new MutationObserver(repaint).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

/** 进入某个应用时调。同色重复调用是空操作，省掉无谓的重绘。 */
export function applyAppTheme(seed: string): void {
  if (activeSeed === seed) return;

  activeSeed = seed;
  repaint();
}

/** 离开应用时调 —— 不是「清空」，是「还原成平台色」。 */
export function resetToPlatformTheme(): void {
  if (activeSeed === null) return;

  activeSeed = null;
  repaint();
}
