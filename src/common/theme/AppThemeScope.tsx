import { useEffect } from 'react';
import _ from 'lodash';
import { applyAppTheme, resetToPlatformTheme } from './applyThemeVars';

/**
 * 从 localStorage 的 appCache-{appId} 里取应用色。
 *
 * 【为什么需要它】取应用详情的是应用顶栏组件（AppPkgHeader/AppDetail），
 * 而工作流页 / 用户页 / 工作流编辑页都【不渲染顶栏】。直接刷新这些页面时
 * appPkg 一直是 defaultState，整站就停在平台蓝。
 *
 * 这份缓存是产品自己维护的（AppDetail 读它做首屏预填），不是我们新造的存储。
 * 它可能过期，但只在「真详情拿不到」时才用；下次经过带顶栏的页面就会刷新。
 */
/**
 * 从当前 URL 里认出「这是哪个应用的页面」。
 *
 * 【为什么要有这个】一批属于应用、却不在 Application 路由树里的顶层页面
 * 拿不到 appPkg，主题就停在平台蓝。它们的共同点是 appId【就写在 URL 里】，
 * 只是位置不同：
 *   · /app/{appId}/...                                 路径段
 *   · /worksheetapi/{appId}、/printForm/{appId}/...     别的前缀 + 同样的路径段
 *   · /worksheet/field/edit?fromURL=/app/{appId}/...    查询串里的回跳地址
 *   · ?appId={appId}                                    查询串直给
 * 按 URL 认领比「记住上次进过哪个应用」可靠：后者在同一标签页里刷新
 * 平台页（比如 /admin）时会把应用色错误地带过去。
 *
 * 【为什么要把前缀一个个列出来，不直接认「路径里的任意 36 位 uuid」】
 * 同样长相的 uuid 在别的路由里是【别的东西】—— 后台管理那批路由的第一段是
 * projectId（组织 id），拿它去读 appCache 要么读不到、要么读到同 id 的别的东西。
 * 加新路由时在这里补前缀即可，比放宽正则安全。
 */
const APP_ID_IN_PATH = /\/(?:app|worksheetapi|printForm)\/([0-9a-f-]{36})(?:\/|$)/i;

export function getAppIdFromLocation(): string | undefined {
  const inPath = APP_ID_IN_PATH.exec(location.pathname);
  if (inPath) return inPath[1];

  const params = new URLSearchParams(location.search);

  const direct = params.get('appId');
  if (direct) return direct;

  const fromUrl = params.get('fromURL');
  if (fromUrl) {
    const inFrom = APP_ID_IN_PATH.exec(fromUrl);
    if (inFrom) return inFrom[1];
  }

  return undefined;
}

export function getCachedAppColor(appId?: string): string | undefined {
  if (!appId) return undefined;

  const cached = window.safeParse(localStorage.getItem(`appCache-${appId}`));
  return _.get(cached, 'iconColor');
}

/**
 * 按【当前 URL】把主题调到位：URL 属于某个应用就用那个应用的色，否则回平台色。
 *
 * 【为什么主题要由路由驱动，而不是由组件挂载驱动】
 * 原来是 AppThemeScope 挂载时上色、卸载时 resetToPlatformTheme。
 * 从应用页跳到 /worksheet/field/edit 这类【顶层但仍属于该应用】的页面时，
 * 顺序是「新页面想要应用色」→「Application 卸载把它重置成平台色」，
 * 后者永远赢 —— 这是个改不掉的时序竞争，只要还靠挂载/卸载就一直存在。
 * 改成每次导航按 URL 重算之后，这个竞争不存在了。
 */
/**
 * 这些顶层路由属于某个应用，但 URL 里【说不出是哪个】—— 只有 worksheetId
 * 或 flowId。它们是 withoutHeaderPathList（router/config.ts:320+）里那批
 * 「不挂平台顶栏」的页面中、确定归某个应用管的那部分。
 *
 * 【怎么发现的】张奇实测：从 /worksheet/field/edit 点「更多设置」，
 * 地址变成 /worksheet/formSet/edit/:worksheetId —— fromURL 没带过去，
 * 于是按 URL 认不出应用，主题当场掉回平台蓝；刷新同理。
 */
const APP_OWNED_TOPLEVEL =
  /^\/(workflowedit|workflowplugin|printForm|worksheet\/(field\/edit|form\/edit|formSet\/edit|uploadTemplateSheet))/i;

/**
 * 【为什么要在 sessionStorage 里记一份「当前在哪个应用里」】
 * 上面那批路由自己说不出应用身份，但【进来之前】那一步说得出：
 * 从应用内跳过去时 URL 带 fromURL，或者干脆就是 /app/{appId}/... 本身。
 * 把那一刻认出来的 appId 记住，后面在这一族路由之间怎么跳、怎么刷新都还在。
 *
 * 选 sessionStorage 不是 localStorage：作用域正好是「一个标签页」——
 * 刷新保留（这正是要修的症状），新开的空白标签页不会莫名其妙带上应用色。
 * window.open 出来的新标签页会从 opener 复制一份，所以「在新窗口打开表单设计」
 * 也能接上。
 *
 * 只在【确认不在任何应用里】时清掉（见下面 forgetAppScope 的调用点），
 * 所以它不会把应用色粘到 /admin、/dashboard 这些平台页上。
 */
