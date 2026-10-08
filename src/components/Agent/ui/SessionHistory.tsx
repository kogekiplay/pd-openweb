import { useState } from 'react';
import styled from 'styled-components';
import { LoadDiv, ScrollView } from 'ming-ui';
import { Input, Modal, Skeleton } from 'ming-ui/antd-components';
import useSessionHistory from 'src/pages/Mobile/Mingo/components/SessionHistory/useSessionHistory';
import type { AgentSession } from '../shareTypes';
import SessionRow from './SessionRow';

const Body = styled.div`
  display: flex;
  flex-direction: column;
  height: 400px;
  .sessionSearchBox {
    flex-shrink: 0;
    margin-bottom: var(--space-3);
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--radius-sm);
    transition: border-color 0.2s ease;
    &:focus-within {
      border-color: var(--color-border-hover);
    }
    .icon-search {
      font-size: var(--font-xl);
      color: var(--color-text-tertiary);
    }
    input {
      flex: 1;
      margin: 0 var(--space-2);
      border: none;
      outline: none;
      background: transparent;
      font-size: var(--font-md);
      color: var(--color-text-primary);
      &::placeholder {
        color: var(--color-text-secondary);
      }
    }
    .icon-cancel {
      font-size: var(--font-lg);
      color: var(--color-text-tertiary);
      cursor: pointer;
      &:hover {
        color: var(--color-text-secondary);
      }
    }
  }
  .sessionList {
    flex: 1;
    .sessionItem {
      cursor: pointer;
      border-radius: var(--radius-sm);
      padding: 0 var(--space-3);
      height: 42px;
      font-size: 15px;
      color: var(--color-text-primary);
      .updateTime {
        margin-left: var(--space-3);
        font-size: var(--font-xs);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      .operateIcon {
        margin-left: var(--space-2);
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        border-radius: var(--radius-sm);
        font-size: var(--font-md);
        color: var(--color-text-secondary);
        cursor: pointer;
        display: none;
        justify-content: center;
        align-items: center;
      }
      &:hover,
      &.menuActive {
        background: var(--color-background-hover);
        .operateIcon {
          display: flex;
        }
        .updateTime {
          display: none;
        }
      }
      &.active {
        background: var(--color-mingo-transparent-light);
      }
    }
    .emptyStatus {
      padding: var(--space-6) 0;
      font-size: var(--font-md);
      color: var(--color-text-tertiary);
      text-align: center;
    }
  }
`;

export default function SessionHistory({
  currentSessionId,
  agentName = '',
  enableShare = true,
  onSelect = () => {},
  onDeleted = () => {},
  onClose = () => {},
}: {
  currentSessionId?: string;
  agentName?: string;
  enableShare?: boolean;
  onSelect?: (session: AgentSession) => void;
  onDeleted?: (id: string) => void;
  onClose?: () => void;
}) {
  const history = useSessionHistory(agentName);
  const [keyword, setKeyword] = useState('');
  return (
    <Modal open width={640} title={_l('历史对话')} footer={null} onCancel={onClose}>
      <Body>
        <Input
          className="sessionSearchBox mBottom12"
          value={keyword}
          placeholder={_l('搜索历史对话')}
          onChange={event => {
            setKeyword(event.target.value);
            history.search(event.target.value);
          }}
        />
        <ScrollView className="sessionList" onScrollEnd={history.loadMore}>
          {history.isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : !history.sessions.length ? (
            <div className="emptyStatus">{keyword ? _l('无搜索结果') : _l('暂无历史对话')}</div>
          ) : (
            history.sessions.map(item => (
              <SessionRow
                key={item.sessionId}
                item={item}
                active={item.sessionId === currentSessionId}
                showUpdateTime
                enableShare={enableShare}
                onSelect={onSelect}
                onRenamed={history.updateSessionTitle}
                onDeleted={id => {
                  history.removeSession(id);
                  onDeleted(id);
                }}
              />
            ))
          )}
          {history.isLoadingMore && <LoadDiv size={20} />}
        </ScrollView>
      </Body>
    </Modal>
  );
}
