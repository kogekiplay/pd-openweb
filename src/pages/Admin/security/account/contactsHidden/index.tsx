import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { updateProjectId } from './actions/action';
import ContactsHidden from './container/ContactsHidden';
import reducer from './reducers/reducer';
import './index.less';

// configureStore 默认装 thunk 并自动接管 devtools，等价于原来的
// createStore(reducer, compose(applyMiddleware(thunk)))。
const store = configureStore({ reducer });

export default class ContactsHiddenWrap extends React.Component<any, any> {
  constructor() {
    super();
  }

  override componentDidMount() {
    $('html').addClass('AppAdminContactsHidden');
  }

  override componentWillUnmount() {
    $('html').removeClass('AppAdminContactsHidden');
  }

  override render() {
    store.dispatch(updateProjectId(this.props.projectId));

    return (
      <Provider store={store}>
        <ContactsHidden {...this.props} />
      </Provider>
    );
  }
}
