import { ScrollView } from 'ming-ui';
import { Button, Checkbox, Modal } from 'ming-ui/antd-components';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import styled from 'styled-components';
import { START_APP_TYPE } from 'src/pages/workflow/WorkflowList/utils';
import IsAppAdmin from '../../../components/IsAppAdmin';
import type { HistoryWorkflowConflict } from '../historyWorkflow';

type WorkflowStartAppTypeStyle = { iconName: string; iconColor: string; text: string };

// START_APP_TYPE 的键是有限数字串；这里用同一份真实对象派生查找表，避免用 string 直接索引。
const FLOW_TYPE_STYLE_BY_KEY = new Map(Object.entries(START_APP_TYPE));

// 原生 obj[value] 会先做 ToPropertyKey（数字 1 → "1"）；Map.get 不会，所以这里显式 String(value)。
const getFlowTypeStyle = (value?: string | number | undefined): Partial<WorkflowStartAppTypeStyle> =>
  FLOW_TYPE_STYLE_BY_KEY.get(String(value)) ?? {};

const CheckedWorkflowWrap = styled.div`
  height: 100%;
  .headerCon {
    border-color: var(--color-border-primary);
    color: var(--color-text-secondary);
  }
  .workflowListWrap .listItem,
  .headerCon.listItem {
    padding: 12px 24px;
    border-bottom: 1px solid var(--color-border-secondary);
    display: flex;
    align-items: center;
    color: var(--color-text-tertiary);
    .columnType,
    .columnStatus {
      width: 150px;
    }
  }
  .workflowListWrap .listItem .columnName {
    display: flex;
    align-items: center;
    .workflowInfoWrap {
      width: 100%;
    }
    .iconWrap {
      align-items: center;
      border-radius: 5px;
      display: flex;
      height: 36px;
      justify-content: center;
      width: 36px;
      .icon {
        font-size: 24px;
      }
    }
  }
`;

interface WorkflowConflictDialogProps {
  visible: boolean;
  list: HistoryWorkflowConflict[];
  totalCount: number;
  checked: string[];
  submitting: boolean;
  onCheckedChange: (checked: string[]) => void;
  onMove: () => void;
  onNotMove: () => void;
}

export function WorkflowConflictDialog(props: WorkflowConflictDialogProps) {
  const { visible, list, totalCount, checked, submitting, onCheckedChange, onMove, onNotMove } = props;
  const workflowTypeOf = (item: HistoryWorkflowConflict) =>
    getFlowTypeStyle(item.process.child ? 'subprocess' : item.process.startAppType);

  return (
    <Modal
      className="checkedWorkflowDialog"
      rootClassName="addWorkflowDialogContainer"
      open={visible}
      mask={{ closable: true }}
      keyboard
      width={740}
      title={<span className="Font17 bold">{_l('%0 个工作流已在其他专属算力中', list.length)}</span>}
      footer={
        <div>
          <Button onClick={onNotMove}>{_l('不移动此列表')}</Button>
          <Button type="primary" className="mLeft8" loading={submitting} onClick={onMove}>
            {_l('移动（%0）', checked.length)}
          </Button>
        </div>
      }
      onOk={() => {}}
      onCancel={onNotMove}
    >
      <CheckedWorkflowWrap className="flexColumn minHeight0">
        <div className="Font13 textSecondary mBottom8">
          {_l('所选的 %0 个工作流中，有 %1 个已存在其他专属算力。请确认是否一并移动', totalCount, list.length)}
        </div>
        <div className="headerCon listItem mTop8">
          <div className="columnCheckbox">
            <Checkbox
              className="mRight12"
              checked={checked.length !== 0 && list.length === checked.length}
              indeterminate={checked.length > 0 && checked.length < list.length}
              value={list.map(item => item.id)}
              onChange={(event: CheckboxChangeEvent) =>
                onCheckedChange(event.target.checked ? list.map(item => item.id) : [])
              }
            />
          </div>
          <div className="columnName flex">{_l('工流程名称')}</div>
          <div className="columnType">{_l('类型')}</div>
          <div className="columnStatus">{_l('所属算力服务')}</div>
        </div>
        <ScrollView className="flex minHeight0 workflowListWrap">
          {list.map(item => (
            <div className="listItem" key={`checkedWorkflowList-${item.id}`}>
              <div className="columnCheckbox">
                <Checkbox
                  className="mRight12"
                  value={item.id}
                  checked={checked.includes(item.id)}
                  onChange={(event: CheckboxChangeEvent) =>
                    onCheckedChange(
                      !event.target.checked ? checked.filter(id => id !== item.id) : checked.concat(item.id),
                    )
                  }
                />
              </div>
              <div className="columnName flex">
                <IsAppAdmin
                  className="alignItemsCenter workflowInfoWrap"
                  appId={item.app.id}
                  appName={item.process.name}
                  defaultIcon={workflowTypeOf(item).iconName}
                  iconColor={workflowTypeOf(item).iconColor}
                  createType={2}
                />
              </div>
              <div className="columnType">{workflowTypeOf(item).text}</div>
              <div className="columnStatus textPrimary">{item.name}</div>
            </div>
          ))}
        </ScrollView>
      </CheckedWorkflowWrap>
    </Modal>
  );
}

export default WorkflowConflictDialog;
