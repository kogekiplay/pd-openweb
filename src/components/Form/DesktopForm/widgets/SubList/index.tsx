import React from 'react';
import _, { find, get } from 'lodash';
import PropTypes from 'prop-types';
import RecordInfoContext from 'worksheet/common/recordInfo/RecordInfoContext';
import ChildTable from 'worksheet/components/ChildTable';
import type { ChildTableChange } from 'worksheet/components/ChildTable/publicTypes';
import type { FormControl, RecordRow } from 'src/utils/controlTypes';
import { storeObject, storeRows } from 'src/utils/fieldStoreBoundary';
import { WidgetEventHelper } from '../../../core/useFormEventManager';

function actionIds(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export default class SubList extends React.Component<any, any> {
  declare eventHelper: WidgetEventHelper;

  static override contextType = RecordInfoContext;
  static override propTypes = {
    from: PropTypes.number,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({})]),
    worksheetId: PropTypes.string,
    recordId: PropTypes.string,
    dataSource: PropTypes.string,
    formData: PropTypes.arrayOf(PropTypes.shape({})),
    registerCell: PropTypes.func,
    onChange: PropTypes.func,
  };

  childTable = React.createRef<React.ElementRef<typeof ChildTable>>();

  constructor(props) {
    super(props);
    this.debounceChange = _.debounce(this.props.onChange, 300);
    this.eventHelper = new WidgetEventHelper(props.formItemId);
  }

  handleChange = ({ rows, originRows = [], lastAction }: ChildTableChange, mode?: unknown) => {
    if (mode === 'childTableDialog') {
      if (!this.childTable.current) return;

      this.childTable.current.store.dispatch({
        type: 'FORCE_SET_OUT_ROWS',
        rows,
      });
    }

    const { value, recordId, onChildTableLoaded = () => {} } = this.props;
    // 子表导入场景这里可以异化，导入完成再调用 onChange
    const onChange =
      lastAction.type === 'UPDATE_ROW' && lastAction['asyncUpdate'] ? this.debounceChange : this.props.onChange;

    const isAdd = !recordId;

    if (!isAdd && lastAction.type === 'INIT_ROWS') {
      onChildTableLoaded();
    }

    if (
      !_.includes(
        [
          'INIT_ROWS',
          'LOAD_ROWS',
          'UPDATE_BASE_LOADING',
          'UPDATE_DATA_LOADING',
          'UPDATE_BASE',
          'UPDATE_CELL_ERRORS',
          'FORCE_SET_OUT_ROWS',
          'RESET',
          'RESET_TREE',
          'UPDATE_TREE_TABLE_VIEW_DATA',
          'UPDATED_TREE_NODE_EXPANSION',
          'UPDATE_TREE_TABLE_VIEW_ITEM',
          'UPDATE_TREE_TABLE_VIEW_TREE_MAP',
          'WORKSHEET_SHEETVIEW_APPEND_ROWS',
          'UPDATE_PAGINATION',
          'RESET_CHANGES',
          'UPDATE_SORT_CONFIG',
          'UPDATE_FILTER_CONTROLS',
        ],
        lastAction.type,
      ) &&
      !/^@/.test(lastAction.type)
    ) {
      if (lastAction.type === 'ADD_ROWS' && find(storeRows(lastAction['rows']), row => row.isAddByTree)) {
        return;
      }

      if (isAdd) {
        onChange({
          isAdd: true,
          disabledRuleSet: get(lastAction, 'isSetValueFromRule'),
          rows: rows.filter(row => !row.empty),
        });
      } else if (lastAction.type === 'CLEAR_AND_SET_ROWS') {
        onChange({
          deleted: get(lastAction, 'isSetValueFromEvent')
            ? value.deleted || lastAction['deleted'] || []
            : originRows.map((r: RecordRow) => r.rowid),
          updated: rows.map((r: RecordRow) => r.rowid),
          rows: rows,
          disabledRuleSet: get(lastAction, 'isSetValueFromRule'),
        });
      } else {
        let deleted: string[] = [];
        let updated: string[] = [];

        try {
          deleted = actionIds(storeObject(value)?.['deleted'] || lastAction['deleted']);
          updated = actionIds(storeObject(value)?.['updated'] || lastAction['updated']);
        } catch (err) {
          console.log(err);
        }

        if (lastAction.type === 'DELETE_ROW') {
          deleted = _.uniq(deleted.concat(actionIds(lastAction['rowid']))).filter(id => !/^(temp|default)/.test(id));
        } else if (lastAction.type === 'DELETE_ROWS') {
          deleted = _.uniq(deleted.concat(actionIds(lastAction['rowIds']))).filter(id => !/^(temp|default)/.test(id));
        } else if (lastAction.type === 'ADD_ROW' || (lastAction.type === 'UPDATE_ROW' && !lastAction['noRealUpdate'])) {
          updated = _.uniq(
            updated.concat(
              lastAction.type === 'UPDATE_ROW'
                ? actionIds(storeObject(lastAction['value'])?.['rowid'] || lastAction['rowid'])
                : actionIds(lastAction['rowid']),
            ),
          );
        } else if (lastAction.type === 'UPDATE_ROWS' && !lastAction['noRealUpdate']) {
          updated = _.uniq(updated.concat(actionIds(lastAction['rowIds'])));
        } else if (lastAction.type === 'ADD_ROWS') {
          updated = _.uniq(
            updated.concat(storeRows(lastAction['rows']).flatMap(row => (row.rowid ? [row.rowid] : []))),
          );
        }

        onChange({
          deleted,
          updated,
          rows: rows,
        });
      }
    }
  };

  override componentDidMount() {
    // 子表 Tab 焦点：Enter 新建一行并进入表格内部键盘逻辑
    this.eventHelper.subscribe(data => {
      const { triggerType } = data;

      if (triggerType === 'Enter') {
        try {
          const childTableWrapper = this.childTable.current;
          const innerTable = childTableWrapper && childTableWrapper.store && childTableWrapper.store.ref;

          if (innerTable && typeof innerTable.handleAddRowByLine === 'function') {
            innerTable.handleAddRowByLine();
          }
        } catch (err) {
          console.log(err);
        }
      }
    });
  }

  override componentWillUnmount() {
    if (this.eventHelper) {
      this.eventHelper.destroy();
    }
  }

  override render() {
    const {
      from,
      formItemId,
      registerCell,
      worksheetId,
      recordId,
      formData,
      appId,
      initSource,
      viewIdForPermit,
      sheetSwitchPermit,
      flag,
      isDraft,
    } = this.props;
    const control = { ...this.props };
    return (
      <div className="mdsubList">
        {
          <ChildTable
            formItemId={formItemId}
            showSearch
            showExport
            ref={this.childTable}
            initSource={initSource}
            registerCell={cell => {
              if (typeof registerCell === 'function') {
                registerCell(cell);
              }
            }}
            appId={appId}
            viewId={viewIdForPermit}
            from={from}
            control={control}
            recordId={recordId}
            sheetSwitchPermit={sheetSwitchPermit}
            flag={flag}
            isDraft={isDraft}
            masterData={{
              controlId: control.controlId,
              recordId,
              worksheetId,
              appId,
              formData: formData
                .map((c: FormControl) =>
                  _.pick(c, [
                    'controlId',
                    'type',
                    'value',
                    'options',
                    'attribute',
                    'enumDefault',
                    'sourceControl',
                    'sourceControlType',
                  ]),
                )
                .filter(c => !!c.value),
            }}
            onChange={this.handleChange}
          />
        }
      </div>
    );
  }
}
