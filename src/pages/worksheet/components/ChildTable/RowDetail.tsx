import React from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import PropTypes from 'prop-types';
import RecordInfoContext from 'worksheet/common/recordInfo/RecordInfoContext';
import CustomFields from 'src/components/Form';
import type DataFormat from 'src/components/Form/core/DataFormat';
import type { FormConditionRule } from 'src/components/Form/core/formUtils/types';
import type { FormQueryConfig } from 'src/components/Form/core/queryTypes';
import type { MasterData } from 'src/components/Form/core/types';
import type { EntranceRef } from 'src/components/Form/store/entranceTypes';
import { isRelateRecordTableControl } from 'src/utils/control';
import type { ControlValue, FormControl, RecordRow } from 'src/utils/controlTypes';

export interface RowDetailState {
  flag: number;
}

interface RowDetailFormRef extends EntranceRef {
  dataFormat: DataFormat | null;
  getSubmitData: (options?: Record<string, unknown>) => {
    fullData: FormControl[];
    error?: unknown;
  };
}

export interface RowDetailProps {
  widgetStyle?: Record<string, unknown> | undefined;
  ignoreLock?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  projectId?: string | undefined;
  appId?: string | undefined;
  controlName?: string | undefined;
  worksheetId?: string | undefined;
  controls?: FormControl[] | undefined;
  data: RecordRow;
  getMasterFormData?: (() => FormControl[]) | undefined;
  handleUniqueValidate?:
    ((controlId: string, value: ControlValue, rowId: string, backendCheck?: boolean) => void) | undefined;
  onSave?: ((row: RecordRow, updatedControlIds?: string[]) => void) | undefined;
  onClose?: (() => void) | undefined;
  openNextRecord?: (() => void) | undefined;
  onRulesLoad?: ((rules: FormConditionRule[]) => void) | undefined;
  searchConfig?: FormQueryConfig[] | undefined;
  sheetSwitchPermit?: HapApi.MD.Entity.Worksheet.SwitchPermitModel[] | undefined;
  isMobile?: boolean | undefined;
  isWorkflow?: boolean | undefined;
  from?: number | undefined;
  masterData?: MasterData | undefined;
  rules?: FormConditionRule[] | undefined;
  isDraft?: boolean | undefined;
}

export default class RowDetail extends React.Component<RowDetailProps, RowDetailState> {
  static override propTypes = {
    widgetStyle: PropTypes.shape({}),
    ignoreLock: PropTypes.bool,
    disabled: PropTypes.bool,
    className: PropTypes.string,
    projectId: PropTypes.string,
    controls: PropTypes.arrayOf(PropTypes.shape({})),
    data: PropTypes.shape({}),
    getMasterFormData: PropTypes.func,
    handleUniqueValidate: PropTypes.func,
    onSave: PropTypes.func,
    onClose: PropTypes.func,
  };

  static defaultProps = {
    controls: [],
    getMasterFormData: () => {},
    onSave: () => {},
    onClose: () => {},
  };

  constructor(props: RowDetailProps) {
    super(props);
    this.state = {
      flag: Math.random(),
    };
  }

