import { decodeInviteResult } from './inviteBoundary';
import type { DecodedInviteResult, InviteAccount, InviteHintAccounts } from './inviteTypes';

// 提示邀请结果
export const existAccountHint = function (response: unknown): InviteHintAccounts | undefined {
  let result: DecodedInviteResult;
  try {
    result = decodeInviteResult(response);
  } catch {
    alert(_l('邀请失败'), 2);
    return undefined;
  }
  const inviteNoticeMessage = function (title: string, accounts: InviteAccount[]) {
    if (!accounts.length) return '';
    const USER_STATUS = new Map([
      ['2', _l('（被拒绝加入，需从后台恢复权限）')],
      ['3', _l('（待审批）')],
      ['4', _l('（被暂停权限，需从后台恢复权限）')],
    ]);
    let noticeMessage = title + '：<br/>';

    accounts.forEach(item => {
      let message = '';

      if (item.account) {
        // 不存在的用户
        message = item.account;
      } else {
        // 已存在的用户
        let accountArr: string[] = [];

        if (item.email) {
          accountArr.push(item.email);
        }

        if (item.mobilePhone) {
          accountArr.push(item.mobilePhone);
        }

        let desc = accountArr.join(' / ') + (item.user === undefined ? '' : USER_STATUS.get(String(item.user)) || '');
        message = item.fullname + (desc.length ? '：' + desc : '');
      }

      noticeMessage += '<div class="Font12 textPlaceholder LineHeight25">' + message + '</div>';
    });

    return noticeMessage;
  };

  if (result.sendMessageResult === 0) {
    alert(_l('邀请失败'), 2);
    return undefined;
  }

  let accountInfos: InviteAccount[] = []; // 成功
  let existAccountInfos: InviteAccount[] = []; // 已存在
  let failedAccountInfos: InviteAccount[] = []; // 失败
  let limitAccountInfos: InviteAccount[] = []; // 邀请限制
  let forbidAccountInfos: InviteAccount[] = []; // 账号来源类型受限

  (result.results || []).forEach(singleResult => {
    // 成功
    if (singleResult.accountInfos) {
      accountInfos = accountInfos.concat(singleResult.accountInfos);
    }

    // 已存在
    if (singleResult.existAccountInfos) {
      existAccountInfos = existAccountInfos.concat(singleResult.existAccountInfos);
    }

    // 失败
    if (singleResult.failedAccountInfos) {
      failedAccountInfos = failedAccountInfos.concat(singleResult.failedAccountInfos);
    }

    // 限制
    if (singleResult.limitAccountInfos) {
      limitAccountInfos = limitAccountInfos.concat(singleResult.limitAccountInfos);
    }

    // 账号来源类型受限
    if (singleResult.forbidAccountInfos) {
      forbidAccountInfos = forbidAccountInfos.concat(singleResult.forbidAccountInfos);
    }
  });

  let message = _l('邀请成功');
  let isNotice =
    existAccountInfos.length || failedAccountInfos.length || limitAccountInfos.length || forbidAccountInfos.length;

  if (isNotice) {
    message = inviteNoticeMessage(_l('以下用户邀请成功'), accountInfos);
    message += inviteNoticeMessage(_l('以下用户已存在，不能重复邀请'), existAccountInfos);
    message += inviteNoticeMessage(_l('以下用户超过邀请数量限制，无法邀请'), limitAccountInfos);
    message += inviteNoticeMessage(_l('以下用户邀请失败'), failedAccountInfos);
    message += inviteNoticeMessage(_l('以下用户账号来源类型受限'), forbidAccountInfos);
  }

  if (isNotice) {
    alert(message, 3);
  } else {
    alert(message);
  }

  return {
    accountInfos: accountInfos,
    existAccountInfos: existAccountInfos,
  };
};
