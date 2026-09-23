import { generate } from '@ant-design/colors';
import { TinyColor } from '@ctrl/tinycolor';
import { rampLevel } from 'src/common/theme/palette';

/**
 * 选项色标签（chip）的配色。
 *
 * 【规则（2026-09-23 用户定）】底色 = 用户选的颜色，原样使用，明暗两套主题相同 ——
 * 设置时看到的颜色就是显示出来的颜色。字色自动挑：
 *   1. 同色系深字（antd 色阶第 8~10 级里第一个够 4.5 的）够得着就用它：黄底配棕字、浅蓝底配深蓝字；
 *   2. 够不着就看近黑字够不够 4.5，够就近黑，不够就白。
 * 近中性色（灰）没有色相可用，直接走第 2 步。
 *
 * 【已知取舍】底色既然是原色，内置 20 色里饱和的蓝、红、粉三色不管配什么字
 * 都到不了 4.5（白字 4.10 / 4.09 / 3.90），这三色给白字，理由见 pickText。原版 HAP 是 7 色不达标 ——
 * 旧的 isLightColor（一张手工名单 + TinyColor 亮度 128 一刀切）让橙、绿、青、黄都配白字，
 * 白字压黄底只有 1.42；现在按对比度挑，这几色配的是同色深字。
 *
 * 【为什么不是之前那版】2026-09-22 曾改成「原色 22% 的浅底 + 同色深字」，20 色全部达标，
 * 但设置时选的颜色和实际显示的底色对不上（显示的是淡了很多的同色），用户决定以一致为先。
 * 不要为了那 3 色把底色再调淡 —— 那正是被否掉的方案。
 */

/** 低于这个饱和度就认为「没有色相」，不拿 HSL 的 h 去造同色深字（灰的 h 是 0，会造出红色阶） */
const ACHROMATIC_S = 0.12;

/** 正文判据。标签字号普遍 12~13px，按正文算。 */
const AA_BODY = 4.5;

/** 近黑字：antd 正文色（88% 不透明的黑）叠在白底上的实色 */
const NEAR_BLACK = '#1f1f1f';
const WHITE = '#ffffff';

export interface OptionChipStyle {
  /** 直接给 background 用 */
  background: string;
  /** 直接给 color 用 */
  color: string;
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = new TinyColor(hex).toRgb();
  const lin = (channel: number) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** 把前景按 alpha 叠到白底上，得到实色 —— 只用来判对比度，不用来渲染 */
function flattenOnWhite(color: TinyColor): string {
  const { r, g, b, a } = color.toRgb();
  return new TinyColor({
    r: r * a + 255 * (1 - a),
    g: g * a + 255 * (1 - a),
    b: b * a + 255 * (1 - a),
  }).toHexString();
}

/**
 * 归一成「antd 色阶第 6 档该长的样子」再交给 generate()。
 *
 * generate() 是按【饱和的种子色】设计的：把色板前半截那些已经很淡的颜色直接喂进去，
 * 整条色阶会跟着一起变淡，深档不够深。所以先把亮度/饱和度拉回中间档，色相保持不变。
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

/** 在实色底上挑字色 */
function pickText(solid: string): string {
  const seed = saturatedSeed(solid);
  if (seed) {
    const ramp = generate(seed);
    const sameHue = [7, 8, 9].map(i => rampLevel(ramp, i)).find(c => contrast(c, solid) >= AA_BODY);
    if (sameHue) return sameHue;
  }
  // 近黑和白不可能同时够 4.5（近黑要底色亮度 ≥ 0.237，白要 ≤ 0.183），所以这一行就是「挑够 4.5 的那个」。
  // 两个都够不着的是亮度落在两者之间的一窄条（饱和的蓝、红、粉），这里给白字：WCAG 2 下两者只差零点几，
  // 按感知对比度 APCA 算，白字 Lc 约 71、近黑只有约 35 —— WCAG 2 在中间调上会高估深字，这是它的已知缺陷。
  // 原版 HAP 和 antd 在这几色上也都是白字。
  return contrast(NEAR_BLACK, solid) >= AA_BODY ? NEAR_BLACK : WHITE;
}

const cache = new Map<string, OptionChipStyle>();

/**
 * 给一个选项色，算出标签用的底色和文字色。结果与明暗主题无关。
 *
 * @param color 用户选的选项色。选项色板的 ColorPicker 存的是 8 位 hex（#rrggbbaa），也可能带透明度
 */
export function getOptionChipStyle(color: string): OptionChipStyle {
  const hit = cache.get(color);
  if (hit) return hit;

  const parsed = new TinyColor(color);
  // 颜色不合法时不要产出一串 NaN：退回纯中性，标签至少还是可读的
  if (!parsed.isValid) {
    const fallback: OptionChipStyle = {
      background: 'var(--color-background-secondary)',
      color: 'var(--color-text-title)',
    };
    cache.set(color, fallback);
    return fallback;
  }

  const opaque = parsed.getAlpha() >= 1;
  const style: OptionChipStyle = opaque
    ? { background: parsed.toHexString(), color: pickText(parsed.toHexString()) }
    : // 半透明的选项色照原样半透明着画；字色按叠在白底上的样子挑（表单和表格的底都是白的）
      { background: parsed.toRgbString(), color: pickText(flattenOnWhite(parsed)) };
  cache.set(color, style);
  return style;
}

/** 供 spec 用 */
export const __internal = { contrast, saturatedSeed, AA_BODY, NEAR_BLACK, WHITE };
