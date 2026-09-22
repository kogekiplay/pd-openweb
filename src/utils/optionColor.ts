import { generate } from '@ant-design/colors';
import { TinyColor } from '@ctrl/tinycolor';

/**
 * 选项色标签（chip）的配色。
 *
 * 【解决的是什么】选项色是**用户自己选的业务数据**（20 色色板，还能自定义），
 * 而标签一直是「实心原色底 + 黑或白字」。实测 20 色里 7 色不达标，
 * 最差的是白字压在黄色上只有 1.42 —— 基本看不清。
 * 而且黑白两种字色都救不了其中 5 色（蓝/红/粉那几档两边都只有 3.9~4.3）：
 * 只要底色是原色，字色怎么翻都过不了 4.5。
 *
 * 【改成什么】浅底 + 同色深字（GitHub 标签那种）：
 *   底 = 原色按 22% 叠在当前表面上（用 color-mix，所以明暗两套主题各自叠各自的底）
 *   字 = antd 色阶里【第一个够 4.5 的那一档】
 * 20 色实测全过，色相识别也保住 —— 黄标签仍是黄的，只是不再是荧光块配白字。
 *
 * 【为什么字色按对比度挑档、而不是固定取第 8 级】不同色相的色阶深浅不一样：
 * 蓝色第 8 级就有 7.3，黄色第 8 级只有 3.29、得往下走一档。
 * 固定下标等于赌每个色相都一样，实测就是不一样。
 *
 * 【近中性色不造色相】灰色的 HSL 色相是没有意义的（TinyColor 给 0，也就是红），
 * 直接把浅灰交给 generate() 会得到一条【红色】色阶 —— 灰标签配深红字。
 * 所以饱和度低于阈值的一律走中性文字档。
 */

export type ThemeMode = 'light' | 'dark';

/** 底色占比。16% 也能全过，取 22% 是为了标签本身看得出颜色（对白底 1.09~1.53）。 */
const TINT = 0.22;

/** 低于这个饱和度就认为「没有色相」，走中性文字档，不要拿 HSL 的 h 去造色 */
const ACHROMATIC_S = 0.12;

/** 正文判据。标签字号普遍 12~13px，按正文算。 */
const AA_BODY = 4.5;

/** 两套主题各自的页面底色，用来把半透明的标签底算成实色再判对比度。 */
const SURFACE: Record<ThemeMode, string> = { light: '#ffffff', dark: '#161616' };

export interface OptionChipStyle {
  /** 直接给 background 用 */
  background: string;
  /** 直接给 color 用 */
  color: string;
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = new TinyColor(hex).toRgb();
  const lin = [r, g, b].map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** 把前景按 alpha 叠到底色上，得到实色 —— 用来判对比度，不用来渲染 */
function flatten(color: string, surface: string, alpha: number): string {
  const f = new TinyColor(color).toRgb();
  const b = new TinyColor(surface).toRgb();
  return new TinyColor({
    r: f.r * alpha + b.r * (1 - alpha),
    g: f.g * alpha + b.g * (1 - alpha),
    b: f.b * alpha + b.b * (1 - alpha),
  }).toHexString();
}

/**
 * 归一成「antd 色阶第 6 档该长的样子」再交给 generate()。
 *
 * generate() 是按【饱和的种子色】设计的：把色板前半截那些已经很淡的颜色直接喂进去，
 * 整条色阶会跟着一起变淡，第 8 级只有 3.07，怎么挑都不够。
 * 所以先把亮度/饱和度拉回中间档，色相保持不变。
 *
 * 返回 null 表示这个颜色近中性、没有色相可用。
 */
function saturatedSeed(color: string): string | null {
  const c = new TinyColor(color);
  const { h, s, l } = c.toHsl();
  if (s < ACHROMATIC_S) return null;
  // 本来就在中间档的（色板后半截那 10 个饱和色）原样用，避免无谓地改动它们的色阶
  if (s >= 0.5 && l >= 0.35 && l <= 0.62) return c.toHexString();
  return new TinyColor({ h, s: Math.max(s, 0.72), l: 0.5 }).toHexString();
}

const cache = new Map<string, OptionChipStyle>();

/**
 * 给一个选项色，算出标签用的底色和文字色。
 *
 * @param color 用户选的选项色，任何 TinyColor 认得的写法
 * @param mode  当前主题。默认读 documentElement 的 data-theme
 */
export function getOptionChipStyle(color: string, mode?: ThemeMode): OptionChipStyle {
  const themeMode: ThemeMode =
    mode || (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  const key = `${color}|${themeMode}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const parsed = new TinyColor(color);
  // 颜色不合法时不要产出一串 NaN：退回纯中性，标签至少还是可读的
  if (!parsed.isValid) {
    const fallback: OptionChipStyle = {
      background: 'var(--color-background-secondary)',
      color: 'var(--color-text-title)',
    };
    cache.set(key, fallback);
    return fallback;
  }

  const hex = parsed.toHexString();
  // 用 color-mix 而不是算好的实色：明暗两套主题各自叠各自的表面色，
  // 标签放在卡片上还是页面上也都对。
  const background = `color-mix(in srgb, ${hex} ${Math.round(TINT * 100)}%, transparent)`;
  // 判对比度得用实色，这里按页面底色估一个最坏情况
  const flat = flatten(hex, SURFACE[themeMode], TINT);

  const seed = saturatedSeed(hex);
  let text = 'var(--color-text-title)';
  if (seed) {
    const ramp =
      themeMode === 'dark' ? generate(seed, { theme: 'dark', backgroundColor: SURFACE.dark }) : generate(seed);
    // 从第 8 级往末尾找第一个够 4.5 的。两套主题的下标范围相同不是巧合：
    // antd 的暗色阶本来就是反着排的（下标越大越亮），所以"往对比度更高的方向走"
    // 在两边都是下标递增。
    const picked = [7, 8, 9].map(i => ramp[i]).find(c => contrast(c, flat) >= AA_BODY);
    text = picked || ramp[9];
  }

  const style: OptionChipStyle = { background, color: text };
  cache.set(key, style);
  return style;
}

/** 供 spec 和调试用：算出标签底色叠成实色之后的值 */
export function flattenedChipBackground(color: string, mode: ThemeMode = 'light'): string {
  return flatten(new TinyColor(color).toHexString(), SURFACE[mode], TINT);
}

/** 供 spec 用 */
export const __internal = { contrast, saturatedSeed, TINT, AA_BODY, SURFACE };
