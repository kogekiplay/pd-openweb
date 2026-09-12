// 本文件自己导出一个叫 configureStore 的函数，所以给 RTK 的同名导出起个别名。
import { configureStore as createReduxStore } from '@reduxjs/toolkit';
import { makeRootReducer } from './reducers';

// 只对下面这几条确切路径关掉两个 dev 检查，整棵 state 树的其余部分仍受保护。
// 共同点：它们存进 store 的都是【活对象】（Immutable 集合 / AbortController /
// 带方法的滚动控制器），自己就会变、也不可序列化，不是我们代码脏、也没法靠改写法修好。
const IGNORED_PATHS = [
  'kc.params',
  'kc.list',
  'kc.selectedItems',
  // 存的是一个【真 DOM 元素】（#kclistContainer），见 kc/redux/reducers.ts 的
  // kcListElement 与 kcAction.ts:181 的 kcListElement.querySelector(...)。
  // 这一条比其它几条更狠：DOM 节点有 parentNode ↔ childNodes 循环引用，而 RTK
  // 2.12 的循环防护是【死代码】—— trackProperties 的 checkedObjects 是默认参数，
  // 递归时没有往下传（dist/redux-toolkit.modern.mjs:175-199），所以遇到环不是
  // 报警而是无限递归。表现为 RangeError: Maximum call stack size exceeded，
  // 整个知识中心页被 ErrorBoundary 接管。本次会话里 ChildTable / RelateRecordTable
  // 撞的是同一个缺陷。
  'kc.kcListElement',
  'sheet.sheetview.abortController',
  // 存的是带 on() 等方法的滚动控制器对象，serializableCheck 每次 dispatch 报一次，
  // 实测单次浏览就刷出 372 条，把控制台里真正的报错淹掉。
  'sheet.gunterView.chartScroll',
];

export function configureStore() {
  // 原来这里手工探测并挂 window.__REDUX_DEVTOOLS_EXTENSION__，RTK 的 configureStore
  // 默认 devTools: true 做的是同一件事（且同样只在非 production 生效）；
  // thunk 也由默认中间件提供。所以 enhancers 那一段整块删掉了。
  return createReduxStore({
    reducer: makeRootReducer(),
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        // 豁免名单见上面的 IGNORED_PATHS。前三条是 kc 模块：
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
        //
        // sheet.sheetview.abortController 是第四条，性质相同 —— 存进 store 的是一个
        // 活的 AbortController 实例（见 worksheet/redux/actions/sheetview.ts 的
        // WORKSHEET_SHEETVIEW_INIT_ABORT_CONTROLLER）。它天生就会自己变：
        // 调用 abort() 时 signal.aborted 由 false 翻成 true，于是 immutableCheck 报
        // "in the path 'sheet.sheetview.abortController.signal.aborted'"，
        // 触发点是 SheetView.componentWillUnmount —— 切工作表就会撞。
        // serializableCheck 也一直在为它刷屏（"A non-serializable value was detected
        // in the state, in the path: sheet.sheetview.abortController"），每 dispatch 一次一条。
        // 这同样不是可修的代码缺陷，而是「把活对象放进 store」的必然结果；真要去掉
        // 得把 AbortController 移出 redux（改放 ref 或模块级 Map），那会动到
        // sheetview 的取数/取消逻辑，是独立一件事。
        // ignoredActions 也要给：ignoredPaths 只管 state 树，派发时 action 本身
        // 还会被单独检查一遍，否则 KC_UPDATE_LIST_ELEMENT 每次仍刷一条
        // 「A non-serializable value was detected in an action, in the path: `value`」。
        serializableCheck: { ignoredPaths: IGNORED_PATHS, ignoredActions: ['KC_UPDATE_LIST_ELEMENT'] },
        immutableCheck: { ignoredPaths: IGNORED_PATHS },
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
