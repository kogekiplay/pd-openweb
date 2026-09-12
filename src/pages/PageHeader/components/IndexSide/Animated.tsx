import React, { useEffect, useState } from 'react';
import { animate, useMotionValue, useMotionValueEvent } from 'motion/react';
import { SPRING_DEFAULT } from 'src/utils/spring';
import IndexSide from './index';

/** 收起时的横向位移，与 IndexSide 自己的 defaultProps.posX 保持一致。 */
const CLOSED_X = -352;

/**
 * 把原来散在三个页头里的 `<Motion style={{ x: spring(visible ? 0 : -352) }}>`
 * 收成一处（NativeHeader / HubAndPluginHeader / AppPkgHeader-AppDetail）。
 *
 * 为什么不能直接用 <motion.div animate={{ x }}>：IndexSide 消费的是【数字本身】，
 * 不只是拿它做 transform：
 *   - IndexSide/index.tsx:41  transform: translate3d(${posX}px,0,0)   ← 纯样式，可以交给 Motion
 *   - IndexSide/Content.tsx:218  {loading && posX !== 0 ? <Skeleton/> : 内容}  ← 【逻辑分支】
 * 第二条是"面板还没完全展开时，加载中就显示骨架屏"。把动画交给 Motion 直接驱动 DOM，
 * 这个判断就拿不到值了。所以这里把动画值镜像回 React state，语义与迁移前完全一致
 * （每帧一次 re-render —— react-motion 本来就是这样，不是新增开销）。
 *
 * ⚠ 不要"优化"成 useSpring(visible ? 0 : CLOSED_X)：那样【不会动】。
 * useSpring → useFollowValue，其 useInsertionEffect 的依赖数组是
 * [value, JSON.stringify(options)]，【source 不在里面】；source 传普通数字时
 * attachFollow 只在挂载时按当时的目标挂一次，之后数字再变也不会重新追踪。
 * 不报错、不告警，只是面板不动了。所以这里用显式的 animate(motionValue, to, ...)。
 */
export default function AnimatedIndexSide(props) {
  const { visible } = props;
  const target = visible ? 0 : CLOSED_X;
  // 挂载即取目标值：原来的 <Motion> 没有 defaultStyle，react-motion 在这种情况下
  // 直接从目标值起步、不播入场动画。保持一致。
  const x = useMotionValue(target);
  const [posX, setPosX] = useState(target);

  useMotionValueEvent(x, 'change', setPosX);

  useEffect(() => {
    const controls = animate(x, target, SPRING_DEFAULT);
    return () => controls.stop();
  }, [target]);

  return <IndexSide {...props} posX={posX} />;
}
