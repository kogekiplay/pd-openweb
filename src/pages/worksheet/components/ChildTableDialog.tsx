import { Fragment, useEffect, useRef, useState } from 'react';
import { useKey } from 'react-use';
import cx from 'classnames';
import _, { get, includes } from 'lodash';
import styled, { createGlobalStyle } from 'styled-components';
import { Button, Dialog, Modal } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import functionWrap from 'ming-ui/components/FunctionWrap';
import sheetAjax from 'src/api/worksheet';
import worksheetAjax from 'src/api/worksheet';
import ChildTable from 'worksheet/components/ChildTable';
import type {
  ChildTableCellRef,
  ChildTableControl,
  ChildTableRefresh,
} from 'worksheet/components/ChildTable/publicTypes';
import { ROW_HEIGHT } from 'worksheet/constants/enum';
import { onValidator } from 'src/components/Form/core/formUtils';
import type { FormQueryConfig } from 'src/components/Form/core/queryTypes';
import type { FormRule } from 'src/components/Form/core/types';
import { formatControlToServer } from 'src/components/Form/core/utils';
import { formatSearchConfigs } from 'src/pages/widgetConfig/util';
import { getSubListErrorOfStore } from 'src/pages/worksheet/components/ChildTable/utils';
import { emitter } from 'src/utils/common';
import type { FormControl, RecordRow } from 'src/utils/controlTypes';
import type { FieldStoreMasterData } from 'src/utils/subListStoreTypes';

const Con = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const IconBtn = styled.span`
  color: var(--color-text-tertiary);
  cursor: pointer;
  display: inline-block;
  height: 28px;
  font-size: var(--font-2xl);
  line-height: 28px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  &:hover {
    background: var(--color-background-hover);
  }
`;

const Header = styled.div`
  height: 50px;
  padding: 0 var(--space-6);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  .inner {
    width: 100%;
  }
  .main {
    font-size: 17px;
    color: var(--color-text-title);
    font-weight: bold;
  }
  .split {
    font-size: var(--font-lg);
    margin: 0 var(--space-2);
    color: var(--color-text-tertiary);
  }
  .sec {
    font-size: 17px;
    color: var(--color-text-secondary);
    max-width: 600px;
    &:hover {
      color: var(--color-text-title);
    }
  }
  .openInNewTab {
    cursor: pointer;
    color: var(--color-text-tertiary);
    font-size: var(--font-md);
    margin-left: 6px;
    line-height: 18px;
    height: 18px;
  }
  .flexCenter {
    display: flex;
    align-items: center;
  }
`;
const Content = styled.div`
  position: relative;
  overflow: hidden;
  padding: 0 25px 36px;
  flex: 1;
  display: flex;
  flex-direction: column;
  .relateRecordTable {
    height: 100%;
  }
  .tableCon {
    flex: 1;
  }
  .childTableCon {
    height: 100%;
  }
  .operates {
    display: none;
  }
  .selectedTip {
    padding: 0 var(--space-6);
    line-height: 50px !important;
    top: -50px !important;
  }
  .childTableCon .errorTip {
    width: calc(100% - 300px);
    height: 30px;
    top: -20px;
  }
  .childTableCon .errorTip {
    display: none;
  }
`;

// 子表从记录详情打开全屏时，弹窗顶部留出 115px，使遮罩后的「记录已修改」提示条可见
const FULL_SCREEN_TOP_OFFSET = 115;
const FullScreenTopOffsetStyle = createGlobalStyle`
  .mdModal.childTableFromRecordFullScreen {
    height: calc(100% - ${FULL_SCREEN_TOP_OFFSET}px) !important;
    vertical-align: bottom !important;
    position: relative !important;
  }
`;

function hasNoRelationRelateControl(controls: FormControl[]) {
  return !!_.find(controls, c => c.type === 29 && _.isEmpty(c.relationControls));
}

interface ChildTableActionLike {
  type?: string;
  rowid?: string | undefined;
  rowIds?: Array<string | undefined>;
  rows?: RecordRow[];
  deleted?: Array<string | undefined> | undefined;
}
interface DialogValue {
  deleted?: Array<string | undefined> | undefined;
  updated?: Array<string | undefined>;
  rows?: RecordRow[];
}

