import { createElement } from 'react';
import type { CSSProperties, LiHTMLAttributes, ReactNode, Ref } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import './less/Item.less';

// 其余属性原样落到 <li> 上
export interface ItemProps extends LiHTMLAttributes<HTMLLIElement> {
  /** 显示在内容前面；iconAtEnd 时由样式挪到后面 */
  icon?: ReactNode;
  iconAtEnd?: boolean | undefined;
  /** 子菜单，渲染在内容后面 */
  subMenu?: ReactNode;
  /** 给了就把内容渲染成 <a> */
  href?: string | undefined;
  target?: string | undefined;
  disabled?: boolean | undefined;
  setRef?: Ref<HTMLLIElement> | undefined;
  /** 内容那一层（div / a）的样式 */
  itemContentStyle?: CSSProperties | undefined;
}

function Item(props: ItemProps) {
  // itemContentStyle 原来留在 rest 里，除了给内容层用，还随 {...rest} 落到 <li> 上，
  // React 在开发环境报「React does not recognize the `itemContentStyle` prop on a DOM element」
  const { className, children, icon, iconAtEnd, subMenu, target, href, disabled, setRef, itemContentStyle, ...rest } =
    props;
  return (
    <li {...rest} ref={setRef} className={cx(className, `ming Item ${iconAtEnd ? 'iconAtEnd' : ''}`)}>
      {createElement(
        href ? 'a' : 'div',
        {
          className: 'Item-content' + (disabled ? ' disabled' : ''),
          href,
          target,
          style: itemContentStyle,
        },
        <span>
          {icon}
          {children}
        </span>,
      )}
      {subMenu}
    </li>
  );
}

Item.propTypes = {
  icon: PropTypes.element,
  iconAtEnd: PropTypes.bool,
  subMenu: PropTypes.element,
  target: PropTypes.string,
  href: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.any,
  disabled: PropTypes.bool, // 是否禁用
  setRef: PropTypes.func,
};

export default Item;
