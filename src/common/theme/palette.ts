/**
 * 主题调色板：种子色 -> CSS 自定义属性。
 *
 * 【为什么是纯函数】它是整个主题引擎唯一有逻辑的地方，另外两层
 * （写 DOM、React 挂载）薄到只剩三五行。纯函数才能被本仓的 spec
 * runner 测到 —— 本仓没有 jsdom/vitest/jest，79 个 spec 全是
 * node + assert，不存在「渲染一个组件再断言」这个选项。
 *
 * 【为什么用 getDesignToken 而不是 theme.useToken()】两者产出同一套
 * token，但前者是纯函数、不要求在 ConfigProvider 子树里调用。设计文档里
 * 「useToken 的调用位置」那条风险因此直接不存在了。
 *
 * 【调色板绝不能分叉】下面每个值要么原样取自 antd 的 token，要么是对
 * token 加一档透明度。我们【不】自己算 lighten/darken —— 那样 antd 组件
 * 和我们的 Less 会得到两种不同的蓝，正是这次要修的病。
 * palette.spec.ts 第 2 组断言专门钉这条，改成自算会当场红。
 */
import { theme } from 'antd';
import { readability, TinyColor } from '@ctrl/tinycolor';

export type ThemeMode = 'light' | 'dark';
export type ThemeVars = Record<string, string>;

/**
 * 平台色 = theme-default.less 里 --color-primary 的字面值。
 * 以后要做「组织级品牌色」的话，改成从组织设置里读即可，这里是唯一入口。
 */
export const PLATFORM_PRIMARY = '#1677ff';

/**
 * 透明档的取值。明暗两套【故意不同】，直接照搬自
 * theme-default.less（.4 / .12 / .06）与 theme-dark.less（.5 / .2 / .12）——
 * 暗底上同样的 alpha 会看不见，原作者已经调过，不要合并成一套。
 */
const ALPHA: Record<ThemeMode, { focusOuter: number; transparent: number; transparentLight: number }> = {
  light: { focusOuter: 0.4, transparent: 0.12, transparentLight: 0.06 },
  dark: { focusOuter: 0.5, transparent: 0.2, transparentLight: 0.12 },
};

/**
 * 【这里【不】产出 --app-primary-color 系列，也不产出 --color-app 系列】
 *
 * · --app-primary-color / --app-primary-hover-color：
 *   src/common/mdcss/basic.css:3-5 已经把它们【别名】到语义变量上：
 *     --app-primary-color: var(--color-primary);
 *     --app-primary-hover-color: var(--color-link-hover);
 *   所以它们本来就跟着主色走，这里再定义一遍等于造第二个真相源；
 *   而且 hover 那个会被悄悄从 --color-link-hover 改成 colorPrimaryHover。
 *
 *   运行期原本还有两个注入器临时覆盖它们（WorkSheet 的 changeAppThemeColor、
 *   utils/common 的 setAppThemeColor）。2026-09-19 两个都已退役 ——
 *   它们注入的是 `:root` 规则，而本模块写的是 documentElement 的 inline style，
 *   后者恒压过前者，所以自打主题引擎上线，那两处注入其实已经是死代码了。
 *
 * 【--app-highlight-color 是例外：这里【要】产出】
 *   它全局本来没有定义，只由那两个注入器临时产生。原先的判断是「别定义，
 *   留着 var(--app-highlight-color, var(--color-mingo-transparent)) 那处兜底」。
 *   2026-09-19 张奇拍板：AI 助手跟随主题色。注入器退役后，不在这里产出它，
 *   应用的 Chatbot 就会掉回 Mingo 紫 —— 那是把决定反过来做了。
 *
 *   【为什么不会波及 Mingo 全局助手的紫】读取点只有一个
 *   （components/Mingo/ChatBot/components/MessageList.tsx），而且挂在
 *   `&.useAppThemeColor` 类下面 —— 这个类是按实例挂的：应用的 Chatbot 挂，
 *   Mingo 全局助手不挂。不挂的那条分支读的是 --color-mingo-transparent，
 *   跟本变量无关。所以「Mingo 必须保持紫」和「AI 助手跟随主题色」并不冲突。
 *
 *   alpha 取 0.2，跟退役掉的注入器逐字一致，观感不变。
 *
 * · --color-app 系列：真·死变量（全仓无赋值），已在同批改指 --color-primary 后删除。
 */
