import React, { forwardRef, useCallback, useRef } from 'react';
import { useClickAway } from 'react-use';
import { compact, every, flatten, isFunction, map } from 'lodash';
import PropTypes from 'prop-types';

const DEFAULT_EVENTS = ['mousedown'];
const BOUNDARY_STYLE = { display: 'contents' };

function assignRef(ref, value) {
  if (isFunction(ref)) {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

function getDomNode(node) {
  if (!node) {
    return null;
  }

  if (node.nodeType) {
    return node;
  }

  if (node.current) {
    return getDomNode(node.current);
  }

  return null;
}

function getClickAwayExceptions(onClickAwayExceptions) {
  return compact(
    map(onClickAwayExceptions, item => {
      if (window.jQuery && item instanceof window.jQuery) {
        return map(item, x => x);
      }

      if (typeof item === 'string' && window.jQuery) {
        return map(window.jQuery(item), x => x);
      }

      return getDomNode(item);
    }),
  );
}

function shouldTriggerClickAway({ el, target, exceptions, specialFilter }) {
  if (!target || !el || !window.jQuery) {
    return false;
  }

  return (
    target !== el &&
    !window.jQuery(target).closest(window.jQuery(el)).length &&
    // exceptions 是异构的：字符串选择器、DOM 节点、jQuery 集合都可能进来
    //（见上面 normalize 里的分支），所以 item 只能是 any。
    every(
      flatten(exceptions),
      (item: any) => target !== item && !window.jQuery(target).closest(window.jQuery(item)).length,
    ) &&
    document.documentElement.contains(target) &&
    !(specialFilter && specialFilter(target))
  );
}

function useCompatibleClickAway({ ref, onClickAway, onClickAwayExceptions, specialFilter }) {
  useClickAway(
    ref,
    event => {
      if (
        onClickAway &&
        shouldTriggerClickAway({
          el: ref.current,
          target: event.target,
          exceptions: getClickAwayExceptions(onClickAwayExceptions),
          specialFilter,
        })
      ) {
        onClickAway(event.target);
      }
    },
    DEFAULT_EVENTS,
  );
}

function useClickAwayElement(props, ref: React.ForwardedRef<unknown>, shouldForwardClickAwayProps: boolean) {
  const { component: Component = 'div', onClickAway, onClickAwayExceptions, specialFilter, ...rest } = props;
  const clickAwayRef = useRef(null);
  const handleRef = useCallback(
    node => {
      clickAwayRef.current = getDomNode(node);
      assignRef(ref, node);
    },
    [ref],
  );

  useCompatibleClickAway({
    ref: clickAwayRef,
    onClickAway,
    onClickAwayExceptions,
    specialFilter,
  });

  const componentProps = shouldForwardClickAwayProps
    ? {
        ...rest,
        onClickAway,
        onClickAwayExceptions,
        specialFilter,
      }
    : rest;

  if (typeof Component === 'string') {
    return <Component {...rest} ref={handleRef} />;
  }

  return <ClickAwayComponentBoundary component={Component} componentProps={componentProps} ref={handleRef} />;
}

/**
 * ClickAway 的 props。字段与下面的 propTypes 一一对应。
 *
 * 【索引签名是如实描述，不是放水】实现里 `...rest` 会原样透传给 component，
 * 而 component 可以是任意标签名或任意组件，所以剩余属性天然是开放的。
 * 没有这份类型时 forwardRef 把 props 推成 {}，调用点传 component / className
 * 一律报"属性不存在于 IntrinsicAttributes"——本仓有两处就是这么报的。
 */
interface ClickAwayProps {
  /** 渲染成什么，默认 'div'；可以是标签名或组件 */
  component?: any;
  children?: React.ReactNode;
  /** 点击外部区域时触发 */
  onClickAway?: (target: EventTarget | null) => void;
  /** 外部区域中点击到了也不触发的对象：jQuery 对象、ReactComponent 或原生 DOM */
  onClickAwayExceptions?: any[];
  /**
   * 部分由 jquery plugins 绑定的元素无法直接传入，额外给一个自定义判断函数。
   * 【返回类型不能写死成 boolean】调用点是按真假值用的，实际有返回
   * jQuery 的 closest() 结果或 DOM 节点的写法（见 WorkSheetFilter/FiltersPopup）。
   */
  specialFilter?: (target: EventTarget | null) => any;
  /** 其余属性原样透传给 component */
  [key: string]: any;
}

const ClickAwayComponentBoundary = forwardRef(function ClickAwayComponentBoundary(
  props: { component: any; componentProps: any },
  ref,
) {
  const { component: Component, componentProps } = props;
  return (
    <span ref={ref} style={BOUNDARY_STYLE}>
      <Component {...componentProps} />
    </span>
  );
});

/**
 * 【类型里必须带上静态的 wrap】forwardRef 返回的是 ForwardRefExoticComponent，
 * 上面没有 wrap；而全仓有 30 处写 ClickAway.wrap(Xxx)。
 * 只给 props 补类型、不管这个静态方法的话，那 30 处会立刻全部报"属性不存在"。
 */
const ClickAway = forwardRef(function ClickAway(props: ClickAwayProps, ref) {
  return useClickAwayElement(props, ref, false);
}) as React.ForwardRefExoticComponent<ClickAwayProps & React.RefAttributes<unknown>> & {
  wrap: (Component: any) => any;
};

ClickAway.propTypes = {
  component: PropTypes.any,
  children: PropTypes.node,
  onClickAway: PropTypes.func, // 点击外部区域时触发的方法
  // 外部区域中点击到了不触发 onClickAway 的对象，可以是 jQuery 对象、ReactComponent 或原生 DOM 对象
  onClickAwayExceptions: PropTypes.array,
  // 部分由 jquery plugins 绑定的元素无法直接传入，可额外传自定义判断函数 return bool
  specialFilter: PropTypes.func,
};

ClickAway.wrap = Component => {
  const ClickAwayWrapper = forwardRef((props, ref) =>
    useClickAwayElement({ ...props, component: Component }, ref, true),
  );
  ClickAwayWrapper.displayName = `ClickAway(${Component.displayName || Component.name || 'Component'})`;
  return ClickAwayWrapper;
};

export default ClickAway;
