import React from 'react';
import { shallowEqual } from 'react-redux';
import { Provider } from 'react-redux';
import PropTypes from 'prop-types';
import store from 'src/redux/configureStore';
import postEnum from '../../constants/postEnum';
import { changeListType, changeTitle } from '../../redux/postActions';
import { PostList } from '../post';
import './feed.css';
import './style.css';
import './userFeed.css';

class UserFeed extends React.Component<any, any> {
  static propTypes = {
    accountId: PropTypes.string,
    title: PropTypes.string,
  };

  componentDidMount() {
    store.dispatch(
      changeListType({
        listType: postEnum.LIST_TYPE.user,
        accountId: this.props.accountId,
      }),
    );
    store.dispatch(changeTitle(this.props.title));
  }

  componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (prevProps.accountId !== this.props.accountId || prevProps.title !== this.props.title) {
        store.dispatch(
          changeListType({
            listType: postEnum.LIST_TYPE.user,
            accountId: this.props.accountId,
          }),
        );
        store.dispatch(changeTitle(this.props.title));
      }
    }
  }

  render() {
    return (
      <Provider store={store}>
        <div className="userFeed userFeedContainer">
          <PostList disableLoadNew />
        </div>
      </Provider>
    );
  }
}

export default UserFeed;
