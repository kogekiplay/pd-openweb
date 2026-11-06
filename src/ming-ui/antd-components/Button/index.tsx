import { type CSSProperties, forwardRef, useContext, useMemo } from 'react';
import { Button as AntdButton, type ButtonProps as AntdButtonProps } from 'antd';
import { ConfigContext } from 'antd/es/config-provider';
import useColorMix from 'ming-ui/hooks/useColorMix';

export interface ButtonProps extends Omit<AntdButtonProps, 'color' | 'variant'> {
  color?: AntdButtonProps['color'] | (string & {}) | undefined;
  variant?: AntdButtonProps['variant'] | 'textBordered' | undefined;
  ellipsis?: boolean | undefined;
  wide?: boolean | undefined;
}
type NativeColor = NonNullable<AntdButtonProps['color']>;
const COLORS: { readonly [Color in NativeColor]: true } = {
  default: true,
  primary: true,
  danger: true,
  blue: true,
  purple: true,
  cyan: true,
  green: true,
  magenta: true,
  pink: true,
  red: true,
  orange: true,
  yellow: true,
  volcano: true,
  geekblue: true,
  lime: true,
  gold: true,
};
function isNativeColor(color: string): color is NativeColor {
  return Object.hasOwn(COLORS, color);
}

/**
 * 官方 7.5.4 `Button/index.jsx` 增量：自定义色的 color-mix 兜底变量。
 * 依赖官方新增 `src/ming-ui/hooks/useColorMix.js`（sha256 93bc77de597a0e1efe2ea1d277f0a1057e2115c948664b91a906ef3c3e698c36），
 * 颜色观察与 ref 合成由同源 TypeScript hook 提供，原按钮/链接 ref 类型保持。
 */
const COLOR_MIX_LEVELS: ReadonlyArray<readonly [string, number, string]> = [
  ['color-hover', 85, 'white'],
  ['color-active', 85, 'black'],
  ['color-light', 10, 'transparent'],
  ['color-light-hover', 15, 'transparent'],
  ['color-light-active', 20, 'transparent'],
];
interface ColorMix {
  color: string;
  percent: number;
  mixColor: string;
}

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ color, variant, ellipsis, wide, style, title, children, className, ...props }, ref) => {
    const { getPrefixCls } = useContext(ConfigContext);
    const rootPrefixCls = getPrefixCls();
    const customColor = color !== undefined && !isNativeColor(color);
    const textBordered = variant === 'textBordered';
    const colorMixes = useMemo<Record<string, ColorMix> | null>(
      () =>
        customColor && color !== undefined
          ? COLOR_MIX_LEVELS.reduce<Record<string, ColorMix>>((mixes, [slot, percent, mixColor]) => {
              const name = `--${rootPrefixCls}-btn-${slot}`;

              if (!Object.prototype.hasOwnProperty.call(style ?? {}, name)) {
                mixes[name] = { color, percent, mixColor };
              }

              return mixes;
            }, {})
          : null,
      [color, customColor, rootPrefixCls, style],
    );
    const colorMixRef = useColorMix(colorMixes, ref);
    const nativeColor = color === undefined ? undefined : isNativeColor(color) ? color : 'primary';
    const nativeVariant = textBordered ? 'text' : variant;
    const buttonStyle: CSSProperties = {
      ...(textBordered
        ? { border: `1px solid ${color === 'default' ? 'var(--color-border-primary)' : 'currentColor'}` }
        : {}),
      ...(customColor ? { color, borderColor: color } : {}),
      ...(wide ? { paddingInline: 'var(--space-8)' } : {}),
      ...style,
    };
    return (
      <AntdButton
        {...props}
        ref={colorMixRef}
        {...(nativeColor === undefined ? {} : { color: nativeColor })}
        {...(nativeVariant === undefined ? {} : { variant: nativeVariant })}
        className={[className, ellipsis ? 'overflowHidden ellipsis' : ''].filter(Boolean).join(' ')}
        title={
          title ??
          (ellipsis && (typeof children === 'string' || typeof children === 'number') ? String(children) : undefined)
        }
        style={buttonStyle}
      >
        {children}
      </AntdButton>
    );
  },
);
Button.displayName = 'HapButton';
export default Object.assign(Button, { Group: AntdButton.Group });
