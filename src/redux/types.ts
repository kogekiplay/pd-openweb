import type { ThunkAction, ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { makeRootReducer } from './reducers';

/**
 * 整棵 store 的 state 类型。
 *
 * 【为什么需要它】react-redux 9 删掉了 DefaultRootState（8 里还在，
 * 可以靠 `declare module 'react-redux' { interface DefaultRootState ... }`
 * 一处增强全仓生效）。9 之后 connect 的 mapStateToProps 拿不到任何默认类型，
 * state 直接是 unknown —— 全仓 connect(state => ({ ...state.sheet })) 于是
 * 齐刷刷报 TS2339「Property 'sheet' does not exist on type 'unknown'」。
 * 这不是某个文件写错了，是缺一个类型出口。
 *
 * 【为什么从 reducer 推，而不是手写】手写一份 slice 清单等于把同一份事实
 * 写两遍，reducers.ts 增删 slice 时这边不会报错，只会静默失配。
 * 从 combineReducers 的返回类型推导则天然跟着 reducers.ts 走。
 *
 * 【精度就是 reducer 自己的精度】这些 reducer 大多是无类型标注的 JS，
 * 各 slice 的类型由它的 initialState 字面量推出来，该宽的地方仍然宽。
 * 这里不做拔高 —— 拿 unknown 换一个【猜】出来的具体类型会凭空造出假错误。
 * 要提升精度，得去给对应的 reducer 标类型，改一个 slice 收一个 slice 的效果。
 */
export type RootState = ReturnType<ReturnType<typeof makeRootReducer>>;

/**
 * thunk 里 dispatch 的类型。
 *
 * 【为什么不从 store 推】configureStore.ts 里已经有
 * `export type AppDispatch = typeof store.dispatch`，但 action 文件不能 import 它：
 * store → reducers → actions → store 会成环。所以这里用 RTK 的 ThunkDispatch
 * 直接构造，只依赖 RootState，不依赖 store 实例。
 *
 * 第二个类型参数是 thunk 的 extraArgument。本仓用的是 RTK 默认中间件、
 * 没有配 extraArgument（见 configureStore.ts 的 middleware），所以是 undefined ——
 * 这是【实情】，不是拿 unknown 占位。
 */
export type AppDispatch = ThunkDispatch<RootState, undefined, UnknownAction>;

/** thunk 里 getState 的类型。 */
export type GetState = () => RootState;

/** 一个 thunk action 的完整签名，返回值默认 void。 */
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, undefined, UnknownAction>;
