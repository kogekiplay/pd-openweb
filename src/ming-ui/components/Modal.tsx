import React, { useEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import _ from 'lodash';
import PropTypes, { string } from 'prop-types';
import styled from 'styled-components';
import { BgIconButton, Button } from 'ming-ui';
import ErrorBoundary from './ErrorBoundary';
import './less/Modal.less';

/* 这排图标（AI 填写 / 草稿 / 分享 / 放大）和右上角那个关闭叉是【两套各自定位的东西】，
   谁也不知道谁有多大，于是对不齐：
     · 叉是 antd 的 .ant-modal-close，贴容器右上角 (0,0)，尺寸来自 MdModal 传给
       closeIcon 的 closeSize（默认 40）→ 中心线 y = closeSize/2 = 20，距右 20；
     · 这排原先写死 top:0 + margin-top:10px，而 BgIconButton 实高只有 28
       （padding 4×2 + 图标 20）→ 中心线 y = 24，比叉低 4px；
       且 right:42 让「叉心 ↔ 末个图标心」= 38px，而图标彼此之间是 40px
       （32 宽 + 8 间距），右边那一档又窄 2px。

   改成跟着 closeSize 算：撑一条 closeSize 高的带子做垂直居中，中心线必然落在叉上；
   水平上让叉心到末个图标心也是 40px，和图标彼此之间同一个节奏。
   带子比图标高，多出来的上下各 6px 用 pointer-events 让开，免得这块 z-index:2 的
   透明区域吃掉底下的点击。$ 前缀是 styled-components 6 的 transient prop，不会落到 DOM 上。 */
const ModalButtonCon = styled(BgIconButton.Group)`
  z-index: 2;
  position: absolute;
  top: 0;
  right: ${({ $closeSize }) => $closeSize / 2 + 24}px;
  height: ${({ $closeSize }) => $closeSize}px;
  align-items: center;
  pointer-events: none;
  > * {
    pointer-events: auto;
  }
`;

const ConfirmCon = styled.div`
  margin-top: var(--space-5);
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
  const locateRef = useRef<HTMLDivElement>(null);
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
  // 【为什么 codemod 没覆盖到这里】tools/codemod-antd6.ts 改的是 JSX 属性，而这里是先拼
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
    // 【32 是单边留白，不是总留白】上下各要一个，所以一律减两次。
    // 原来非 middle 的两个分支只减了一次 —— 实测 861 高的视口里弹层高 829，
    // 上面留 32、下面贴死到 0，看起来就是「上面留空了底下没留空」。
    modalProps.style.height = window.innerHeight - 32 * 2;
    modalProps.className = modalProps.className + ' fixed';

    if (verticalAlign) {
      modalProps.style.verticalAlign = verticalAlign;
      // 【高度对了还不够，位置也得摆对】verticalAlign:'bottom' 会把弹层压到
      // 行盒底部：高 797 的弹层在 861 的视口里落成「上 64、下 0」。
      // 给它一个下外边距，参与行盒高度计算之后就是上下各 32。
      if (verticalAlign !== 'middle') {
        modalProps.style.marginBottom = 32;
      }
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
      <ModalButtonCon gap={8} $closeSize={closeSize}>
        {/* key 要给到【数组的每一项】。原先只有 BgIconButton 那条分支带了 key，走 btn.ele 的
            自定义节点（NewRecord 的「AI 填写」和「草稿」就是这种）是消费方现场 new 出来的，
            身上没有 key —— 控制台那条 `Each child in a list should have a unique "key" prop.
            Check the render method of \`div\`. It was passed a child from NewRecord.` 就是它。
            这里统一包一层 Fragment 挂 key：Fragment 不生成 DOM 节点，上面 `> *` 的
            pointer-events 和 flex gap 都照旧作用在真正的图标节点上。 */}
        {iconButtons.map((btn, i) => (
          <React.Fragment key={btn.type || i}>
            {btn.ele || <BgIconButton style={{ width: 32 }} icon={btn.icon} tooltip={btn.tip} onClick={btn.onClick} />}
          </React.Fragment>
        ))}
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
