import React, { cloneElement } from 'react';
import { Tooltip } from 'antd';
import cx from 'classnames';
import './index.less';

export default function (props) {
  const {
    children,
    destroyTooltipOnHide = true,
    type = 'var(--color-background-inverse)',
    title,
    color,
    shortcut,
    maxWidth = 350,
    // ↓ 下面这些是 antd 5 的旧名，v6 已经【删掉】或废弃。
    // 本壳有 669 个消费方，它们传的还是旧名，而下面 {...props} 会把这些名字
    // 原样铺到 antd 6 的 Tooltip 上：废弃的（overlay*）只是告警，但 visible /
    // onVisibleChange / arrowPointAtCenter 在 v6 是【真删掉】的——铺过去既不生效、
    // 也不报错，受控的 tooltip 会静默变成不受控。
    // 所以在这个 API 边界上做一次翻译：解构出来不再进 {...props}，再显式映射到新名。
    // 一处改掉，669 个消费方不用动，也不依赖「能不能用正则把跨行 JSX 找全」。
    visible,
    onVisibleChange,
    arrowPointAtCenter,
    overlayClassName,
    overlayStyle,
    overlayInnerStyle,
    ...restProps
  } = props;

  const renderTitle = () => {
    let content = title;
    if (!content) return null;

    // 如果有快捷键参数，则在 title 后面添加快捷键显示
    if (shortcut) {
      return (
        <span>
          {content}
          <span className="mLeft8 Alpha7">{shortcut}</span>
        </span>
      );
    }

    if (type === 'white') {
      return <div className="textBlack">{content}</div>;
    }

    return content;
  };

  return (
    <Tooltip
      {...restProps}
      color={type === 'white' ? 'white' : color || 'var(--color-background-inverse)'}
      title={renderTitle()}
      classNames={{ root: cx('md-tooltip-overlay', overlayClassName) }}
      styles={{
        root: { maxWidth, maxHeight: 300, whiteSpace: 'pre-wrap', ...overlayStyle },
        ...(overlayInnerStyle ? { container: overlayInnerStyle } : null),
      }}
      destroyOnHidden={destroyTooltipOnHide}
      {...(visible === undefined ? null : { open: visible })}
      {...(onVisibleChange ? { onOpenChange: onVisibleChange } : null)}
      {...(arrowPointAtCenter ? { arrow: { pointAtCenter: true } } : null)}
      zIndex={props.zIndex || 100000}
    >
      {cloneElement(children)}
    </Tooltip>
  );
}
