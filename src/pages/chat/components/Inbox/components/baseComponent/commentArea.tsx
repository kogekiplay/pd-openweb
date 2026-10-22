import React from 'react';
import { createRoot } from 'react-dom/client';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types';
import filterXSS from 'xss';
// 根入口 `xss` 把 `./default` 的全部导出挂到 module.exports（lib/index.js 的循环），
// `whiteList` 是**同一个对象**；改用根入口消除 'xss/lib/default' 缺声明（全仓 4 处同样的共享缺口，本文件先闭合）。
import { whiteList } from 'xss';
import { UserCard } from 'ming-ui';
import confirm from 'ming-ui/components/Dialog/Confirm';
import DiscussionController from 'src/api/discussion';
import postAjax from 'src/api/post';
import Commenter from 'src/components/comment/commenter';
import UploadFile from 'src/components/UploadFiles';
import { formatMsgDate } from 'src/pages/chat/utils';
import { htmlDecodeReg } from 'src/utils/common';
import createLinksForMessage from 'src/utils/createLinksForMessage';
import { dateConvertToUserZone } from 'src/utils/project';
import { SOURCE_TYPE } from '../../constants';
import { buildSourceLink, formatTopic, splitSourceId } from '../../util';
import Avatar from './avatar';
import ReplyTo from './replyTo';
import UserLink from './userLink';


import type { InboxUser as CommentUser, NormalizedComment as CommentTopic, TopicSource } from '../../payloadTypes';

/** 删除评论/回复所需字段（`removeTopicConfirm`/`removeTopic` 两个函数的真实入参） */
interface RemoveTopicProps {
  sourceId?: string | undefined;
  sourceType?: number | undefined;
  discussionId?: string | undefined;
  replyId?: string | number | null | undefined;
  isDeleteAttachment?: unknown;
  removeCallback: (id?: string | number | null) => void;
}

/** 评论上下文里的 params（`getComponentProps`/`CommentArea` 共用的真实字段） */
interface CommentParams {
  sourceId?: string | undefined;
  sourceType?: number | undefined;
  discussionId?: string | undefined;
  extendsId?: string | undefined;
  name?: string | undefined;
  projectId?: string | undefined;
  appId?: string | undefined;
  createAccount?: CommentUser | undefined;
}

/** `getComponentProps` 的入参：评论组件的公共上下文 */
interface CommentContext {
  params: CommentParams;
}

interface CommentItemProps extends CommentTopic {
  categories?: TopicSource['categories'];
  projectId?: string | undefined;
  appId?: string | undefined;
  addCallback: (comment: TopicSource) => void;
  removeCallback: (id?: string | number | null) => void;
  /** 由父级 cloneElement 注入的评论输入组件（其 props 由父级按需补齐） */
  children: React.ReactElement<{ autoFoucs?: boolean; onSubmit?: (comment: TopicSource) => void; onSubmitCallback?: () => void }>;
}

interface CommentAreaParams extends CommentParams {
  /** 与 commentsProps 里的 type 不同：这里给 `clickLoadMore` 用 */
  type?: number | undefined;
}

interface CommentAreaProps {
  params: CommentAreaParams;
  commentsProps: {
    comments?: TopicSource[] | undefined;
    commentsCount?: number | undefined;
  };
}

interface CommentAreaState {
  /** 动态加载全部评论 */
  loadAllComments: boolean;
  commenterIsFocus: boolean;
  comments: CommentTopic[];
  /** 初始值来自 `comments && comments.length > 0`，无评论时为 undefined（既有行为） */
  showComments: boolean | undefined;
}

const removeTopicConfirm = (props: RemoveTopicProps) => {
  const { replyId, isDeleteAttachment } = props;
  const title = replyId ? _l('回复') : _l('评论');
  const header = isDeleteAttachment
    ? _l('%0带有的附件会被删除，确认要删除此%0吗？', title)
    : _l('确认要删除此%0吗？', title);
  confirm({
    title: header,
    onOk: () => {
      removeTopic(props);
    },
  });
};

