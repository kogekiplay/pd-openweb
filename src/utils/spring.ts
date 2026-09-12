/**
 * 从 react-motion 迁到 Motion（motion/react）时的弹簧参数映射。
 *
 * 为什么要单独定义、而不是用 Motion 的默认值：两个库的默认弹簧【不一样】，
 * 直接用默认值会让全站动画手感整体改变 —— 而这次迁移的目标是换库，不是改手感。
 *
 * react-motion 这边的事实（读 node_modules/react-motion 源码确认，不是凭印象）：
 *   - presets.js: noWobble = { stiffness: 170, damping: 26 }，注释写明
 *     "the default, if nothing provided"
 *   - spring.js:  defaultConfig = { ...noWobble, precision: 0.01 }
 *     即 spring(value) 不传第二参时就是这组值
 *   - stepper.js: 注释 "usually we put mass here, but for animation purposes,
 *     specifying mass is a [...]"，即质量项被省略，等价 mass = 1
 *
 * 所以 Motion 侧要显式写全 stiffness / damping / mass 三项才等价。
 *
 * 关于 precision：react-motion 用它同时作为位移和速度的静止阈值；Motion 分成
 * restDelta / restSpeed 两个。数量级一致，不逐一对齐 —— 它只影响动画末尾几毫秒
 * 何时判定停止，肉眼不可见，为它引入两个魔数不划算。
 */
import type { Transition } from 'motion/react';

/** 等价于 react-motion 的 spring(value)（noWobble 预设）。 */
export const SPRING_DEFAULT: Transition = {
  type: 'spring',
  stiffness: 170,
  damping: 26,
  mass: 1,
};

/** 等价于 react-motion 的 spring(value, { stiffness: 300, damping: 30 })，EditingBar 在用。 */
export const SPRING_STIFF_300: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 1,
};

/** 立即跳变，不做动画。对应 react-motion 里「直接给数字、不包 spring()」的写法。 */
export const SPRING_NONE: Transition = { duration: 0 };
