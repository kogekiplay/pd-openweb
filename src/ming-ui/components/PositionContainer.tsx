import { Component } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { shallowEqual } from 'react-redux';
import PropTypes from 'prop-types';
import { getClickAwayExceptions, getDomNode } from './ClickAway';
import './less/PositionContainer.less';

export type PositionPlacement = 'top' | 'bottom' | 'left' | 'right';
export type PositionBounding = Pick<DOMRectReadOnly, 'top' | 'left' | 'bottom' | 'right' | 'width' | 'height'>;
export interface PositionOffset {
  top?: number | undefined;
  left?: number | undefined;
}
export interface PositionContainerProps {
  visible?: boolean | undefined;
  bounding?: PositionBounding | null | undefined;
  placement?: PositionPlacement | undefined;
  onHide?: (() => void) | undefined;
  popupParentNode?: (() => HTMLElement | null | undefined) | undefined;
  offset?: PositionOffset | undefined;
  isInit?: boolean | undefined;
  onClickAwayExceptions?: readonly unknown[] | undefined;
  children?: ReactNode;
}
interface PositionPoint {
  top: number;
  left: number;
}
function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

class PositionContainer extends Component<PositionContainerProps> {
  declare popupBounding: DOMRect | undefined;
  declare hasTop: boolean | undefined;
  declare popup: HTMLDivElement | undefined;
  declare popupParentNode: HTMLElement | undefined;
  declare bounding: PositionBounding | null | undefined;
  private root: Root | undefined;
  private showTimer: number | undefined;
  private mounted = false;
  private listening = false;
  private readonly handleResize = () => this.onWindowResize();
  private readonly handleBodyClick = (event: MouseEvent) => this.destroy(event);

  static override propTypes = {
    visible: PropTypes.bool, // 显示隐藏
    bounding: PropTypes.object, // 触发元素的 getBoundingClientRect
    placement: PropTypes.string, // 显示的位置，top，bottom，left，right
    onHide: PropTypes.func, // 设置隐藏的回调函数
    popupParentNode: PropTypes.func, // 创建指定的区域下，默认是body
    offset: PropTypes.object, //额外偏移的坐标
    isInit: PropTypes.bool, //是否在页面加载完初始化
    onClickAwayExceptions: PropTypes.array,
  };
  static defaultProps = {
    visible: false,
    placement: 'top',
    offset: {
      top: 0,
      left: 0,
    },
    isInit: false,
    onClickAwayExceptions: [],
    popupParentNode: () => document.body,
    onHide: () => {},
  };
  override componentDidMount() {
    this.mounted = true;
    this.bounding = this.props.bounding;
    if (this.props.isInit || this.props.visible) this.create(this.props);
  }
  create(props: PositionContainerProps) {
    this.popupParentNode = props.popupParentNode?.() || document.body;
    this.hasTop = this.popupParentNode.tagName === 'BODY' ? true : false;
    if (!this.popup) {
      this.popup = document.createElement('div');
      this.popup.className = 'ming PositionContainer-wrapper';
      this.root = createRoot(this.popup);
    }
    this.popupParentNode.appendChild(this.popup);
    this.renderLayer(props);
    if (!this.listening) {
      window.addEventListener('resize', this.handleResize);
      document.body.addEventListener('click', this.handleBodyClick, false);
      this.listening = true;
    }
  }
  override componentWillUnmount() {
    this.mounted = false;
    this.clearShowTimer();
    window.removeEventListener('resize', this.handleResize);
    document.body.removeEventListener('click', this.handleBodyClick);
    this.listening = false;
    const root = this.root;
    this.root = undefined;
    // Dispose the separate React root after the parent commit finishes.
    if (root) queueMicrotask(() => root.unmount());
    this.popup?.remove();
    this.popup = undefined;
    this.popupParentNode = undefined;
  }

