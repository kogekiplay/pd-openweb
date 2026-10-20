import React from 'react';
import _ from 'lodash';
import { LoadDiv, ScrollView } from 'ming-ui';
import GroupItem from './GroupItem';
import ListNull from './ListNull';
import type { AddressBookGroupDetail } from '../types';

/** 群列表数据：无关键词时按首字母分组（Record），搜索时是平铺数组 */
type GroupListData = Record<string, AddressBookGroupDetail[]> | AddressBookGroupDetail[] | null;

interface GroupListProps {
  fetch: () => void;
  /** 点击某个群（父级按 groupId 记录选中） */
  itemClickHandler: (groupId: string) => void;
  list: GroupListData;
  isLoading: boolean;
  isSearch: boolean;
  selectedGroupId?: string | null | undefined;
}

interface SingleListProps {
  title?: string | undefined;
  list?: AddressBookGroupDetail[] | undefined;
}

export default class GroupList extends React.Component<GroupListProps> {
  declare debouncedScroll: _.DebouncedFuncLeading<() => void>;

  constructor(props: GroupListProps) {
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

  renderSingleList(listProps: SingleListProps) {
    const { title, list } = listProps;
    return (
      <div className="list-wrapper" key={title}>
        <div className="list-packet list-packet-name textSecondary Font12">{title}</div>
        <div>
          {_.map(list, (item: AddressBookGroupDetail) => (
            <GroupItem
              {...item}
              key={item.groupId}
              itemClickHandler={this.props.itemClickHandler}
              isSelected={item.groupId === this.props.selectedGroupId}
            />
          ))}
        </div>
      </div>
    );
  }

  renderListContent() {
    const { isLoading, list, isSearch } = this.props;

    if (!isSearch) {
      // 擦除标记：非搜索分支 list 是字母分组字典（原 any 直接取 keys）。
      const keys = _.keys(list as Record<string, AddressBookGroupDetail[]>);
      if (!keys.length && isLoading) return <LoadDiv className="mTop10" />;
      return (
        <React.Fragment>
          {_.map(
            keys.sort((a, b) => a.localeCompare(b)),
            key => {
              const props = {
                list: (list as Record<string, AddressBookGroupDetail[]>)[key],
                title: key,
              };
              return this.renderSingleList(props);
            },
          )}
          {isLoading ? <LoadDiv /> : null}
          {!isLoading && keys && keys.length === 0 ? <ListNull isSearch={isSearch} type={'groups'} /> : null}
        </React.Fragment>
      );
    } else {
      // 擦除标记：搜索分支 list 是平铺数组（原 any 直接读 length）。
      if (!isLoading && list && (list as AddressBookGroupDetail[]).length === 0) {
        return <ListNull isSearch={isSearch} type={'groups'} />;
      }

      return (
        <React.Fragment>
          {_.map(list as AddressBookGroupDetail[], (item: AddressBookGroupDetail) => (
            <GroupItem
              {...item}
              key={item.groupId}
              itemClickHandler={this.props.itemClickHandler}
              isSelected={item.groupId === this.props.selectedGroupId}
            />
          ))}
          {isLoading ? <LoadDiv /> : null}
        </React.Fragment>
      );
    }
  }

  override render() {
    return (
      <ScrollView className="h100" onScrollEnd={this.debouncedScroll}>
        {this.renderListContent()}
      </ScrollView>
    );
  }
}