const removeTopic = function (props: RemoveTopicProps) {
  const { sourceType, sourceId, discussionId } = props;

  if (sourceType === SOURCE_TYPE.POST) {
    postAjax
      .removePostComment({
        deleteAttachment: 1,
        postID: sourceId,
        commentID: discussionId,
      })
      .then(function (data) {
        const { success } = data;

        if (success) {
          alert(_l('删除成功'));
          props.removeCallback(props.discussionId);
        } else {
          alert(_l('删除失败'), 2);
        }
      });
  } else {
    const { discussionId } = props;
    var params = {
      discussionId,
      sourceType,
    };

    DiscussionController.removeDiscussion(params)
      .then(function (result) {
        if (result.code === 1) {
          alert(_l('删除成功'));
          props.removeCallback(props.discussionId);
        } else {
          Promise.reject(false);
        }
      })
      .catch(() => {
        alert(_l('操作失败'), 2);
      });
  }
};

const getComponentProps = function (props: CommentContext) {
  const {
    params: { sourceType, discussionId, extendsId, name, projectId, createAccount },
  } = props;
  var commonProps = {
    placeholder: _l('请输入回复内容'),
    textareaMinHeight: 22,
    autoFocus: true,
    shrinkAfterSubmit: true,
  };
  // 擦除标记：评论上下文里的 name 是标题文案（原 any 直接传）。
  const decodedName = htmlDecodeReg(name as string);
  const { sourceId, childId } = splitSourceId(props.params.sourceId!);
  var map: Record<string | number, Record<string, unknown> | undefined> = {
    [SOURCE_TYPE.TASK]: {
      selectGroupOptions: {
        projectId,
      },
      sourceId,
      sourceType,
      appId: 'ab99d0bb-3249-46f9-8a60-6952cb76cac2',
      replyId: discussionId,
      remark: sourceId + '|' + decodedName + '|' + _l('任务'),
    },
    [SOURCE_TYPE.FOLDER]: {
      selectGroupOptions: {
        projectId,
      },
      sourceId,
      sourceType,
      appId: '66d51996-6a56-41ba-be15-0d388b548f00',
      replyId: discussionId,
      remark: sourceId + '|' + decodedName + '|' + _l('项目'),
    },
    [SOURCE_TYPE.WORKSHEET]: {
      selectGroupOptions: {
        projectId,
      },
      sourceId,
      extendsId,
      sourceType,
      appId: '1e31c859-1605-4d8d-b3be-437ff871f02d',
      replyId: discussionId,
      remark: sourceId + '|' + decodedName + '|' + _l('工作表'),
      mentionsOptions: { isAtAll: false },
    },
    [SOURCE_TYPE.WORKSHEETROW]: {
      selectGroupOptions: {
        projectId,
      },
      sourceId: props.params.sourceId,
      extendsId,
      sourceType,
      appId: 'c8bc1b25-2bbe-4334-b1e3-be1b207f3126',
      replyId: discussionId,
      remark: (childId ? sourceId + '_' + childId : sourceId) + '|' + decodedName + '|' + _l('工作表记录'),
    },
    [SOURCE_TYPE.CALENDAR]: {
      sourceId: props.params.sourceId,
      sourceType,
      appId: '42c96ef1-3ab6-4269-9824-e21436f34a38',
      replyId: discussionId,
      remark:
        (childId ? sourceId + '_' + moment(childId).format('YYYYMMDDHHmmss') : sourceId) +
        '|' +
        decodedName +
        '|' +
        _l('日程'),
    },
    // 擦除标记：`SOURCE_TYPE.POST` 是 undefined，运行期键名为字符串 "undefined"（既有行为）。
    [SOURCE_TYPE.POST as unknown as string | number]: {
      sourceId,
      sourceType,
      replyId: discussionId,
      accountId: (createAccount || {}).accountId,

      sendPost: false,
    },
  };

  return $.extend(true, commonProps, map[sourceType as string | number]);
};

export interface CommentItemState {
  showCommenter: boolean;
}

class CommentItem extends React.Component<CommentItemProps, CommentItemState> {
  constructor(props: CommentItemProps) {
    super(props);
    this.state = {
      showCommenter: false,
    };
  }

  override componentDidMount() {
    const { replyId } = this.props;
    $(`.inboxBox .commentItem-${replyId}`)
      .find('[data-accountid],[data-groupid]')
      .each((_i, ele: Element) => {
        if ($(ele).attr('bindUserCard')) return;
        $(ele).attr('bindUserCard', 'true');
        let accountId = $(ele).attr('data-accountid');
        let groupId = $(ele).attr('data-groupid');
        const root = createRoot(ele);

        root.render(
          <UserCard sourceId={accountId || groupId} type={groupId ? 2 : 1}>
            <span>{ele.innerHTML}</span>
          </UserCard>,
        );
      });
  }

