import React from 'react';
import styled from 'styled-components';
import { Icon } from 'ming-ui';
import type { ChangeGroup, ChangeResource } from 'src/components/AppSandbox/types';
import { CHANGE_STATUS } from '../constants';
import { getChangeNavigationResources } from '../model/changeNavigation';
import ChangeStatus from './ChangeStatus';

const Navigation = styled.div`
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid var(--color-border-secondary);
  background-color: var(--color-background-secondary);
`;

const GroupTitle = styled.div`
  display: flex;
  height: 42px;
  padding: 0 14px;
  align-items: center;
  border-bottom: 1px solid var(--color-border-secondary);
  color: var(--color-text-secondary);
  font-size: var(--font-sm);
  font-weight: 600;

  .groupIcon {
    margin-right: var(--space-2);
    font-size: var(--font-md);
  }
  .count {
    margin-left: auto;
    color: var(--color-text-tertiary);
    font-weight: 400;
  }
`;

const ResourceItem = styled.button`
  position: relative;
  display: grid;
  width: 100%;
  min-height: 42px;
  padding: var(--space-2) var(--space-3) var(--space-2) 28px;
  border: 0;
  box-sizing: border-box;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  background-color: ${({ $active }) => ($active ? 'var(--color-primary-transparent)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--color-primary)' : 'var(--color-text-primary)')};
  font-size: var(--font-sm);
  text-align: left;
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};

  &::before {
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 0;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background-color: ${({ $active, $disabled }) => (!$disabled && $active ? 'var(--color-primary)' : 'transparent')};
    content: '';
  }

  &:not(:disabled):hover {
    background-color: ${({ $active }) =>
      $active ? 'var(--color-primary-transparent)' : 'var(--color-background-hover)'};
  }

  .resourceName {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const GROUP_ICONS: Record<string, string> = {
  aggregations: 'apps',
  worksheets: 'worksheet',
  pages: 'dashboard',
  workflows: 'workflow',
  roles: 'group',
  chatBots: 'robot',
};

export const getResourceKey = (groupKey: string, change: ChangeResource) => `${groupKey}:${change.id}`;

export default function ChangeResourceNavigation({
  groups,
  selectedResourceKey,
  onSelect,
}: {
  groups: ChangeGroup[];
  selectedResourceKey?: string | undefined;
  onSelect: (key: string) => void;
}) {
  return (
    <Navigation>
      {groups.map(group => (
        <React.Fragment key={group.key}>
          <GroupTitle>
            <Icon className="groupIcon" icon={GROUP_ICONS[group.key] || 'folder'} />
            <span>{group.title}</span>
            <span className="count">{group.changes.length}</span>
          </GroupTitle>
          {getChangeNavigationResources(group).map(change => {
            const resourceKey = getResourceKey(group.key, change);
            const disabled = !change.navigationCategory && change.action !== CHANGE_STATUS.UPDATED;

            return (
              <ResourceItem
                key={resourceKey}
                type="button"
                disabled={disabled}
                $active={!disabled && resourceKey === selectedResourceKey}
                $disabled={disabled}
                onClick={() => onSelect(resourceKey)}
              >
                <span className="resourceName" title={change.name}>
                  {change.name}
                </span>
                {!change.navigationCategory && <ChangeStatus status={change.action} />}
              </ResourceItem>
            );
          })}
        </React.Fragment>
      ))}
    </Navigation>
  );
}