  override componentDidUpdate(prevProps: PositionContainerProps) {
    if (!shallowEqual(prevProps, this.props)) {
      let { visible, bounding } = this.props;
      this.bounding = bounding;
      if (visible) {
        const parent = this.props.popupParentNode?.() || document.body;
        if (this.popup && this.popupParentNode === parent && parent.contains(this.popup)) {
          this.renderLayer(this.props);
        } else {
          this.create(this.props);
        }
      } else {
        if (this.popup) {
          this.hide();
        }
      }
    }
  }
  private clearShowTimer() {
    if (this.showTimer !== undefined) window.clearTimeout(this.showTimer);
    this.showTimer = undefined;
  }
  renderLayer(props: PositionContainerProps) {
    let { children, visible } = props;
    this.clearShowTimer();
    this.root?.render(children);
    if (visible && props.bounding)
      this.showTimer = window.setTimeout(() => {
        this.showTimer = undefined;
        if (this.mounted && this.props.visible) this.show();
      }, 200);
    else this.hide();
  }
  getHasParent(node: Node, className: string) {
    for (let current: Node | null = node; current; current = current.parentNode) {
      if (isElement(current) && current.classList.contains(className)) return false;
    }
    return true;
  }
  destroy(event: MouseEvent) {
    if (!this.mounted || !this.props.visible) return;
    const target = getDomNode(event.target);
    const exceptions = getClickAwayExceptions(this.props.onClickAwayExceptions);
    // React may remove the clicked child before this native body listener runs.
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const startedInside = path.some(item => {
      const node = getDomNode(item);
      return node && isElement(node) && node.classList.contains('PositionContainer-wrapper');
    });
    if (
      target &&
      !startedInside &&
      this.getHasParent(target, 'PositionContainer-wrapper') &&
      exceptions.every(item => !item.contains(target))
    ) {
      this.props.onHide?.();
    }
  }
  onWindowResize() {
    let { visible, onHide } = this.props;

    if (this.mounted && visible) {
      onHide?.();
    }
  }
  getCurrentClientRect() {
    let { popupParentNode, bounding, popup } = this;
    const placement = this.props.placement || 'top';
    if (!popupParentNode || !bounding || !popup) return { top: 0, left: 0 };
    let popupBounding = (this.popupBounding = popup.getBoundingClientRect());
    let result: PositionPoint = { top: 0, left: 0 };

    let popupParentNodeBounding = popupParentNode.getBoundingClientRect();

    let crrentBounding = {
      top: bounding.top - popupParentNodeBounding.top,
      bottom: bounding.bottom - popupParentNodeBounding.bottom,
      left: bounding.left - popupParentNodeBounding.left,
      right: bounding.right - popupParentNodeBounding.left,
    };

    if (placement === 'top') {
      result = {
        top: crrentBounding.top - popupBounding.height + popupParentNode.scrollTop,
        left: crrentBounding.left,
      };
      if (crrentBounding.top < popupBounding.height) {
        result.top = crrentBounding.bottom + popupParentNodeBounding.height + popupParentNode.scrollTop;
      }
    }

    if (placement === 'bottom') {
      result = {
        top: crrentBounding.bottom + popupParentNodeBounding.height + popupParentNode.scrollTop,
        left: crrentBounding.left,
      };
      if (Math.abs(crrentBounding.bottom) < popupBounding.height && crrentBounding.top > popupBounding.height) {
        result.top = crrentBounding.top - popupBounding.height + popupParentNode.scrollTop;
      }
    }

    if (placement === 'left') {
      result = {
        top: crrentBounding.top + popupParentNode.scrollTop,
        left: crrentBounding.left - popupBounding.width,
      };
    }

    if (placement === 'right') {
      result = {
        top: crrentBounding.top + popupParentNode.scrollTop,
        left: crrentBounding.right,
      };
    }

    return result;
  }
  getVerticalSpace(bounding: PositionBounding, popupBounding: PositionBounding) {
    let { clientHeight } = document.body;

    let isTop = bounding.top - popupBounding.height >= 0 ? true : false;
    let isBottom = clientHeight - bounding.top - bounding.height - popupBounding.height >= 0 ? true : false;

    let topSpace = {
      top: bounding.top - popupBounding.height,
      left: bounding.left,
    };

    if (isBottom && topSpace.top < 0) {
      topSpace.top = bounding.bottom;
    }

    let bottomSpace = {
      top: bounding.bottom,
      left: bounding.left,
    };

    if (isTop && clientHeight < bottomSpace.top + popupBounding.height) {
      bottomSpace.top = bounding.top - popupBounding.height;
    }

    if (!isTop && !isBottom) {
      let top = popupBounding.height - bounding.top;
      let bottom = popupBounding.height - (clientHeight - bounding.top - bounding.height);
      topSpace.top = topSpace.top + top;
      bottomSpace.top = bottomSpace.top - bottom;
    }

    return {
      topSpace,
      bottomSpace,
    };
  }
  getHorizontalSpace(bounding: PositionBounding, popupBounding: PositionBounding) {
    let { clientWidth } = document.body;

    let left = bounding.left - popupBounding.width;
    let right = clientWidth - bounding.left - bounding.width - popupBounding.width;
    let isLeft = left >= 0 ? true : false;
    let isRight = right >= 0 ? true : false;

    let leftSpace = {
      top: bounding.top,
      left: bounding.left - popupBounding.width,
    };

    if (isRight && leftSpace.left < 0) {
      leftSpace.left = bounding.right;
    }

    let rightSpace = {
      top: bounding.top,
      left: bounding.right,
    };

    if (isLeft && rightSpace.left + popupBounding.width > clientWidth) {
      rightSpace.left = bounding.left - popupBounding.width;
    }

    if (!isLeft && !isRight) {
      leftSpace.left = leftSpace.left - left;
      rightSpace.left = rightSpace.left + right;
    }

    return {
      leftSpace,
      rightSpace,
    };
  }
  getBoundingClientRect() {
    let { bounding, popup } = this;
    const placement = this.props.placement || 'top';
    if (!bounding || !popup) return { top: 0, left: 0 };
    let popupBounding = (this.popupBounding = popup.getBoundingClientRect());
    let { clientWidth, clientHeight } = document.body;
    let result: PositionPoint = { top: 0, left: 0 };

    let verticalSpace = this.getVerticalSpace(bounding, popupBounding);
    let horizontalSpace = this.getHorizontalSpace(bounding, popupBounding);

    if (placement === 'top') {
      result = verticalSpace.topSpace;
    }

    if (placement === 'bottom') {
      result = verticalSpace.bottomSpace;
    }

    if (placement === 'left') {
      result = horizontalSpace.leftSpace;
    }

    if (placement === 'right') {
      result = horizontalSpace.rightSpace;
    }

    if (placement == 'top' || placement == 'bottom') {
      if (result.left + popupBounding.width > clientWidth) {
        result.left = clientWidth - popupBounding.width;
      }
    }

    if (placement == 'right' || placement == 'left') {
      if (clientHeight < result.top + popupBounding.height) {
        result.top = clientHeight - popupBounding.height;
      }
    }

    return { top: Math.max(0, result.top), left: Math.max(0, result.left) };
  }
  show() {
    const { offset = {} } = this.props;
    let { popup } = this;
    if (!popup || !this.bounding) return;
    let bounding = this.hasTop ? this.getBoundingClientRect() : this.getCurrentClientRect();
    popup.style.left = `${bounding.left + (offset.left ?? 0)}px`;
    popup.style.top = `${bounding.top + (offset.top ?? 0)}px`;
    popup.style.display = 'block';
    popup.classList.add('PositionContainer-active');
  }
  hide() {
    this.clearShowTimer();
    let { popup } = this;
    if (!popup) return;
    popup.style.left = '-99999px';
    popup.style.top = '-99999px';
    popup.classList.remove('PositionContainer-active');
  }
  override render() {
    return <noscript />;
  }
}

export default PositionContainer;
