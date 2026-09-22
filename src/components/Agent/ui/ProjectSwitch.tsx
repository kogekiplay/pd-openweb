import React, { useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import { get } from 'lodash';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { ScrollView } from 'ming-ui';
import { emitter } from 'src/utils/common';

// 组织（网络）切换下拉：复用首页 SwitchProject 的下拉视觉与切换行为
// （safeLocalStorageSetItem('currentProjectId') + emit CHANGE_CURRENT_PROJECT）。
// 自管理浮层（相对触发器绝对定位 + 文档 mousedown 关闭）：rc-trigger 在 overflow:hidden / 居中容器下
// 会出现漂移、横向撑页、点选/点外不关闭等问题，这里改为自管理，定位与关闭都可控、不撑页。
const Wrap = styled.div`
  position: relative;
  display: inline-flex;
  max-width: 100%;
`;

const Pop = styled.div`
  position: absolute;
  left: 0;
  z-index: 1000;
  width: 300px;
  max-width: 80vw;
  background: var(--color-background-card);
  border-radius: var(--radius-sm);
  padding: 5px 0;
  box-shadow: var(--shadow-lg);
  ${p => (p.$placement === 'top' ? 'bottom: calc(100% + 6px);' : 'top: calc(100% + 6px);')}
`;

const ProjectItem = styled.div`
  cursor: pointer;
  padding: 0 var(--space-5);
  font-size: 15px;
  font-weight: 500;
  height: 40px;
  line-height: 40px;
  &.active {
    color: var(--color-primary-text);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }
  &:not(.active):hover {
    background: var(--color-background-hover);
  }
`;

const ScrollCon = styled(ScrollView)`
  height: ${({ height }) => height}px !important;
`;

export default function ProjectSwitch({ value, onChange = () => {}, placement = 'bottom', children }) {
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef(null);
  const projects = get(md, 'global.Account.projects', []) || [];

  // 点击浮层与触发器之外关闭（mousedown 捕获阶段，先于 React click，避免误判）
  useEffect(() => {
    if (!visible) return undefined;
    const onDocMouseDown = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setVisible(false);
    };

    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [visible]);

  const handleSwitch = project => {
    setVisible(false);
    if (project.projectId === value) return;
    safeLocalStorageSetItem('currentProjectId', project.projectId);
    onChange(project.projectId);
    emitter.emit('CHANGE_CURRENT_PROJECT', project);
  };

  const rowH = 40;
  const maxRows = Math.ceil((window.innerHeight - 160) / rowH);
  // 【要标成 ReactNode】下面超过 maxRows 时会把整个数组换成单个 <ScrollCon>，
  // 不标的话推断成 Element[]，那一行赋值就报类型不符。
  let list: React.ReactNode = projects.map(p => (
    <ProjectItem
      key={p.projectId}
      className={cx('ellipsis', { active: p.projectId === value })}
      onClick={() => handleSwitch(p)}
    >
      {p.companyName}
    </ProjectItem>
  ));

  if (projects.length > maxRows) {
    list = <ScrollCon height={maxRows * rowH}>{list}</ScrollCon>;
  }

  return (
    <Wrap ref={wrapRef}>
      <span className="t-inline-flex" onClick={() => setVisible(v => !v)}>
        {children}
      </span>
      {visible && <Pop $placement={placement}>{list}</Pop>}
    </Wrap>
  );
}

ProjectSwitch.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  placement: PropTypes.oneOf(['top', 'bottom']),
  children: PropTypes.node,
};