  renderMessage() {
    const { message, accountsInMessage, groupsInMessage, categories, sourceType } = this.props;
    return (
      <span
        dangerouslySetInnerHTML={{
          __html: filterXSS(
            createLinksForMessage({
              // 擦除标记：评论正文由接口给出（原 any 直接传）。
              message: message as string,
              rUserList: accountsInMessage,
              rGroupList: groupsInMessage,
              categories,
              sourceType,
            }),
            {
              whiteList: Object.assign({}, whiteList, { img: ['src', 'alt', 'title', 'width', 'height', 'class'] }),
            },
          ).replace(/\n/g, ' <br>'),
        }}
      />
    );
  }

  renderTopic() {
    const { sourceType, createAccount, replyAccount, sourceId, replyId } = this.props;

    if (replyId) {
      return (
        <div className="mBottom10 mTop3 LineHeight25">
          <span className="mRight10 commentContentItem InlineBlock WordBreak">
            <UserLink {...createAccount} />
            <span className="mLeft5 Green mRight5">{_l('回复')}</span>
            <UserLink {...replyAccount} />
            {replyId ? <ReplyTo {...{ sourceId, replyId, sourceType }} /> : null}
            <span>: </span>
          </span>
          {this.renderMessage()}
        </div>
      );
    } else {
      return (
        <div className="mBottom10 mTop3 LineHeight25">
          <span className="mRight10 commentContentItem InlineBlock WordBreak">
            <UserLink {...createAccount} />
            <span className="mLeft2">: </span>
          </span>
          {this.renderMessage()}
        </div>
      );
    }
  }

  renderAttachment() {
    const { attachment, projectId, appId } = this.props;
    return (
      <div className="mTop5">
        <UploadFile isUpload={false} attachmentData={attachment} projectId={projectId} appId={appId} />
      </div>
    );
  }

  renderBottomBar() {
    const { canDelete, sourceId, sourceType } = this.props;
    // 擦除标记：评论的 createTime 由接口给出（原 any 直接传）。
    const createTime = dateConvertToUserZone(this.props.createTime as number);

    const buildLink = () => {
      switch (sourceType) {
        case SOURCE_TYPE.POST:
          return (
            <a
              href={buildSourceLink(sourceType, sourceId as string)}
              className="textTertiary NoUnderline"
              title={_l('点击查看动态详情')}
            >
              {formatMsgDate(createTime)}
            </a>
          );
        case SOURCE_TYPE.TASK:
          return (
            <a
              href={buildSourceLink(sourceType, sourceId as string)}
              className="textTertiary NoUnderline"
              title={_l('点击查看任务详情')}
            >
              {formatMsgDate(createTime)}
            </a>
          );
        case SOURCE_TYPE.FOLDER:
          return (
            <a
              href={buildSourceLink(sourceType, sourceId as string)}
              className="textTertiary NoUnderline"
              title={_l('点击查看项目详情')}
            >
              {formatMsgDate(createTime)}
            </a>
          );
        case SOURCE_TYPE.CALENDAR: {
          return (
            <a
              href={buildSourceLink(sourceType, sourceId as string)}
              className="textTertiary NoUnderline"
              title={_l('点击查看日程详情')}
            >
              {formatMsgDate(createTime)}
            </a>
          );
        }
      }
      return undefined;
    };

    return (
      <div className="clearfix">
        {buildLink()}
        <div className="Right">
          {canDelete ? (
            <a
              className="Hidden removeCommentButton"
              onClick={() => {
                const { discussionId, isDeleteAttachment, sourceType, replyId, removeCallback } = this.props;
                const props = {
                  sourceId,
                  replyId,
                  discussionId,
                  isDeleteAttachment,
                  sourceType,
                  removeCallback,
                };
                removeTopicConfirm(props);
              }}
            >
              {_l('删除')}
            </a>
          ) : null}
          <a
            className="mLeft15"
            onClick={() => {
              this.setState({ showCommenter: true });
            }}
          >
            {_l('回复')}
          </a>
        </div>
      </div>
    );
  }

