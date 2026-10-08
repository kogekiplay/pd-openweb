import base, { controllerName } from './base';

/**
 * DataLimit
 */
const DataLimit = {
  /** 批量重置工作流用量。 */
  resetUageLimit: function (args: ApiArgs, options: ApiOptions = {}) {
    base.ajaxOptions.url = base.server(options) + '/DataLimit/ResetUageLimit';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'DataLimitResetUageLimit', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  GetUageLimits: function (args, options) {
    base.ajaxOptions.url = base.server(options) + '/DataLimit/GetUageLimits';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'DataLimitGetUageLimits', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  EditUageLimit: function (args, options) {
    base.ajaxOptions.url = base.server(options) + '/DataLimit/EditUageLimit';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'DataLimitEditUageLimit', args, $.extend({}, base, options));
  },
  /** 批量修改工作流用量配额。 */
  batchEditUageLimit: function (args: ApiArgs, options: ApiOptions = {}) {
    base.ajaxOptions.url = base.server(options) + '/DataLimit/BatchEditUageLimit';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'DataLimitBatchEditUageLimit', args, $.extend({}, base, options));
  },
};
export default DataLimit;