function alpha(color: string, a: number): string {
  return new TinyColor(color).setAlpha(a).toRgbString();
}

/**
 * 中性色阶往主色色相偏一点，让整个界面「带上主题感」，而不是只有主按钮变色。
 *
 * 【为什么不是把这些直接换成主色】它们是图标、次要文字、分隔线、浅底 ——
 * 换成主色会毁掉可读性和层级。正确的做法是保留明度、只偏色相。
 *
 * 【为什么文字和背景两档强度】文字要担对比度，背景和边框不担。
 * 定这两个数时次要文字对白底只有 4.61（AA 正文门槛 4.5），混 15% 暖色就会掉破线，
 * 所以文字取 10%、背景与边框取 32%。冷色方向反而会把对比度略微推高，瓶颈是暖色。
 *
 * 【2026-09-21 起亮色文字档位整体加深了，这里的裕量比当初宽】
 * 次要文字从 4.61 提到 6.58（弱化说明那一档原本 2.68，任何字号都不达标，
 * 提到 4.54）。但 TINT_TEXT 仍保持 10 —— 裕量变宽不等于该顺手调它，
 * 那是另一个决定，要单独验。
 *
 * 【不参与染色的三类】主体表面（页面底、卡片底、输入框底）与正文主文字：
 * 它们是「纸和墨」，染了会让整站发闷、长文阅读变累。
 */
const TINT_TEXT = 10;
const TINT_SURFACE = 32;

/** 中性色阶的基准值，逐字抄自 theme-default.less / theme-dark.less。 */
const NEUTRALS: Record<ThemeMode, Record<string, [string, number]>> = {
  light: {
    '--color-text-secondary': ['#5d5d5d', TINT_TEXT],
    '--color-text-tertiary': ['#767676', TINT_TEXT],
    '--color-text-title': ['#454545', TINT_TEXT],
    '--color-text-placeholder': ['#cccccc', TINT_TEXT],
    '--color-text-disabled': ['#bdbdbd', TINT_TEXT],
    '--color-border-primary': ['#dddddd', TINT_SURFACE],
    '--color-border-secondary': ['#eaeaea', TINT_SURFACE],
    '--color-border-tertiary': ['#cccccc', TINT_SURFACE],
    '--color-border-hover': ['#bdbdbd', TINT_SURFACE],
    '--color-border-strong': ['#9e9e9e', TINT_SURFACE],
    '--color-background-secondary': ['#fafafa', TINT_SURFACE],
    '--color-background-tertiary': ['#f5f5f5', TINT_SURFACE],
    '--color-background-hover': ['#f5f5f5', TINT_SURFACE],
    '--color-background-disabled': ['#f0f0f0', TINT_SURFACE],
  },
  dark: {
    '--color-text-secondary': ['#b3b3b3', TINT_TEXT],
    '--color-text-tertiary': ['#8c8c8c', TINT_TEXT],
    '--color-text-title': ['#f2f2f2', TINT_TEXT],
    '--color-text-placeholder': ['#6f6f6f', TINT_TEXT],
    '--color-text-disabled': ['#5e5e5e', TINT_TEXT],
    '--color-border-primary': ['#3c3c3c', TINT_SURFACE],
    '--color-border-secondary': ['#2a2a2a', TINT_SURFACE],
    '--color-border-tertiary': ['#484848', TINT_SURFACE],
    '--color-border-hover': ['#525252', TINT_SURFACE],
    '--color-border-strong': ['#606060', TINT_SURFACE],
    '--color-background-secondary': ['#090909', TINT_SURFACE],
    '--color-background-tertiary': ['#1f1f1f', TINT_SURFACE],
    '--color-background-hover': ['#393939', TINT_SURFACE],
    '--color-background-disabled': ['#141414', TINT_SURFACE],
  },
};

