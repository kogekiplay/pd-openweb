import React from 'react';
import { Provider } from 'react-redux';
import Config from '../../../config';
import { updateProjectId } from './actions/current';
import Root from './container/root';
import configureStore from './store/configureStore';
import './index.less';

const store = configureStore();

export default class App extends React.Component<any, any> {
  constructor() {
    super();
    Config.setPageTitle(_l('用户 - 成员与部门'));
  }

  override componentDidMount() {
    $('html').addClass('AppAdminStructure');
  }

  override componentWillUnmount() {
    store.dispatch({ type: 'PROJECT_ID_CHANGED' });
    $('html').removeClass('AppAdminStructure');
  }

  override render() {
    store.dispatch(updateProjectId(this.props.projectId));

    return (
      <Provider store={store}>
        <Root handleShowHeader={this.props.handleShowHeader} authority={this.props.authority} />
      </Provider>
    );
  }
}
