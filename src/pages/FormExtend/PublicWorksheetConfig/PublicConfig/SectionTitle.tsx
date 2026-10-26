import type { MouseEventHandler, ReactNode } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon } from 'ming-ui';

/**
 * 公开合同只按真实消费方与组件自身渲染用法收窄（PublicConfig 下 7 处调用）：
 * - title 进 `<div className="titleText">`；isFolded 只用于三选一 Icon 名；className 拼到容器上。
 * - onClick 是容器 div 的点击处理：运行时由 React 传入 MouseEvent，所以按真实的
 *   `MouseEventHandler<HTMLDivElement>` 声明（不是按调用方"零参"的写法反过来收窄成 () => void）。
 *   组件里原有的 `onClick = _.noop` 默认保持不变（不改默认值）；真实调用方 7 处都是
 *   `() => setState(...)` 这种零参回调，对这种更宽的参数类型本来就可赋值。
 */
export interface SectionTitleProps {
  title?: ReactNode | undefined;
  isFolded?: boolean | undefined;
  onClick?: MouseEventHandler<HTMLDivElement> | undefined;
  className?: string | undefined;
}

const TitleWrapper = styled.div`
  display: flex;
  align-items: center;
  width: fit-content;
  margin-top: var(--space-8);
  margin-bottom: var(--space-6);
  cursor: pointer;

  .titleText {
    color: var(--color-text-title);
    font-weight: bold;
    vertical-align: middle;
    font-size: 15px;
  }
  i {
    color: var(--color-text-tertiary);
    margin-right: var(--space-3);
  }
`;

export default function SectionTitle(props: SectionTitleProps) {
  const { title, isFolded, onClick = _.noop, className } = props;
  return (
    <TitleWrapper className={className || ''} onClick={onClick}>
      <Icon icon={isFolded ? 'arrow-right-tip' : 'arrow-down'} />
      <div className="titleText">{title}</div>
    </TitleWrapper>
  );
}
