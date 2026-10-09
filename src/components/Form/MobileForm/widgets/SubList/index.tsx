import _ from 'lodash';
import PropTypes from 'prop-types';
import type { ChildTableChange } from 'worksheet/components/ChildTable/publicTypes';
import type { FormControl, RecordRow } from 'src/utils/controlTypes';
import { storeObject, storeRows } from 'src/utils/fieldStoreBoundary';
import ChildTable from '../../components/ChildTable';

function actionIds(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export default function SubList(props) {
  const {
    recordId,
    from,
    registerCell,
    worksheetId,
    formData,
    disabled,
    formDisabled,
    appId,
    initSource,
    viewIdForPermit,
    sheetSwitchPermit,
    flag,
    isDraft,
    onChange = () => {},
  } = props;
  const control = { ...props };
  const masterFormData = formData
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
    .filter(c => !!c.value);

  const debounceChange = _.debounce(onChange, 500);

  const handleChange = ({ rows, originRows = [], lastAction }: ChildTableChange, value) => {
    const onChangeData = lastAction.type === 'UPDATE_ROW' && lastAction['asyncUpdate'] ? debounceChange : onChange;
    const isAdd = !recordId;

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
          'UPDATE_TREE_TABLE_VIEW_DATA',
          'UPDATED_TREE_NODE_EXPANSION',
          'UPDATE_TREE_TABLE_VIEW_ITEM',
          'UPDATE_TREE_TABLE_VIEW_TREE_MAP',
          'WORKSHEET_SHEETVIEW_APPEND_ROWS',
          'UPDATE_PAGINATION',
          'UPDATE_SORT_CONFIG',
          'UPDATE_FILTER_CONTROLS',
        ],
        lastAction.type,
      ) &&
      !/^@/.test(lastAction.type)
    ) {
      if (isAdd) {
        onChangeData({
          isAdd: true,
          rows: rows.filter(row => !row.empty),
        });
      } else if (lastAction.type === 'CLEAR_AND_SET_ROWS') {
        onChangeData({
          deleted: originRows.map((r: RecordRow) => r.rowid),
          updated: rows.map((r: RecordRow) => r.rowid),
          rows: rows,
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

        onChangeData({
          deleted,
          updated,
          rows: rows,
        });
      }
    }
  };

  return (
    <div className="mobileSubList">
      <ChildTable
        showSearch
        showExport
        initSource={initSource}
        registerCell={registerCell}
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
          formData: masterFormData,
        }}
        onChange={handleChange}
        mobileIsEdit={!disabled && !formDisabled}
      />
    </div>
  );
}

SubList.propTypes = {
  from: PropTypes.number,
  formDisabled: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({}), PropTypes.arrayOf(PropTypes.shape({}))]),
  worksheetId: PropTypes.string,
  recordId: PropTypes.string,
  dataSource: PropTypes.string,
  formData: PropTypes.arrayOf(PropTypes.shape({})),
  registerCell: PropTypes.func,
  onChange: PropTypes.func,
};
