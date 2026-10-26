import cx from 'classnames';
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
 * 图标
 * type ['delete'] 提供默认样式 删除是红色
 * @param {} param0
 */
export default function Icon({
  className,
  type,
  icon,
  ...rest
}: {
  className?: string;
  /**
   * getIconByType 的返回是 string | undefined（未知 key 走原 `|| {}` → icon 为 undefined）。
   * 这里本来就只把它拼进 `icon-${icon}` 模板串（缺省时模板照旧），所以声明成 string | undefined
   * 如实反映真实入参；不加兜底、不改模板、不动 rest 透传。
   */
  icon?: string | undefined;
  [key: string]: any;
}) {
  return <IconWrap className={cx(`icon-${icon}`, className, { action: rest['onClick'] }, type)} {...rest}></IconWrap>;
}
