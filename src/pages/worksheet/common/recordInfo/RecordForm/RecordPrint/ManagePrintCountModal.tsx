import { useState } from 'react';
import { Button, Modal } from 'ming-ui/antd-components';
import worksheetAjax from 'src/api/worksheet';
import type { PrintContext, TemplatePrintCount } from './printCount';

export interface ManagedPrintTemplate extends TemplatePrintCount {
  name: string;
}
interface Props extends PrintContext {
  templates: ManagedPrintTemplate[];
  rowId: string;
  onReset: () => void;
  onCancel: () => void;
}
export default function ManagePrintCountModal({ templates, projectId, worksheetId, rowId, onReset, onCancel }: Props) {
  const [resetting, setResetting] = useState<string | undefined>();
  const reset = (template: ManagedPrintTemplate) => {
    Modal.confirm({
      centered: true,
      width: 560,
      title: _l('确认重置“%0”的打印次数吗？', template.name),
      content: _l('仅重置当前模板在本记录下的打印次数，记录总次数和其他模板的打印次数不变。'),
      okText: _l('确认'),
      cancelText: _l('取消'),
      okButtonProps: { danger: true },
      onOk: async () => {
        setResetting(template.printId);
        try {
          const result: unknown = await worksheetAjax.resetTemplatePrintCount({
            projectId,
            worksheetId,
            printId: template.printId,
            rowId,
          });
          if (!result) throw new Error('Unable to reset print count');
          onReset();
        } catch {
          alert(_l('重置失败，请稍后再试'), 2);
        } finally {
          setResetting(undefined);
        }
      },
    });
  };
  return (
    <Modal open width={680} footer={null} title={_l('管理模板打印次数')} onCancel={onCancel}>
      <p className="Font13 textSecondary">{_l('仅重置当前模板次数，记录总计打印次数不减少')}</p>
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {templates.map(template => (
          <div key={template.printId} className="flexRow alignItemsCenter pTop16 pBottom16 borderBottom">
            <span className="flex ellipsis mRight16" title={template.name}>
              {template.name}
            </span>
            <strong>
              {template.printCount}/{template.printLimitCount}
            </strong>
            <Button
              size="small"
              className="mLeft16"
              loading={resetting === template.printId}
              disabled={template.printCount === 0 || resetting !== undefined}
              onClick={() => reset(template)}
            >
              {_l('重置')}
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
