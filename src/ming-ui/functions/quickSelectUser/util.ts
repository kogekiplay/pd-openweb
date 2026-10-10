import _ from 'lodash';
import addressBookController from 'src/api/addressBook';
import externalPortalCotroller from 'src/api/externalPortal';
import userController from 'src/api/user';
import { wrapAjax } from 'worksheet/redux/actions/util';
import { decodeUsers, userObject } from './boundary';
import type { AccountsOptions, GetUsersOptions, QuickUser, UsersRequest } from './types';

const getUsersByApp = wrapAjax(externalPortalCotroller.getUsersByApp);
const getProjectContactUserListByApp = wrapAjax(userController.getProjectContactUserListByApp);
const getUserAddressbookByKeywords = wrapAjax(addressBookController.getUserAddressbookByKeywords);
const getOftenMetionedUser = wrapAjax(userController.getOftenMetionedUser);

export function getAccounts({
  list,
  includeUndefinedAndMySelf,
  includeSystemField,
  prefixOnlySystemField,
  filterAccountIds,
  prefixAccountIds,
  prefixAccounts,
}: AccountsOptions) {
  let prefixUsers: QuickUser[] = [];
  let users = [...list];
  var filterMe = filterAccountIds.indexOf(md.global.Account.accountId) !== -1;
  var filterUndefined = filterAccountIds.indexOf('user-undefined') !== -1;
  var hasPrefix = (includeUndefinedAndMySelf && !(filterMe && filterUndefined)) || prefixAccountIds.length;
  var prefixAccountLength = prefixAccountIds.length;
  if (includeSystemField) {
    if (prefixOnlySystemField) {
      prefixUsers = users.filter(l => _.startsWith(l.accountId, 'user'));
      users = users.filter(l => !_.startsWith(l.accountId, 'user'));
    } else {
      prefixUsers = users.filter(c => c.accountId.length !== 36);
      users = users.filter(c => c.accountId.length === 36);
    }
  } else {
    if (hasPrefix) {
      if (includeUndefinedAndMySelf) {
        if (filterMe && filterUndefined) {
          prefixUsers = users.splice(0, prefixAccountLength);
        } else if (filterMe || filterUndefined) {
          prefixUsers = users.splice(0, 1 + prefixAccountLength);
        } else {
          prefixUsers = users.splice(0, 2 + prefixAccountLength);
        }
      } else {
        prefixUsers = users.splice(0, prefixAccountLength);
      }
    }
  }

  if (prefixAccounts && prefixAccounts.length) {
    prefixUsers = prefixUsers.concat(prefixAccounts || []);
  }

  return {
    prefixUsers,
    users,
  };
}

export function getUsers(args: GetUsersOptions): UsersRequest {
  let request: { abort(): void };
  let result: Promise<QuickUser[]>;
  if (args.type === 'external') {
    const raw = getUsersByApp({
      projectId: args.projectId,
      appId: args.appId,
      pageIndex: args.pageIndex || 1,
      pageSize: 25,
      keywords: args.keywords || '',
      filterAccountIds: args.filterAccountIds || [],
    });
    request = raw;
    result = raw.then((response: unknown) => {
      let result: QuickUser[] = decodeUsers(response).map(user => ({
        accountId: user.accountId,
        avatar: user.avatar,
        fullname: user.name,
        phone: user.mobilePhone,
      }));

      if ((args.pageIndex || 1) !== 1) {
        return result;
      }

      const currentAccount = result.find(item => item.accountId === md.global.Account.accountId);

      if (!args.hidePortalCurrentUser && (args.includeSystemField || args.includeUndefinedAndMySelf)) {
        const prefix: QuickUser[] = [
          {
            accountId: 'user-self',
            avatar: md.global.FileStoreConfig.pictureHost + '/UserAvatar/user-self.png?imageView2/1/w/100/h/100/q/90',
            fullname: _l('当前用户'),
          },
        ];
        result = prefix.concat(result);
      } else if (!args.keywords && currentAccount) {
        result = [currentAccount].concat(result);
      }

      return _.uniqBy(result, 'accountId');
    });
  } else if (args.type === 'range') {
    const raw = getProjectContactUserListByApp({
      pageIndex: 1,
      pageSize: 100,
      projectId: args.projectId,
      keywords: args.keywords,
      filterAccountIds: args.filterAccountIds || [],
      ...(_.isObject(args.selectRangeOptions) ? args.selectRangeOptions : {}),
    });
    request = raw;
    result = raw.then((response: unknown) => {
      const result = userObject(response);
      if (!result) throw new TypeError('Invalid restricted user response');
      const source = result['users'];
      if (source === undefined || source === null) return [];
      const users = userObject(source);
      if (!users) throw new TypeError('Invalid restricted user list');
      const list = users['list'];
      return decodeUsers(list === undefined || list === null ? [] : list);
    });
  } else if (args.keywords) {
    const otherOptions = args.filterOtherProject ? { projectId: args.projectId } : { currentProjectId: args.projectId };

    const raw = getUserAddressbookByKeywords({
      keywords: args.keywords || '',
      filterAccountIds: args.filterAccountIds || [],
      ...otherOptions,
    });
    request = raw;
    result = raw.then((response: unknown) => decodeUsers(userObject(response)?.['list']));
  } else {
    const raw = getOftenMetionedUser({
      count: args.mentionedCount,
      filterAccountIds: args.filterAccountIds || [],
      includeUndefinedAndMySelf: args.includeUndefinedAndMySelf || false,
      includeSystemField: args.includeSystemField || false,
      prefixAccountIds: args.prefixAccountIds || [],
      projectId: args.projectId,
    });
    request = raw;
    result = raw.then((response: unknown) => decodeUsers(response));
  }
  return Object.assign(result, { abort: () => request.abort() });
}
