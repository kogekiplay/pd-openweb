import { Modal } from 'ming-ui/antd-components';
import type { BatchPrintError } from './recordInfo/RecordForm/RecordPrint/printCount';

interface Props extends BatchPrintError {
  zIndex?: number | undefined;
  onClose: () => void;
}
export default function BatchPrintErrorModal({ templateName, recordNames, zIndex, onClose }: Props) {
  return (
    <Modal
      open
      width={680}
      {...(zIndex === undefined ? {} : { zIndex })}
      title={_l('批量打印：%0', templateName)}
      okText={_l('关闭')}
      cancelButtonProps={{ style: { display: 'none' } }}
      onOk={onClose}
      onCancel={onClose}
    >
      <p className="Font13 textTertiary">
        <strong>{recordNames.length}</strong> {_l('条记录因已达打印上限，未加入本次打印任务。')}
      </p>
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {recordNames.map((name, index) => (
          <div key={index} className="pTop16 pBottom16 ellipsis borderBottom" title={name}>
            {name}
          </div>
        ))}
      </div>
    </Modal>
  );
}
