import React, { useState } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Input } from 'ming-ui';

const EmptyHierarchyWrap = styled.div`
  .ming.Input {
    border: none;
    padding: 0;
    height: 28px;
    border-radius: 0;
    border-bottom: 2px solid var(--color-primary);
    background-color: transparent;
    font-size: var(--font-md);
    font-weight: bold;
  }
  .titleWrap {
    margin-bottom: var(--space-1);
    height: 36px;
    display: flex;
    align-items: center;
    span {
      margin-bottom: 1px;
    }
  }

  .addWrap {
    box-sizing: border-box;
    width: 280px;
    padding: 0 var(--space-3);
    line-height: 48px;
    transition: all 0.25s;
    border-radius: var(--radius-sm);
    background-color: var(--color-background-primary);
    color: var(--color-text-tertiary);
    font-weight: bold;
    box-shadow: var(--shadow-sm);
    &:hover {
      box-shadow: var(--shadow-md);
    }
    &.allowAdd {
      cursor: pointer;
      &:hover {
        color: var(--color-primary);
      }
    }
  }
`;

export default function EmptyHierarchy({ allowAdd, onAdd, layersName, updateLayersName, needTitle = true }) {
  const [isEdit, setEdit] = useState(false);
  const [value, setValue] = useState(layersName[0] || '');
  return (
    <EmptyHierarchyWrap>
      {needTitle && (
        <div className="titleWrap">
          {isEdit ? (
            <Input
              value={value}
              autoFocus
              onChange={setValue}
              onBlur={() => {
                setEdit(false);
                updateLayersName([value]);
              }}
            />
          ) : (
            <span
              className={cx('overflow_ellipsis layerTitle', value ? 'textSecondary Bold' : 'textDisabled Bold')}
              onClick={() => setEdit(true)}
            >
              {value || _l('一级')}
            </span>
          )}
        </div>
      )}

      {!(_.get(window, 'shareState.isPublicView') || _.get(window, 'shareState.isPublicPage')) && (
        <div onClick={onAdd} className={cx('addWrap', { allowAdd })}>
          <i className="icon-add"></i>
          <span>{allowAdd ? _l('添加记录') : _l('暂无记录')}</span>
        </div>
      )}
    </EmptyHierarchyWrap>
  );
}
