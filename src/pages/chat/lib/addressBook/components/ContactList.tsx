import React from 'react';
import _ from 'lodash';
import { LoadDiv, ScrollView } from 'ming-ui';
import ContactItem from './ContactItem';
import ListNull from './ListNull';

/**
 * 联系人行。只声明列表真实读取/透传的字段（**不加 index signature**）：
 * 父级也有自己的接口形态（如 `ProjectContacts.UserModel`），接口类型不会获得隐式索引签名，
 * 加宽索引会让它们无法赋进来。
 */
interface ContactRow {
  accountId?: string | undefined;
  avatar?: string | undefined;
  fullname?: string | undefined;
  isContact?: boolean | undefined;
  isFriend?: boolean | undefined;
}

/** 列表数据：无关键词时按首字母分组（Record），搜索时是平铺数组 */
type ContactListData = Record<string, ContactRow[]> | ContactRow[] | null;

interface ContactClickPayload {
  /** 点击行带回的账号 id（行数据里可能缺省，故显式允许 undefined） */
  accountId?: string | undefined;
  isFriend?: boolean | undefined;
  isContact?: boolean | undefined;
}

interface ContactListProps {
  fetch: () => void;
  /** 点击某个联系人（`ContactItem` 传的是 `{accountId,isFriend,isContact}` 对象） */
  itemClickHandler: (item: ContactClickPayload) => void;
  list: ContactListData;
  isLoading: boolean;
  isSearch: boolean;
  selectedAccountId?: string | null | undefined;
  /** 部门搜索模式下禁用滚动加载 */
  searchDepartmentUsers?: boolean | undefined;
}

interface SingleListProps {
  title?: string | undefined;
  list?: ContactRow[] | undefined;
}

export default class ContactList extends React.Component<ContactListProps> {
  declare debouncedScroll: _.DebouncedFuncLeading<() => void>;

  constructor(props: ContactListProps) {
    // 原实现 `super()` 未传 props；React 之后仍会写 this.props，运行等价（Babel 1 行差异）。
    super(props);

    this.debouncedScroll = _.throttle(this.scrollEvent.bind(this), 20, {
      leading: true,
    });
  }

  override componentDidMount() {
    this.props.fetch();
  }

  override componentWillUnmount() {
    this.debouncedScroll.cancel();
  }

  scrollEvent() {
    this.props.fetch();
  }

  renderList(list: ContactRow[] | undefined) {
    return (
      <React.Fragment>
        {_.map(list, (item: ContactRow) => (
          <ContactItem
            {...item}
            key={item.accountId}
            itemClickHandler={this.props.itemClickHandler}
            isSelected={item.accountId === this.props.selectedAccountId}
            searchDepartmentUsers={this.props.searchDepartmentUsers}
          />
        ))}
      </React.Fragment>
    );
  }

  renderSingleList(listProps: SingleListProps) {
    const { title, list } = listProps;
    return (
      <div className="list-wrapper" key={title}>
        <div className="list-packet list-packet-name textSecondary Font12">{title}</div>
        <div>{this.renderList(list)}</div>
      </div>
    );
  }

  renderListContent() {
    const { isLoading, list, isSearch } = this.props;

    if (isSearch) {
      // 擦除标记：搜索分支 list 是平铺数组（原 any 直接读 length）。
      if (!isLoading && list && (list as ContactRow[]).length === 0) {
        return <ListNull isSearch={isSearch} type={'contacts'} />;
      }

      return (
        <React.Fragment>
          {this.renderList(list as ContactRow[])}
          {isLoading ? <LoadDiv className="mTop10" /> : null}
        </React.Fragment>
      );
    } else {
      // 擦除标记：非搜索分支 list 是字母分组字典（原 any 直接取 keys）。
      const keys = _.keys(list as Record<string, ContactRow[]>);
      if (!keys.length && isLoading) return <LoadDiv className="mTop10" />;
      return (
        <React.Fragment>
          {_.map(
            keys.sort((a, b) => a.localeCompare(b)),
            key => {
              const props = {
                list: (list as Record<string, ContactRow[]>)[key],
                title: key,
              };
              return this.renderSingleList(props);
            },
          )}
          {isLoading ? <LoadDiv /> : null}
          {!isLoading && keys && keys.length === 0 ? <ListNull isSearch={isSearch} type={'contacts'} /> : null}
        </React.Fragment>
      );
    }
  }

  override render() {
    const { searchDepartmentUsers } = this.props;
    return (
      <ScrollView className="h100" onScrollEnd={searchDepartmentUsers ? () => {} : this.debouncedScroll}>
        {this.renderListContent()}
      </ScrollView>
    );
  }
}
