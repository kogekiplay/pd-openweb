import React from 'react';
import styled from 'styled-components';

const Com = styled.span`
  display: inline-block;
  font-size: var(--font-xs);
  padding: 0 3px;
  color: var(--color-white);
  background: var(--color-success);
  border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) var(--radius-sm);
  height: 16px;
  line-height: 14px;
  margin-left: 5px;
  vertical-align: middle;
`;

export default function Beta({ className }: { className?: string; [key: string]: any }) {
  return <Com className={className}>beta</Com>;
}
