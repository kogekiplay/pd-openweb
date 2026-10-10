import { type CSSProperties, forwardRef } from 'react';
import { Button as AntdButton, type ButtonProps as AntdButtonProps } from 'antd';

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

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ color, variant, ellipsis, wide, style, title, children, className, ...props }, ref) => {
    const customColor = color !== undefined && !isNativeColor(color);
    const textBordered = variant === 'textBordered';
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
        ref={ref}
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
