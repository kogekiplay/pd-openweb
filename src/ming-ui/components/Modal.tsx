import React, { useEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import _ from 'lodash';
import PropTypes, { string } from 'prop-types';
import styled from 'styled-components';
import { BgIconButton, Button } from 'ming-ui';
import ErrorBoundary from './ErrorBoundary';
import './less/Modal.less';

const ModalButtonCon = styled(BgIconButton.Group)`
  z-index: 2;
  position: absolute;
  right: 42px;
  margin-top: 10px;
  top: 0;
`;

const ConfirmCon = styled.div`
  margin-top: 20px;
  text-align: right;
`;

const defaultProps = {
  footer: null,
};

export default function MdModal(props) {
  const {
    allowScale,
    fullScreen,
    visible,
    dislocate,
    closeSize = 40,
    verticalAlign,
    iconButtons = [],
    closeIcon,
    okDisabled,
    onCancel,
    headerComp = null,
    needRenderRight,
    renderModalRightComp,
  } = props;
  const locateRef = useRef<any>(undefined);
  let { width } = props;
  const showConfirm = props.onOk || props.okText || props.cancelText;
  const [left, setLeft] = useState(0);
  const [isLarge, setIsLarge] = useState(localStorage.getItem('NEW_RECORD_IS_LARGE') === 'true');

  if (allowScale && isLarge) {
    width = window.innerWidth > 1600 ? 1600 : window.innerWidth - 32 * 2;
  }

  const modalProps = {
    ...defaultProps,
    ...{
      className: 'mdModal',
      wrapClassName: 'mdModalWrap',
      transitionName: 'none',
      maskTransitionName: 'none',
      centered: true,
      keyboard: false,
      maskClosable: false,
      ...props,
      width,
    },
  };
  modalProps.closeIcon = !_.isUndefined(closeIcon) ? (
    closeIcon
  ) : (
    <i
      style={_.assign(
        { display: 'inline-block', width: closeSize, height: closeSize, lineHeight: closeSize + 'px' },
        props.closeStyle,
      )}
      className="ming Icon icon-default icon icon-close textTertiary Font22"
    />
  );
  modalProps.className = `mdModal ${props.className || ''}`;
  modalProps.style = Object.assign(props.style || {}, {
    transform: `translate(${left}px, 0px)`,
    transition: 'width 0.4s ease',
  });
  // 【antd 6 删掉了 Modal 的 visible】接口里只剩 open。本壳对外的 API 一直是 visible，
  // 而下面是 {...props} 整个铺给 <Modal>，于是 v6 收到一个它不认识的 visible、
  // open 永远是 undefined —— 弹窗静默不显示。表现就是「点记录打不开、点按钮没反应」，
  // 不报错、不进 ErrorBoundary、控制台干净，最难查的一类。
  // v5 的官方 codemod 把 JSX 上的 visible= 改成了 open=，但改不到这种「壳自己有个同名
  // 对外 API、再用 spread 转发」的写法；全仓 604 处 visible= 大多是 ming-ui 自己的组件。
  modalProps.open = props.open !== undefined ? props.open : visible;
  delete modalProps.visible;

  // antd 6 的边界翻译。本壳对外仍保留 v5 的名字（消费方传的是 bodyStyle / maskClosable），
  // 但交给 antd 时必须转成 styles.* 和 mask.closable。
  //
  // 【为什么 codemod 没覆盖到这里】tools/codemod-antd6.cjs 改的是 JSX 属性，而这里是先拼
  // 一个 modalProps 对象、最后 {...modalProps} 铺给 <Modal>。对象属性它看不见 ——
  // 表现就是控制台一直刷 `[antd: Modal] bodyStyle is deprecated`，但全仓 grep JSX 属性
  // 一个都搜不到，很容易以为是别人的代码。ming-ui 的 Tooltip 壳是同一类情况。
  modalProps.styles = {
    ...(props.styles || {}),
    mask: { backgroundColor: 'rgba(0, 0, 0, .7)', ...(props.maskStyle || {}) },
    body: Object.assign({}, props.bodyStyle || {}),
  };
  // mask 可能被消费方传成布尔；统一归一成对象，再把 maskClosable 并进去。
  // 注意 antd 6 里对象不写 enabled 即视为启用（enabled !== false），与旧的 mask 默认 true 一致。
  modalProps.mask =
    typeof modalProps.mask === 'object' && modalProps.mask !== null
      ? { closable: modalProps.maskClosable, ...modalProps.mask }
      : { enabled: modalProps.mask !== false, closable: modalProps.maskClosable };
  delete modalProps.maskClosable;
  delete modalProps.maskStyle;
  delete modalProps.bodyStyle;
  useEffect(() => {
    window.dislocateCount = window.dislocateCount || 0;
    if (window.dislocateCount > 0 && !document.querySelectorAll('.mdModal').length) {
      window.dislocateCount = 0;
    }

    if (dislocate && visible) {
      let newLeft = window.dislocateCount * 10;
      const maxLeft = width < 1600 ? 32 : (window.innerWidth - width) / 2;

      if (newLeft > maxLeft) {
        newLeft = maxLeft;
      }

      setLeft(newLeft);
      window.dislocateCount = window.dislocateCount + 1;
    }
  }, [visible]);
  useEffect(() => {
    if (locateRef.current) {
      try {
        locateRef.current.parentElement.parentElement.style.maxHeight = window.innerHeight - 32 + 'px';
      } catch (err) {
        console.log(err);
      }
    }

    const id = Math.random() * Math.random();

    if (window.closeFns) {
      window.closeindex = (window.closeindex || 0) + 1;
      window.closeFns[id] = {
        id,
        className: props.className,
        index: window.closeindex,
        fn: modalProps.onCancel,
      };
    }

    return () => {
      if (dislocate) {
        window.dislocateCount = window.dislocateCount - 1;
      }

      if (window.closeFns) {
        delete window.closeFns[id];
      }
    };
  }, []);
  if (props.type === 'fixed') {
    modalProps.style.height = window.innerHeight - 32 * 2;
    modalProps.className = modalProps.className + ' fixed';
    if (verticalAlign) {
      modalProps.style.verticalAlign = verticalAlign;
      if (verticalAlign !== 'middle') {
        modalProps.style.height = window.innerHeight - 32;
      }
    }

    if (allowScale && isLarge) {
      modalProps.style.height = window.innerHeight - 32;
    }
  }

  if (showConfirm && !modalProps.footer) {
    modalProps.footer = (
      <ConfirmCon>
        <Button type="link" onClick={props.onCancel || _.noop}>
          {props.cancelText || _l('取消')}
        </Button>
        <Button type="primary" disabled={okDisabled} onClick={props.onOk || _.noop}>
          {props.okText || _l('确定')}
        </Button>
      </ConfirmCon>
    );
  }

  if (fullScreen) {
    modalProps.className = modalProps.className + ' fullScreen';
    modalProps.style.height = '100%';
    modalProps.style.width = '100%';
    modalProps.style.maxWidth = 'unset';
    modalProps.style.verticalAlign = 'middle';
    modalProps.width = '100%';
  }

  return (
    <Modal
      {...modalProps}
      onCancel={e => {
        onCancel(e, 'click');
      }}
    >
      <div ref={locateRef}></div>
      {headerComp}
      <ModalButtonCon gap={8}>
        {iconButtons.map(
          (btn, i) =>
            btn.ele || (
              <BgIconButton style={{ width: 32 }} key={i} icon={btn.icon} tooltip={btn.tip} onClick={btn.onClick} />
            ),
        )}
        {allowScale && (
          <BgIconButton
            style={{ width: 32 }}
            icon={isLarge ? 'worksheet_narrow' : 'worksheet_enlarge'}
            tooltip={isLarge ? _l('缩小') : _l('放大')}
            onClick={() => {
              safeLocalStorageSetItem('NEW_RECORD_IS_LARGE', !isLarge);
              setIsLarge(!isLarge);
            }}
          />
        )}
      </ModalButtonCon>
      {needRenderRight ? (
        <ErrorBoundary>
          <div className="flexRow h100">
            {props.children}
            {renderModalRightComp ? renderModalRightComp() : null}
          </div>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>{props.children}</ErrorBoundary>
      )}
    </Modal>
  );
}

MdModal.propTypes = {
  allowScale: PropTypes.bool,
  fullScreen: PropTypes.bool,
  verticalAlign: PropTypes.string,
  visible: PropTypes.bool,
  okDisabled: PropTypes.bool,
  width: PropTypes.number,
  dislocate: PropTypes.bool,
  type: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.shape({}),
  closeStyle: PropTypes.shape({}),
  closeSize: PropTypes.number,
  bodyStyle: PropTypes.shape({}),
  children: PropTypes.node,
  cancelText: string,
  okText: string,
  onCancel: PropTypes.func,
  onOk: PropTypes.func,
};
