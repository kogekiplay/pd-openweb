import _ from 'lodash';
export const controllerName = 'Integration';

/** server() 只看 isAggTable 选接口服务（聚合表走 AggregationUrl）；其余字段原样随请求走 */
interface ServerOptions {
  isAggTable?: boolean;
  [key: string]: unknown;
}

export default {
  server: (options: ServerOptions = {}) => {
    if (options.isAggTable) {
      return `${__api_server__.datapipeline || md.global.Config.AggregationUrl}/`;
    } else {
      return `${__api_server__.datapipeline || md.global.Config.DataPipelineUrl}/`;
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
