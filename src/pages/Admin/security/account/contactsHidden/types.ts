/**
 * ContactsHidden 自己的局部 store 类型。
 *
 * 这个 store 【不在】根 reducer 里（src/redux/reducers.ts），所以不能用 RootState ——
 * 用了会把 getState() 判成整棵全局树，读自己的 slice 立刻 TS2339。
 *
 * 和 RootState 同样的做法：从它自己的 reducer 推，reducer 增删 slice 这边自动跟着走。
 */
import type reducer from './reducers/reducer';

export type ContactsHiddenState = ReturnType<typeof reducer>;
/** 这个 store 没接 thunk 的类型化中间件，dispatch 收裸 action 也收 thunk 函数 */
export type ContactsHiddenDispatch = (action: any) => any;
export type ContactsHiddenGetState = () => ContactsHiddenState;