function isRow(value: unknown): value is RecordRow {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (!('rowid' in value) || value.rowid === undefined || typeof value.rowid === 'string')
  );
}

function isDialogAction(value: unknown): value is ChildTableActionLike {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const rowIds = (items: unknown): items is Array<string | undefined> =>
    Array.isArray(items) && items.every(item => item === undefined || typeof item === 'string');
  return (
    (!('type' in value) || value.type === undefined || typeof value.type === 'string') &&
    (!('rowid' in value) || value.rowid === undefined || typeof value.rowid === 'string') &&
    (!('rowIds' in value) || value.rowIds === undefined || rowIds(value.rowIds)) &&
    (!('deleted' in value) || value.deleted === undefined || rowIds(value.deleted)) &&
    (!('rows' in value) || value.rows === undefined || (Array.isArray(value.rows) && value.rows.every(isRow)))
  );
}

export interface ChildTableDialogProps {
  allowEdit?: boolean | undefined;
  openFrom?: string | undefined;
  isWorkflow?: boolean | undefined;
  initSource?: boolean | undefined;
  entityName?: string | undefined;
  rules?: FormRule[] | undefined;
  appId?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  from?: number | undefined;
  control: ChildTableControl;
  controls?: FormControl[] | undefined;
  recordId?: string | undefined;
  sheetSwitchPermit?: HapApi.MD.Entity.Worksheet.SwitchPermitModel[] | undefined;
  masterData?: FieldStoreMasterData | undefined;
  projectId?: string | undefined;
  mobileIsEdit?: boolean | undefined;
  searchConfig?: FormQueryConfig[] | undefined;
  valueChanged?: boolean | undefined;
  onClose?: (() => void) | undefined;
  title?: React.ReactNode;
}

