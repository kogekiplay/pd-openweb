import React, { Component, Fragment } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, LoadDiv, ScrollView } from 'ming-ui';
import * as actions from 'src/pages/chat/redux/actions';
import type { AppDispatch, RootState } from 'src/redux/types';
import type { ScrollViewHandle } from 'ming-ui/components/ScrollView';
import type { ScrollInfo } from 'ming-ui/components/ScrollView/types';
import type { ChatRawMessageWire } from '../../redux/types';
import type { AddressBookRequest, AddressBookSearchResult, AddressBookSearchEntry, AddressBookSearchRow } from 'src/api/addressBookTypes';
import * as ajax from '../../utils/ajax';
import './index.less';

const SearchWrap = styled.div`
  input {
    border: none;
    border-radius: 17px;
    background: var(--color-background-secondary);
    border: 1px solid var(--color-background-secondary);
    padding: var(--space-1) 5px var(--space-1) 35px;
    width: 100%;
    &:focus {
      border-color: var(--color-primary);
      background: var(--color-background-primary);
    }
  }
  .icon-cancel {
    right: 5px;
  }
`;


type AddressAccount = AddressBookSearchEntry;
type AddressGroup = AddressBookSearchEntry;
type AddressBookEntry = AddressBookSearchRow;

/** 通讯录搜索接口的返回形状：两个列表（`flatten` 与 `renderProject` 真实读取） */
type AddressBookResult = AddressBookSearchResult;
export interface SearchMemberProps {
  /** `toolbarConfig.sessionListVisible`（connect 注入） */
  sessionListVisible: boolean;
  /** 由使用方传入的嵌入模式标记 */
  embed?: boolean | undefined;
  /**
   * `SessionListDrawer` 真实传入的受控搜索值，本组件当前**不读取**（自己维护 state.value）；
   * 保留为不透明字段以匹配调用方，不假装成已消费的形状。
   */
  searchValue?: unknown;
  setSearchValue?: unknown;
  addGroupSession: (groupId: string, msg?: ChatRawMessageWire) => void;
  addUserSession: (id: string | undefined, msg?: ChatRawMessageWire) => void;
}

export interface SearchMemberState {
  value: string;
  loading: boolean;
  /** 初值是占位 `[]`；首次搜索完成后才写入真实结果对象（`renderProject` 只在非 loading 时渲染） */
  result: AddressBookResult | [];
  flattenResult: AddressBookEntry[];
  currentIndex: number;
  accountsVisible: boolean;
  groupsVisible: boolean;
}

const flatten = (res: AddressBookResult): AddressBookEntry[] => {
  const result: AddressBookEntry[] = [];
  result.push(...(res.accounts?.list ?? []), ...(res.groups?.list ?? []));
  return result;
};

class SearchMember extends Component<SearchMemberProps, SearchMemberState> {
  private requestVersion = 0;
  /** Same ordinary SDK request; no metadata index or any receipt bridge. */
  ajax: AddressBookRequest<AddressBookSearchResult> | null = null;
  declare scrollView: ScrollViewHandle | null | undefined;

  constructor(props: SearchMemberProps) {
    super(props);
    this.state = {
      value: '',
      loading: true,
      result: [],
      flattenResult: [],
      currentIndex: -1,
      accountsVisible: true,
      groupsVisible: true,
    };
  }
  inputRef = React.createRef<HTMLInputElement>();
  override componentDidMount() {
    this.handleFocus();
  }

