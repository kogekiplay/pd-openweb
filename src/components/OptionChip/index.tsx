/**
 * 彩色选项的标签 —— 与表单、表格里实际渲染的一模一样：
 * 颜色取 getOptionChipStyle（浅底 + 同色深字，表单 Dropdown / Checkbox、表格单元格用的都是它），
 * 外形照搬表单的 .customAntDropdownTitleWithBG（24px 高、12px 圆角、左右 --space-3 内边距）。
 *
 * 用在设计器 / 选项集这些「编辑选项」的地方：原先那里只画一个颜色圆点 + 纯文字，
 * 要到表单里才看得出选项最终长什么样。
 */
import React, { forwardRef } from 'react';
import styled from 'styled-components';
import { getOptionChipStyle } from 'src/utils/optionColor';

const chipShape = `
  height: 24px;
  line-height: 24px;
  border-radius: 12px;
  padding: 0 var(--space-3);
  box-sizing: border-box;
  max-width: 100%;
  vertical-align: middle;
`;

const Chip = styled.span`
  display: inline-block;
  ${chipShape}
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

interface OptionChipProps {
  color: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function OptionChip({ color, children, className, title }: OptionChipProps) {
  return (
    <Chip className={className} style={getOptionChipStyle(color)} title={title}>
      {children}
    </Chip>
  );
}

// 【宽度随文字】input 本身不会按内容撑开：放一个隐藏的同文副本和 input 叠在同一个 grid 单元格里，
// 由副本决定宽度。&& 把优先级抬一级，盖过外层容器里对 input 的通用样式（行高、悬停底色）。
const EditableChip = styled.span`
  display: inline-grid;
  ${chipShape}
  && > .optionChipSizer,
  && > input {
    grid-area: 1 / 1;
    font: inherit;
    line-height: 24px;
  }
  && > .optionChipSizer {
    visibility: hidden;
    white-space: pre;
    overflow: hidden;
  }
  && > input {
    /* width: 0 让 input 不按自己的默认固有宽度（约 20 个字符）去撑 grid 列宽，
       列宽只由上面的隐藏副本决定；min-width: 100% 再让它铺满这一列 */
    width: 0;
    min-width: 100%;
    height: 24px;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    &:hover {
      background: transparent;
    }
  }
`;

type EditableOptionChipProps = { color: string } & React.InputHTMLAttributes<HTMLInputElement>;

/** 可编辑的彩色选项：输入框就嵌在标签里，编辑时看到的就是最终样式 */
export const EditableOptionChip = forwardRef<HTMLInputElement, EditableOptionChipProps>(function EditableOptionChip(
  { color, value, placeholder, ...inputProps },
  ref,
) {
  return (
    <EditableChip style={getOptionChipStyle(color)}>
      <span className="optionChipSizer" aria-hidden="true">
        {String(value ?? '') || placeholder || ' '}
      </span>
      <input ref={ref} value={value} placeholder={placeholder} {...inputProps} />
    </EditableChip>
  );
});
