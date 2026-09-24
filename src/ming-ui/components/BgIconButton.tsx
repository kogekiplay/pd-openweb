import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import type { TooltipProps } from 'antd';
import cx from 'classnames';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Tooltip } from 'ming-ui/antd-components';
import { browserIsMobile } from 'src/utils/common';

const isMobile = browserIsMobile();

const Con = styled.div`
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  .btnIcon {
    font-size: var(--font-2xl);
    color: var(--color-text-secondary);
  }
  .btnText {
    font-size: var(--font-sm);
    color: var(--color-text-title);
    margin-left: var(--space-1);
  }
  &.size-small {
    .btnIcon {
      font-size: var(--font-lg);
    }
    .btnText {
      font-size: var(--font-xs);
    }
  }
  &:not(.isMobile) {
    &:hover {
      background-color: var(--color-background-hover);
    }
  }
  ${({ disabled }) =>
    disabled &&
    `
      cursor: not-allowed;
      .btnIcon {
        color: var(--color-text-disabled);
      }
      .btnText {
        color: var(--color-text-disabled);
      }
      &:hover {
        background-color: transparent;
      }
    `}
`;

interface BgIconButtonProps {
  disabled?: boolean | undefined;
  className?: string | undefined;
  iconClassName?: string | undefined;
  style?: CSSProperties | undefined;
  iconStyle?: CSSProperties | undefined;
  /** 'small' 用小一号的图标和文字 */
  size?: 'normal' | 'small' | undefined;
  /** 图标名，渲染成 icon-<icon>；给了 iconComponent 就不用它（propTypes 里标了必填，实际有调用方只给 iconComponent） */
  icon?: string | undefined;
  /** 自定义图标节点，优先于 icon */
  iconComponent?: ReactNode;
  text?: ReactNode;
  /** 挂在 mousedown 上；disabled 或给了 nativeOnClick 时不挂 */
  onClick?: ((e: MouseEvent<HTMLDivElement>) => void) | undefined;
  /** 挂在真正的 click 上 */
  nativeOnClick?: ((e: MouseEvent<HTMLDivElement>) => void) | undefined;
  tooltip?: ReactNode;
  popupPlacement?: TooltipProps['placement'] | undefined;
  /** 提示框里跟在文字后面显示的快捷键 */
  shortcut?: ReactNode;
}

function BgIconButton({
  disabled,
  className,
  iconClassName,
  style = {},
  iconStyle = {},
  size = 'normal',
  icon,
  iconComponent,
  text,
  onClick,
  nativeOnClick,
  tooltip,
  popupPlacement = 'bottom',
  shortcut,
}: BgIconButtonProps) {
  return (
    <Tooltip
      title={tooltip && !isMobile ? <span>{tooltip}</span> : null}
      placement={popupPlacement}
      align={{ offset: [0, -3] }}
      shortcut={shortcut}
    >
      <Con
        className={cx(className, `size-${size}`, { disabled, isMobile })}
        disabled={disabled}
        style={style}
        onMouseDown={disabled || nativeOnClick ? null : onClick}
        onClick={nativeOnClick}
      >
        {iconComponent ? (
          iconComponent
        ) : (
          <i className={cx(`btnIcon icon icon-${icon}`, iconClassName)} style={iconStyle}></i>
        )}
        {text && <span className="btnText">{text}</span>}
      </Con>
    </Tooltip>
  );
}

BgIconButton.propTypes = {
  disabled: PropTypes.bool,
  className: PropTypes.string,
  iconClassName: PropTypes.string,
  icon: PropTypes.node.isRequired,
  text: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  tooltip: PropTypes.node,
  popupPlacement: PropTypes.string,
  style: PropTypes.shape({}),
  iconStyle: PropTypes.shape({}),
};

BgIconButton.Group = styled.div`
  display: flex;
  gap: ${({ gap }) => gap || '10'}px;
`;

export default BgIconButton;
