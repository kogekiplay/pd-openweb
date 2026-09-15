import React, { cloneElement, Component } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import Item from './Item';
import './less/MenuItem.less';

class MenuItem extends Component<any, any> {
  // 用 declare：只声明类型、不生成运行时字段（babel 的 TS preset 会整行擦掉）。
  // nativeElement 是 @rc-component/trigger 取 DOM 节点的约定入口，见 setItemRef。
  declare menuItemNode: HTMLElement | null;
  declare nativeElement: HTMLElement | null;

  static propTypes = {
    icon: PropTypes.element,
    iconAtEnd: PropTypes.bool,
    subMenu: PropTypes.element,
    onMouseEnter: PropTypes.func,
    onMouseLeave: PropTypes.func,
    onClick: PropTypes.func,
    className: PropTypes.string,
    children: PropTypes.any,
    disabled: PropTypes.bool, // 是否禁用
    setRef: PropTypes.func,
  };

  state = {
    showSubMenu: false,
  };

  setItemRef = node => {
    this.menuItemNode = node;
    // 【rc-component 取 DOM 节点的约定】MenuItem 常被当作 <Trigger> 的直接子元素
    //（如视图右键菜单里的「导出」，见 worksheet/components/ViewItems/SettingMenu.tsx）。
    // rc-trigger 5 用 findDOMNode，class 组件天然可用；继任的 @rc-component/trigger
    // 改成 getDOM(node)，而它只认两种东西（@rc-component/util Dom/findDOMNode.js:10）：
    //   node.nativeElement 是 DOM，或者 node 本身就是 DOM
    // class 组件的 ref 给出的是【实例】，两条都不满足 → targetEle 恒为 null，
    // useAlign 算出的坐标完全失真，弹层被放到 (-6260, -7880)，即渲染在屏幕外。
    // 这个失败是【静默】的：弹层在 DOM 里、内容也对、控制台无任何报错，
    // 用户看到的就是「点了/悬停了没反应」。
    this.nativeElement = node;

    if (this.props.setRef) {
      this.props.setRef(node);
    }
  };

  handleMouseEnter(...args) {
    this.setState({ showSubMenu: true });
    if (this.props.onMouseEnter) {
      this.props.onMouseEnter.apply(this, args);
    }
  }
  handleMouseLeave(...args) {
    this.setState({ showSubMenu: false });
    if (this.props.onMouseLeave) {
      this.props.onMouseLeave.apply(this, args);
    }
  }

  render() {
    let { subMenu } = this.props;

    if (subMenu) {
      subMenu = cloneElement(subMenu, {
        isSubMenu: true,
        subMenuVisible: this.state.showSubMenu,
        getParentMenuItemNode: () => this.menuItemNode,
        className: cx({ hide: !this.state.showSubMenu }, subMenu.props.className),
      });
    }

    return (
      <Item
        {...this.props}
        className={cx(this.props.className, 'ming MenuItem', { 'MenuItem--withSubMenu': subMenu })}
        subMenu={subMenu}
        // 必须把事件【透传】下去。这两个 handler 会转调 this.props.onMouseEnter/Leave，
        // 而当 MenuItem 被 @rc-component/trigger 当作子元素时，那个 prop 就是 trigger 的
        // onMouseEnter —— 它里面 setMousePosByEvent(event) 直接读 event.clientX，
        // 【没有任何守卫】（es/index.js:251）。写成 () => this.handleMouseEnter() 会把事件吞掉，
        // trigger 拿到 undefined，当场抛
        // "Cannot read properties of undefined (reading 'clientX')"，带子菜单的菜单项
        //（如工作表视图右键菜单里的「导出」）一 hover 就崩。
        //
        // 旧的 rc-trigger 5.x 不会暴露这个问题：它对应的 setPoint 有双重守卫
        //   setPoint(point) { if (!alignPoint || !point) return; ... }  （es/index.js:396）
        // 继任包把守卫去掉了，于是这里一直存在的「吞事件」才真正发作。
        onMouseEnter={(...args) => this.handleMouseEnter(...args)}
        onMouseLeave={(...args) => this.handleMouseLeave(...args)}
        disabled={this.props.disabled}
        setRef={this.setItemRef}
      >
        {this.props.children}
      </Item>
    );
  }
}

export default MenuItem;
