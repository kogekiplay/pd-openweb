import { ConfigProvider, Empty, Table } from 'antd';
import type { TableProps } from 'antd';
import moment from 'moment';
import { UserHead } from 'ming-ui';
import { START_APP_TYPE } from 'src/pages/workflow/WorkflowList/utils';
import { navigateTo } from 'src/router/navigateTo';
import IsAppAdmin from '../../../components/IsAppAdmin';
import type { HistoryWorkflowItem } from '../historyWorkflow';

type WorkflowStartAppTypeStyle = { iconName: string; iconColor: string; text: string };

// START_APP_TYPE 的键是有限数字串；这里用同一份真实对象派生查找表，避免用 string 直接索引。
const FLOW_TYPE_STYLE_BY_KEY = new Map(Object.entries(START_APP_TYPE));

// 原生 obj[value] 会先做 ToPropertyKey（数字 1 → "1"）；Map.get 不会，所以这里显式 String(value)。
const getFlowTypeStyle = (value?: string | number | undefined): Partial<WorkflowStartAppTypeStyle> =>
  FLOW_TYPE_STYLE_BY_KEY.get(String(value)) ?? {};
const renderEmpty = () => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={_l('暂无数据')} />;

export const getHistoryWorkflowColumns = ({
  projectId,
}: {
  projectId: string;
}): NonNullable<TableProps<HistoryWorkflowItem>['columns']> => [
  {
    title: _l('工作流'),
    dataIndex: 'id',
    render: (value: string, record: HistoryWorkflowItem) => {
      const workflowType = getFlowTypeStyle(record.startAppType);

      return (
        <div className="workfloeRowName flexRow alignItemsCenter">
          <IsAppAdmin
            className="workflowCheckWrap"
            appId={record.app ? record.app.id : undefined}
            desc={record.app ? record.app.name : undefined}
            appName={record.name}
            defaultIcon={workflowType.iconName}
            iconColor={workflowType.iconColor}
            createType={2}
            ckeckSuccessCb={() => navigateTo(`/workflowedit/${value}`)}
          />
        </div>
      );
    },
  },
  {
    title: _l('类型'),
    dataIndex: 'startAppType',
    width: 150,
    render: (value: string | number | undefined) => getFlowTypeStyle(value).text,
  },
  {
    title: _l('添加时间'),
    dataIndex: 'addedTime',
    width: 300,
    render: (value: string | undefined) =>
      value ? moment(value).format(_l('YYYY-MM-DD HH:mm')) : '_',
  },
  {
    title: _l('添加人'),
    dataIndex: 'addedBy',
    width: 300,
    render: (value: HistoryWorkflowItem['addedBy']) => {
      const addedBy = value || { accountId: '', avatar: '', fullName: '' };

      return (
        <div className="flexRow textSecondary minWidth0">
          <UserHead
            size={28}
            user={{ userHead: addedBy.avatar, accountId: addedBy.accountId }}
            projectId={projectId}
          />
          <div className="mLeft12 ellipsis flex minWidth0 LineHeight28">{addedBy.fullName}</div>
        </div>
      );
    },
  },
];

interface HistoryWorkflowTableProps {
  loading: boolean;
  list: HistoryWorkflowItem[];
  projectId: string;
}

export default function HistoryWorkflowTable({ loading, list, projectId }: HistoryWorkflowTableProps) {
  return (
    <ConfigProvider renderEmpty={renderEmpty}>
      <Table<HistoryWorkflowItem>
        loading={loading}
        className="workflowTable"
        rowClassName="workflowTableTitleRow"
        columns={getHistoryWorkflowColumns({ projectId })}
        dataSource={list}
        rowKey={record => record.id}
        pagination={false}
      />
    </ConfigProvider>
  );
}
