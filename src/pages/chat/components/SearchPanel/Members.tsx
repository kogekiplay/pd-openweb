import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import { LoadDiv, ScrollView } from 'ming-ui';
import GroupController from 'src/api/group';
import type { ChatSession } from '../../redux/types';
import { Member } from '../Members/Panel';
import type { MemberItem } from '../Members/Panel';

export interface SearchMembersProps {
  session: ChatSession;
  /** 搜索关键词（变化时重置分页并重拉） */
  searchText?: string | undefined;
  /** 点击某个成员（父级会话面板的 `onOpenSession`，与 `MembersPanel` 同一回调） */
  onOpenSession: (item: MemberItem) => void;
}

export interface SearchMembersState {
  loading: boolean;
  pageIndex: number;
  members: MemberItem[];
}

export default class Members extends Component<SearchMembersProps, SearchMembersState> {
  constructor(props: SearchMembersProps) {
    super(props);
    this.state = {
      loading: false,
      pageIndex: 1,
      members: [],
    };
  }
  override componentDidMount() {
    const { searchText } = this.props;
    this.updateMembers(searchText);
  }

  override componentDidUpdate(prevProps: SearchMembersProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.searchText !== prevProps.searchText) {
        this.setState(
          {
            loading: false,
            pageIndex: 1,
            members: [],
          },
          () => {
            this.updateMembers(this.props.searchText);
          },
        );
      }
    }
  }
  updateMembers(searchText: string | undefined) {
    const { session } = this.props;
    const { loading, pageIndex, members } = this.state;

    if (loading || !pageIndex) {
      return;
    }

    this.setState({
      loading: true,
    });
    GroupController.getGroupUsers({
      groupId: session.id,
      pageIndex,
      keywords: searchText,
      pageSize: 18,
    }).then(result => {
      const { groupUsers } = result;
      this.setState({
        pageIndex: groupUsers && groupUsers.length >= 18 ? pageIndex + 1 : 0,
        loading: false,
        members: members.concat(groupUsers || []),
      });
    });
  }
  handleScrollEnd() {
    const { searchText } = this.props;
    this.updateMembers(searchText);
  }
  override render() {
    const { members, loading } = this.state;
    return (
      <ScrollView
        className="ChatPanel-SearchPanelContent ChatPanel-SearchPanel-Member"
        onScrollEnd={this.handleScrollEnd.bind(this)}
      >
        {members.map((item: MemberItem) => (
          <Member item={item} key={item.accountId} onOpenSession={this.props.onOpenSession} />
        ))}
        <LoadDiv className={cx('loading', { Hidden: !loading })} size="small" />
        {!loading && !members.length ? (
          <div className="nodata-wrapper">
            <div className="nodata-img" />
            <p>{_l('无匹配结果')}</p>
          </div>
        ) : undefined}
      </ScrollView>
    );
  }
}
