import { type ReactNode, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Icon } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';

export const Wrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 3px 6px;
  max-width: 250px;
  height: 24px;
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  background-color: var(--color-background-tertiary);
  .icon {
    margin-right: var(--space-1);
    font-size: var(--font-md);
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
`;

/** 组件真正读取的三个输入（不再用 `[key: string]: any` 继承任意字段）。 */
interface EllipsisTextProps {
  /**
   * 直接作为子节点渲染，并原样交给 Tooltip 的 title；组件从不对它做 String()/拼接/默认值，
   * 所以按真实渲染语义是 ReactNode。**保持可选**：原 body 允许不传（渲染空、Tooltip title 为 null），
   * 不因为"唯一真实 caller 有传"就把缺项变成新要求（ReactNode 本身含 undefined）。
   */
  text?: ReactNode;
  /** 来自 getIconByType，未知 key 时为 undefined；下面本来就是 `icon && …` 条件渲染，天然接受 undefined。 */
  icon?: string | undefined;
  /** 原样交给 Wrapper（styled.div）的 className。 */
  className?: string | undefined;
}

const EllipsisText = ({ text, icon, className }: EllipsisTextProps) => {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const checkedRef = useRef(false);
  const [overflow, setOverflow] = useState(false);

  const check = () => {
    if (checkedRef.current) return;

    const el = textRef.current;
    if (!el) return;

    const isOverflow = el.scrollWidth > el.clientWidth;

    setOverflow(isOverflow);
    checkedRef.current = true;
  };

  useEffect(() => {
    checkedRef.current = false;
    setOverflow(false);
  }, [text]);

  return (
    <Tooltip title={overflow ? text : null}>
      <Wrapper className={className} onMouseEnter={check}>
        {icon && <Icon icon={icon} className="icon" />}
        <span ref={textRef} className="ellipsis">
          {text}
        </span>
      </Wrapper>
    </Tooltip>
  );
};

export default EllipsisText;
