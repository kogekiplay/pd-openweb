import { useEffect, useRef, useState } from 'react';
import { Button, InputNumber, Modal, Switch } from 'ming-ui/antd-components';
import worksheetAjax from 'src/api/worksheet';
import { buriedUpgradeVersionDialog } from 'src/components/upgradeVersion';
import { VersionProductType } from 'src/utils/domain/shared/productFeatures';

export interface PrintCountWorksheetInfo {
  worksheetId: string;
  appId: string;
  projectId: string;
  advancedSetting?: Record<string, string | undefined> | undefined;
}
interface SettingCardProps {
  worksheetInfo: PrintCountWorksheetInfo;
  disabled: boolean;
  onChange: (value: PrintCountWorksheetInfo) => void;
}
export function PrintCountSettingCard({ worksheetInfo, disabled, onChange }: SettingCardProps) {
  const { worksheetId, appId, projectId, advancedSetting = {} } = worksheetInfo;
  const enabled = advancedSetting['print_count_enabled'] === '1';
  const [printCountEnabled, setPrintCountEnabled] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => setPrintCountEnabled(enabled), [enabled, worksheetId]);
  const updateEnabled = async (checked: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setPrintCountEnabled(checked);
    const setting = { print_count_enabled: checked ? '1' : '0' };
    try {
      const result: unknown = await worksheetAjax.editWorksheetSetting({
        workSheetId: worksheetId,
        appId,
        projectId,
        advancedSetting: setting,
        editAdKeys: ['print_count_enabled'],
      });
      if (!result) throw new Error('Unable to save print count setting');
      onChange({ ...worksheetInfo, advancedSetting: { ...advancedSetting, ...setting } });
    } catch {
      setPrintCountEnabled(!checked);
      alert(_l('修改失败，请稍后再试'), 2);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <div className="flexRow alignItemsCenter mBottom20">
      <div className="flex">
        <div className="Font13 Bold">{_l('统计打印次数')}</div>
        <div className="Font13 textTertiary mTop4">
          {_l('开启后，在记录打印菜单中显示当前记录下各模板的已打印次数。')}
        </div>
      </div>
      <Switch
        size="small"
        checked={printCountEnabled}
        disabled={disabled || saving}
        onChange={checked => {
          void updateEnabled(checked);
        }}
      />
      {disabled && (
        <Button type="link" onClick={() => buriedUpgradeVersionDialog(projectId, VersionProductType.printCountLimit)}>
          {_l('升级')}
        </Button>
      )}
    </div>
  );
}
interface LimitModalProps {
  value?: number | null | undefined;
  defaultValue?: number | undefined;
  onSave: (value: number | null, previousCount?: number) => Promise<unknown> | void;
  onCancel: () => void;
}
export function confirmDisableTemplatePrintLimit(onOk: () => Promise<unknown> | void) {
  Modal.confirm({
    centered: true,
    width: 560,
    title: _l('确认关闭打印次数限制？'),
    content: _l('关闭后，该模板将不再限制打印次数。已累计的打印次数会保留，重新开启限制后继续生效。'),
    okText: _l('确认'),
    cancelText: _l('取消'),
    okButtonProps: { danger: true },
    onOk,
  });
}
export function PrintCountLimitModal({ value, defaultValue, onSave, onCancel }: LimitModalProps) {
  const initiallyEnabled = value !== undefined && value !== null;
  const initialCount = Number(defaultValue ?? value);
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [count, setCount] = useState(initialCount > 0 ? initialCount : 1);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const save = async (nextValue: number | null, previousCount?: number) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave(nextValue, previousCount);
      onCancel();
    } catch {
      alert(_l('修改失败，请稍后再试'), 2);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      width={560}
      title={_l('打印次数限制')}
      okText={_l('保存')}
      cancelText={_l('取消')}
      okDisabled={enabled && !count}
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={() => {
        void save(enabled ? count : null);
      }}
    >
      <p className="Font13 textSecondary">
        {_l('开启后，将限制当前模板对同一条记录的打印次数。达到限制次数后，该记录将无法继续使用此模板打印。')}
      </p>
      <div className="flexRow alignItemsCenter mTop20 mBottom20">
        <span className="flex">{_l('启用限制')}</span>
        <Switch
          size="small"
          checked={enabled}
          disabled={saving}
          onChange={checked => {
            if (!checked && initiallyEnabled) {
              confirmDisableTemplatePrintLimit(() => save(null, count));
              return;
            }
            setEnabled(checked);
          }}
        />
      </div>
      {enabled && (
        <div className="flexRow alignItemsCenter">
          <span className="mRight20">{_l('限制次数')}</span>
          <InputNumber
            min={1}
            max={10000}
            precision={0}
            controls={false}
            suffix={_l('次')}
            value={count}
            onChange={next => setCount(next ?? 0)}
          />
        </div>
      )}
    </Modal>
  );
}
