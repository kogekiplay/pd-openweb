import React from 'react';
import cx from 'classnames';
import { UserCard } from 'ming-ui';
import { APPLICATION_ICON } from 'src/utils/enum';
import { MSGTYPES } from '../../constants';

/** 头像 props（`messageContent` 把收件箱条目的这几个字段透传进来） */
interface AvatarProps {
  accountId?: string | undefined;
  fullname?: string | undefined;
  avatar?: string | undefined;
  /** 消息类型（`MSGTYPES`，用于确定应用图标） */
  inboxType?: number | string | undefined;
  appId?: string | undefined;
}

interface AvatarState extends AvatarProps {
  /** 按消息类型归一出的应用图标类别 */
  applicationType: string;
}

const formatUser = function (props: AvatarProps): AvatarState {
  const { accountId, fullname, avatar, inboxType, appId } = props;
  // 系统消息 应用类型
  let applicationType = '';

  switch (inboxType) {
    case MSGTYPES.SystemMessage:
      applicationType = 'system';
      break;
    case MSGTYPES.CalendarMessage:
      applicationType = 'calendar';
      break;
    case MSGTYPES.TaskMessage:
    case MSGTYPES.FolderMessage:
      applicationType = 'task';
      break;
    case MSGTYPES.KCMessage:
      applicationType = 'knowledge';
      break;
    case MSGTYPES.ApprovalMessage:
      applicationType = 'approval';
      break;
    case MSGTYPES.AttendanceMessage:
      applicationType = 'check';
      break;
    case MSGTYPES.DossierMessage:
      applicationType = 'dossier';
      break;
    case MSGTYPES.WorkSheetMessage:
      applicationType = 'worksheet';
      break;
    case MSGTYPES.WorkFlowMessage:
    case MSGTYPES.WorkFlowTaskMessage:
    case MSGTYPES.WorkFlowUserTaskMessage:
    case MSGTYPES.WorkFlowSendTaskMessage:
      applicationType = 'workflow';
      break;
    default:
      break;
  }

  return {
    accountId,
    fullname,
    avatar,
    applicationType,
    appId,
  };
};

let date: null | number = null;

export default class Avatar extends React.Component<AvatarProps, AvatarState> {
  declare card: HTMLAnchorElement | null | undefined;

  constructor(props: AvatarProps) {
    super(props);
    this.state = {
      ...formatUser(props),
    };
  }

  override render() {
    const { accountId, fullname, avatar, applicationType, appId } = this.state;

    if (applicationType) {
      return (
        <span
          className={cx('colorPrimaryDark msgIcon', { calendar: applicationType === 'calendar ' })}
          data-date={date || (date = new Date().getDate())}
        >
          <span className={cx(APPLICATION_ICON[applicationType], 'circle small')}></span>
        </span>
      );
    } else {
      let param = {};

      if (!(md.global.Account.isPortal || (accountId || '').indexOf('a#') > -1)) {
        param = {
          href: '/user_' + accountId,
        };
      }

      return (
        <UserCard sourceId={accountId} appId={appId}>
          <a
            {...param}
            target="_blank"
            className="inboxAvatar"
            ref={elem => {
              this.card = elem;
            }}
          >
            <img src={avatar} title={fullname} />
          </a>
        </UserCard>
      );
    }
  }
}