/**
 * 偏色相但【保住明度】。
 *
 * 只 mix 是不够的：mix 会把明度一起拉向主色，于是暖色主题下次要文字会变亮、
 * 对白底的对比度掉到 WCAG AA 以下（实测纯橙 #ff9800 下掉到 4.28）。
 * 所以 mix 之后再把 HSL 的 L 调回去，直到相对亮度与原值一致 ——
 * 二分 12 轮足够收敛到肉眼无差。
 */
function tintPreservingLuminance(base: string, primary: string, strength: number): string {
  const target = new TinyColor(base).getLuminance();
  const mixed = new TinyColor(base).mix(primary, strength).toHsl();

  let lo = 0;
  let hi = 1;
  let best = mixed.l;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const lum = new TinyColor({ ...mixed, l: mid }).getLuminance();
    best = mid;
    if (lum > target) hi = mid;
    else lo = mid;
  }
  return new TinyColor({ ...mixed, l: best }).toHexString();
}

function tintedNeutrals(primary: string, mode: ThemeMode): ThemeVars {
  const out: ThemeVars = {};
  for (const [name, [base, strength]] of Object.entries(NEUTRALS[mode])) {
    out[name] = tintPreservingLuminance(base, primary, strength);
  }
  return out;
}

export function buildThemeVars(seed: string, mode: ThemeMode = 'light'): ThemeVars {
  // 非法色不能让整站没主题色。TinyColor 对乱字符串返回 isValid=false 而不是抛，
  // 但 antd 的算法拿到它会产出一串 NaN 颜色，界面会变成透明/黑块 —— 比抛错更难查。
  // 空串同样走这里：应用刚建出来时 iconColor 可能是空的。
  const safeSeed = seed && new TinyColor(seed).isValid ? seed : PLATFORM_PRIMARY;

  const token = theme.getDesignToken({
    token: { colorPrimary: safeSeed },
    ...(mode === 'dark' ? { algorithm: theme.darkAlgorithm } : {}),
  });

  const a = ALPHA[mode];
  const primary = token.colorPrimary;

  return {
    // ——— 主色（theme-default.less 的 7 个）———
    '--color-primary': primary,
    '--color-primary-light': token.colorPrimaryHover,
    '--color-primary-dark': token.colorPrimaryActive,
    '--color-primary-focus': primary,
    '--color-primary-focus-outer': alpha(primary, a.focusOuter),
    // 应用 Chatbot 的消息底色。Mingo 全局助手不挂 .useAppThemeColor，读不到这个值。
    '--app-highlight-color': alpha(primary, 0.2),
    '--color-primary-transparent': alpha(primary, a.transparent),
    '--color-primary-transparent-light': alpha(primary, a.transparentLight),

    // ——— 淡色档（2026-09-19 补）———
    // theme-default.less 原本只有上面 7 档，缺「淡底 / 淡边框」这两级，
    // 于是选中态那类淡蓝只能写死（Cascader、TagTextarea 都是）。
    // 用透明档代替不行：主色 12% 透明在白底上混出来的那个色，
    // 比 antd 的 colorPrimaryBorder 淡得多，换上去边框会明显变虚。
    // 直接从 antd token 读回这两级，和上面几档同源，不会分叉。
    '--color-primary-bg': token.colorPrimaryBg,
    '--color-primary-border': token.colorPrimaryBorder,

    // ——— 带主题倾向的中性色阶 ———
    // 图标、次要文字、分隔线、浅底都走这一套；不含页面底/卡片底/输入框底/正文主文字。
    ...tintedNeutrals(primary, mode),

    // ——— 主题色【之上】的前景色 ———
    // 应用顶栏/左侧导航的底色就是应用色（或它的淡底），上面的文字和图标是
    // 「盖在主题色之上的可读前景」，不是该跟随主题的色 —— 直接换成主色会看不见。
    // 所以只把基色从纯黑/纯白往主色偏一点点，透明度层级由调用点用
    // color-mix(..., transparent) 原样保留。
    //
    // 【强度只有 8%，是被对比度逼出来的】任何色相混进纯黑/纯白都会削弱极值。
    // 实测 rgba(墨,0.4) 落在淡底上：纯黑 2.82，混 8% 是 2.65-2.74，混 18% 掉到 2.47。
    // 8% 是「看得出色相倾向」与「几乎不掉对比度」的折中。
    // 真正让顶栏有主题感的是背景和边框那一侧（它们改用主色，见 AppPkgHeader/index.less）。
    '--color-on-app-ink': onInk(primary),
    '--color-on-app-paper': onPaper(primary),

    // ——— 主题色的【实心面】：按钮、徽标、分页当前页 ———
    // 见 solidPrimary 的说明：主色太浅就换用它的深色档，而不是把白字翻成黑字。
    '--color-primary-solid': solidPrimary(primary, token.colorPrimaryActive),
    '--color-primary-solid-hover': solidPrimaryHover(primary, token.colorPrimaryActive),
    // 压在上面那个实心面上的文字。绝大多数情况下是白 ——
    // 因为实心面已经保证够深了。留着这一层是为了兜住极端浅色（比如纯黄），
    // 那种连深色档都撑不住白字，只能翻墨色。
    '--color-on-primary': onSolidPrimary(solidPrimary(primary, token.colorPrimaryActive)),
  };
}