  override render() {
    const { createAccount, addCallback, replyId } = this.props;
    const { showCommenter } = this.state;

    return (
      <div className={`commentItem pTop12 commentItem-${replyId}`}>
        <div className="commentAvatar Left">
          <Avatar {...createAccount} />
        </div>

        <div className="commentContent">
          {this.renderTopic()}
          {this.renderAttachment()}
          {this.renderBottomBar()}
          {showCommenter ? (
            <div className="mTop5 mBottom5">
              {React.cloneElement(this.props.children, {
                autoFoucs: true,
                onSubmit: (discussion: TopicSource) => {
                  addCallback(discussion);
                },
                onSubmitCallback: () => {
                  this.setState({
                    showCommenter: false,
                  });
                },
              })}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

export default class CommentArea extends React.Component<CommentAreaProps, CommentAreaState> {
  static override propTypes = {
    commentsProps: PropTypes.shape({
      comments: PropTypes.array,
      commentsCount: PropTypes.number,
    }),
    params: PropTypes.shape({
      sourceId: PropTypes.string.isRequired,
      sourceType: PropTypes.oneOf(_.values(SOURCE_TYPE)),
      discussionId: PropTypes.string,
      replyId: PropTypes.string,
      name: PropTypes.string,
    }),
  };

  constructor(props: CommentAreaProps) {
    super(props);
    const {
      params: { sourceType },
    } = this.props;
    const {
      commentsProps: { comments },
    } = props;
    this.state = {
      loadAllComments: false, // 动态加载全部评论
      commenterIsFocus: false,
      comments: _.map(comments || [], (comment: TopicSource) => {
        return formatTopic(comment, sourceType);
      }),

      showComments: comments && comments.length > 0,
    };
  }

  addCommentCallback = (comment: TopicSource) => {
    const {
      params: { sourceType },
    } = this.props;
    const comments = this.state.comments.slice(0);
    this.setState({
      comments: [formatTopic(comment, sourceType)].concat(comments),
    });
  };

  removeCommentCallback(id?: string | number | null) {
    this.setState({
      comments: _.filter(this.state.comments, ({ discussionId }: CommentTopic) => discussionId !== id),
    });
  }

  clickLoadMore() {
    const {
      params: { sourceId, type },
    } = this.props;

    postAjax
      .getMorePostComments({
        postID: sourceId,
      })
      .then((data: TopicSource[] | 'error') => {
        if (data === 'error') {
          alert(_l('操作失败'), 2);
        } else {
          this.setState({
            loadAllComments: true,
            comments: _.map(data, (comment: TopicSource) => formatTopic(comment, type)),
          });
        }
      });
  }

  renderCommenter() {
    const props = {
      ...getComponentProps({
        params: this.props.params,
      }),
      projectId: this.props.params.projectId,
      fromAppId: this.props.params.appId,
      autoFocus: this.state.commenterIsFocus,
      onSubmit: this.addCommentCallback,
    };
    return <Commenter {...props} mentionsOptions={{ getPopupContainer: () => document.body }} />;
  }

  renderComments() {
    const { showComments } = this.state;

    if (showComments) {
      return (
        <div className="pTop5">
          {this.renderCommenter()}
          {(() => {
            return _.map(this.state.comments, comment => {
              const props = {
                ...comment,
                addCallback: this.addCommentCallback,
                removeCallback: this.removeCommentCallback.bind(this),
              };
              const commenterProps = {
                ...getComponentProps({
                  params: {
                    ...this.props.params,
                    discussionId: props.discussionId,
                    createAccount: props.createAccount,
                  },
                }),
                onSubmit() {},
              };
              return (
                <CommentItem key={props.discussionId} {...props}>
                  <Commenter {...commenterProps} />
                </CommentItem>
              );
            });
          })()}
        </div>
      );
    } else {
      return null;
    }
  }

  renderViewMore() {
    const {
      commentsProps: { commentsCount },
    } = this.props;
    const { comments } = this.state;
    const hasMore = comments && commentsCount && comments.length < commentsCount;
    const { loadAllComments } = this.state;

    if (hasMore && !loadAllComments) {
      return (
        <div className="TxtCenter">
          <a
            href="javascript:void(0);"
            onClick={() => {
              this.clickLoadMore();
            }}
          >
            {_l('展开其余 %0 条回复', commentsCount - comments.length)}
            <i className="icon-arrow-down-border" />
          </a>
        </div>
      );
    }
    return undefined;
  }

  override render() {
    return (
      <div className="Font12">
        <div>
          {!md.global.Account.isPortal && ( //外部门户没有回复
            <a
              href="javascript:void 0;"
              onClick={() => {
                this.setState({ showComments: true, commenterIsFocus: true });
              }}
            >
              {_l('回复')}
            </a>
          )}
        </div>
        {this.renderComments()}
        {this.renderViewMore()}
      </div>
    );
  }
}