const APP_SCOPE_KEY = 'themeAppScope';

function rememberAppScope(appId: string): void {
  try {
    sessionStorage.setItem(APP_SCOPE_KEY, appId);
  } catch (err) {
    /* 隐私模式下 sessionStorage 可能不可写，退化成「没有记忆」即可 */
  }
}

function readAppScope(): string | undefined {
  try {
    return sessionStorage.getItem(APP_SCOPE_KEY) || undefined;
  } catch (err) {
    return undefined;
  }
}

function forgetAppScope(): void {
  try {
    sessionStorage.removeItem(APP_SCOPE_KEY);
  } catch (err) {
    /* 同上 */
  }
}

export function syncThemeFromLocation(): void {
  const appId = getAppIdFromLocation();

  // ① URL 自己说得出是哪个应用 —— 最可靠，顺手记下来给 ② 用。
  if (appId) {
    rememberAppScope(appId);
    const color = getCachedAppColor(appId);
    color ? applyAppTheme(color) : resetToPlatformTheme();
    return;
  }

  // ② 属于应用但 URL 说不出 —— 用记忆里的那个。
  //    记忆也没有（比如直接把链接贴进新标签页）就保持现状，
  //    等页面自己把 appId 交给 AppThemeScope。
  if (APP_OWNED_TOPLEVEL.test(location.pathname)) {
    const color = getCachedAppColor(readAppScope());
    if (color) applyAppTheme(color);
    return;
  }

  // ③ 确认是平台页 —— 记忆一起清掉，否则回头再进 ② 会带着上一个应用的色。
  forgetAppScope();
  resetToPlatformTheme();
}

interface Props {
  /** 应用主题色，取自 state.appPkg.iconColor。 */
  seed?: string;
  /**
   * 应用详情是否还在 store 里（传 !!state.appPkg.id）。
   *
   * 【为什么需要这个开关】appPkg 会被清空，而清空后 iconColor 回落到
   * defaultState 的平台蓝。工作流页 / 用户页不渲染应用顶栏，
   * 而顶栏组件（AppPkgHeader/AppDetail）卸载时会派发 clearAppDetail()，
   * 于是一进这两个页面整站主色就从应用色变回平台蓝 —— 张奇实测到的现象。
   *
   * 用 appPkg.id 有无判断「详情还在不在」是精确的，不是靠猜颜色：
   * 清空后 id 消失，而正常加载时它一定有值。
   */
  loaded?: boolean;
  /**
   * 当前应用的 id。seed 拿不到时用它去读 appCache-{appId} 兜底。
   * 顶层路由（如 /workflowedit/:flowId）没有 appPkg，只能走这条。
   */
  appId?: string;
}

/**
 * 进入应用时把调色板换成应用色，离开时还原成平台色。渲染 null。
 *
 * 【为什么挂在 Application 里而不是按路径判断】/app/my/* 和 /app/lib/
 * 走的是 AppHomepage/AppCenter（应用中心），不是 Application
 * —— 见 src/router/config.ts:224-231 与 :240。react-router v7 里
 * 静态段排序恒高于动态段，所以「挂在 Application 内部」这件事本身
 * 就已经把应用中心排除掉了，不需要再写一个 /^\/app\// 的谓词
 * （写了反而会把应用中心误判成应用）。
 *
 * 【为什么不靠 state.appPkg.id 判断在不在应用里】CLEAR_APP_DETAIL
 * 只在 AppDetail 卸载时派发一次（AppPkgHeader/AppDetail/index.tsx:248），
 * 不是所有应用路由都挂了它。组件自身的卸载才是可靠信号。
 */
export default function AppThemeScope({ seed, loaded = true, appId }: Props) {
  // 详情在就用详情的色，不在就退回缓存。两者都没有时不刷（保持平台色）。
  const color = loaded && seed ? seed : getCachedAppColor(appId);

  // 页面自己解出来的应用身份也要记进 tab 作用域 —— /workflowedit 就是靠这条
  // 把 flowInfo.relationId 传下去，之后跳到 /worksheet/formSet/edit 才接得上。
  useEffect(() => {
    if (appId) rememberAppScope(appId);
  }, [appId]);

  useEffect(() => {
    if (!color) return;
    applyAppTheme(color);
    // 明暗切换【不】在这里处理：主题引擎自己盯着 documentElement 的 data-theme，
    // 重算时会用当前记住的应用色。见 applyThemeVars.ts 的 activeSeed。
    //
    // 【loaded 必须进依赖】详情是异步到的：首帧 loaded=false、seed 是默认值，
    // 详情回来后 loaded 翻 true 而 seed 可能【没变】（应用色恰好等于默认值时）。
    // 漏了它那一帧就再也不会补刷。
  }, [color]);

  // 【卸载时不再重置】离开应用由 syncThemeFromLocation 在导航时统一处理。
  // 留在这里会和「新页面按 URL 上应用色」抢顺序，且卸载总是后发制人。

  return null;
}