const PURE_INK = '#000000';
const PURE_PAPER = '#ffffff';

/** 主题色【淡底】上的墨色/纸色：只把纯黑纯白往主色偏一点点（理由见上面那段注释）。 */
function onInk(primary: string): string {
  return new TinyColor(PURE_INK).mix(primary, 8).toHexString();
}
function onPaper(primary: string): string {
  return new TinyColor(PURE_PAPER).mix(primary, 8).toHexString();
}

/**
 * 主题色的【实心面】：主按钮、徽标、分页当前页这种「大块彩底 + 文字」。
 *
 * 【为什么不能直接用主色】用户可以把主题色设成任意颜色，而这些地方一律配白字。
 * 主色一浅白字就读不清 —— 2026-09-21 实测生产上 13 个真实应用主题色，
 * 4 个配白字连 3:1 都到不了（最低 2.28）。
 *
 * 【为什么是换底色，不是把白字翻成黑字】
 * 这条是**被张奇的反馈纠正过来的**，值得写清楚：
 * 第一版做的是翻字色（见 onSolidPrimary），按 WCAG 算橙底黑字 7.58 远高于
 * 白字 2.77，数字上是大胜。但他一眼就说「可见度变差了」——**他是对的**：
 *   · WCAG 2.x 的对比度公式**不区分明暗极性**，同一个比值下「深底浅字」和
 *     「浅底深字」的实际观感并不对称。这正是 WCAG 3 要换成 APCA 的原因。
 *   · 更要紧的是，主按钮的"可见度"还包含**它像不像一个主操作**。
 *     彩底黑字读起来像警告标签，白字压彩底才是主按钮的惯常分量。
 *   我用一个只测字形可辨度的指标，去回答了一个关于视觉分量的问题。
 *
 * 换底色两头都占：白字保住（分量不变），对比度也够 ——
 * 那 4 个色换成深色档之后分别是 3.49 / 4.29 / 4.23 / 4.34，全部过 3:1。
 * 而且深色档是**同色相的派生色**，不是另一个颜色，观感上温和得多。
 *
 * 【只在不达标时才换】达标的 9 个色，实心面就是主色本身，一点不变。
 */
export function solidPrimary(primary: string, primaryActive: string): string {
  return readability(primary, PURE_PAPER) >= 3 ? primary : primaryActive;
}

/**
 * 实心面的悬停色。
 *
 * 常态是主色时 -> 悬停加深（深色档），这是原来的行为，9 个达标的色一点不变。
 * 常态【已经】是深色档时 -> 悬停回到主色，也就是**变亮**。
 * 后者是被迫的：antd 的 token 里没有比 colorPrimaryActive 更深的一档，
 * 而本模块有一条硬规矩 —— **调色板绝不自算 lighten/darken**（见文件头），
 * 自算会让 antd 组件和我们的 Less 分叉出两种颜色。
 * 「悬停变亮」本身是常见做法，不是将就。
 */
export function solidPrimaryHover(primary: string, primaryActive: string): string {
  return solidPrimary(primary, primaryActive) === primary ? primaryActive : primary;
}

