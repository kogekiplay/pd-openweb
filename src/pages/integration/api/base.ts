import _ from 'lodash';
export const controllerName = 'Integration';

export default {
  server: (options: Record<string, any> = {}) => {
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
