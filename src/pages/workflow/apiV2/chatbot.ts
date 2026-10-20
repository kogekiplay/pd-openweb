import base, { controllerName } from './base';
import type { ApiArgs, ApiOptions } from './apiTypes';

/** Owner fields consumed by GetHelp. Missing fields remain missing in the UI. */
export interface ChatbotFeedbackOwner {
  companyId?: string | undefined;
  fullName?: string | undefined;
  accountId?: string | undefined;
}

/** The UI retains its empty initial owner for a falsy JSON response. */
export type ChatbotFeedbackOwnerResult = ChatbotFeedbackOwner | false | 0 | '' | null | undefined;

/** User feedback identifies a message; platform feedback identifies a flow node. */
export interface ChatbotFeedbackParams {
  chatbotId?: string | undefined;
  messageId?: string | undefined;
  instanceId?: string | undefined;
  flowNodeId?: string | undefined;
  opinion: string;
}
/**
 * chatbot
*/
const chatbot = {
  /**
   * null
   * @param {Object} options 配置参数
   */
  updateConversation: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/updateConversation';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotupdateConversation', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  shareToConversation: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/shareToConversation';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotshareToConversation', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  resetConversation: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/resetConversation';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotresetConversation', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  ocr: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/ocr';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotocr', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  getOwner: function(args: { chatbotId?: string | undefined }, options?: ApiOptions): ApiResultOf<ChatbotFeedbackOwnerResult> {
    base.ajaxOptions.url = base.server(options) + '/chatbot/getOwner';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotgetOwner', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  getMessageList: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/getMessageList';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotgetMessageList', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  getMessageListAndConversation: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/getMessageListAndConversation';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotgetMessageListAndConversation', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  getConversation: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/getConversation';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotgetConversation', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  getConversationList: function(args: ApiArgs = {}, options: ApiOptions = {}) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/getConversationList';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotgetConversationList', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  getAllConversationList: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/getAllConversationList';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotgetAllConversationList', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  feedback: function(args: ChatbotFeedbackParams, options?: ApiOptions): ApiResultOf<unknown> {
    base.ajaxOptions.url = base.server(options) + '/chatbot/feedback';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotfeedback', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  clearConversation: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/clearConversation';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotclearConversation', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  addShareConversation: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/addShareConversation';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotaddShareConversation', args, $.extend({}, base, options));
  },
  /**
   * null
   * @param {Object} options 配置参数
   */
  handleAIRequest: function(args, options?) {
    base.ajaxOptions.url = base.server(options) + '/chatbot/HandleAIRequest';
    base.ajaxOptions.type = 'POST';
    return mdyAPI(controllerName, 'chatbotHandleAIRequest', args, $.extend({}, base, options));
  },
};
export default chatbot;
