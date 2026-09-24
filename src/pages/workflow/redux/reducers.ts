import { combineReducers } from 'redux';
import type { DataAction } from 'src/redux/types';

// 流程信息来自接口（getProcessPublish 等），形状未类型化，按接口原样值记
type FlowInfoAction =
  | { type: 'GET_FLOW_INFO' | 'UPDATE_PROCESS'; data: ApiPayload }
  | { type: 'UPDATE_PUBLIC_STATE'; obj: ApiPayload }
  | { type: 'UPDATE_PUBLISH_STATUS'; publishStatus: number }
  | { type: 'CLEAR_FLOW_SOURCE' };

const flowInfo = (state: ApiPayload = {}, action: FlowInfoAction) => {
  switch (action.type) {
    case 'GET_FLOW_INFO':
      return action.data;
    case 'UPDATE_PROCESS':
      return Object.assign({}, state, {
        name: action.data.name,
        groupId: action.data.groupId,
        explain: action.data.explain,
        iconColor: action.data.iconColor,
        iconName: action.data.iconName,
      });
    case 'UPDATE_PUBLIC_STATE':
      return Object.assign({}, state, action.obj);
    case 'UPDATE_PUBLISH_STATUS':
      return Object.assign({}, state, { publishStatus: action.publishStatus });
    case 'CLEAR_FLOW_SOURCE':
      return {};
    default:
      return state;
  }
};

const workflowDetail = (state: ApiPayload = {}, action: DataAction<ApiPayload>) => {
  switch (action.type) {
    case 'GET_PROCESS_INFO':
    case 'ADD_FLOW_NODE':
    case 'DELETE_FLOW_NODE':
    case 'UPDATE_NODE_DATA':
    case 'GO_BACK_UPDATE_SOURCE':
    case 'UPDATE_FLOW_NODE_NAME':
    case 'UPDATE_NODE_GATEWAY':
    case 'UPDATE_BRANCH_SORT':
      return action.data;
    case 'CLEAR_SOURCE':
      return {};
    default:
      return state;
  }
};

const workflowTestRunning = (state: ApiPayload = {}, action: DataAction<ApiPayload>) => {
  switch (action.type) {
    case 'UPDATE_WORKFLOW_TEST_RUNNING':
    case 'CLEAR_WORKFLOW_TEST_RUNNING':
      return action.data;
    default:
      return state;
  }
};

export default combineReducers({
  flowInfo,
  workflowDetail,
  workflowTestRunning,
});
