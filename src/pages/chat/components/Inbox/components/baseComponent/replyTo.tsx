import React from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { Tooltip } from 'ming-ui/antd-components';
import LoadDiv from 'ming-ui/components/LoadDiv';
import DiscussionController from 'src/api/discussion';
import type { DiscussionReplyResponse, InboxRequest, PostReplyResponse } from 'src/api/inboxTypes';
import PostController from 'src/api/post';
import { SOURCE_TYPE } from '../../constants';
import type { InboxMessageBody } from '../../payloadTypes';

interface ReplyToProps {
  /** 来源类型（`SOURCE_TYPE`；POST 为 undefined） */
  sourceType?: number | undefined;
  sourceId?: string | undefined;
  /** Raw/normalized reply IDs pass unchanged to the finite post and discussion API parameters. */
  replyId?: InboxMessageBody['replyId'];
}

interface ReplyToState {
  /** 预留的业务标记（历史字段，本组件只写不读语义） */
  binded: boolean;
  /** A successful discussion reply can preserve a missing, undefined or null body. */
  replayMsg?: string | null | undefined;
  loading: boolean;
}

export default class ReplyTo extends React.Component<ReplyToProps, ReplyToState> {
  declare ajax: InboxRequest<(PostReplyResponse & DiscussionReplyResponse) | null | undefined> | undefined;

  static override propTypes = {
    sourceType: PropTypes.oneOf(_.values(SOURCE_TYPE)),

    sourceId: PropTypes.string,
    replyId: PropTypes.string,
  };

  constructor(props: ReplyToProps) {
    super(props);
    this.state = {
      binded: false,
      replayMsg: null,
      loading: false,
    };
  }

  override componentWillUnmount() {
    this.abortRequest();
  }

  abortRequest() {
    if (this.ajax && this.ajax.abort) {
      this.ajax.abort();
    }
  }

  fetchReplyMsg() {
    if (this.state.replayMsg || this.state.loading) return false;
    const { sourceType, sourceId, replyId } = this.props;

    const callback = (msg: string | null | undefined) => {
      this.setState({
        replayMsg: msg,
        loading: false,
      });
    };

    this.setState({ loading: true });
    if (sourceType === SOURCE_TYPE.POST) {
      this.ajax = PostController.getReplyMessage({
        commentID: replyId,
        postID: sourceId,
      });

      this.ajax.then(function (data) {
        var message = data!.Message;
        if (message) {
          callback(message);
        } else {
          callback(_l('内容已删除'));
        }
      });
    } else {
      this.ajax = DiscussionController.getDiscussionMsg({
        discussionId: replyId,
        sourceType,
      });
      this.ajax.then(function (result) {
        if (result!.code) {
          callback(result!.data);
        } else {
          callback(_l('内容已删除'));
        }
      });
    }
    return undefined;
  }

  override render() {
    return (
      <Tooltip title={this.state.replayMsg || <LoadDiv />} type="white" mouseEnterDelay={0.3}>
        <i
          className="mLeft2 mRight2 colorPrimaryLight icon-replyto Hand colorPrimaryLight"
          onMouseOver={this.fetchReplyMsg.bind(this)}
        />
      </Tooltip>
    );
  }
}
