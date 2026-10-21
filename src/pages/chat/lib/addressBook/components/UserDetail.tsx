import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import Trigger from '@rc-component/trigger';
import { Dialog, Icon, LoadDiv, ScrollView } from 'ming-ui';
import Menu from 'ming-ui/components/Menu';
import MenuItem from 'ming-ui/components/MenuItem';
import { addFriendConfirm as addFriendConfirmFun } from 'ming-ui/functions';
import { checkCertification } from 'src/components/checkCertification';
import UserBaseProfile from 'src/components/UserInfoComponents/UserBaseProfile.jsx';
import UserMoreProfile from 'src/components/UserInfoComponents/UserMoreProfile.jsx';
import { pathCompletion } from 'src/utils/common';
import copy from 'src/utils/copyToClipboard';
import API, { removeFriend } from '../api';
import { config } from '../config';
import type { AddressBookUserCard, AddressBookUserDetail } from '../types';
import AddFriend from './AddFriend';

interface UserDetailProps {
  /** 要展示的用户；null 表示清空（父级切走时会显式置 null） */
  accountId?: string | null | undefined;
  projectId?: string | null | undefined;
  hideBackBtn?: boolean | undefined;
  /** 返回按钮回调（父级传入） */
  back?: () => void;
}

interface UserDetailState {
  data: AddressBookUserDetail | null | undefined;
  isLoading: boolean;
}

/** `fetchUserDetail` 失败分支写入的默认 state */
const defaultState: UserDetailState = {
  data: null,
  isLoading: false,
};


export default class UserDetail extends React.Component<UserDetailProps, UserDetailState> {
  constructor(props: UserDetailProps) {
    super(props);

    this.state = defaultState;

    this.addFriendConfirm = this.addFriendConfirm.bind(this);
    this.deleteFriendConfirm = this.deleteFriendConfirm.bind(this);
  }

  override componentDidMount() {
    const { accountId } = this.props;

    if (accountId) {
      this.fetchUserDetail(accountId);
    }
  }

