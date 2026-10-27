import cx from 'classnames';
import type { ComponentProps } from 'react';
import styled from 'styled-components';

const IconWrap = styled.i`
  font-size: var(--font-lg);
  color: var(--color-text-tertiary);

  &.action {
    cursor: pointer;
    &:hover {
      color: var(--color-text-title);
    }
  }
  &.delete {
    cursor: pointer;
    &:hover {
      color: var(--color-error-text);
    }
  }
  &.link {
    cursor: pointer;
    &:hover {
      color: var(--color-primary-text);
    }
  }
`;

/**
 * 组件自己读取/解释的三个字段；其余一律是原生 `<i>` 属性，经 `...rest` 原样透传给 styled.i。
 * 不再用 `[key: string]: any` 吞掉未知字段：未知属性会走 React 原生 i 元素的属性域（含 ref）。
 */
interface IconOwnProps {
  /** 原样并入 cx（body 未做枚举解释）。 */
  className?: string | undefined;
  /**
   * 只拼进 `icon-${icon}` 模板串。真实调用点里既有字符串字面量，也有 `getIconByType(...)`
   * 的 string | undefined（未知控件 key 时是 undefined），所以按真实入参声明为 string | undefined；
   * 不加兜底、不改模板。
   */
  icon?: string | undefined;
  /**
   * 作为**额外 class token** 交给 cx（`cx(…, type)`），body 并没有把它解释成枚举，
   * 因此按真实支持的用法是任意字符串；不能凭 less 里的 delete/action/link 三种样式假签成字面量联合。
   */
  type?: string | undefined;
}

/**
 * 图标
 * type ['delete'] 提供默认样式 删除是红色
 * @param {} param0
 */
export default function Icon({
  className,
  type,
  icon,
  ...rest
}: IconOwnProps & Omit<ComponentProps<'i'>, keyof IconOwnProps>) {
  return <IconWrap className={cx(`icon-${icon}`, className, { action: rest['onClick'] }, type)} {...rest}></IconWrap>;
}
