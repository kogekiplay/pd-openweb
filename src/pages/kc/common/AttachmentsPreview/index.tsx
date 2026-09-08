import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AttachmentsPreview from './attachmentsPreview';
import reducer from './reducers/reducer';

// configureStore 默认装 thunk 并自动接管 devtools。
const store = configureStore({ reducer });

export default function (props) {
  return (
    <Provider store={store}>
      <AttachmentsPreview {...props} />
    </Provider>
  );
}
