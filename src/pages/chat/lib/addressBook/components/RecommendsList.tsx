import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import Button from 'ming-ui/components/Button';
import LoadDiv from 'ming-ui/components/LoadDiv';
import { addFriendConfirm } from 'ming-ui/functions';
import { pathCompletion } from 'src/utils/common';
import API, { editIgnoreRecommends } from '../api';

/** 推荐好友行（`fetchRecommends` 返回的 list 元素） */
interface RecommendItem {
  accountId?: string | undefined;
  avatar?: string | undefined;
  fullname?: string | undefined;
  /** 手机通讯录里的备注名 */
  mobileName?: string | undefined;
  companyName?: string | undefined;
  /** 已处理标记：undefined = 未处理；true = 已添加；false = 已忽略 */
  added?: boolean | undefined;
}

interface RecommendsListProps {
  /** 父级是否已完成首屏加载（false → 重置并重新拉取） */
  isLoaded: boolean;
  /** 最后通知父级是否还有推荐（避免提前触发 render） */
  update: (hasRecommends: boolean) => void;
}

interface RecommendsListState {
  isLoading: boolean;
  pageIndex: number;
  hasMore: boolean | undefined;
  listData: (RecommendItem | undefined)[] | null;
}

export default class RecommendsList extends React.Component<RecommendsListProps, RecommendsListState> {
  constructor(props: RecommendsListProps) {
    // 原实现 `super()` 未传 props；React 之后仍会写 this.props，运行等价（Babel 1 行差异）。
    super(props);
    this.state = {
      isLoading: false,
      pageIndex: 1,
      hasMore: true,
      listData: null,
    };

    this.fetch = this.fetch.bind(this);
  }

  override componentDidMount() {
    this.fetch();
  }

  override componentDidUpdate(prevProps: RecommendsListProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.isLoaded !== prevProps.isLoaded && this.props.isLoaded === false) {
        this.setState(
          {
            isLoading: false,
            pageIndex: 1,
            hasMore: true,
            listData: null,
          },
          this.fetch,
        );
      }
    }
  }

  updateListData(accountId: string, isAdd: boolean) {
    const { listData } = this.state;
    this.setState({
      // 擦除标记：分页拉取前 listData 可能为 null（原 any 直接 map；lodash 对 null 返回 []）。
      listData: _.map(listData, (item: RecommendItem | undefined) => {
        if (item!.accountId === accountId) {
          return {
            ...item,
            added: isAdd,
          };
        } else {
          return item;
        }
      }),
    });
  }

  add(accountId: string) {
    addFriendConfirm({
      accountId,
    });
  }

  ignore(accountId: string) {
    return editIgnoreRecommends(accountId).then(data => {
      if (data) {
        this.updateListData(accountId, false);
      } else {
        alert(_l('操作失败，请重新尝试'), 2);
      }
    });
  }

  fetch() {
    const { isLoading, hasMore } = this.state;
    if (isLoading || !hasMore) return;
    this.setState({
      isLoading: true,
    });
    API.fetchRecommends({
      pageIndex: this.state.pageIndex,
      pageSize: 10,
    }).then(({ allCount, list }: { allCount?: number; list?: RecommendItem[] }) => {
      const { listData, pageIndex } = this.state;

      if (allCount !== 0) {
        this.setState({
          hasMore: list && list.length >= 10,
          pageIndex: pageIndex + 1,
          listData: (listData || []).concat(list),
        });
      }

      this.setState({
        isLoading: false,
      });
      // 最后去update父组件状态，不然会直接触发render
      this.props.update(allCount !== 0);
    });
  }

  override render() {
    const { listData, isLoading, pageIndex, hasMore } = this.state;
    if (!isLoading && (listData === null || !listData.length)) return null;
    if (isLoading && pageIndex === 1) return null;
    return (
      <React.Fragment>
        <div className="list-header mBottom10 Font15">{_l('推荐好友')}</div>
        <table className="list-content Font12">
          <thead className="LineHeight30 textSecondary TxtLeft">
            <tr>
              <th>{_l('联系人')}</th>
              <th>{_l('手机联系人')}</th>
              {/* 擦除标记：obsolete 的 `width` 属性已不在 React 19 类型里；spread 保留同一 DOM 属性值。 */}
              <th {...({ width: "186px" } satisfies React.ThHTMLAttributes<HTMLTableCellElement> & { width: string })}>
                {_l('组织')}
              </th>
              <th
                {...({ width: "30%" } satisfies React.ThHTMLAttributes<HTMLTableCellElement> & { width: string })}
                className="TxtCenter"
              >
                {_l('操作')}
              </th>
            </tr>
          </thead>
          <tbody className="textSecondary">
            {/* 擦除标记：非首屏分支下 listData 必已存在（原 any 直接取 length/map）。 */}
            {listData!.length &&
              listData!.map((item: RecommendItem | undefined) => {
                return (
                  <tr key={item!.accountId}>
                    <td className="userItem pRight24">
                      <a href={pathCompletion('/user_' + (item!.accountId as string))} className="Hand NoUnderline" target="_blank">
                        <img className="circle avatar" src={item!.avatar} />
                      </a>
                      <a
                        href={pathCompletion('/user_' + (item!.accountId as string))}
                        className="Bold Hand overflow_ellipsis textPrimary mLeft8"
                        title={item!.fullname}
                      >
                        {item!.fullname || ''}
                      </a>
                    </td>
                    <td className="pRight24">
                      <div className="overflow_ellipsis TxtMiddle">{item!.mobileName}</div>
                    </td>
                    <td>
                      <div className="overflow_ellipsis TxtMiddle wMax100">{item!.companyName || ''}</div>
                    </td>
                    {item!.added === undefined ? (
                      <td className="TxtCenter">
                        <Button type="primary" size="small" onClick={() => this.add(item!.accountId as string)}>
                          {_l('添加')}
                        </Button>
                        <Button type="link" size="small" action={() => this.ignore(item!.accountId as string)}>
                          {_l('忽略')}
                        </Button>
                      </td>
                    ) : (
                      <td className="TxtCenter">
                        <span className="textSecondary">{item!.added ? _l('已添加') : _l('忽略')}</span>
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
        {hasMore && (
          <a className="mTop10" href="javascript: void 0;" onClick={this.fetch}>
            {_l('查看更多')}
          </a>
        )}
        {isLoading ? <LoadDiv /> : null}
      </React.Fragment>
    );
  }
}
