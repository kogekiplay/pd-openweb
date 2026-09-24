import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { Avatar, UserCard } from 'ming-ui';

interface UserHeadProps {
  /** 调用方常把整条成员数据原样传进来，多余字段照收 */
  user: { accountId: string; userHead?: string | undefined; [key: string]: unknown };
  size?: number | undefined;
  className?: string | undefined;
  type?: string | undefined;
  /** 头像的点击事件 */
  headClick?: ((accountId: string) => void) | undefined;
  /** 网络 id */
  projectId?: string | undefined;
  appId?: string | undefined;
  operation?: React.ReactNode;
  /** 是否显示发消息按钮 */
  chatButton?: boolean | undefined;
  /** 新页面打开 chat */
  newPageChat?: boolean | undefined;
  /** 是否来自离职列表 */
  isFromDepartureList?: boolean | undefined;
  /** 不弹名片层 */
  disabled?: boolean | undefined;
  /** 透传给 UserCard 的 type：1 人员 2 群组 3 小秘书 4 任务/文件夹/群组/小秘书 */
  secretType?: number | undefined;
  [key: string]: unknown;
}

/**
 * 用户头像，带 hover 的层
 */
export default class UserHead extends React.Component<UserHeadProps> {
  static override propTypes = {
    user: PropTypes.shape({
      accountId: PropTypes.string,
      userHead: PropTypes.string,
    }).isRequired,
    size: PropTypes.number,
    className: PropTypes.string,
    type: PropTypes.string,
    headClick: PropTypes.func, // 头像的点击事件
    projectId: PropTypes.string, // 网络id
    appId: PropTypes.string,
    operation: PropTypes.element,
    chatButton: PropTypes.bool, // 是否显示发消息按钮
    newPageChat: PropTypes.bool, // 新页面打开 chat
    isFromDepartureList: PropTypes.bool, // 是否来自离职列表
  };

  static defaultProps = {
    chatButton: true,
    size: 48,
  };

  getDefaultImg = (accountId: string) => {
    let host = `${md.global.FileStoreConfig.pictureHost}/UserAvatar/`;

    switch (accountId) {
      case 'user-self':
        return host + 'user-self.png';
      case 'user-sub':
        return host + 'user-sub.png';
      case 'user-workflow':
        return host + 'workflow.png';
      case 'user-publicform':
        return host + 'publicform.png';
      case 'user-api':
        return host + 'worksheetapi.png';
      case 'user-integration':
        return host + 'user-integration.png';
      default:
        return host + 'default.gif';
    }
  };

  override render() {
    const { user, appId, projectId, operation, headClick, chatButton, newPageChat, isFromDepartureList, size } =
      this.props;

    if (!user) return false;

    const src = user.userHead || this.getDefaultImg(user.accountId);
    const imgSrc =
      src.indexOf('?') > 0
        ? src.replace(/imageView2\/\d\/w\/\d+\/h\/\d+(\/q\/\d+)?/, 'imageView2/1/w/100/h/100/q/90')
        : src
          ? src + '?imageView2/1/w/100/h/100/q/90'
          : '';

    const result = (
      <div
        className={cx('pointer', this.props.className)}
        rel="noopener noreferrer"
        style={{ display: 'block', width: size, height: size }}
        onClick={event => {
          if (headClick) {
            headClick(user.accountId);
            event.stopPropagation();
          }
        }}
      >
        <Avatar size={size} src={imgSrc || ''} />
      </div>
    );

    const disabled =
      this.props.disabled ||
      [
        'user-self',
        'user-sub',
        'user-undefined',
        'user-workflow',
        'user-publicform',
        'user-api',
        'user-integration',
        '2',
        '4',
        'isEmpty',
        'user-system',
      ].includes(user.accountId);

    return (
      <UserCard
        type={this.props.secretType || 1}
        sourceId={user.accountId}
        operation={operation}
        projectId={projectId}
        appId={appId}
        disabled={disabled}
        chatButton={chatButton}
        newPageChat={newPageChat}
        isFromDepartureList={isFromDepartureList}
      >
        {result}
      </UserCard>
    );
  }
}
