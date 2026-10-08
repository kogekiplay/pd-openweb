import React, { useState } from 'react';
import cx from 'classnames';
import styled from 'styled-components';
import { LoadDiv, MobileSearch, ScrollView } from 'ming-ui';
import { PopupWrapper } from 'ming-ui';
import { Skeleton } from 'ming-ui/antd-components';
import type { AgentSession } from 'src/components/Agent/shareTypes';
import SessionActions from './SessionActions';
import SessionRow from './SessionRow';
import type { SessionAction } from './types';
import useSessionHistory from './useSessionHistory';

const HISTORY_LAYER_ID = 'mobile-mingo-session-history';
const HIDDEN_SCROLLBAR_OPTIONS = {
  scrollbars: {
    visibility: 'hidden',
  },
};

const Content = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-background-card);
  .inlineTitle {
    flex-shrink: 0;
    padding: var(--space-4) 15px var(--space-2);
    font-size: var(--font-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  &.inlineHistory {
    border-right: 1px solid var(--color-border-secondary);
  }
  .sessionList {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    .sessionItem {
      cursor: pointer;
      border-radius: 5px;
      padding: 0 15px;
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
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        margin-left: var(--space-2);
        border-radius: 3px;
        background: var(--color-background-tertiary);
        color: var(--color-text-secondary);
      }
      &.active {
        background: var(--color-mingo-transparent-light);
      }
    }
    .emptyStatus {
      min-height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-6) 15px;
      font-size: var(--font-md);
      color: var(--color-text-tertiary);
      text-align: center;
    }
  }
`;

export default function SessionHistory({
  currentSessionId,
  inline = false,
  onSelect = () => {},
  onDeleted = () => {},
  onClose = () => {},
}: {
  currentSessionId?: string | undefined;
  inline?: boolean;
  onSelect?: (session: AgentSession) => void;
  onDeleted?: (sessionId: string) => void;
  onClose?: () => void;
}) {
  const [action, setAction] = useState<SessionAction | null>(null);
  const { isLoading, isLoadingMore, keyword, sessions, loadMore, removeSession, search, updateSessionTitle } =
    useSessionHistory();

  const handleDeleted = (sessionId: string) => {
    removeSession(sessionId);
    onDeleted(sessionId);
  };

  const content = (
    <Content className={cx({ inlineHistory: inline })}>
      {inline && <div className="inlineTitle">{_l('历史对话')}</div>}
      <MobileSearch placeholder={_l('搜索历史对话')} onSearch={search} />
      <ScrollView className="sessionList" options={HIDDEN_SCROLLBAR_OPTIONS} onScrollEnd={loadMore}>
        {isLoading ? (
          <Skeleton
            className="pAll20"
            active
            paragraph={{
              rows: 4,
              width: [100, '100%', '100%', '50%'],
            }}
          />
        ) : !sessions.length ? (
          <div className="emptyStatus">{keyword ? _l('无搜索结果') : _l('暂无历史对话')}</div>
        ) : (
          <React.Fragment>
            {sessions.map(item => (
              <SessionRow
                key={item.sessionId}
                item={item}
                active={Boolean(currentSessionId && item.sessionId === currentSessionId)}
                onSelect={onSelect}
                onOpenActions={session => setAction({ type: 'menu', session })}
              />
            ))}
            {isLoadingMore && <LoadDiv className="mTop6 mBottom6" size={20} />}
          </React.Fragment>
        )}
      </ScrollView>
    </Content>
  );

  return (
    <React.Fragment>
      {inline ? (
        content
      ) : (
        <PopupWrapper
          visible
          title={_l('历史对话')}
          headerType="withIcon"
          headerTitleAlign="left"
          bodyClassName="heightPopupBody40"
          layerId={HISTORY_LAYER_ID}
          onClose={onClose}
        >
          {content}
        </PopupWrapper>
      )}
      <SessionActions action={action} onChange={setAction} onRenamed={updateSessionTitle} onDeleted={handleDeleted} />
    </React.Fragment>
  );
}
