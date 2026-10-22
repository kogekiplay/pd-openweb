import React, { Fragment } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import { Divider } from 'antd';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { ScrollView } from 'ming-ui';
import Button from 'ming-ui/components/Button';
import LoadDiv from 'ming-ui/components/LoadDiv';
import inboxController from 'src/api/inbox';
import type { InboxMessagesResponse, InboxRequest } from 'src/api/inboxTypes';
import type { AppDispatch } from 'src/redux/types';
import * as actions from '../../../redux/actions';
import { LOADTYPES, NAMES, TYPES } from '../constants';
import type { InboxFilterValue, InboxItem } from '../util';
import { isWithinOneHour } from '../util';
import Message from './inboxMessage';

interface InboxListProps {
  dispatch: AppDispatch;
  type?: string | undefined;
  inboxType?: string | undefined;
  inboxFavorite?: boolean | undefined;
  clearUnread?: boolean | undefined;
  count?: number | undefined;
  weak_count?: number | undefined;
  updateNow?: number | undefined;
  requestNow?: number | undefined;
  filter?: InboxFilterValue | null | undefined;
}

export interface InboxListState {
  failed: boolean;
  pageIndex: number;
  list: InboxItem[];
  isLoading: boolean;
  hasMoreData: boolean;
}

class InboxList extends React.Component<InboxListProps, InboxListState> {
  declare ajaxRequest: InboxRequest<InboxMessagesResponse | null | undefined> | undefined;

  static override propTypes = {
    inboxFavorite: PropTypes.bool,
    type: PropTypes.oneOf(_.values(TYPES)),
  };

  constructor(props: InboxListProps) {
    super(props);
    this.state = {
      failed: false,
      pageIndex: 1,
      list: [],
      isLoading: false,
      hasMoreData: true,
    };
  }

  override componentDidMount() {
    this.fetchInboxList();
  }

  override componentDidUpdate(prevProps: InboxListProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (
        !_.isEqual(_.omit(this.props, 'count', 'requestNow'), _.omit(prevProps, 'count', 'requestNow')) ||
        (this.props.count && this.props.count !== prevProps.count) ||
        (this.props.requestNow && !isWithinOneHour(this.props.requestNow))
      ) {
        this.setState(
          {
            pageIndex: 1,
            isLoading: true,
            list: [],
            hasMoreData: true,
          },
          () => {
            this.fetchInboxList();
            // The refresh signal retains a missing inbox key and uses the previous dispatch receiver.
            prevProps.dispatch(actions.updateInoxRequestNow(this.props.inboxType));
          },
        );
      }
    }
  }

  fetchInboxList() {
    const { pageIndex, list } = this.state;
    const { clearUnread, inboxFavorite, type, filter } = this.props;
    const { user, startTime, endTime, appId } = filter || {};
    this.setState({
      failed: false,
      isLoading: true,
    });
    this.ajaxRequest = inboxController.getInboxMessage({
      pageIndex,
      pageSize: location.href.includes('windowChat') ? 20 : 10,
      inboxFavorite: inboxFavorite ? 1 : 0,
      type,
      clearUnread,
      loadType: LOADTYPES.ALL,
      creatorId: user ? user.accountId : null,
      startTime,
      endTime,
      appId,
    });
    this.ajaxRequest
      .then(response => {
        const { inboxList } = response!;
        if (pageIndex === 1) {
          this.setState({
            hasMoreData: inboxList!.length > 0,
            list: inboxList!,
            isLoading: false,
          });
        } else {
          this.setState({
            hasMoreData: inboxList!.length > 0,
            list: list.concat(inboxList!),
            isLoading: false,
          });
        }
      })
      // 原来按 jQuery 的 fail(jqXHR, textStatus) 写，拿第二个参数判 'abort'：Promise 的 catch 只有一个参数，
      // 于是被取消的请求也弹「加载失败」。接口层 reject 的是 { errorCode, errorMessage }，errorCode 1 就是被取消
      .catch(error => {
        if (_.get(error, 'errorCode') !== 1) {
          alert(_l('加载失败，点击重试'), 2);
          this.setState({
            failed: true,
            isLoading: false,
          });
        }
      });
  }

  scrollEvent() {
    const { hasMoreData, pageIndex, isLoading } = this.state;
    if (!hasMoreData || isLoading) return false;
    this.setState(
      {
        pageIndex: pageIndex + 1,
      },
      () => {
        this.fetchInboxList();
      },
    );
    return undefined;
  }

  renderList(): React.ReactNode {
    const { count } = this.props;
    const { list, pageIndex, isLoading, failed } = this.state;

    if (list.length) {
      return this.state.list.map((inboxItem: InboxItem, index: number) => (
        <Fragment key={inboxItem.inboxId}>
          <Message
            {...{
              inboxItem,
            }}
          />
          {index === count! - 1 && (
            <Divider className="inboxDivider Font13" plain>
              {_l('以上为新消息')}
            </Divider>
          )}
        </Fragment>
      ));
    } else if (pageIndex === 1 && !isLoading && !failed) {
      return this.renderNullDiv();
    }
    // 【显式返回 undefined】与原先"落到函数末尾隐式返回 undefined"运行行为完全相同，
    // 只为满足 noImplicitReturns（不是新增渲染分支）。
    return undefined;
  }

  renderLoading() {
    const { pageIndex, isLoading, failed } = this.state;

    if (failed && !isLoading) {
      return (
        <div className="mTop10 TxtCenter">
          <Button type={'link'} onClick={this.fetchInboxList.bind(this)}>
            {_l('加载失败，点击重新加载')}
          </Button>
        </div>
      );
    } else {
      return isLoading ? (
        pageIndex === 1 ? (
          <LoadDiv className="mTop20" />
        ) : (
          <LoadDiv className="mTop10 mBottom10" />
        )
      ) : null;
    }
  }

  renderNullDiv() {
    const { inboxType, inboxFavorite } = this.props;

    if (inboxFavorite) {
      return (
        <div className="nullTip starMsg">
          <div className="Font18">{_l('在这里查看星标信息')}</div>
          <div className="Font14 textTertiary">{_l('点击信息列表右上角的星号，为重要的信息打上星标')}</div>
        </div>
      );
    } else {
      return (
        <div className="nullTip commMsg">
          <div className="Font18">{_l('还没有消息')}</div>
          <div className="Font14 textTertiary">
            {/* The real translator applies String to each argument, including missing and inherited lookup values. */}
            {(_l as (key: string, ...args: unknown[]) => string)('在这查看所有和%0相关的消息', Reflect.get(NAMES, inboxType as string))}
          </div>
        </div>
      );
    }
  }

  override render() {
    return (
      <ScrollView className="flex inboxBox" allowance={50} onScrollEnd={this.scrollEvent.bind(this)}>
        {this.renderList()}
        {this.renderLoading()}
      </ScrollView>
    );
  }
}
export default connect()(InboxList);
