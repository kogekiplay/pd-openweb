import React, { cloneElement, Component } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import './less/List.less';

class List extends Component<any, any> {
  static propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    header: PropTypes.element,
    footer: PropTypes.element,
    bodyMaxHeight: PropTypes.number,
  };
  render() {
    let iconAtFront = false;
    let iconAtEnd = false;
    const items = React.Children.map(this.props.children, item => {
      if (!React.isValidElement(item)) {
        return null;
      }

      if (item.props.icon) {
        if (item.props.iconAtEnd && !iconAtEnd) {
          iconAtEnd = true;
        } else if (!iconAtFront) {
          iconAtFront = true;
        }
      }

      return item;
    });

    const header = this.props.header
      ? cloneElement(this.props.header, { className: cx(this.props.header.props.className, 'List-header') })
      : undefined;
    const footer = this.props.footer
      ? cloneElement(this.props.footer, { className: cx(this.props.footer.props.className, 'List-footer') })
      : undefined;
    // 【自己的 prop 不能进 ...rest】原先是 `<div {...this.props}>`，于是 setRef /
    // header / footer / bodyMaxHeight 全都落到真实 DOM 上；更糟的是 ClickAway.wrap
    // 会把 onClickAway / onClickAwayExceptions / specialFilter 一路透传进来，
    // React 逐个报 "Unknown event handler property" 和 "does not recognize the prop"。
    const {
      setRef,
      header: _header,
      footer: _footer,
      bodyMaxHeight,
      className,
      children: _children,
      // 这三个不是 List 的 prop，是 ClickAway.wrap(Menu) 透传下来的
      //（它的 shouldForwardClickAwayProps 会把它们塞回给被包组件）。
      // Menu 不消费、原样传给 List，最后就落到 <div> 上了。
      onClickAway: _onClickAway,
      onClickAwayExceptions: _onClickAwayExceptions,
      specialFilter: _specialFilter,
      ...rest
    } = this.props as any;
    return (
      <div
        {...rest}
        ref={setRef}
        className={cx(className, 'ming List', {
          'List--withIconFront': iconAtFront,
          'List--withIconEnd': iconAtEnd,
        })}
      >
        {header}
        <ul className="" style={{ maxHeight: this.props.bodyMaxHeight }}>
          {items}
        </ul>
        {footer}
      </div>
    );
  }
}

export default List;
