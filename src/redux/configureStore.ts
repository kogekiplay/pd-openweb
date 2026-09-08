// 本文件自己导出一个叫 configureStore 的函数，所以给 RTK 的同名导出起个别名。
import { configureStore as createReduxStore } from '@reduxjs/toolkit';
import { makeRootReducer } from './reducers';

export function configureStore() {
  // 原来这里手工探测并挂 window.__REDUX_DEVTOOLS_EXTENSION__，RTK 的 configureStore
  // 默认 devTools: true 做的是同一件事（且同样只在非 production 生效）；
  // thunk 也由默认中间件提供。所以 enhancers 那一段整块删掉了。
  return createReduxStore({
    reducer: makeRootReducer(),
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        // 只对三条确切路径关掉这两个 dev 检查，整棵 state 树的其余部分仍受保护。
        // 这三个 slice 存的是 Immutable.js 集合（src/pages/kc/redux/reducers.ts:50/79/155
        // 分别以 Map / List / Set 作默认值），两个检查对它们都不适用，而且都不是我们代码脏：
        //
        //  - serializableCheck 会把 Immutable 集合判成不可序列化，每次 dispatch 报一次，
        //    并且要深走整棵 state 树，在这个规模的 store 上开发环境会明显变慢。
        //  - immutableCheck 更严重，它会【抛错】而不是警告。实测：Immutable 把 hashCode
        //    缓存在内部 __hash 字段，只要读一次（shallowEqual、equals 内部都会读）就写这个
        //    字段，RTK 判成 "A state mutation was detected between dispatches, in the
        //    path 'list.__hash'"。这是 Immutable.js 的固有行为，不是可修的缺陷。
        //
        // 要真正去掉这三条豁免，得把 kc 模块的 store state 从 Immutable.js 换成普通 JS
        // 结构（涉及 kc/redux/reducers.ts 与 selectAction.ts，另有 8 个组件读这些集合），
        // 那是独立一件事，不该混在依赖升级里做。
        serializableCheck: { ignoredPaths: ['kc.params', 'kc.list', 'kc.selectedItems'] },
        immutableCheck: { ignoredPaths: ['kc.params', 'kc.list', 'kc.selectedItems'] },
      }),
  });
}

const store = configureStore();

// react-redux 9 把裸 useDispatch() 收紧成 Dispatch<UnknownAction>，不认 thunk。
// RTK 从 store 推导出的 dispatch 类型是带 thunk 中间件的，所以要 dispatch thunk 的
// 组件应当写 useDispatch<AppDispatch>()。
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

export default store;
