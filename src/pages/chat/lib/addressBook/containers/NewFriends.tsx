import React from 'react';
import { shallowEqual } from 'react-redux';
import { LoadDiv, ScrollView } from 'ming-ui';
import ListNull from '../components/ListNull';
import NewFriendsList from '../components/NewFriendsList';
import RecommendsList from '../components/RecommendsList';

interface NewFriendsState {
  loadedRecommends: boolean;
  haveRecommends: boolean;
  loadedApplys: boolean;
  haveApplys: boolean;
  firstLoading: boolean;
}

export default class NewFriends extends React.Component<Record<string, never>, NewFriendsState> {
  constructor(props: Record<string, never>) {
    // 原实现 `super()` 未传 props；React 之后仍会写 this.props，运行等价（Babel 1 行差异）。
    super(props);

    this.state = {
      loadedRecommends: false,
      haveRecommends: true,
      loadedApplys: false,
      haveApplys: true,
      firstLoading: true,
    };

    this.updateRecommendsFlag = this.updateRecommendsFlag.bind(this);
    this.updateApplysFlag = this.updateApplysFlag.bind(this);
  }

  override componentDidUpdate(prevProps: Record<string, never>) {
    if (!shallowEqual(prevProps, this.props)) {
      this.setState({
        loadedRecommends: false,
        haveRecommends: true,
        loadedApplys: false,
        haveApplys: true,
        firstLoading: true,
      });
    }
  }

  updateRecommendsFlag(haveRecommends: boolean) {
    this.setState({
      loadedRecommends: true,
      haveRecommends,
      firstLoading: false,
    });
  }

  updateApplysFlag(haveApplys: boolean) {
    this.setState({
      loadedApplys: true,
      haveApplys,
      firstLoading: false,
    });
  }

  renderContent() {
    const { firstLoading, loadedApplys, loadedRecommends, haveRecommends, haveApplys } = this.state;

    if (loadedApplys && loadedRecommends && !haveApplys && !haveRecommends) {
      return <ListNull type="newfriends" />;
    }

    return (
      <ScrollView>
        <div className="pAll20">
          <NewFriendsList isLoaded={loadedApplys} update={this.updateApplysFlag} />
          <RecommendsList isLoaded={loadedRecommends} update={this.updateRecommendsFlag} />
          {firstLoading ? <LoadDiv className="mTop20" /> : null}
        </div>
      </ScrollView>
    );
  }

  override render() {
    return <div className="contacts-new-friends">{this.renderContent()}</div>;
  }
}