export default function ChildTableDialog(props: ChildTableDialogProps) {
  const {
    allowEdit = false,
    openFrom,
    isWorkflow,
    initSource,
    entityName,
    rules,
    appId,
    worksheetId,
    viewId,
    from,
    control,
    controls = [],
    recordId,
    sheetSwitchPermit,
    masterData,
    projectId,
    mobileIsEdit,
    onClose = () => {},
  } = props;
  const cache = useRef<{
    comp?: ChildTableCellRef | undefined;
    isSaving?: boolean | undefined;
    reload?: ChildTableRefresh | undefined;
    [key: string]: unknown;
  }>({});
  const callFromDialog = openFrom !== 'cell';
  const rowHeight = ROW_HEIGHT[Number(_.get(control, 'advancedSetting.rowheight'))] || 34;
  const needUpdateControls = _.isEmpty(controls) || hasNoRelationRelateControl(controls);
  const [loading, setLoading] = useState(typeof props.searchConfig === 'undefined');
  const [searchConfig, setSearchConfig] = useState(props.searchConfig);
  const [changed, setChanged] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(openFrom !== 'cell');
  const [refreshFlag, setRefreshFlag] = useState(Math.random());
  const [value, setValue] = useState<DialogValue>({});
  const [isSaving, setIsSaving] = useState(false);
  const conHeight = window.innerHeight - 32 - 50 - (callFromDialog ? FULL_SCREEN_TOP_OFFSET : 0);
  const maxHeight = conHeight - 31 - 36 - 10;
  const maxShowRowCount = Math.floor((maxHeight - 30 - 40) / rowHeight);
  const width = window.innerWidth - 32 * 2 > 1600 ? 1600 : window.innerWidth - 32 * 2;

  function handleSave(close?: boolean | undefined) {
    function submit() {
      if (cache.current.isSaving) {
        return;
      }

      const store = cache.current.comp?.props.store;
      if (!store) return;
      const errors = getSubListErrorOfStore(store);
      const validatedResult = onValidator({ item: { ...control, value }, appId });

      if (validatedResult.errorType) {
        alert(validatedResult.errorText, 3);
        return;
      }

      if (!_.isEmpty(errors)) {
        alert(_l('请正确填写表单'), 3);
        return;
      } else {
        store.clearSubListErrors();
      }

      cache.current.isSaving = true;
      setIsSaving(true);
      worksheetAjax
        .updateWorksheetRow({
          appId,
          viewId,
          worksheetId,
          rowId: recordId,
          newOldControl: [formatControlToServer({ ...control, store, value: { ...value, controls } })],
        })
        .then(data => {
          if (!data.data) {
            if (data.resultCode === 22) {
              store.setUniqueError({ badData: data.badData });
            }

            cache.current.isSaving = false;
            setIsSaving(false);
          } else {
            alert(_l('保存成功'));
            cache.current.isSaving = false;
            setChanged(false);
            setIsSaving(false);
            if (close) {
              onClose();
            }

            setValue({});
            setRefreshFlag(Math.random());
            emitter.emit('RELOAD_RECORD_INFO', {
              worksheetId,
              recordId,
            });
          }
        });
    }

    setTimeout(submit, window.cellTextIsBlurring ? 1000 : 0);
  }

  useEffect(() => {
    if (loading) {
      sheetAjax.getQueryBySheetId({ worksheetId: control.dataSource }).then(queryRes => {
        setSearchConfig(formatSearchConfigs(queryRes));
        setLoading(false);
      });
    }
  }, []);
  useKey('/', e => {
    if (window.isMacOs ? e.metaKey : e.ctrlKey) {
      setIsFullScreen(old => !old);
      e.preventDefault();
      e.stopPropagation();
    }
  });
  return (
    <Modal
      visible
      keyboard
      type="fixed"
      verticalAlign="bottom"
      width={width}
      className={cx({ childTableFromRecordFullScreen: callFromDialog && isFullScreen })}
      closeIcon={<span />}
      bodyStyle={{ padding: 0, position: 'relative' }}
      fullScreen={isFullScreen}
      onCancel={onClose}
    >
      {callFromDialog && isFullScreen && <FullScreenTopOffsetStyle />}
      <Con>
        <Header>
          <div className="inner flexRow flexCenter">
            <div className="main ellipsis" title={control.controlName}>
              {control.controlName}
            </div>
            <div className="flex"></div>
            {openFrom === 'cell' && changed && (
              <Fragment>
                <Button
                  loading={isSaving}
                  className="mRight20 flex-shrink-0"
                  onClick={() => {
                    handleSave();
                    // try {
                    //   if (includes(['input', 'textarea'], document.activeElement.tagName.toLowerCase())) {
                    //     document.activeElement.blur();
                    //     document.querySelector('.recordInfoForm').dispatchEvent(new MouseEvent('mousedown'));
                    //   }
                    // } catch (err) {
                    //   console.error(err);
                    // }
                    // setTimeout(handleSave, window.cellTextIsBlurring ? 2000 : 0);
                  }}
                >
                  {_l('保存')}
                </Button>
              </Fragment>
            )}
            <Tooltip
              title={isFullScreen ? _l('退出') : _l('全屏')}
              shortcut={window.isMacOs ? '⌘/' : 'Ctrl+/'}
              placement="bottom"
            >
              <IconBtn
                className="ThemeHoverColor3"
                onClick={() => {
                  if (callFromDialog) {
                    onClose();
                  } else {
                    setIsFullScreen(!isFullScreen);
                  }
                }}
              >
                <i className={`icon icon-${isFullScreen ? 'worksheet_narrow' : 'worksheet_enlarge'}`}></i>
              </IconBtn>
            </Tooltip>
            {!callFromDialog && (
              <Tooltip title={_l('关闭')} shortcut={'Esc'} placement="bottom">
                <IconBtn
                  className={cx('hoverColorPrimary', { mRight10: changed })}
                  onClick={() => {
                    if (!changed || openFrom !== 'cell') {
                      onClose();
                      return;
                    }

                    Dialog.confirm({
                      title: _l('您是否保存此次更改'),
                      description: _l('当前有尚末保存的更改，您在离开当前页面前是否需要保存这些更改。'),
                      cancelType: 'ghost',
                      okText: _l('是，保存更改'),
                      cancelText: _l('否，放弃更改'),
                      onlyClose: true,
                      onOk: () => handleSave(true),
                      onCancel: onClose,
                    });
                  }}
                >
                  <i className="icon icon-close"></i>
                </IconBtn>
              </Tooltip>
            )}
          </div>
        </Header>
        <Content>
          <ChildTable
            valueChanged={props.valueChanged === true ? props.valueChanged : changed}
            needResetControls={needUpdateControls}
            registerCell={comp => {
              cache.current.comp = comp;
            }}
            refreshFlag={refreshFlag}
            mode="dialog"
            maxShowRowCount={maxShowRowCount}
            maxHeight={maxHeight}
            isWorkflow={isWorkflow}
            initSource={initSource}
            entityName={entityName}
            rules={rules}
            appId={appId}
            worksheetId={worksheetId}
            viewId={viewId}
            from={from}
            control={{
              ...(allowEdit
                ? control
                : {
                    ...control,
                    fieldPermission: '100',
                  }),
              worksheetId,
              addRefreshEvents: (_name, refresh) => {
                cache.current.reload = refresh;
              },
            }}
            controls={controls}
            recordId={recordId}
            searchConfig={searchConfig}
            sheetSwitchPermit={sheetSwitchPermit}
            masterData={{ recordId, controlId: control.controlId, ...masterData }}
            projectId={projectId}
            onChange={changedValues => {
              if (openFrom === 'cell') {
                const { rows } = changedValues;
                const lastAction: ChildTableActionLike = isDialogAction(changedValues.lastAction)
                  ? changedValues.lastAction
                  : {};

                if (
                  !_.includes(
                    [
                      'DELETE_ROW',
                      'DELETE_ROWS',
                      'ADD_ROW',
                      'UPDATE_ROW',
                      'UPDATE_ROWS',
                      'ADD_ROWS',
                      'CLEAR_AND_SET_ROWS',
                    ],
                    lastAction.type,
                  )
                ) {
                  return;
                }

                if (lastAction.type === 'ADD_ROWS' && _.find(lastAction.rows, row => row['isAddByTree'])) {
                  return;
                }

                setValue(oldValue => {
                  let deleted: DialogValue['deleted'] = oldValue.deleted === undefined ? [] : oldValue.deleted;
                  let { updated = [] } = oldValue;

                  if (lastAction.type === 'DELETE_ROW') {
                    deleted = Array.from(new Set(deleted.concat(lastAction.rowid))).filter(
                      id => !/^(temp|default)/.test(String(id)),
                    );
                  } else if (lastAction.type === 'DELETE_ROWS') {
                    deleted = Array.from(new Set(deleted.concat(lastAction.rowIds))).filter(
                      id => !/^(temp|default)/.test(String(id)),
                    );
                  } else if (lastAction.type === 'CLEAR_AND_SET_ROWS') {
                    deleted = lastAction.deleted;
                  }

                  if (lastAction.type === 'ADD_ROW' || lastAction.type === 'UPDATE_ROW') {
                    updated = Array.from(new Set(updated.concat(lastAction.rowid)));
                  } else if (lastAction.type === 'UPDATE_ROWS') {
                    updated = Array.from(new Set(updated.concat(lastAction.rowIds)));
                  } else if (lastAction.type === 'ADD_ROWS' || lastAction.type === 'CLEAR_AND_SET_ROWS') {
                    if (!lastAction.rows) throw new TypeError('Missing rows for child table edit');
                    updated = Array.from(new Set(updated.concat(lastAction.rows.map(row => row.rowid))));
                  }

                  return { ...oldValue, updated, deleted, rows };
                });
                setChanged(true);
              } else if (
                !includes(
                  [
                    'FORCE_SET_OUT_ROWS',
                    'UPDATE_BASE',
                    'INIT_ROWS',
                    'UPDATE_DATA_LOADING',
                    'LOAD_ROWS',
                    'UPDATE_PAGINATION',
                    'UPDATE_FILTER_CONTROLS',
                  ],
                  get(changedValues, 'lastAction.type'),
                )
              ) {
                setChanged(true);
              }
            }}
            mobileIsEdit={mobileIsEdit}
            addRefreshEvents={(name: string, value) => {
              cache.current[name] = value;
            }}
          />
        </Content>
      </Con>
    </Modal>
  );
}

export const openChildTable = (props: ChildTableDialogProps) => functionWrap(ChildTableDialog, props);
