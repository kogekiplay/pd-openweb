import React from 'react';
import cx from 'classnames';
import styled from 'styled-components';
import { Tooltip } from 'ming-ui/antd-components';

const FooterWrap = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  height: 66px;
  padding: 0 var(--space-6);
  box-sizing: border-box;
  background-color: var(--color-background-card) !important;
  .saveBtn {
    display: inline-block;
    padding: 0 var(--space-8);
    color: var(--color-on-primary);
    background-color: var(--color-primary-solid);
    border-radius: var(--radius-sm);
    line-height: 36px;
    &:hover {
      background-color: var(--color-primary-dark);
    }
    &.disabled {
      background-color: rgba(73, 127, 251, 0.49);
      border: none;
      line-height: 36px;
      cursor: not-allowed;
    }
  }
  .cancelBtn {
    display: inline-block;
    padding: 0 var(--space-8);
    color: var(--color-primary);
    border-radius: var(--radius-sm);
    line-height: 34px;
    border: 1px solid var(--color-primary);
    background-color: var(--color-background-primary);
  }
`;

export default function DrawerFooter(props) {
  const {
    disabled,
    saveLoading,
    okText = _l('保存'),
    showTooltips,
    tipsTxt,
    handleSave = () => {},
    onCancel = () => {},
  } = props;

  return (
    <FooterWrap>
      {showTooltips ? (
        <Tooltip title={tipsTxt} placement="top">
          <span className={cx('saveBtn Hand bold', { disabled: disabled })} onClick={handleSave}>
            {saveLoading ? _l('保存中...') : okText}
          </span>
        </Tooltip>
      ) : (
        <span
          className={cx('saveBtn Hand bold', { disabled: disabled })}
          onClick={() => {
            if (saveLoading || disabled) {
              return;
            }

            handleSave();
          }}
        >
          {saveLoading ? _l('保存中...') : okText}
        </span>
      )}
      <span className="cancelBtn Hand bold mLeft16" onClick={onCancel}>
        {_l('取消')}
      </span>
    </FooterWrap>
  );
}
