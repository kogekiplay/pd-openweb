import type { HTMLAttributes, Ref } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';

// 其余属性原样落到 <i> 上，所以 props 就是 <i> 的 HTML 属性再加下面几项
interface IconProps extends HTMLAttributes<HTMLElement> {
  /** 图标名：渲染成 `${prefix}${icon}` 这个 class，如 icon="edit" → icon-edit */
  icon?: string | undefined;
  /** 悬停提示，写到 title 上；给了它就以它为准 */
  hint?: string | undefined;
  /** 字体类名，默认 'icon' */
  fontClass?: string | undefined;
  /** 图标类名前缀，默认 `${fontClass}-` */
  prefix?: string | undefined;
  /** 附加一个 icon-<type> 类，默认 'default' */
  type?: string | undefined;
  /** React 19 里 ref 是函数组件的普通 prop，跟着其余属性一起落到 <i> 上 */
  ref?: Ref<HTMLElement> | undefined;
}

function Icon(props: IconProps) {
  const { icon, className, style, type = 'default', ...otherProps } = props;
  let { fontClass, prefix } = props;

  if (!fontClass) {
    fontClass = 'icon';
  }

  if (!prefix) {
    prefix = fontClass + '-';
  }

  return (
    <i
      {...otherProps}
      style={style}
      className={cx('ming Icon', `icon-${type}`, fontClass, prefix + icon, className)}
      // 原来是 title={props.hint}：没给 hint 时把调用方自己传的 title 也盖成 undefined，
      // 动态侧栏「官方群组」徽标的提示就一直出不来。hint 优先，没有再用 title
      title={props.hint ?? props.title}
    />
  );
}

Icon.propTypes = {
  icon: PropTypes.string,
  hint: PropTypes.string,
  fontClass: PropTypes.string,
  prefix: PropTypes.string,
  className: PropTypes.string,
};

export default Icon;