  override componentDidUpdate(prevProps: SearchMemberProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.sessionListVisible && !prevProps.sessionListVisible) {
        this.handleFocus();
      }
    }
  }
  handleFocus = () => {
    if (this.inputRef.current && !location.href.includes('windowChat')) {
      setTimeout(() => {
        if (this.inputRef.current) {
          this.inputRef.current.focus();
        }
      }, 300);
    }
  };
  getAllAddressbookByKeywords = () => {
    const { value } = this.state;
    this.setState({ loading: true });
    this.ajax && this.ajax.abort();
    const requestVersion = ++this.requestVersion;
    this.ajax = ajax.getAllAddressbookByKeywords(value.trim());
    this.ajax.then((result: AddressBookResult) => {
      if (requestVersion !== this.requestVersion || value !== this.state.value) return;
      this.setState({
        loading: false,
        result,
        flattenResult: flatten(result),
      });
    });
  };
  override componentWillUnmount() {
    try {
      this.ajax && this.ajax.abort();
    } finally {
      this.requestVersion += 1;
      this.handleChange.cancel();
    }
  }
  adjustViewport(direction: string) {
    const { flattenResult, currentIndex } = this.state;
    // 擦除标记：`|| {}` 兜底在取不到滚动信息时给空对象（原实现就是这样），断言只是把声明接上。
    const { viewport } = (this.scrollView && this.scrollView.getScrollInfo()) || ({} as ScrollInfo);
    // 擦除标记：viewport 缺省时 jQuery 得到空集合（与原实现一致）。
    const $scrollViewEl = $(viewport as HTMLElement);
    const current: Partial<AddressAccount> & Partial<AddressGroup> = flattenResult[currentIndex] || {};
    const id = current.accountId ? (current.user ? current.user.userId : current.accountId) : current.groupId;
    const $currentEl = $(`#project-container-item-${id}`);

    if (!viewport || currentIndex === -1) {
      return;
    }

    // .position() 在空集合上返回 undefined，`|| {}` 是兜底；断言只是让类型跟着走，
    // 运行期不变（那种情况下 position.top 仍是 undefined）。
    const position = $currentEl.position() || ({} as JQuery.Coordinates);

    // 擦除标记：jQuery v4 的 `height()` 声明可空；Selector 命中的节点必有布局盒（原 any 直接比较）。
    if (direction === 'up') {
      if (
        position.top < 0 ||
        position.top + ($currentEl.height() as number) >= ($scrollViewEl.height() as number)
      ) {
        // 擦除标记：滚动容器由 ref 注入（本方法只在滚动/键盘回调里调用）；缺省时原实现同样抛原生 TypeError。
        this.scrollView!.scrollToElement($currentEl[0]);
      }
    } else if (direction === 'down') {
      if (position.top + ($currentEl.height() as number) >= ($scrollViewEl.height() as number)) {
        const { scrollTop, scrollHeight, maxScrollTop } = (this.scrollView!.getScrollInfo() || {}) as ScrollInfo;
        const bottom = scrollHeight - scrollTop - position.top - ($currentEl.height() as number);
        this.scrollView!.scrollTo({ top: maxScrollTop - bottom });
      } else if (position.top < 0) {
        this.scrollView!.scrollToElement($currentEl[0]);
      }
    }
  }
  handleChange = _.debounce((value: string) => {
    if (!value.trim()) return;
    this.setState(
      {
        value,
        flattenResult: [],
        currentIndex: -1,
      },
      () => {
        value && this.getAllAddressbookByKeywords();
      },
    );
  }, 300);
  handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const { flattenResult, currentIndex } = this.state;
    const { which } = event;

    if (which === 38 && flattenResult.length) {
      this.setState(
        {
          currentIndex: currentIndex === -1 || currentIndex === 0 ? flattenResult.length - 1 : currentIndex - 1,
        },
        () => {
          this.adjustViewport('up');
        },
      );
    } else if (which === 40 && flattenResult.length) {
      this.setState(
        {
          currentIndex: currentIndex === flattenResult.length - 1 ? 0 : currentIndex + 1,
        },
        () => {
          this.adjustViewport('down');
        },
      );
    } else if (which === 13 && flattenResult.length && currentIndex !== -1) {
      this.handleOpenSession(flattenResult[currentIndex]);
    } else if (which === 27) {
      this.setState({ value: '' });
    }
  };
  handleOpenSession(data: AddressBookEntry) {
    if (data === null || data === undefined) return;
    const { groupId, accountId } = data;

    if (groupId) {
      const msg: ChatRawMessageWire = {
        to: groupId,
        avatar: data.avatar,
        groupname: data.name,
        msg: { con: '' },
      };
      this.props.addGroupSession(groupId, msg);
    } else {
      const msg: ChatRawMessageWire = {
        logo: data.avatarMiddle,
        uname: data.fullname,
        sysType: 1,
      };
      this.props.addUserSession(accountId, msg);
    }

    this.setState({ value: '' });
  }
  renderAccount(account: AddressAccount, currentResult: Partial<AddressAccount> & Partial<AddressGroup>) {
    const id = account.user ? account.user.userId : account.accountId;
    const isCurrent = id === (currentResult.user ? currentResult.user.userId : currentResult.accountId);
    return (
      <div
        id={`project-container-item-${id}`}
        className={cx('project-container-item', { active: isCurrent })}
        onClick={this.handleOpenSession.bind(this, account)}
        key={account.accountId}
      >
        <img src={account.avatarMiddle} />
        <div className="flexColumn flex minWidth0 mLeft10">
          <span className="username textPrimary bold Font13" title={account.fullname}>
            {account.fullname}
          </span>
          <span className="department textSecondary ellipsis Font12">
            {account.profession}
            {account.profession && account.companyName && ' | '}
            {account.companyName}
          </span>
        </div>
      </div>
    );
  }
  renderGroup(group: AddressGroup, currentResult: Partial<AddressAccount> & Partial<AddressGroup>) {
    const isCurrent = group.groupId === currentResult.groupId;
    return (
      <div
        id={`project-container-item-${group.groupId}`}
        className={cx('project-container-item', { active: isCurrent })}
        onClick={this.handleOpenSession.bind(this, group)}
        key={group.groupId}
      >
        <img src={group.avatar} />
        <div className="flex minWidth0 mLeft10 ellipsis">
          <span className="groupname textPrimary bold Font13" title={group.name}>
            {group.name}
          </span>
        </div>
      </div>
    );
  }
  renderProject() {
    const { result, loading, flattenResult, currentIndex, accountsVisible, groupsVisible } = this.state;
    if (Array.isArray(result)) return null;
    const currentResult: Partial<AddressAccount> & Partial<AddressGroup> = flattenResult[currentIndex] || {};
    const count = (result.groups?.list ?? []).length + (result.accounts?.list ?? []).length;
    return (
      <div className="content">
        {!!(result.accounts?.list ?? []).length && (
          <div>
            <div
              className="project-container-head flexRow alignItemsCenter"
              onClick={() => this.setState({ accountsVisible: !accountsVisible })}
            >
              <div className="flex bold">
                {_l('联系人')}
                <span className="mLeft5 colorPrimary">{(result.accounts?.list ?? []).length}</span>
              </div>
              <Icon icon={accountsVisible ? 'arrow-up-border' : 'arrow-down-border'} className="textSecondary Font16" />
            </div>
            {accountsVisible && (
              <div>{(result.accounts?.list ?? []).map(account => account === null || account === undefined ? null : this.renderAccount(account, currentResult))}</div>
            )}
          </div>
        )}
        {!!(result.groups?.list ?? []).length && (
          <div>
            <div
              className="project-container-head flexRow alignItemsCenter"
              onClick={() => this.setState({ groupsVisible: !groupsVisible })}
            >
              <div className="flex bold">
                {_l('聊天/群组')}
                <span className="mLeft5 colorPrimary">{(result.groups?.list ?? []).length}</span>
              </div>
              <Icon icon={groupsVisible ? 'arrow-up-border' : 'arrow-down-border'} className="textSecondary Font16" />
            </div>
            {groupsVisible && (
              <div>{(result.groups?.list ?? []).map(group => group === null || group === undefined ? null : this.renderGroup(group, currentResult))}</div>
            )}
          </div>
        )}
        {!loading && !count ? (
          <div className="nodata-wrapper">
            <div className="nodata-img" />
            <p>{_l('没有搜索结果')}</p>
          </div>
        ) : undefined}
      </div>
    );
  }
  renderContent() {
    const { embed } = this.props;
    const { loading } = this.state;
    return (
      <div className={cx('ChatList-SearchMember-Content', { embed })}>
        <ScrollView
          ref={scrollView => {
            this.scrollView = scrollView;
          }}
        >
          {loading ? (
            <div className="loading">
              <LoadDiv size="big" />
            </div>
          ) : (
            this.renderProject()
          )}
        </ScrollView>
      </div>
    );
  }
  override render() {
    const { value } = this.state;
    return (
      <Fragment>
        <SearchWrap className="searchWrap flexRow alignItemsCenter flex mRight10 Relative">
          <Icon icon="search" className="textSecondary Font20 mLeft10 Absolute" />
          <input
            name="searchMember"
            autoComplete="off"
            ref={this.inputRef}
            type="text"
            className="Font13"
            placeholder={_l('搜索用户 / 群组')}
            value={value}
            onChange={event => {
              const value = event.target.value;
              this.setState({ value }, () => {
                this.handleChange(value);
              });
            }}
            onKeyDown={this.handleKeyDown}
          />
          {value.trim() && (
            <Icon
              icon="cancel"
              className="textSecondary Font20 pointer Absolute"
              onClick={() => this.setState({ value: '' })}
            />
          )}
        </SearchWrap>
        {value.trim() && this.renderContent()}
      </Fragment>
    );
  }
}

export default connect(
  (state: RootState) => ({
    sessionListVisible: state.chat.toolbarConfig.sessionListVisible,
  }),
  (dispatch: AppDispatch) => bindActionCreators(_.pick(actions, ['addGroupSession', 'addUserSession']), dispatch),
)(SearchMember);
