export const controllerName = 'Workflow';

/** server() 只看请求选项里的这三个开关来选接口服务；其余字段原样随请求走 */
interface ServerOptions {
  /** 集成中心的接口 */
  isIntegration?: boolean;
  /** 工作流插件的接口 */
  isPlugin?: boolean;
  /** 在插件页里也强制走普通工作流接口 */
  isWorkflow?: boolean;
  [key: string]: unknown;
}

export default {
  server: (options: ServerOptions = {}) => {
    const isPlugin = location.href.indexOf('workflowplugin') > -1;

    if (options.isIntegration) {
      return __api_server__.integration || md.global.Config.IntegrationAPIUrl;
    } else if (options.isPlugin || (isPlugin && !options.isWorkflow)) {
      return __api_server__.workflowPlugin || md.global.Config.WorkflowPluginUrl;
    } else {
      return __api_server__.workflow || md.global.Config.WorkFlowUrl;
    }
  },
  ajaxOptions: {
    url: '',
    type: 'Get',
    cache: false,
    dataType: 'json',
    contentType: 'application/json',
  },
};
