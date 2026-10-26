import type { InboxEndpoint } from './inboxTypes';
import type {
  AccountsPersonalStatusParams,
  AddOrUpdateStatusResponse,
  PersonalStatusIdentity,
  PersonalStatusResponse,
  PersonalStatusWriteParams,
} from './personalStyleTypes';

// Reuse the existing ordinary-JSON/opaque-mode overloads. Alternate SDK modes
// keep their actual opaque return instead of claiming a JSON payload promise.
const getAccountsPersonalStatus: InboxEndpoint<
  AccountsPersonalStatusParams,
  HapApi.MD.Web.Ajax.ResultModel.Personals.PeronsalStatusModelList
> = function (args: AccountsPersonalStatusParams, options: ApiOptions = {}) {
  return mdyAPI('PersonalStyle', 'GetAccountsPersonalStatus', args, options);
};

// This action consumes no request fields; callers pass an object unchanged.
const getPersonalStatus: InboxEndpoint<object, PersonalStatusResponse> = function (
  args: object,
  options: ApiOptions = {},
) {
  return mdyAPI('PersonalStyle', 'GetPersonalStatus', args, options);
};

const setPersonalStatus: InboxEndpoint<PersonalStatusWriteParams, boolean> = function (
  args: PersonalStatusWriteParams,
  options: ApiOptions = {},
) {
  return mdyAPI('PersonalStyle', 'SetPersonalStatus', args, options);
};

const cancelPersonalStatus: InboxEndpoint<PersonalStatusIdentity, boolean> = function (
  args: PersonalStatusIdentity,
  options: ApiOptions = {},
) {
  return mdyAPI('PersonalStyle', 'CancelPersonalStatus', args, options);
};

const deletePersonalStatus: InboxEndpoint<PersonalStatusIdentity, boolean> = function (
  args: PersonalStatusIdentity,
  options: ApiOptions = {},
) {
  return mdyAPI('PersonalStyle', 'DeletePersonalStatus', args, options);
};

const addOrUpdateStatus: InboxEndpoint<PersonalStatusWriteParams, AddOrUpdateStatusResponse> = function (
  args: PersonalStatusWriteParams,
  options: ApiOptions = {},
) {
  return mdyAPI('PersonalStyle', 'AddOrUpdateStatus', args, options);
};

export default {
  /**
   * 获取 多个用户的 生效状态信息（用户 未设置 状态 不返回）
   * @param {Object} args 请求参数
   * @param {array} args.accountIds
   * @param {Object} options 配置参数
   * @param {Boolean} options.silent 是否禁止错误弹层
   * @returns Ordinary JSON mode returns the documented payload; alternate SDK modes remain opaque.
   **/
  getAccountsPersonalStatus,
  /**
   * 获取账户一览信息
   * @param {Object} args 请求参数
   * @param {Object} options 配置参数
   * @param {Boolean} options.silent 是否禁止错误弹层
   * @returns Ordinary JSON mode returns the documented payload; alternate SDK modes remain opaque.
   **/
  getPersonalStatus,
  /**
   * 设置 个人状态为 当前状态/预约
   * @param {Object} args 请求参数
   * @param {string} args.statusId Id
   * @param {string} args.icon 图标
   * @param {string} args.remark 备注
   * @param {string} args.beginTime 起始时间【可空】
   * @param {string} args.endTime 结束时间【可空】
   * @param {} args.durationOption
   * @param {Object} options 配置参数
   * @param {Boolean} options.silent 是否禁止错误弹层
   * @returns Ordinary JSON mode returns the documented payload; alternate SDK modes remain opaque.
   **/
  setPersonalStatus,
  /**
   * 取消设置 当前状态
   * @param {Object} args 请求参数
   * @param {string} args.statusId Id
   * @param {Object} options 配置参数
   * @param {Boolean} options.silent 是否禁止错误弹层
   * @returns Ordinary JSON mode returns the documented payload; alternate SDK modes remain opaque.
   **/
  cancelPersonalStatus,
  /**
   * 删除 个人状态
   * @param {Object} args 请求参数
   * @param {string} args.statusId Id
   * @param {Object} options 配置参数
   * @param {Boolean} options.silent 是否禁止错误弹层
   * @returns Ordinary JSON mode returns the documented payload; alternate SDK modes remain opaque.
   **/
  deletePersonalStatus,
  /**
   * 添加或更新的 个人 单个状态
   * @param {Object} args 请求参数
   * @param {string} args.statusId Id【可空】
   * @param {string} args.icon 图标
   * @param {string} args.remark 备注
   * @param {string} args.beginTime 预约 起始时间【可空】
   * @param {string} args.endTime 预约 结束时间【可空】
   * @param {} args.durationOption
   * @param {Object} options 配置参数
   * @param {Boolean} options.silent 是否禁止错误弹层
   * @returns Ordinary JSON mode returns the documented payload; alternate SDK modes remain opaque.
   **/
  addOrUpdateStatus,
};
