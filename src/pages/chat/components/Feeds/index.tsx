import { Component } from 'react';
import { Dialog, LoadDiv } from 'ming-ui';
import postAjax from 'src/api/post';
import previewAttachments from 'src/components/previewAttachments/previewAttachments';
import PostDetails from 'src/pages/feed/components/post/postDetails/postDetails';
import { getClassNameByExt } from 'src/utils/common';
import createLinksForMessage from 'src/utils/createLinksForMessage';
import { dateConvertToUserZone } from 'src/utils/project';
import { formatMsgDate } from '../../utils';
import * as ajax from '../../utils/ajax';
import type { ChatSession } from '../../redux/types';
import type { MessageArgs } from 'src/utils/messageLinkTypes';
import './index.less';


/** 动态附件（`classify` 真实读取/写入的字段：分类、图标类名、原下标、下载地址等） */
interface FeedAttachment {
  /** 1 = 图片，2 = 文件 */
  attachmentType?: number | undefined;
  /** `classify` 写入：`getClassNameByExt(ext)` 的图标类名 */
  icon?: string | undefined;
  ext?: string | undefined;
  /** `classify` 写入：附件在原始数组里的下标（预览定位用） */
  index?: number | undefined;
  fileID?: string | undefined;
  previewUrl?: string | undefined;
  originalFilename?: string | undefined;
  downloadUrl?: string | undefined;
  sourceID?: string | undefined;
  commentID?: string | undefined;
  fromType?: unknown;
  docVersionID?: string | undefined;
  [key: string]: unknown;
}

/** `formatFeeds` 归一化后的动态条目（列表/详情共用的真实消费形状） */
export interface PostFeedItem {
  autoID?: string | undefined;
  postID?: string | undefined;
  message?: string | undefined;
  rUserList?: unknown;
  rGroupList?: unknown;
  categories?: unknown;
  createTime?: number | string | undefined;
  commentCount?: number | undefined;
  user?: { userHead?: string | undefined; userName?: string | undefined; [key: string]: unknown } | undefined;
  attachments?: FeedAttachment[] | undefined;
  /** `formatFeeds` 写入：转链接并截断后的正文 */
  content?: string | undefined;
  /** `formatFeeds` 写入：`classify` 的分类结果 */
  previewAttachments?: { imagelist: FeedAttachment[]; filelist: FeedAttachment[] } | undefined;
  splitTime?: string | undefined;
  [key: string]: unknown;
}

interface FeesItemProps {
  item: PostFeedItem;
}

interface FeedsProps {
  session: ChatSession;
  onSetPanelVisible: (visible: boolean) => void;
}

interface FeedsState {
  postList: PostFeedItem[];
  loading: boolean;
}

const classify = (files: FeedAttachment[]) => {
  const imagelist: FeedAttachment[] = [];
  const filelist: FeedAttachment[] = [];
  files.forEach((item, index: number) => {
    if (item.attachmentType === 1) {
      item.index = index;
      imagelist.push(item);
    } else if (item.attachmentType === 2) {
      item.icon = getClassNameByExt(item.ext);
      item.index = index;
      filelist.push(item);
    }
  });
  return {
    imagelist,
    filelist,
  };
};

export const formatFeeds = (attachments: PostFeedItem[]) => {
  return attachments.map((item: PostFeedItem) => {
    if (item.attachments) {
      item.previewAttachments = classify(item.attachments);
    }

    // 擦除标记：`createLinksForMessage` 的必填正文/提及列表由动态接口给出（原 any 直接传）。
    item.content = createLinksForMessage({
      message: item.message as string,
      rUserList: item.rUserList as MessageArgs['rUserList'],
      rGroupList: item.rGroupList as MessageArgs['rGroupList'],
      categories: item.categories as MessageArgs['categories'],
      noLink: true,
      filterFace: true,
      doNotEscapeHTML: true,
    }).slice(0, 300);
    item.content = item.content.length >= 70 ? item.content.slice(0, 70) + '...' : item.content;
    return item;
  });
};

