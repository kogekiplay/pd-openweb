import React from 'react';
import cx from 'classnames';
import _, { omit } from 'lodash';
import PropTypes from 'prop-types';
import { getTitleTextFromControls } from 'src/utils/control';
import { FILTER_CONDITION_TYPE } from '../../enum';
import { controlCoverId, relatedName, relatedRecord, selectedRows, stringValues } from './dynamicBoundary';
import type { EditorValueProps, RelatedFilterRecord, RelatedFilterState } from './dynamicTypes';

function safeParse(str: string): unknown {
  try {
    const result: unknown = JSON.parse(str);
    return result;
  } catch (err) {
    console.error(err);
    return {};
  }
}

export default class RelateRecord extends React.Component<EditorValueProps, RelatedFilterState> {
  static override propTypes = {
    disabled: PropTypes.bool,
    onChange: PropTypes.func,
    control: PropTypes.shape({}),
    fullValues: PropTypes.arrayOf(PropTypes.string),
  };

  static defaultProps = {
    fullValues: [],
  };

  constructor(props: EditorValueProps) {
    super(props);
    let { fullValues = [] } = props;
    this.state = {
      records: _.map(stringValues(fullValues), r => relatedRecord(safeParse(r))),
      selectRecordVisible: false,
    };
  }

  get selectSingle() {
    const { type, control = {} } = this.props;
    return control.enumDefault === 1 && _.includes([FILTER_CONDITION_TYPE.ARREQ, FILTER_CONDITION_TYPE.ARRNE], type);
  }

  addRecord = (rawRecords: unknown) => {
    const selectedRecords = selectedRows(rawRecords);
    const { control, onChange } = this.props;
    const { records } = this.state;
    const { relationControls } = control;
    const newRecords = (
      this.selectSingle
        ? []
        : records.filter((r: RelatedFilterRecord) => !_.find(selectedRecords, sr => r.id === sr.rowid))
    ).concat(
      selectedRecords.map(sr => ({
        name: relatedName(getTitleTextFromControls(relationControls, sr)),
        id: sr.rowid,
      })),
    );
    this.setState({
      records: newRecords,
    });
    onChange({ values: newRecords.map(r => r.id), fullValues: newRecords.map(v => JSON.stringify(v)) });
  };

  removeRecord = (record: RelatedFilterRecord) => {
    const { onChange } = this.props;
    const { records } = this.state;
    const newRecords = records.filter((r: RelatedFilterRecord) => r.id !== record.id);
    this.setState({
      records: newRecords,
    });
    onChange({ values: newRecords.map(r => r.id), fullValues: newRecords.map(v => JSON.stringify(v)) });
  };

  override render() {
    const { control, worksheetId, disabled } = this.props;
    const { records } = this.state;
    return (
      <div className="worksheetFilterRelateRecordCondition">
        <div
          className={cx('recordsCon', { disabled })}
          onClick={() => {
            import('src/components/SelectRecords').then(({ selectRecords }) => {
              selectRecords({
                control: {
                  ...control,
                  advancedSetting: omit(control.advancedSetting, 'filters'),
                },
                getType: 32,
                allowNewRecord: false,
                multiple: !this.selectSingle,
                coverCid: controlCoverId(control),
                filterRowIds: records.map((r: RelatedFilterRecord) => r.id),
                showControls: control.showControls,
                appId: control.appId,
                viewId: control.viewId,
                worksheetId: control.dataSource,
                controlId: control.controlId,
                parentWorksheetId: worksheetId,
                visible: true,
                onOk: this.addRecord,
              });
            });
          }}
        >
          {records.length ? (
            records.map((record, index: number) => (
              <div className="recordItem" key={index}>
                <i className="icon icon-link-worksheet"></i>
                <span className="recordname WordBreak">{record.name}</span>
                <span
                  className="remove"
                  onClick={e => {
                    e.stopPropagation();
                    this.removeRecord(record);
                  }}
                >
                  <i className="icon icon-delete"></i>
                </span>
              </div>
            ))
          ) : (
            <span className="placeholder">{_l('请选择')}</span>
          )}
        </div>
      </div>
    );
  }
}
