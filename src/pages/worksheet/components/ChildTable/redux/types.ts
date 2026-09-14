import type reducer from './reducer';

/**
 * ChildTable 的【局部】 store 状态类型。
 *
 * 本仓不止一个 store —— 给局部 store 套全局 RootState 会凭空造出错误
 * （见 tools/codemod-thunk-params.cjs 的头部警告）。做法与 src/redux/types.ts 一致：
 * 从这棵 reducer 自己推，reducer 增删 slice 时这里自动跟着走，不会静默失配。
 *
 * 精度就是 reducer 自己的精度：各 slice 由它的 initialState 字面量推出来，
 * 该宽的地方仍然宽。要提升得去标对应的 reducer，改一个收一个。
 */
export type ChildTableState = ReturnType<typeof reducer>;

/** thunk 里的 dispatch。局部 store 不经 RTK，直接描述它实际支持的两种实参 */
export type ChildTableDispatch = (action: any) => any;

export type ChildTableGetState = () => ChildTableState;
