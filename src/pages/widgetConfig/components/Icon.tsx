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
  icon?: string;
  [key: string]: any;
}) {
  return <IconWrap className={cx(`icon-${icon}`, className, { action: rest['onClick'] }, type)} {...rest}></IconWrap>;
}