/**
 * 压在【实心面】上的前景色：白字够读就用白，不够才翻成墨色。
 *
 * 【这一层现在基本不会触发】实心面已经保证够深了，13 个真实色全都走白字。
 * 留着是为了兜住极端浅色（纯黄那种）：连深色档都撑不住白字时，
 * 翻墨色总比读不清强。
 *
 * 【为什么需要它】用户可以把应用主题色设成任意颜色，而全仓有一批地方
 * 写死了白字（`.textWhite` 那一类）。主色一浅，白字就读不清 ——
 * 2026-09-21 实测生产上 13 个应用主题色，**4 个连 3:1 都到不了**
 * （青 2.28、灰 2.54、橙 2.77、绿 2.78），按钮上的字是糊的。
 *
 * 【阈值是 3 不是 4.5，而且【不能】写成「谁对比高用谁」】
 * 这两处都是被实测逼出来的：
 * · 用 4.5 或者「取更高的那个」，13 个色里会翻掉 6-12 个 ——
 *   包括白字本来就够用的蓝色（3.12）。那是纯粹多余的改动，
 *   而且「深蓝底黑字」才是真正看着怪的东西。
 * · 用 3 且只在不达标时翻，**只动那 4 个本来就坏的**，其余 9 个一点不变。
 *   3 这个数字也对得上实际用法：压在主色上的基本是按钮/徽标文字，
 *   14px 加粗，正好落在 WCAG 的 large text 档。
 *
 * 【这里用纯黑纯白，【不】走 onInk/onPaper 那套 8% 偏色】
 * 第一版用了带偏色的版本，实测多翻掉一个：生产上那个中蓝配纯白是 3.12（够），
 * 但混了 8% 蓝的"纸色"压到 3 以下，就被判成不达标。
 * （注释里不写字面色值 —— check:colors 棘轮连注释一起数。具体色值见 palette.spec.ts。）
 * 这正是上面那段注释警告过的「任何色相混进纯黑/纯白都会削弱极值」。
 * 淡底上牺牲一点对比换色相倾向是划算的；**压在实心主色上，对比度就是全部意义**，
 * 为 8% 的色相倾向把字弄糊是本末倒置。
 */
export function onSolidPrimary(primary: string): string {
  return readability(primary, PURE_PAPER) >= 3 ? PURE_PAPER : PURE_INK;
}

/**
 * 给 `<ConfigProvider theme={...}>` 用的 antd 主题配置。
 *
 * 【为什么要有这个函数，而不是三处各写各的】全仓有三个地方要配 antd 主题
 * （路由根 / 应用层 / FunctionWrap 的命令式挂载），逻辑必须一致 ——
 * 三份拷贝迟早走样，而走样的表现是「某些弹层里的按钮和主界面不一样深」，
 * 没人会往主题配置上想。
 *
 * 【为什么 Button 要单独覆盖 colorPrimary】antd 的实心主按钮直接拿全局
 * colorPrimary 当底色。主色太浅时白字读不清（见 solidPrimary），
 * 但又【不能】把全局 colorPrimary 改成深色档 —— 那会把链接、选中态、
 * 进度条这些「非实心面」也一起加深，主题就不是用户选的那个颜色了。
 * 所以只在 Button 这个组件作用域里换底色。
 */
export function antdTheme(seed: string): {
  token: Record<string, string>;
  components: Record<string, Record<string, string>>;
} {
  const safeSeed = seed && new TinyColor(seed).isValid ? seed : PLATFORM_PRIMARY;
  const t = theme.getDesignToken({ token: { colorPrimary: safeSeed } });
  const solid = solidPrimary(t.colorPrimary, t.colorPrimaryActive);

  return {
    // colorTextLightSolid = 压在实心主色上的文字。按【实心面】算，不是按主色算 ——
    // 底色已经换深了，这里几乎总是白。
    token: { colorPrimary: t.colorPrimary, colorTextLightSolid: onSolidPrimary(solid) },
    components: {
      Button: {
        colorPrimary: solid,
        colorPrimaryHover: solidPrimaryHover(t.colorPrimary, t.colorPrimaryActive),
        colorPrimaryActive: solid,
      },
    },
  };
}

/** 拼成可直接塞进 <style> 的声明串。 */
export function themeVarsToCssText(vars: ThemeVars): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}
