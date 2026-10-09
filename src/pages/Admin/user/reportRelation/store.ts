import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './reducer';

/** Each mounted report-relation view keeps its organization in its own thunk middleware. */
export default function createReportRelationStore(projectId: string) {
  return configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware => getDefaultMiddleware({ thunk: { extraArgument: { projectId } } }),
  });
}
