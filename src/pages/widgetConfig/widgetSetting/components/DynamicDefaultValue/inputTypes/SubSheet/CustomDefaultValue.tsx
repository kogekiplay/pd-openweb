import { Component } from 'react';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Dialog } from 'ming-ui';
import ChildTable from 'worksheet/components/ChildTable';
import 'src/pages/widgetConfig/styled/style.less';
import { handleAdvancedSettingChange } from 'src/pages/widgetConfig/util/setting';
import type { FormControl } from 'src/utils/controlTypes';
import type { DynamicInputProps } from '../../dynamicTypes';

interface CustomDefaultValueProps extends DynamicInputProps {
  onClose: () => void;
  onOk?: (() => void) | undefined;
  appId?: string | undefined;
}
type DefaultRow = Record<string, unknown>;
interface CustomDefaultValueState {
  filterRows: DefaultRow[];
  rowData: DefaultRow[];
}
export default class CustomDefaultValue extends Component<CustomDefaultValueProps, CustomDefaultValueState> {
  constructor(props: CustomDefaultValueProps) {
    super(props);
    const { dynamicValue = [] } = props;
    const defaultValue = (dynamicValue[0] || {}).staticValue;
    let parsed: unknown;
    try {
      parsed = defaultValue ? JSON.parse(String(defaultValue)) : [];
    } catch {
      parsed = [];
    }
    const rows = Array.isArray(parsed)
      ? parsed.filter((row): row is DefaultRow => row !== null && typeof row === 'object' && !Array.isArray(row))
      : [];
    const rowData = rows.map(item => {
      const tempRowId = typeof item['rowid'] === 'string' && item['rowid'] ? item['rowid'] : `temp-${uuidv4()}`;
      return { ...item, rowid: tempRowId, allowedit: true, addTime: new Date().getTime() };
    });
    this.state = {
      filterRows: rows,
      rowData,
    };
  }

  override render() {
    const { onClose, data = {}, globalSheetInfo = {}, appId, onChange } = this.props;
    const { filterRows = [], rowData = [] } = this.state;
    const controls: FormControl[] = (data.relationControls || []).map(i => ({
      ...i,
      controlPermissions: i.controlPermissions || '111',
    }));
    // 游离子表（含尚未保存、dataSource 仍是临时 id 的子表）没有可配置业务规则的真实工作表，
    // 这里传入 controls 后 ChildTable 不会走 getWorksheetInfo 拿 rules，表格会自行请求 GetControlRules，
    // 对游离子表属于无效请求，直接关闭规则加载。
    const isBlankSubList =
      _.get(data, 'advancedSetting.detailworksheettype') === '2' || _.includes(data.dataSource, '-');
    return (
      <Dialog
        visible={true}
        className="CustomDefaultValueDialog"
        title={<span className="Bold">{_l('自定义默认值')}</span>}
        width={1000}
        onCancel={onClose}
        onOk={() => {
          // 自定义默认值场景忽略一切校验（手机/证件格式、必填、唯一、业务规则均不拦截），输入原样保留为默认值。
          const sources = filterRows.length
            ? [{ rcid: '', cid: '', staticValue: JSON.stringify(filterRows), isAsync: false }]
            : [];
          onChange(
            handleAdvancedSettingChange(data, { defsource: JSON.stringify(sources), dynamicsrc: '', defaulttype: '0' }),
          );

          onClose();
        }}
      >
        <div style={{ minHeight: 74, margin: '10px 0 var(--space-3)' }}>
          <ChildTable
            initRowIsCreate={false}
            enableRules={!isBlankSubList}
            disableValidate
            from={0}
            control={{
              ...data,
              value: JSON.stringify(rowData),
              advancedSetting: {
                allowadd: '1',
                allowsingle: '1',
                allowedit: '1',
                allowcancel: '1',
                rowheight: '0',
                blankrow: '1',
                allowcopy: '1',
                searchrange: '1',
                openstatistics: '0',
                statisticsseting: '[]',
              },
            }}
            controls={controls}
            projectId={globalSheetInfo.projectId}
            appId={appId || globalSheetInfo.appId}
            onChange={({ rows = [] }: { rows?: DefaultRow[] }) => {
              const filterRows = rows.map(row => {
                const itemValue: DefaultRow = {};
                (data.showControls || [])
                  .concat(['pid', 'rowid', 'childrenids'])
                  .map((controlId: string) => (itemValue[controlId] = row[controlId] ?? ''));
                return itemValue;
              });
              this.setState({ filterRows });
            }}
          />
        </div>
      </Dialog>
    );
  }
}
