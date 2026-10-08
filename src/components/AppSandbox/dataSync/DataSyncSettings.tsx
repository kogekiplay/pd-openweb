import { Fragment, useState } from 'react';
import cx from 'classnames';
import { ScrollView, SvgIcon } from 'ming-ui';
import { InputNumber, Select } from 'ming-ui/antd-components';
import type { SandboxAppSettings } from 'src/utils/domain/app/sandbox';
import {
  MAX_SYNC_COUNT_PER_APP,
  MAX_SYNC_COUNT_PER_SHEET,
  updateAppDataSyncType,
  updateEntitySyncCount,
} from 'src/utils/domain/app/sandbox';
import { getTranslateInfo } from 'src/utils/services/app';
import './DataSyncSettings.less';

export type SandboxSyncSettings = Omit<SandboxAppSettings, 'entities'> & {
  appName?: string;
  iconUrl?: string;
  iconColor?: string;
  entities: Array<SandboxAppSettings['entities'][number] & { worksheetName?: string }>;
};

const getDataSyncTypeOptions = () =>
  [
    { label: _l('仅同步应用结构'), value: 0 },
    { label: _l('每张表最多同步10000条记录'), value: 1 },
    { label: _l('自定义同步的记录数量'), value: 2 },
  ].map(item => ({ ...item, className: 'processOptionWrapper' }));

const getSheetCountOptions = () => [
  { label: _l('不同步'), count: 0 },
  { label: 50, count: 50 },
  { label: 100, count: 100 },
  { label: _l('全部'), count: 'all' as const, isAll: true },
  { label: _l('自定义'), count: -1, isCustom: true },
];

export default function DataSyncSettings({
  list = [],
  onChange,
}: {
  list?: SandboxSyncSettings[];
  onChange: (list: SandboxSyncSettings[]) => void;
}) {
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const dataSyncTypeOptions = getDataSyncTypeOptions();
  const sheetCountOptions = getSheetCountOptions();

  const handleTypeChange = (appId: string, exampleType: number) => {
    onChange(updateAppDataSyncType(list, appId, exampleType));
    if (exampleType === 2) setActiveAppId(appId);
  };

  const renderWorksheets = (item: SandboxSyncSettings) => (
    <ScrollView className="dataSyncSettings-worksheets">
      {(item.entities || []).map(entity => (
        <div className="dataSyncSettings-row mBottom10" key={entity.worksheetId}>
          <div className="dataSyncSettings-left">
            <div className="mLeft35">{entity.worksheetName}</div>
            <div className="Font12 textTertiary">{`（${entity.totalRecordNum}）`}</div>
          </div>
          <div className="dataSyncSettings-right pLeft4">
            {sheetCountOptions.map(option => {
              const active = option.isCustom
                ? option.isCustom === entity.isCustom
                : option.isAll
                  ? option.isAll === entity.isAll
                  : option.count === entity.count;
              return (
                <div
                  className={cx('dataSyncSettings-countOption', { active })}
                  key={option.count}
                  onClick={() => onChange(updateEntitySyncCount(list, item.appId, entity.worksheetId, option))}
                >
                  {option.label}
                </div>
              );
            })}
            {entity.isCustom && (
              <InputNumber<number>
                className="dataSyncSettings-customInput"
                controls={false}
                max={MAX_SYNC_COUNT_PER_SHEET}
                min={0}
                placeholder={_l('请输入')}
                value={typeof entity.count === 'number' && entity.count !== -1 ? entity.count : null}
                onChange={count =>
                  onChange(
                    updateEntitySyncCount(list, item.appId, entity.worksheetId, { count: count ?? 0, isCustom: true }),
                  )
                }
              />
            )}
          </div>
        </div>
      ))}
    </ScrollView>
  );

  return (
    <div className="dataSyncSettings">
      {list.map(item => (
        <Fragment key={item.appId}>
          <div className="dataSyncSettings-row" data-app-id={item.appId}>
            <div className="dataSyncSettings-left">
              <div className="dataSyncSettings-icon mRight15" style={{ backgroundColor: item.iconColor }}>
                <SvgIcon fill="var(--color-white)" size={14} url={item.iconUrl} />
              </div>
              <div className="flex ellipsis pRight10">
                {getTranslateInfo(item.appId, null, item.appId).name || item.appName}
              </div>
            </div>
            <div className="dataSyncSettings-right">
              <Select
                className="dataSyncSettings-select"
                disabled={item.sandboxDataExists || !item.entities?.length}
                options={dataSyncTypeOptions}
                value={!item.entities?.length ? _l('该应用下没有工作表') : item.exampleType}
                onChange={exampleType => handleTypeChange(item.appId, Number(exampleType))}
              />
              <span
                className={cx('mLeft10', {
                  textSecondary: item.selectedCount > 0 && item.selectedCount <= MAX_SYNC_COUNT_PER_APP,
                  overMax: item.selectedCount > MAX_SYNC_COUNT_PER_APP,
                })}
              >
                {item.exampleType === 2 && _l('已选 %0 行（最大5万行）', item.selectedCount || 0)}
              </span>
              {activeAppId !== item.appId && item.exampleType === 2 && (
                <span
                  className="colorPrimary mLeft15 hoverColorPrimaryLight Hand"
                  onClick={() => setActiveAppId(item.appId)}
                >
                  {_l('设置')}
                </span>
              )}
            </div>
          </div>
          {activeAppId === item.appId && item.exampleType === 2 && renderWorksheets(item)}
        </Fragment>
      ))}
    </div>
  );
}
