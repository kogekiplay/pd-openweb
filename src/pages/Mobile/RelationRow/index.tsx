import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import _ from 'lodash';
import * as actions from 'mobile/RelationRow/redux/actions';
import type { RootState } from 'src/redux/types';
import withRouter from '../../../router/withRouter';
import RelationAction from './RelationAction';
import RelationList from './RelationList';

let Home = class Home extends Component<any, any> {
  constructor(props) {
    super(props);
  }

  handleScroll = event => {
    const { loadParams, updatePageIndex } = this.props;
    const { clientHeight, scrollHeight, scrollTop } = event.target;
    const targetVlaue = scrollHeight - clientHeight - 30;
    const { loading, isMore, pageIndex } = loadParams;

    if (targetVlaue <= scrollTop && !loading && isMore) {
      updatePageIndex(pageIndex + 1);
    }
  };

  render() {
    const { controlId, params } = this.props;
    return (
      <Fragment>
        <div
          className="flexColumn flex"
          style={{
            overflowX: 'hidden',
            overflowY: 'auto',
          }}
          onScroll={this.handleScroll}
        >
          <RelationList {...params} />
        </div>
        <RelationAction controlId={controlId} />
      </Fragment>
    );
  }
};
Home = withRouter(Home);
export default connect(
  (state: RootState) => ({ ..._.pick(state.mobile, ['loadParams']) }),
  dispatch => bindActionCreators(_.pick(actions, ['updatePageIndex']), dispatch),
)(Home);
