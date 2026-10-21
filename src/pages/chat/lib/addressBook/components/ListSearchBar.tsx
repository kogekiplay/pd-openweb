import React from 'react';
import type { ChangeEvent } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import { Tooltip } from 'ming-ui/antd-components';
import Icon from 'ming-ui/components/Icon';
import { dialogSelectUser } from 'ming-ui/functions';
import InviteController from 'src/api/invitation';
import addFriends from 'src/components/addFriends';
import AddFriends from 'src/components/addFriends';
import createGroup from 'src/pages/Group/createGroup/load';
import { existAccountHint } from 'src/utils/inviteCommon';

interface ListSearchBarProps {
  /** 外部传入的当前关键词（组件内部输入框会跟随它变化） */
  keywords?: string | undefined;
  /** 关键词变化的防抖回调（构造器里包成 500ms debounce） */
  search: (value: string) => void;
  /** 右侧按钮类型：contacts / friends / projectContacts / groups */
  type?: string | undefined;
  projectId?: string | null | undefined;
}

interface ListSearchBarState {
  /** 输入框当前值（外部 keywords 可缺省，如实允许 undefined） */
  value?: string | undefined;
}

export default class SearchBar extends React.Component<ListSearchBarProps, ListSearchBarState> {
  /** 构造器里生成的防抖搜索（`componentWillUnmount` 里 cancel） */
  declare search: _.DebouncedFunc<(value: string) => void>;

  constructor(props: ListSearchBarProps) {
    // 原实现 `super()` 未传 props；React 之后仍会写入 this.props，运行等价（Babel 有 1 行差异）。
    super(props);
    this.state = {
      value: props.keywords || '',
    };
    this.addHandler = this.addHandler.bind(this);
    this.search = _.debounce(props.search, 500);
    this.searchHandler = this.searchHandler.bind(this);
  }

  override componentDidUpdate(prevProps: ListSearchBarProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.keywords !== prevProps.keywords) {
        this.setState({
          value: this.props.keywords,
        });
      }
    }
  }

  override componentWillUnmount() {
    if (this.search && this.search.cancel) {
      this.search.cancel();
    }
  }

  searchHandler(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    this.setState({
      value,
    });
    this.search(value);
  }

  addHandler() {
    const { type, projectId } = this.props;

    switch (type) {
      case 'contacts':
        addFriends({ selectProject: true });
        break;
      case 'friends':
        AddFriends({ projectId, fromType: 0 });
        break;
      case 'projectContacts':
        dialogSelectUser({
          SelectUserSettings: {
            filterAccountIds: [md.global.Account.accountId],
            filterProjectId: projectId,
            callback: function (users: { accountId?: string }[]) {
              InviteController.inviteUser({
                sourceId: projectId,
                accountIds: users.map((o: { accountId?: string }) => o.accountId),
                fromType: 4,
              }).then(function (result) {
                existAccountHint(result);
              });
            },
          },
        });
        break;
      case 'groups':
        createGroup({ projectId });
        break;
      default:
        break;
    }
  }

  override render() {
    const { type } = this.props;
    const isGroup = type === 'groups';
    const isFriend = type === 'friends';
    const tip = isGroup ? _l('创建群组') : isFriend ? _l('邀请好友') : _l('邀请同事');
    return (
      <div className="contacts-search">
        <div className="contacts-search-wrapper">
          <Icon icon="search" className="Font18 textTertiary mTop1" />
          <input
            name="listSearchBar"
            autoComplete="off"
            type="text"
            className="contacts-search-input"
            placeholder={_l('搜索')}
            onChange={this.searchHandler}
            value={this.state.value}
          />
        </div>
        <Tooltip title={tip}>
          <span>
            <Icon
              icon={isGroup ? 'group_add' : 'invite'}
              className={cx(
                'contacts-search-addbtn pLeft12 pRight20 textTertiary Hand hoverColorPrimary',
                isGroup ? 'Font22' : 'Font18 mLeft5',
              )}
              onClick={this.addHandler}
            />
          </span>
        </Tooltip>
      </div>
    );
  }
}
