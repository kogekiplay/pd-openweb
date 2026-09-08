// 本文件自己导出一个叫 configureStore 的函数，所以给 RTK 的同名导出起个别名。
import { configureStore as createReduxStore } from '@reduxjs/toolkit';
import api from '../middleware/api';
import reducer from '../reducers';

const configureStore = preloadState =>
  // 原来是 redux 1.x 时代的 compose(applyMiddleware(...))(createStore) 写法，
  // 第三个位置参数手工挂 devtools —— RTK 的 configureStore 默认 devTools: true 已覆盖；
  // thunk 由默认中间件提供，自定义的 api 中间件追加在其后（保持原来 thunk 在前的顺序）。
  createReduxStore({
    reducer,
    preloadedState: preloadState,
    middleware: getDefaultMiddleware => getDefaultMiddleware().concat(api),
  });

export default configureStore;
