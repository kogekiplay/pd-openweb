import base, { controllerName } from './base';
import type { ApiArgs, ApiOptions } from './apiTypes';
/**
 * translator
*/
const translator = {
  /**
   * null
   * @param {string} [args.processId] *null
   * @param {Object} options 配置参数
   */
  getProcessTranslator: function(args: ApiArgs = {}, options: ApiOptions = {}) {
    base.ajaxOptions.url = base.server(options) + '/translator/getProcessTranslator';
    base.ajaxOptions.type = 'GET';
    return mdyAPI(controllerName, 'translatorgetProcessTranslator', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {string} [args.apkId] *null
   * @param {boolean} [args.all] *null
   * @param {Object} options 配置参数
   */
  getProcessTranslatorList: function(args: ApiArgs = {}, options: ApiOptions = {}) {
    base.ajaxOptions.url = base.server(options) + '/translator/getProcessTranslatorList';
    base.ajaxOptions.type = 'GET';
    return mdyAPI(controllerName, 'translatorgetProcessTranslatorList', args, $.extend({}, base, options));
  },
};
export default translator;