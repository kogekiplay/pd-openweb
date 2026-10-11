// 部门/组织角色名称显示
import styled from 'styled-components';
import { Tooltip } from 'ming-ui/antd-components';
import { browserIsMobile } from 'src/utils/common';
import type { CSSProperties } from 'react';

interface DisabledNameProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
  isRole?: boolean | undefined;
}

const RoleName = styled.span`
  &.disabled {
    color: var(--color-text-secondary) !important;
    text-decoration: line-through !important;
  }
`;

export default function DisabledDepartmentAndRoleName(props: DisabledNameProps) {
  const { className, style = {}, disabled, name, isRole } = props;
  const toolTipText = isRole ? _l('组织角色已停用') : _l('部门已停用');
  const deleteText = isRole ? _l('组织角色已删除') : _l('部门已删除');
  const isMobile = browserIsMobile();

  if (disabled) {
    if (isMobile) {
      return (
        <RoleName className={`disabled ${className ? className : ''}`} style={style}>
          {name}
        </RoleName>
      );
    }

    return (
      <Tooltip popupPlacement="top" title={<span>{toolTipText}</span>}>
        <RoleName className={`disabled ${className ? className : ''}`} style={style}>
          {name}
        </RoleName>
      </Tooltip>
    );
  }

  return (
    <RoleName className={className} style={style}>
      {name ? name : deleteText}
    </RoleName>
  );
}