  override componentDidUpdate(prevProps: UserDetailProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.accountId && this.props.accountId !== prevProps.accountId) {
        this.fetchUserDetail(this.props.accountId);
      } else if (this.props.accountId === null) {
        this.setState(defaultState);
      }
    }
  }

  fetchUserDetail(accountId: string) {
    this.setState({
      isLoading: true,
    });
    API.fetchUserDetail(accountId)
      .then((data: AddressBookUserDetail | undefined) => {
        if (data) {
          data.userCards = (_.get(data, 'userCards') || []).filter((item: AddressBookUserCard) => item.companyName);

          this.setState({
            ...defaultState,
            // assign default state
            data,
          });
        } else {
          this.setState({
            ...defaultState,
            // assign default state
            data,
          });
        }
      })
      .catch(() => {
        this.setState({
          ...defaultState,
          // assign default state
          data: undefined,
        });
      });
  }

  addFriendConfirm() {
    const { accountId } = this.props;
    addFriendConfirmFun({
      accountId,
    });
  }

  deleteFriendConfirm() {
    const { accountId } = this.props;
    Dialog.confirm({
      title: _l('确认删除当前好友？'),
      description: _l('删除后您将不显示在对方的好友列表里'),
      onOk: () => {
        // 擦除标记：只有带 accountId 时才显示删除好友入口（原 any 直接传）。
        removeFriend(accountId as string).then(() => {
          alert(_l('删除成功'), 1);
          this.setState({
            data: {
              ...this.state.data,
              isFriend: false,
            },
          });
        });
      },
    });
  }

  renderFriendTag() {
    // 擦除标记：调用方只在 data 已加载时渲染（原 any 直接解构）；缺省时原实现抛原生 TypeError。
    const { isFriend, accountId } = this.state.data as AddressBookUserDetail;
    if (accountId === md.global.Account.accountId) return null;
    if (!isFriend) {
      return (
        <span
          className="Right textSecondary Hand hoverColorPrimary"
          onClick={() => checkCertification({ isPersonal: true, checkSuccess: this.addFriendConfirm })}
        >
          <i className="Font14 icon-custom_add_circle TxtMiddle" />
          <span className="mLeft5 TxtMiddle Font12">{_l('添加好友')}</span>
        </span>
      );
    } else {
      return (
        <div className="Right Relative pTop8">
          <Trigger
            action={['click']}
            popupAlign={{
              points: ['tr', 'br'],
              offset: [-180, 4],
              overflow: { adjustX: true, adjustY: true },
            }}
            popup={
              <Menu con={'.contacts-detail-wrapper'}>
                <MenuItem icon={<Icon icon="hr_delete" className="TxtMiddle" />} onClick={this.deleteFriendConfirm}>
                  <span className="TxtMiddle">{_l('删除好友')}</span>
                </MenuItem>
              </Menu>
            }
          >
            <span className="textSecondary Hand hoverColorPrimary">
              <i className="Font14 icon-check_circle TxtMiddle" />
              <span className="mLeft5 TxtMiddle Font12">{_l('我的好友')}</span>
              <i className="Font14 mLeft5 icon-moreop TxtMiddle" />
            </span>
          </Trigger>
        </div>
      );
    }
  }

  renderHeader() {
    const {
      data: { avatar, fullname, userCards = [], accountId, isContact },
    } = this.state as { data: AddressBookUserDetail };
    const companyName = _.get(userCards, '[0].companyName');
    const commonOrg = _.filter(userCards, (card: AddressBookUserCard) =>
      _.some(_.get(md, 'global.Account.projects', []), project => project.projectId === card.projectId),
    );

    return (
      <React.Fragment>
        <div className="detail-header">
          <img src={avatar as string} className="detail-header-avatar" />
          <div className="detail-header-info flexRow">
            <div className="flex ellipsis pRight10">
              <div className="ellipsis bold">{fullname}</div>
              {accountId !== md.global.Account.accountId && commonOrg.length > 0 ? (
                <div className="colorPrimary">{_l('%0个共同组织', commonOrg.length)}</div>
              ) : companyName ? (
                <div className="textSecondary ellipsis Font14">{companyName}</div>
              ) : (
                ''
              )}
            </div>
            {this.renderFriendTag()}
          </div>
        </div>
        <div className="detail-btns mTop24 mBottom24 flexRow alignItemsCenter bold">
          <a
            href="javascript:void 0;"
            className="detail-btn bgColorPrimary hoverBgColorPrimaryDark NoUnderline"
            onClick={() => {
              if (isContact) {
                config.callback!({ accountId });
              } else {
                this.addFriendConfirm();
              }
            }}
          >
            <Icon icon="chat" className="mRight5 Font18 TxtMiddle" />
            {_l('发消息')}
          </a>
          <a
            href={pathCompletion('/user_' + accountId)}
            className="detail-btn textSecondary mLeft10 NoUnderline"
            target="_blank"
          >
            <Icon icon="dynamic-empty" className="mRight10 Font17 TxtMiddle" />
            {_l('TA的动态')}
          </a>
          <div className="flex"></div>
          {this.renderDetail()}
        </div>
      </React.Fragment>
    );
  }

  onCopyID = () => {
    // 擦除标记：复制用户 ID（原 any 直接传）。
    copy(_.get(this.state.data, 'accountId') as string);
    alert(_l('复制成功'));
  };

  renderDetail() {
    return (
      <React.Fragment>
        <span className="textTertiary hoverColorPrimary Hand" onClick={this.onCopyID}>
          {_l('用户ID')}
          <Icon icon="copy" className="mLeft5" />
        </span>
      </React.Fragment>
    );
  }

  override render() {
    const { isLoading, data } = this.state;
    const { userCards = [] } = data || {};
    const { accountId, projectId, hideBackBtn } = this.props;

    if (isLoading) {
      return (
        <div className="pTop20">
          <LoadDiv />
        </div>
      );
    }

    if (data === null) return null;
    if (!isLoading && data === undefined) {
      // 擦除标记：`AddFriend` 的 accountId 可选；父级把 null 也当缺省传（原 any 直接传）。
      return <AddFriend accountId={accountId as string} />;
    }

    return (
      <ScrollView className="h100">
        <div className="contacts-detail-wrapper">
          {projectId && !hideBackBtn && (
            <div className="back Hand mBottom24" onClick={this.props.back}>
              <Icon icon="arrow-left-border" /> {_l('返回')}
            </div>
          )}
          {this.renderHeader()}
          <UserBaseProfile
            className="userProjectInfoWrap"
            infoWrapClassName="flexColumn"
            projects={userCards}
            isAddressBook={true}
            currentUserProject={
              _.find(userCards, v => v.projectId === projectId) || (!_.isEmpty(userCards) && userCards[0]) || {}
            }
            userInfo={data}
          />
          <UserMoreProfile className="mTop10" userInfo={data} rowNum={2} />
        </div>
      </ScrollView>
    );
  }
}
