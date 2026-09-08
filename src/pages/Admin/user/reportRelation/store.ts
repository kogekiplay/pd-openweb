import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './reducer';

// configureStore 默认就装了 thunk（RTK 自带 redux-thunk），也自动接管 redux devtools，
// 所以不再需要 applyMiddleware(thunk)。
export default configureStore({ reducer: rootReducer });