export class FeesItem extends Component<FeesItemProps, Record<string, never>> {
  constructor(props: FeesItemProps) {
    super(props);
  }
  handlePreview(item: FeedAttachment, event: { stopPropagation: () => void }) {
    event.stopPropagation();
    const { attachments } = this.props.item;
    const { index } = item;
    previewAttachments(
      {
        index: index || 0,
        attachments,
        callFrom: 'player',
        sourceID: item.sourceID,
        commentID: item.commentID,
        fromType: item.fromType,
        docVersionID: item.docVersionID,
        showThumbnail: true,
        hideFunctions: ['editFileName'],
      },
      {},
    );
  }
  handlePreviewFeed(item: PostFeedItem) {
    const { postID } = item;

    const removeFn = function () {
      $('.chatFeedDialog').parent().remove();
    };

    postAjax
      .getPostDetail({
        postId: postID,
      })
      .then(postItem => {
        if (postItem.success === '1') {
          Dialog.confirm({
            width: 800,
            dialogClasses: 'chatFeedDialog',
            title: _l('动态详情'),
            noFooter: true,
            children: <PostDetails onRemove={removeFn} postItem={postItem} />,
          });
        } else {
          return alert(_l('您的权限不足或此动态已被删除，无法查看'), 2);
        }
      });
  }
  renderImage(files: FeedAttachment[]) {
    return (
      <div className="feed-imageList">
        {files.map((item: FeedAttachment) => (
          <div key={item.fileID} className="feed-image-item" onClick={this.handlePreview.bind(this, item)}>
            <img src={item.previewUrl} />
          </div>
        ))}
      </div>
    );
  }
  renderFile(files: FeedAttachment[]) {
    return (
      <div className="feed-filelist">
        {files.map((item: FeedAttachment) => (
          <div className="feed-file-item" key={item.fileID} onClick={this.handlePreview.bind(this, item)}>
            <div className="file-icon">
              <i className={item.icon} />
            </div>
            <div className="file-info">
              <div className="file-info-name colorPrimary">{item.originalFilename}</div>
            </div>
            <div className="file-info-action">
              <a href={item.downloadUrl} className="download colorPrimary icon-download" target="_blank" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  renderFeed() {
    const { item } = this.props;
    const { user, previewAttachments } = item;
    const { imagelist, filelist } = previewAttachments || {};
    // 擦除标记：动态条目必有创建者、正文由 formatFeeds 写入（原 any 直接读）；
    // 缺省时原实现抛原生 TypeError / 渲染 'undefined'。
    return (
      <div className="ChatPanel-Feeds-item" key={item.autoID} onClick={this.handlePreviewFeed.bind(this, item)}>
        <div className="feed-creator">
          <div className="feed-creator-avatar">
            <img src={user!.userHead} />
          </div>
          <div className="feed-creator-info flex ellipsis">{user!.userName}</div>
        </div>
        <div className="feed-body">
          <div className="feed-content" dangerouslySetInnerHTML={{ __html: item.content as string }}></div>
          {imagelist && imagelist.length ? this.renderImage(imagelist) : undefined}
          {filelist && filelist.length ? this.renderFile(filelist) : undefined}
        </div>
        <div className="feed-metadata">
          <span className="feed-ctime pull-left">{formatMsgDate(dateConvertToUserZone(item.createTime))}</span>
          <span className="feed-comment icon-task-reply-msg">{item.commentCount}</span>
        </div>
      </div>
    );
  }
  override render() {
    const { item } = this.props;
    return (
      <div>
        {item.splitTime ? (
          <div>
            <div className="splitTime">{item.splitTime}</div>
            {this.renderFeed()}
          </div>
        ) : (
          this.renderFeed()
        )}
      </div>
    );
  }
}

export default class Feeds extends Component<FeedsProps, FeedsState> {
  constructor(props: FeedsProps) {
    super(props);
    this.state = {
      postList: [],
      loading: true,
    };
  }
  override componentDidMount() {
    const { session } = this.props;
    ajax
      .getFeed({
        gID: session.id,
        pIndex: 1,
        pSize: 3,
        lastPostAutoID: null,
      })
      .then(feeds => {
        const { postList } = feeds;
        this.setState({
          loading: false,
          postList: postList && postList.length ? formatFeeds(postList) : [],
        });
      });
  }
  override render() {
    const { loading, postList } = this.state;
    return (
      <div className="ChatPanel-Feeds ChatPanel-sessionInfo-item">
        <div className="ChatPanel-Feeds-hander ChatPanel-sessionInfo-hander">
          <span>{_l('动态')}</span>
          {postList.length ? (
            <span
              onClick={this.props.onSetPanelVisible.bind(this, true)}
              className="ChatPanel-sessionInfo-hander-entry colorPrimary"
            >
              {_l('所有动态')}
              <i className="icon-arrow-right-border" />
            </span>
          ) : undefined}
        </div>
        <div className="ChatPanel-Feeds-body">
          {postList.map((item: PostFeedItem) => (
            <FeesItem item={item} key={item.autoID} />
          ))}
          {loading ? <LoadDiv size="small" /> : undefined}
          {!loading && !postList.length ? <div className="nodata">{_l('群组中暂无动态')}</div> : undefined}
        </div>
      </div>
    );
  }
}
