import React, { useEffect, useRef } from 'react';
import { useKey } from 'react-use';
import cx from 'classnames';
import { includes } from 'lodash';
import { motion } from 'motion/react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import Tooltip from 'ming-ui/antd-components/Tooltip';
import { getLatestCreateTimestampOfWithSaveShortcut } from 'src/utils/common';
import { SPRING_STIFF_300 } from 'src/utils/spring';

// styled(motion.div) 而不是 styled.div：让这层同时是样式容器和动画载体，
// 就不用再套一层 <Motion> 的 render prop，top 由 Motion 直接写到元素上。
//
// 原来是 style={Object.assign({ overflow }, value, style)}，即外部传入的 style
// 【可以覆盖】动画出来的 top。现在 animate={{ top }} 由 Motion 写入，外部 style
// 盖不住它 —— 优先级变了。查过 5 个调用方（RecordInfo ×2、NewRecordContent、
// EditFlow、EntityRelationship），传的都是 { left, width }，没有一个传 top，
// 所以这个差异在当前代码里取不到。真要传 top 的话得改回手写 style。
const ConBox = styled(motion.div)`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  z-index: 11;
`;

const Con = styled.div`
  height: 48px;
  border-radius: 48px;
  color: var(--color-white);
  line-height: 48px;
  padding: 0 10px 0 24px;
  z-index: 9;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: row;
  align-items: center;
  min-width: 400px;
`;

const Loading = styled.i`
  height: 1em;
  color: rgba(255, 255, 255, 0.8);
  font-size: 20px;
  margin-right: 10px;
  animation: rotate 2s linear infinite;
`;

const Button = styled.div`
  cursor: pointer;
  display: inline-block;
  height: 28px;
  line-height: 28px;
  padding: 0 18px;
  border-radius: 28px;
`;
const OkButton = styled(Button)`
  background-color: var(--color-text-inverse);
  font-weight: 600;
  user-select: none;
  &:not(.disabled):hover {
  }
  &.disabled {
    color: var(--color-border-primary);
    cursor: not-allowed;
  }
`;
const CancelButton = styled(Button)`
  color: var(--color-white);
  font-weight: bold;
  &:hover {
    background-color: rgba(255, 255, 255, 0.16);
  }
`;

export default function EditingBar(props) {
  const {
    style = {},
    isBlack = false,
    saveShortCut,
    loading,
    visible,
    defaultTop,
    visibleTop,
    title,
    okDisabled,
    didMountTimestamp,
    updateText = _l('保存'),
    cancelText = _l('取消'),
    onUpdate = () => {},
    onCancel = () => {},
    onOkMouseDown = () => {},
  } = props;
  const cache = useRef({ saveShortCut, okDisabled });

  const handleSave = e => {
    if (!cache.current.saveShortCut || !(window.isMacOs ? e.metaKey : e.ctrlKey)) return;
    if (window.richTextDialogIsActive) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    const latestCreateTimestamp = getLatestCreateTimestampOfWithSaveShortcut();
    e.stopPropagation();
    e.preventDefault();
    if (latestCreateTimestamp !== didMountTimestamp) {
      return;
    }

    if (cache.current.okDisabled) return;
    if (includes(['input', 'textarea'], (document.activeElement?.tagName || '').toLowerCase())) {
      document.activeElement.blur();
      document.querySelector('.recordInfoForm').dispatchEvent(new MouseEvent('mousedown'));
    }

    onUpdate();
  };

  useKey('s', handleSave);
  useKey('S', handleSave);
  useEffect(() => {
    cache.current = { saveShortCut, okDisabled };
  }, [saveShortCut, okDisabled]);
  return (
    <ConBox
      initial={{ top: defaultTop }}
      animate={{ top: visible ? visibleTop : defaultTop }}
      transition={SPRING_STIFF_300}
      style={{ overflow: visible ? undefined : 'hidden', ...style }}
      onClick={e => e.stopPropagation()}
      className="editingBar"
    >
      <Con style={{ background: isBlack ? 'var(--color-background-inverse)' : 'var(--color-primary)' }}>
        <span className="flex bold">{title}</span>
        {loading && <Loading className="icon icon-loading_button" />}
        {!loading && cancelText && (
          <CancelButton className="mLeft30  mRight10" onClick={onCancel}>
            {cancelText}
          </CancelButton>
        )}
        {!loading && (
          <Tooltip
            title={saveShortCut && !okDisabled ? _l('保存') : ''}
            shortcut={saveShortCut && !okDisabled ? (window.isMacOs ? '⌘S' : 'Ctrl+S') : ''}
          >
            <OkButton
              className={cx({ disabled: okDisabled }, isBlack ? 'textBlack' : 'colorPrimary')}
              onMouseDown={onOkMouseDown}
              onClick={okDisabled ? () => {} : onUpdate}
            >
              {updateText}
            </OkButton>
          </Tooltip>
        )}
      </Con>
    </ConBox>
  );
}

EditingBar.propTypes = {
  saveShortCut: PropTypes.bool,
  style: PropTypes.shape({}),
  visible: PropTypes.bool,
  okDisabled: PropTypes.bool,
  loading: PropTypes.bool,
  title: PropTypes.any,
  defaultTop: PropTypes.number,
  visibleTop: PropTypes.number,
  updateText: PropTypes.string,
  cancelText: PropTypes.string,
  onUpdate: PropTypes.func,
  onCancel: PropTypes.func,
  onOkMouseDown: PropTypes.func,
};
