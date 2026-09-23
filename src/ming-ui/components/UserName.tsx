import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { UserCard } from 'ming-ui';
import { pathCompletion } from 'src/utils/common';

interface UserNameProps {
  /** 调用方常把整条成员数据原样传进来，多余字段照收 */
  user: { userName?: string | undefined; accountId?: string | undefined; [key: string]: unknown };
  className?: string | undefined;
  chatButton?: boolean | undefined;
  /** 小秘书等系统身份：不跳个人页 */
  isSecretary?: boolean | undefined;
  /** 网络 id */
  projectId?: string | undefined;
  /** 外部门户需要传 */
  appId?: string | undefined;
  /** 是否来自离职列表 */
  isFromDepartureList?: boolean | undefined;
  /** 不弹名片层、不可点 */
  disabled?: boolean | undefined;
  [key: string]: unknown;
}

/**
 * 用户姓名，正常用户可以点到其详情页。带 hover 的层
 */
class UserName extends React.Component<UserNameProps> {
  static override propTypes = {
    user: PropTypes.shape({
      userName: PropTypes.string,
      accountId: PropTypes.string,
    }),
    className: PropTypes.string,
    chatButton: PropTypes.bool,
    projectId: PropTypes.string, // 网络id
    appId: PropTypes.string, //外部门户需要传
    isFromDepartureList: PropTypes.bool, // 是否来自离职列表
  };

  static defaultProps = {
    chatButton: true,
  };

  override render() {
    const { user, className, chatButton, isSecretary = false, projectId, appId, isFromDepartureList } = this.props;

    const disabled =
      this.props.disabled ||
      !user.accountId ||
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
        sourceId={user.accountId}
        disabled={disabled}
        chatButton={chatButton}
        projectId={projectId}
        appId={appId}
        isFromDepartureList={isFromDepartureList}
      >
        <a
          className={cx({ textSecondary: !user.accountId }, className)}
          href={disabled || isSecretary ? 'javascript:void(0);' : pathCompletion('/user_' + user.accountId)}
          target="_blank"
          onClick={e => (disabled || isSecretary) && e.preventDefault()}
        >
          {user.userName}
        </a>
      </UserCard>
    );
  }
}

export default UserName;