  override componentDidUpdate(prevProps: RowDetailProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (
        this.props.data &&
        (this.props.data.rowid !== prevProps.data.rowid ||
          (prevProps.isMobile && !_.isEqual(this.props.data, prevProps.data)))
      ) {
        this.setState({
          flag: Math.random(),
        });
      }
    }
  }

  formcon = React.createRef<HTMLDivElement>();
  customwidget = React.createRef<RowDetailFormRef>();

  handleChange = () => {
    const { data, isMobile, onSave = () => {} } = this.props;

    if (!this.customwidget.current || isMobile) {
      return;
    }

    const submitData = this.customwidget.current.getSubmitData({ silent: true, noTriggerError: true });
    const dataFormat = this.customwidget.current.dataFormat;
    if (!dataFormat) return;
    const updateControlIds = dataFormat.getUpdateControlIds();
    const formdata = submitData.fullData;
    const row = formdata.reduce<Record<string, unknown>>((result, field) => {
      if (field.controlId) result[field.controlId] = field.value;
      return result;
    }, {});
    onSave({ ...data, ...row, empty: false }, updateControlIds);
  };

  // 三个开关都可省略（调用方有 handleSave()、handleSave(true)、handleSave(false, true) 几种写法），省略即 false
  handleSave = (nextContinue?: boolean, isSwitchSave?: boolean, ignoreAlert?: boolean) => {
    if (!this.customwidget.current) {
      return undefined;
    }

    if (this.formcon.current?.querySelector('.Progress--circle')) {
      alert(_l('附件正在上传，请稍后'), 3);
      return undefined;
    }

    const { data, onSave = () => {}, onClose = () => {}, openNextRecord = () => {} } = this.props;
    const submitData = this.customwidget.current.getSubmitData({ ignoreAlert });
    const dataFormat = this.customwidget.current.dataFormat;
    if (!dataFormat) return undefined;
    const updateControlIds = dataFormat.getUpdateControlIds();
    const formdata = submitData.fullData;

    if (submitData.error) {
      return false;
    } else {
      const row = formdata.reduce<Record<string, unknown>>((result, field) => {
        if (field.controlId) result[field.controlId] = field.value;
        return result;
      }, {});
      onSave({ ...data, ...row, empty: false }, updateControlIds);
      if (isSwitchSave) {
        return undefined;
      } else if (nextContinue) {
        this.setState({ flag: Math.random() }, () => {
          if (this.formcon.current) {
            const $firstText = this.formcon.current.querySelector(
              '.customFieldsContainer .customFormItem .customFormTextareaBox input.smallInput',
            );

            if ($firstText instanceof HTMLElement) {
              $firstText.click();
            }
          }
        });
        onClose();
        openNextRecord();
      } else {
        onClose();
      }
    }
    return undefined;
  };

  handleClose = () => {
    const { onClose = () => {} } = this.props;

    if (this.formcon.current?.querySelector('.Progress--circle')) {
      alert(_l('附件正在上传，请稍后'), 3);
      return;
    }

    onClose();
  };

  override render() {
    const {
      ignoreLock,
      disabled,
      worksheetId,
      projectId,
      controls = [],
      data,
      getMasterFormData = () => [],
      handleUniqueValidate = () => {},
      appId,
      onRulesLoad,
      searchConfig,
      sheetSwitchPermit,
      isMobile,
      isWorkflow,
      from,
      masterData,
      widgetStyle = {},
      rules,
      isDraft,
    } = this.props;
    const { flag } = this.state;
    const formdata = _.isEmpty(data)
      ? controls
      : controls
          .filter((c: FormControl) => !_.includes(['ownerid', 'caid', 'ctime', 'utime'], c.controlId))
          .map((c: FormControl) => ({
            ...c,
            value: (() => {
              const value = c.controlId ? data[c.controlId] : undefined;
              return _.includes([19, 23, 24], c.type) && value !== null && typeof value === 'object' && 'text' in value
                ? value['text']
                : value;
            })(),
            count: c.controlId ? data[`rq${c.controlId}`] : undefined,
          }));
    const recordId = data.rowid && data.rowid.startsWith('temp') ? undefined : data.rowid;
    return (
      <RecordInfoContext.Provider
        value={{
          recordBaseInfo: {
            appId,
            worksheetId,
            recordId: data.rowid,
          },
        }}
      >
        <div ref={this.formcon}>
          <CustomFields
            ignoreLock={ignoreLock}
            worksheetId={worksheetId}
            disabled={disabled}
            searchConfig={searchConfig}
            sheetSwitchPermit={sheetSwitchPermit}
            columnNumber={1}
            from={from === 21 ? 21 : isMobile && isWorkflow ? 3 : recordId ? 3 : 2}
            isDraft={isDraft}
            isCreate={false}
            recordId={recordId}
            ref={this.customwidget}
            masterData={masterData}
            data={formdata
              .map(c => ({
                ...c,
                fieldPermission: isRelateRecordTableControl(c) ? '000' : c.fieldPermission,
                controlPermissions: isRelateRecordTableControl(c) ? '000' : c.controlPermissions,
                isSubList: true,
              }))
              .filter(c => !_.includes([34].concat(_.get(window, 'shareState.isPublicForm') ? [48] : []), c.type))}
            getMasterFormData={getMasterFormData}
            flag={flag}
            projectId={projectId}
            appId={appId}
            checkCellUnique={(controlId: string, value: ControlValue, backendCheck?: boolean) =>
              handleUniqueValidate(controlId, value, data.rowid ?? '', backendCheck)
            }
            onChange={this.handleChange}
            onRulesLoad={onRulesLoad}
            ignoreSection
            widgetStyle={widgetStyle}
            rules={rules}
          />
        </div>
      </RecordInfoContext.Provider>
    );
  }
}
