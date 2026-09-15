import React from 'react';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import ClickAway from 'ming-ui/components/ClickAway';
import './EditableCellCon.less';

const Con = styled.div`
  .editIcon {
    position: absolute;
    right: 4px;
    top: 4px;
    width: 24px;
    height: 24px;
    border-radius: 3px;
    background: var(--color-background-primary);
    justify-content: center;
    align-items: center;
  }
`;

function EditableCellCon(props) {
  const {
    className,
    style,
    error,
    iconName,
    iconClassName,
    isediting,
    popupContainer,
    onIconClick,
    children,
    conRef,
    iconRef,
    hideOutline,
    onClick,
    onClear,
    // 本组件常被当作 <Trigger> 的直接子元素（CellControls 下 Date/Text/User/
    // Department/Time/OrgRole/MobilePhone/Cascader 共 8 处）。
    // @rc-component/trigger 靠挂在子元素上的 ref 取 DOM 节点（rc-trigger 5 用的是
    // findDOMNode，子组件接不接 ref 都无所谓）。接不住的话 targetEle 恒为 null，
    // 弹层会被算到屏幕外 —— 表现为「单元格校验错误提示不显示」，且【不报任何错】。
    ref,
  } = props;
  return (
    <Trigger
      zIndex={99}
      popup={<div className="cellControlErrorTip">{error}</div>}
      getPopupContainer={() => popupContainer}
      popupClassName="filterTrigger"
      popupVisible={!!error}
      autoDestroy
      popupAlign={{
        points: ['tl', 'bl'],
      }}
    >
      <Con
        className={cx('editableCellCon', className, {
          cellControlEdittingStatus: !hideOutline && isediting,
          cellControlErrorStatus: !hideOutline && error,
          isediting,
        })}
        // 外部 ref 与既有的 conRef 都要挂上。
        // 必须写成【块体】：React 19 把 callback ref 的返回值当作清理函数，
        // 简写体 `node => assign(node)` 会把赋值结果当 cleanup 返回，报
        // "Unexpected return value from a callback ref"。
        ref={node => {
          if (typeof conRef === 'function') conRef(node);
          else if (conRef) conRef.current = node;

          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        style={style}
        onClick={onClick}
      >
        {children}
        {!isediting && (
          <span
            className={cx('editIcon textTertiary hoverColorPrimary', { canClear: !!onClear })}
            onClick={e => {
              e.stopPropagation();
              if (onClear) {
                onClear();
              } else {
                onIconClick(e);
              }
            }}
          >
            <i ref={iconRef} className={`editbtn icon icon-${iconName} Font16 Hand ${iconClassName}`} />
            <i
              ref={iconRef}
              className={`clearbtn icon icon-cancel Font16 Hand ${iconClassName}`}
              onClick={e => {
                e.stopPropagation();
                if (onClear) {
                  onClear();
                }
              }}
            />
          </span>
        )}
        {/* {!editable && (
          <ReadOnlyTip className="readOnlyTip">
            {_l('当前字段不可编辑')}
          </ReadOnlyTip>
        )} */}
      </Con>
    </Trigger>
  );
}

export default props => {
  const Comp = props.clickAwayWrap ? ClickAway.wrap(EditableCellCon) : EditableCellCon;
  return <Comp {...props} />;
};

EditableCellCon.propTypes = {
  className: PropTypes.string,
  iconClassName: PropTypes.string,
  style: PropTypes.shape({}),
  iconName: PropTypes.string,
  isediting: PropTypes.bool,
  onIconClick: PropTypes.func,
  onClick: PropTypes.func,
  onClear: PropTypes.func,
  children: PropTypes.node,
};
