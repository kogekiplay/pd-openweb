import React, { useEffect, useRef, useState } from 'react';
import { useSetState } from 'react-use';
import { Select } from 'antd';
import _ from 'lodash';
import { Checkbox, Dialog, Icon, Input, LoadDiv, RadioGroup } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import dataSourceApi from '../../../../api/datasource';
import worksheetApi from 'src/api/worksheet';
import { getIconByType } from 'src/pages/widgetConfig/util';
import styled from 'src/utils/typedStyled';
import FieldMappingList from '../../../components/FieldsMappingList/index';
import SelectTables from '../../../components/SelectTables';
import TimingSetting from '../../../components/TimingSetting';
import {
  CREATE_TYPE,
  CREATE_TYPE_RADIO_LIST,
  DATABASE_TYPE,
  namePattern,
  TRIGGER_WORKFLOW_CHECKBOX_OPTIONS,
} from '../../../constant';
import {
  getDefaultData,
  getDuplicateFieldsRenamedList,
  getInitFieldsMapping,
  getInitWorkSheetFields,
  isNotSupportField,
} from '../../../utils';
import {
  syncFields,
  syncIcon,
  syncLabeledValue,
  syncMappings,
  syncMatchResponse,
  syncNullableString,
  syncOptions,
  syncSchedule,
  syncSelectedTable,
  syncSourceTab,
  syncStringList,
  syncWorksheetControls,
} from './connectorBoundary';
import type {
  MappingDefaults,
  MatchedTypes,
  OnlySyncStepProps,
  SourceTableTab,
  SyncField,
  SyncFieldData,
  SyncMapping,
  SyncMappingData,
  SyncMatchedData,
  SyncOptionsState,
  SyncSheetData,
  SyncTableMeta,
  SyncTableOptions,
  SyncTables,
  SyncTask,
} from './connectorTypes';
import LeftTableList from './LeftTableList';
import SheetGroupSelect from './SheetGroupSelect';

const OnlySyncWrapper = styled.div`
  padding: var(--space-4) var(--space-6);
  width: 100%;
  height: calc(100% - 32px);

  .middleArrow {
    display: flex;
    justify-content: center;
    transform: rotate(-90deg);
    width: 64px;
    min-width: 64px;
    height: 56px;
    color: var(--color-primary-text);
  }
  .dbItem {
    display: flex;
    justify-content: space-between;
    width: 643px;
    .itemInput {
      width: 300px;
    }
  }
  .sheetNameWidth {
    width: 643px;
  }
  .multiplePkTips {
    padding: 10px var(--space-4);
    background: var(--color-background-secondary);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-secondary);
    margin-bottom: var(--space-5);
    width: fit-content;
  }
  .loadSheetWrap {
    display: flex;
    align-items: center;
    width: fit-content;
    margin-top: var(--space-5);
    cursor: pointer;
    color: var(--color-primary-text);
    &:hover {
      color: var(--color-link-hover);
      i {
        color: var(--color-link-hover);
      }
    }
  }
  .timingSettingWrapper {
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-8);
    border-bottom: 1px solid var(--color-text-disabled);
  }
`;

const NoDataContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 200px;
  margin-top: var(--space-6);
  border: 2px solid var(--color-border-secondary);
  border-radius: var(--radius-sm);

  .noContentIcon {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 130px;
    height: 130px;
    background: var(--color-background-secondary);
    border-radius: 50%;
    color: var(--color-text-tertiary);
  }
`;

export default function OnlySyncStep(props: OnlySyncStepProps) {
  const { onClose, source, dest, setSubmitData, currentProjectId } = props;
  // 必须显式给类型：useState({}) 会被推成 useState<{}>，
  // 之后读 currentTab.db / .table 等一律报 TS2339（本文件因此有 158 条）。
  const [currentTab, setCurrentTab] = useState<SourceTableTab>({});
  const [optionList, setOptionList] = useSetState<SyncOptionsState>({ dbOptionList: [], sheetOptionList: [] });
  const [sheetData, setSheetData] = useSetState<SyncTables<SyncSheetData>>({});
  const [sourceFields, setSourceFields] = useSetState<SyncTables<SyncFieldData>>({});
  const [destFields, setDestFields] = useSetState<SyncTables<SyncFieldData>>({});
  const [fieldsMapping, setFieldsMapping] = useSetState<SyncTables<SyncMappingData>>({});
  const [matchedTypes, setMatchedTypes] = useSetState<SyncTables<SyncMatchedData>>({});
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ retry: () => void } | undefined>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const requestFailure = (error: unknown, retry: () => void): void => {
    console.error(error);
    if (!mounted.current) return;
    setLoading(false);
    setFailure({ retry });
  };

  const isSourceAppType = source.type === DATABASE_TYPE.APPLICATION_WORKSHEET;
  const isDestAppType = dest.type === DATABASE_TYPE.APPLICATION_WORKSHEET;
  const hasTimingSetting = source.type === DATABASE_TYPE.HANA;
  const destHasSchema = dest.hasSchema;

  const dbKey = String(currentTab.db);
  const tableKey = String(currentTab.table);
  const readTable = <T,>(state: SyncTables<T>, db = dbKey, table = tableKey): T | undefined => state[db]?.[table];
  const readOptions = (db = dbKey, table = tableKey): SyncTableOptions | undefined => {
    const database = optionList[db];
    return database && !Array.isArray(database) ? database[table] : undefined;
  };
  const onChangeStateData = <T extends SyncTableMeta>(
    state: SyncTables<T>,
    setState: (patch: Partial<SyncTables<T>>) => void,
    options: Partial<NoInfer<T>>,
  ): void => {
    setState({
      [dbKey]: Object.assign({}, state[dbKey], {
        [tableKey]: Object.assign(
          { tableName: currentTab.tableName, schema: currentTab.schema },
          readTable(state),
          options,
        ),
      }),
    });
  };
  const onChangeOptionsData = (options: Partial<SyncTableOptions>): void => {
    const database = optionList[dbKey];
    setOptionList({
      [dbKey]: Object.assign({}, database, {
        [tableKey]: Object.assign(
          { tableName: currentTab.tableName, schema: currentTab.schema },
          readOptions(),
          options,
        ),
      }),
    });
  };
  const defaultMapping = (
    mapping: SyncMapping[],
    types: MatchedTypes | undefined,
    isSetDefaultFields: boolean | undefined,
    destFields: SyncField[] | undefined,
    sourceApp: boolean,
    destApp: boolean,
    notCanvas: boolean,
  ): SyncMapping[] => {
    const result: unknown = getDefaultData(
      mapping,
      types,
      isSetDefaultFields,
      destFields,
      sourceApp,
      destApp,
      notCanvas,
    );
    return syncMappings(result);
  };

  /**
   * @param {Object} props
   * {Array} props.initMapping 要更新的fieldsMapping
   * {Array} props.sourceFields 源表字段列表
   * {boolean} props.isCreate 目的地表是否新建
   * {boolean} props.noFetchSet 设置默认数据但不需要重新拉取matchedTypes
   * {boolean} props.isSetDefaultFields 是否设置默认选中字段--仅对于选择已有表
   * {Array} props.destFields 目的地表字段列表
   * @returns
   */
  const setFieldsMappingDefaultData = (props: MappingDefaults): void => {
    setFailure(undefined);
    const { initMapping, sourceFields, isCreate, noFetchSet, isSetDefaultFields, destFields } = props;

    if (noFetchSet) {
      const defaultData = defaultMapping(
        initMapping,
        readTable(matchedTypes)?.matchedTypes,
        isSetDefaultFields,
        destFields,
        isSourceAppType,
        isDestAppType,
        true,
      );
      onChangeStateData(fieldsMapping, setFieldsMapping, { fieldsMapping: defaultData });
      return;
    }

    //通过接口获取当前源字段对应 目的地字段字段可选的字段类型
    dataSourceApi
      .fieldsDataTypeMatch({
        dataDestType: dest.type,
        sourceFields,
        isCreate,
      })
      .then((raw: unknown) => {
        const matched = syncMatchResponse(raw);
        if (!mounted.current) return;
        const defaultData = defaultMapping(
          initMapping,
          matched,
          isSetDefaultFields,
          destFields,
          isSourceAppType,
          isDestAppType,
          true,
        );
        onChangeStateData(fieldsMapping, setFieldsMapping, { fieldsMapping: defaultData });
        onChangeStateData(matchedTypes, setMatchedTypes, { matchedTypes: matched });
      })
      .catch((error: unknown) => requestFailure(error, () => setFieldsMappingDefaultData(props)));
  };

  const loadDatabases = (): void => {
    setFailure(undefined);
    dataSourceApi
      .getDatabases({ projectId: currentProjectId, datasourceId: dest.id })
      .then((raw: unknown) => {
        const res = syncStringList(raw);
        if (!mounted.current) return;
        const dbOptionList = res.map(item => ({ label: item, value: item }));
        setOptionList({ dbOptionList });
      })
      .catch((error: unknown) => requestFailure(error, loadDatabases));
  };
  useEffect(() => {
    if (!isDestAppType) loadDatabases();
    if (isSourceAppType) setLoading(false);
  }, []);

  //更新提交数据
  useEffect(() => {
    const submitData: SyncTask[] = [];

    for (let db in fieldsMapping) {
      for (let table in fieldsMapping[db]) {
        const mappingState = readTable(fieldsMapping, db, table);
        const mappings = mappingState?.fieldsMapping || [];
        const isCreate = readTable(sheetData, db, table)?.sheetCreateType !== CREATE_TYPE.SELECT_EXIST;

        if (
          !_.isEmpty(mappingState?.fieldsMapping) &&
          ((!isDestAppType && readTable(sheetData, db, table)?.dbName) || isDestAppType)
        ) {
          const destFieldsMapping = mappings.map(mapping => {
            const item = {
              sourceField: { ...mapping.sourceField, alias: mapping.sourceField.name },
              destField: { ...mapping.destField, alias: mapping.destField.name },
            }; //将alias赋值成name提交
            const { isCheck } = item.destField;

            if (isCreate) {
              return isSourceAppType && isDestAppType
                ? {
                    sourceField: _.pick(item.sourceField, [
                      'id',
                      'isTitle',
                      'jdbcTypeId',
                      'isCheck',
                      'oid',
                      'controlSetting',
                    ]),
                    destField: isCheck
                      ? _.pick(item.destField, ['name', 'isTitle', 'jdbcTypeId', 'isCheck', 'oid', 'comment'])
                      : null,
                  }
                : {
                    ...item,
                    destField: isCheck ? item.destField : null,
                  };
            } else {
              return isDestAppType
                ? {
                    sourceField: isSourceAppType
                      ? _.pick(item.sourceField, ['id', 'isTitle', 'jdbcTypeId', 'isCheck', 'oid', 'isPk'])
                      : item.sourceField,
                    destField: isCheck
                      ? isSourceAppType
                        ? _.pick(item.destField, ['id', 'isTitle', 'jdbcTypeId', 'isCheck', 'oid', 'isPk'])
                        : _.pick(item.destField, ['id', 'isTitle', 'jdbcTypeId', 'isPk', 'isNotNull', 'isCheck', 'oid'])
                      : null,
                  }
                : item.destField.isCheck
                  ? item
                  : { ...item, destField: null };
            }
          });
          const sourceFields = destFieldsMapping.map(item => item.sourceField);
          const destNodeFields = destFieldsMapping.map(item => item.destField).filter(item => item !== null);
          const identifyDuplicateField = (readTable(destFields, db, table)?.fields || []).filter(
            item => item.id === readTable(sheetData, db, table)?.fieldForIdentifyDuplicate,
          )[0];

          const extraSettingData =
            isDestAppType && readTable(sheetData, db, table)?.sheetCreateType === CREATE_TYPE.SELECT_EXIST
              ? {
                  writeMode: readTable(sheetData, db, table)?.writeMode,
                  fieldForIdentifyDuplicate:
                    identifyDuplicateField && !_.isEmpty(identifyDuplicateField) ? identifyDuplicateField : undefined,
                  isCleanDestTableData: readTable(sheetData, db, table)?.isCleanDestTableData,
                }
              : {};

          const data = {
            projectId: currentProjectId,
            owner: md.global.Account.accountId,
            sourceNode: {
              nodeId: '1',
              name: _l('源表节点'),
              nodeType: 'SOURCE_TABLE',
              description: _l('这是一个源表节点'),
              fields: sourceFields,
              config: {
                datasourceId: source.id,
                dbName: source.type === DATABASE_TYPE.KAFKA ? mappingState?.tableName : db,
                tableName: mappingState?.tableName,
                schema: mappingState?.schema,
                dsType: source.type,
                className: source.className,
                iconBgColor: source.iconBgColor,
                appId: isSourceAppType ? source.id : undefined,
                workSheetId: isSourceAppType ? table : undefined,
                fields: sourceFields,
              },
            },
            destNode: {
              nodeId: '2',
              name: _l('目的地节点'),
              nodeType: 'DEST_TABLE',
              description: _l('这是一个目的地节点'),
              fields: destNodeFields,
              config: {
                dataDestId: dest.id,
                dbName: readTable(sheetData, db, table)?.dbName,
                tableName: readTable(sheetData, db, table)?.sheetName || readTable(sheetData, db, table)?.tableName,
                schema: readTable(sheetData, db, table)?.schemaName,
                createTable:
                  readTable(sheetData, db, table)?.sheetCreateType === CREATE_TYPE.SELECT_EXIST ? false : true,
                dsType: dest.type,
                className: dest.className,
                iconBgColor: dest.iconBgColor,
                appId: isDestAppType ? dest.id : undefined,
                workSheetId: isDestAppType ? readTable(sheetData, db, table)?.sheetNameValue : undefined,
                fieldsMapping: destFieldsMapping,
                appSectionId: readTable(sheetData, db, table)?.appSectionId,
                ...extraSettingData,
              },
            },
            workflowConfig: isDestAppType
              ? {
                  insertTrigger: !!readTable(sheetData, db, table)?.insertTrigger,
                  updateTrigger: !!readTable(sheetData, db, table)?.updateTrigger,
                  deleteTrigger: !!readTable(sheetData, db, table)?.deleteTrigger,
                }
              : undefined,
            scheduleConfig:
              source.type === DATABASE_TYPE.HANA
                ? readTable(sheetData, db, table)?.scheduleConfig || { readIntervalType: 0, readType: 0 }
                : undefined,
            tableList: readOptions()?.sheetOptionList || [],
            destPkCount: (readTable(destFields, db, table)?.fields || []).filter(item => item.isPk).length,
          };
          submitData.push(data);
        }
      }
    }

    setSubmitData && setSubmitData(submitData);
  }, [fieldsMapping, sheetData, optionList]);

  const loadWorksheetFields = (): void => {
    const worksheetId = currentTab.table;
    if (!worksheetId) return;
    setFailure(undefined);
    worksheetApi
      .getWorksheetInfo({ worksheetId, getTemplate: true })
      .then((raw: unknown) => {
        const fieldsParams = syncFields(
          getInitWorkSheetFields(syncWorksheetControls(raw), false, isSourceAppType, isDestAppType, worksheetId),
        );
        if (!mounted.current) return undefined;
        if (_.isEmpty(fieldsParams)) {
          onChangeStateData(fieldsMapping, setFieldsMapping, { fieldsMapping: [] });
          return undefined;
        }
        return dataSourceApi.fillJdbcType({ worksheetId, fields: fieldsParams }).then((raw: unknown) => {
          const res = syncFields(raw);
          if (!mounted.current) return;
          onChangeStateData(sourceFields, setSourceFields, { fields: res, workSheetId: worksheetId });
          setFieldsMappingDefaultData({
            initMapping: syncMappings(getInitFieldsMapping(res, isSourceAppType, dest.type)),
            sourceFields: res,
            isCreate: readTable(sheetData)?.sheetCreateType !== CREATE_TYPE.SELECT_EXIST,
          });
        });
      })
      .catch((error: unknown) => requestFailure(error, loadWorksheetFields));
  };
  useEffect(() => {
    if (currentTab.table) {
      onSetDefaultSheetData();
      if (!readTable(fieldsMapping)?.fieldsMapping) {
        isSourceAppType ? loadWorksheetFields() : loadTableFields();
      }
    }
  }, [currentTab]);

  const loadTableFields = () => {
    setFailure(undefined);
    setLoading(true);
    const params = {
      projectId: currentProjectId,
      datasourceId: source.id,
      dbName: source.type === DATABASE_TYPE.KAFKA ? currentTab.tableName : currentTab.db,
      schema: currentTab.schema,
      tableName: currentTab.tableName,
      destType: dest.type,
    };

    dataSourceApi
      .getTableFields(params)
      .then((raw: unknown) => {
        const fields = syncFields(raw);
        if (!mounted.current) return;
        setLoading(false);
        onChangeStateData(sourceFields, setSourceFields, { fields });
        setFieldsMappingDefaultData({
          initMapping: syncMappings(getInitFieldsMapping(fields, isSourceAppType, dest.type)),
          sourceFields: fields,
          isCreate: readTable(sheetData)?.sheetCreateType !== CREATE_TYPE.SELECT_EXIST,
        });
      })
      .catch((error: unknown) => requestFailure(error, loadTableFields));
  };

  const onSetDefaultSheetData = () => {
    const currentDb = readTable(sheetData)?.dbName;
    const currentSchema = readTable(sheetData)?.schemaName;
    const currentSheetName = readTable(sheetData)?.sheetName;
    const currentSheetCreateType = readTable(sheetData)?.sheetCreateType;
    let hasSetData: Pick<SyncSheetData, 'dbName' | 'schemaName'> &
      Pick<SyncTableOptions, 'schemaOptionList' | 'sheetOptionList'> = {
      dbName: null,
      schemaName: null,
      schemaOptionList: null,
      sheetOptionList: null,
    };

    if (!_.isEmpty(sheetData)) {
      for (let dbItem in sheetData) {
        for (let tableItem in sheetData[dbItem]) {
          if (readTable(sheetData, dbItem, tableItem)?.dbName) {
            hasSetData = {
              ..._.pick(readTable(sheetData, dbItem, tableItem), ['dbName', 'schemaName']),
              ..._.pick(readOptions(dbItem, tableItem), ['schemaOptionList', 'sheetOptionList']),
            };
            break;
          }
        }
      }
    }

    if (
      (!currentDb && !!hasSetData.dbName) ||
      (!currentSchema && !!hasSetData.schemaName) ||
      (!currentSheetName && currentSheetCreateType !== CREATE_TYPE.SELECT_EXIST)
    ) {
      onChangeStateData(sheetData, setSheetData, {
        ..._.pick(hasSetData, ['dbName', 'schemaName']),
        sheetName: currentTab.tableName,
      });
      onChangeOptionsData(_.pick(hasSetData, ['schemaOptionList', 'sheetOptionList']));
    }
  };

  const onChangeDb = (rawValue: unknown) => {
    const db = { value: syncLabeledValue(rawValue) };
    const initMapping = syncMappings(
      getInitFieldsMapping(readTable(sourceFields)?.fields || [], isSourceAppType, dest.type),
    );
    setFieldsMappingDefaultData({ initMapping, noFetchSet: true });

    if (destHasSchema) {
      //获取指定数据库下schema列表
      dataSourceApi
        .getSchemas({ projectId: currentProjectId, datasourceId: dest.id, dbName: db.value })
        .then((raw: unknown) => {
          const res = syncStringList(raw);
          if (!mounted.current) return;
          const schemaOptionList = res.map(item => {
            return { label: item, value: item };
          });
          onChangeStateData(sheetData, setSheetData, { dbName: db.value, schemaName: null, sheetNameValue: null });
          onChangeOptionsData({ schemaOptionList });
        })
        .catch((error: unknown) => requestFailure(error, () => onChangeDb(rawValue)));
    } else {
      onChangeStateData(sheetData, setSheetData, { dbName: db.value, sheetNameValue: null });
    }
  };

  const onChangeSchema = (rawValue: unknown) => {
    const schema = { value: syncLabeledValue(rawValue) };
    const initMapping = syncMappings(
      getInitFieldsMapping(readTable(sourceFields)?.fields || [], isSourceAppType, dest.type),
    );
    setFieldsMappingDefaultData({ initMapping, noFetchSet: true });
    onChangeStateData(sheetData, setSheetData, { schemaName: schema.value });
  };

  const onChangeSheetCreateType = async (rawValue: unknown) => {
    const sheetCreateType = syncNullableString(rawValue);
    if (typeof sheetCreateType !== 'string') throw new TypeError('Invalid connector create type');
    const initSheetData: Partial<SyncSheetData> = {};
    const { sheetNameValue, writeNode } = readTable(sheetData) || {};

    if (sheetCreateType === CREATE_TYPE.NEW) {
      initSheetData.sheetName = currentTab.tableName;
    } else {
      initSheetData.sheetName = sheetNameValue || '';
      initSheetData.appSectionId = null;
      if (!writeNode) {
        initSheetData.writeMode = 'SKIP';
        initSheetData.isCleanDestTableData = false;
      }

      const sheetOptionList = readOptions()?.sheetOptionList || [];

      if (sheetNameValue) {
        const selected = sheetOptionList.filter(item => item.value === sheetNameValue)[0];
        if (!selected) throw new TypeError('Missing selected connector table');
        initSheetData.sheetName = selected.workSheetName;
      }
    }

    onChangeStateData(sheetData, setSheetData, { sheetCreateType, ...initSheetData });
    const initMapping = syncMappings(
      getInitFieldsMapping(readTable(sourceFields)?.fields || [], isSourceAppType, dest.type),
    );
    !_.isEmpty(initMapping) &&
      setFieldsMappingDefaultData({
        initMapping,
        sourceFields: readTable(sourceFields)?.fields || [],
        isCreate: sheetCreateType === CREATE_TYPE.NEW,
        noFetchSet: false,
        isSetDefaultFields: sheetCreateType === CREATE_TYPE.SELECT_EXIST && !!readTable(destFields)?.fields,
        destFields: readTable(destFields)?.fields,
      });
  };

  const onChangeSheet = (rawValue: unknown) => {
    const sheet = syncSelectedTable(rawValue);
    if (!sheet) return;
    const initMapping = syncMappings(
      getInitFieldsMapping(readTable(sourceFields)?.fields || [], isSourceAppType, dest.type),
    );

    if (_.isEmpty(initMapping)) {
      onChangeStateData(sheetData, setSheetData, {
        sheetName: sheet.label,
        sheetNameValue: sheet.value,
      });
      return;
    }

    if (isDestAppType) {
      onChangeStateData(sheetData, setSheetData, {
        sheetName: sheet.label,
        sheetNameValue: sheet.value,
      });
      worksheetApi
        .getWorksheetInfo({ worksheetId: sheet.value, getTemplate: true })
        .then((raw: unknown) => {
          const fieldsParams = syncFields(
            getInitWorkSheetFields(syncWorksheetControls(raw), true, isSourceAppType, isDestAppType, sheet.value),
          );
          return dataSourceApi.fillJdbcType({ worksheetId: sheet.value, fields: fieldsParams }).then((raw: unknown) => {
            const res = syncFields(raw);
            if (!mounted.current) return;
            onChangeStateData(destFields, setDestFields, { fields: res, workSheetId: sheet.value });
            setFieldsMappingDefaultData({
              initMapping,
              noFetchSet: true,
              isSetDefaultFields: true,
              destFields: res,
            });
          });
        })
        .catch((error: unknown) => requestFailure(error, () => onChangeSheet(rawValue)));
    } else {
      const params = {
        projectId: currentProjectId,
        datasourceId: dest.id,
        dbName: readTable(sheetData)?.dbName,
        schema: readTable(sheetData)?.schemaName,
        tableName: sheet.label,
      };
      dataSourceApi
        .getTableFields(params)
        .then((raw: unknown) => {
          const res = syncFields(raw);
          if (!mounted.current) return;
          const arr = res.filter(item => item.isPk);

          if (arr.length > 0) {
            onChangeStateData(sheetData, setSheetData, {
              sheetName: sheet.label,
              sheetNameValue: sheet.value,
            });
            onChangeStateData(destFields, setDestFields, { fields: res });
            setFieldsMappingDefaultData({
              initMapping,
              noFetchSet: true,
              isSetDefaultFields: true,
              destFields: res,
            });
          } else {
            alert(_l('该表没有主键，无法同步'), 2);
          }
        })
        .catch((error: unknown) => requestFailure(error, () => onChangeSheet(rawValue)));
    }
  };

  const renderIdentifyDup = () => {
    const destOptions = readTable(destFields)?.fields || [];
    const options = destOptions
      .filter(item => _.includes([2, 3, 4, 5, 7, 33], item.mdType)) //可选类型--文本，电话，邮箱，证件，自动编号
      .map(item => {
        return {
          label: (
            <div className="flexRow alignItemsCenter">
              <Icon icon={syncIcon(getIconByType(item.mdType))} className="textTertiary Font18" />
              <span title={item.name} className="mLeft8 overflow_ellipsis textPrimary">
                {item.name}
              </span>
            </div>
          ),
          value: item.id,
        };
      });

    return (
      <React.Fragment>
        <p className="mTop20 mBottom8 bold">{_l('重复数据')}</p>
        <p className="mBottom12 textTertiary">{_l('未选择目标字段时, 会根据数据源的主键字段判断重复')}</p>
        <div className="flexRow alignItemsCenter">
          <span className="nowrap">{_l('在同步时，依据目标字段')}</span>
          <div className="Width120 mLeft12 mRight12">
            <Select<string | null | undefined, { label: React.ReactNode; value?: string | null | undefined }>
              className="selectItem"
              allowClear={true}
              options={options}
              value={readTable(sheetData)?.fieldForIdentifyDuplicate}
              onChange={fieldForIdentifyDuplicate =>
                onChangeStateData(sheetData, setSheetData, { fieldForIdentifyDuplicate })
              }
            />
          </div>
          <span className="nowrap">{_l('识别重复，并')}</span>
          <div className="Width70 mLeft12 mRight12">
            <Select<string | null | undefined, { label: React.ReactNode; value?: string | null | undefined }>
              className="selectItem"
              options={[
                { label: _l('跳过'), value: 'SKIP' },
                { label: _l('覆盖'), value: 'OVERWRITE' },
              ]}
              value={readTable(sheetData)?.writeMode}
              onChange={(raw: unknown) => {
                const writeMode = syncNullableString(raw);
                if (writeMode === null) throw new TypeError('Invalid connector write mode');
                onChangeStateData(sheetData, setSheetData, { writeMode });
              }}
            />
          </div>
          {readTable(sheetData)?.writeMode === 'OVERWRITE' && (
            <Tooltip title={_l('“覆盖”会导致数据同步变慢。')}>
              <Icon icon="info_outline" className="Font16 textDisabled pointer" />
            </Tooltip>
          )}
        </div>
        <div className="mTop20">
          <Checkbox
            size="small"
            text={_l('在本次同步数据之前，彻底清空目标表数据')}
            checked={readTable(sheetData)?.isCleanDestTableData}
            onClick={(checked: boolean) => {
              !checked
                ? Dialog.confirm({
                    title: _l('清空目标表数据'),
                    description: _l('在本次同步任务前，清空目的地表数据，清空后无法恢复。'),
                    buttonType: 'danger',
                    okText: _l('确认'),
                    onOk: () => onChangeStateData(sheetData, setSheetData, { isCleanDestTableData: !checked }),
                  })
                : onChangeStateData(sheetData, setSheetData, { isCleanDestTableData: !checked });
            }}
          />
        </div>
      </React.Fragment>
    );
  };

  const renderPkSet = () => {
    const sourcePkCount = (readTable(sourceFields)?.fields || []).filter(item => item.isPk).length;

    //只有（数据源是库且无主键+表到库）可以设置主键
    if (!((!isSourceAppType && sourcePkCount === 0) || (isSourceAppType && !isDestAppType))) {
      return null;
    }

    const sourceOptions = readTable(sourceFields)?.fields || [];
    const options = sourceOptions
      .filter(
        item =>
          !isNotSupportField(item, readTable(matchedTypes)?.matchedTypes || {}) &&
          (isSourceAppType || ((!!item.isNotNull || source.type === DATABASE_TYPE.KAFKA) && !!item.isCanBePk)),
      )
      .map(item => {
        return {
          label: (
            <div className="flexRow alignItemsCenter">
              <Icon icon={syncIcon(getIconByType(item.mdType))} className="textTertiary Font18" />
              <span title={item.name} className="mLeft8 overflow_ellipsis textPrimary">
                {item.name}
              </span>
            </div>
          ),
          value: item.id,
        };
      });
    const currentMapping = readTable(fieldsMapping)?.fieldsMapping || [];
    const currentPkField = currentMapping.filter(mapping => mapping.sourceField.isPk)[0]?.sourceField;
    const currentSheetCreateType = readTable(sheetData)?.sheetCreateType;

    const onChangePk = (rawValue: unknown) => {
      const id = syncNullableString(rawValue);
      const newFieldsMapping = currentMapping.map(item => {
        const sourceField = item.sourceField;
        const isPk = sourceField.id === id;

        return {
          sourceField: {
            ...item.sourceField,
            isPk,
            isCheck: isPk,
            isFakePk: isPk,
          },
          destField: {
            ...item.destField,
            isPk,
            isCheck: isPk,
            isFakePk: isPk,
            id: null,
            name: dest.type === DATABASE_TYPE.MONGO_DB && isPk ? '_id' : sourceField.name.replace(namePattern, ''),
            isNotNull: isPk,
          },
        };
      });
      setFieldsMappingDefaultData({
        initMapping: syncMappings(getDuplicateFieldsRenamedList(newFieldsMapping)),
        sourceFields: newFieldsMapping.map(item => item.sourceField),
        isCreate: currentSheetCreateType !== CREATE_TYPE.SELECT_EXIST,
        noFetchSet: false,
        isSetDefaultFields: currentSheetCreateType === CREATE_TYPE.SELECT_EXIST && !!readTable(destFields)?.fields,
        destFields: readTable(destFields)?.fields,
      });
    };

    return (
      <React.Fragment>
        <p className="mBottom16 bold">{_l('设置主键')}</p>
        <div className="flexRow alignItemsCenter mBottom20">
          <span className="nowrap">{_l('在同步时，指定数据源字段')}</span>
          <div className="Width120 mLeft12 mRight12">
            <Select<string | null | undefined, { label: React.ReactNode; value?: string | null | undefined }>
              className="selectItem"
              options={options}
              value={currentPkField?.id}
              notFoundContent={_l('暂无数据')}
              onChange={onChangePk}
            />
          </div>
          <span className="nowrap">{_l('为主键')}</span>
          <Tooltip
            title={
              !isSourceAppType
                ? _l('只可以选非空字段。仅用于数据同步，不会改变数据库字段属性，建议使用索引列。')
                : _l('仅用于数据同步，不会改变数据库字段属性，建议使用索引列。')
            }
          >
            <Icon icon="info_outline" className="Font16 textDisabled pointer mLeft12" />
          </Tooltip>
        </div>
      </React.Fragment>
    );
  };

  const renderTimingSetting = () => {
    return (
      <div className="timingSettingWrapper">
        <div className="Font14 bold mBottom16">{_l('定时设置')}</div>
        <TimingSetting
          showInDrawer={false}
          projectId={currentProjectId}
          sourceId={source.id}
          dbName={currentTab.db}
          schema={currentTab.schema}
          tableName={currentTab.table}
          sourceFields={readTable(sourceFields)?.fields || []}
          settingValue={readTable(sheetData)?.scheduleConfig}
          onChange={(value: unknown) =>
            onChangeStateData(sheetData, setSheetData, { scheduleConfig: syncSchedule(value) })
          }
        />
      </div>
    );
  };

  const schemaOptions = readOptions()?.schemaOptionList;
  const hasMultiplePks = !!(readTable(sourceFields)?.fields || []).filter(item => item.fid === 'composite_primary_key')
    .length;

  return (
    <OnlySyncWrapper>
      <div className="tabNav" onClick={onClose}>
        <span>{_l('仅同步数据')}</span>
      </div>

      <div className="flexRow h100">
        <LeftTableList
          {...props}
          currentTab={currentTab}
          setCurrentTab={(value: unknown) => setCurrentTab(syncSourceTab(value))}
          onDelete={(db: string, table: string) => {
            const newSheetData = _.cloneDeep(sheetData);
            const newFieldsMapping = _.clone(fieldsMapping);

            const mapping = newFieldsMapping[db]?.[table];
            if (mapping) {
              const sheet = newSheetData[db]?.[table];
              if (!sheet) throw new TypeError('Missing connector destination configuration');
              mapping.fieldsMapping = null;
              sheet.dbName = null;
              sheet.sheetName = null;
              sheet.sheetNameValue = null;
              sheet.sheetCreateType = CREATE_TYPE.NEW;
              setSheetData(newSheetData);
              setFieldsMapping(newFieldsMapping);
            }
          }}
        />

        <div className="middleArrow">
          <Icon icon="arrow_down" className="Font24" />
        </div>

        <div className="flex flexColumn">
          <div className="titleItem mTop16">
            {hasTimingSetting && <div className="bold mRight24">{_l('同步到')}</div>}
            <div className="iconWrapper">
              <svg className="icon svg-icon" aria-hidden="true">
                <use xlinkHref={`#icon${_.get(dest, 'className')}`} />
              </svg>
            </div>
            <span title={dest.sourceName}>{dest.sourceName}</span>
            {failure && (
              <div role="alert" className="mLeft16">
                {_l('加载失败')}
                <button type="button" className="mLeft8" onClick={failure.retry}>
                  {_l('重试')}
                </button>
              </div>
            )}
          </div>
          {currentTab.table ? (
            <div className="mTop16 flex flexColumn">
              {hasTimingSetting && renderTimingSetting()}

              {!isDestAppType && (
                <div className="dbItem">
                  <div className="itemInput">
                    <p className="mBottom8 bold">{_l('数据库')}</p>
                    <Select<string | null | undefined, { label: React.ReactNode; value?: string | null | undefined }>
                      className="selectItem mBottom20"
                      showSearch={true}
                      labelInValue={true}
                      placeholder={_l('请选择')}
                      notFoundContent={_l('暂无数据')}
                      value={readTable(sheetData)?.dbName}
                      options={optionList.dbOptionList}
                      onChange={db => onChangeDb(db)}
                    />
                  </div>
                  {destHasSchema && (
                    <div className="itemInput">
                      <p className="mBottom8 bold">schema</p>
                      <Select<string | null | undefined, { label: React.ReactNode; value?: string | null | undefined }>
                        className="selectItem mBottom20"
                        showSearch={true}
                        labelInValue={true}
                        placeholder={_l('请选择')}
                        notFoundContent={_l('暂无数据')}
                        value={readTable(sheetData)?.schemaName}
                        {...(schemaOptions ? { options: schemaOptions } : {})}
                        onChange={schema => onChangeSchema(schema)}
                      />
                    </div>
                  )}
                </div>
              )}

              {(isDestAppType ||
                (!destHasSchema && readTable(sheetData)?.dbName) ||
                (destHasSchema && readTable(sheetData)?.schemaName)) && (
                <div className="flexColumn flex">
                  <p className="mBottom16 bold">{isDestAppType ? _l('工作表') : _l('数据表')}</p>
                  <RadioGroup
                    className="mBottom20"
                    data={CREATE_TYPE_RADIO_LIST}
                    checkedValue={readTable(sheetData)?.sheetCreateType || CREATE_TYPE.NEW}
                    onChange={sheetCreateType => onChangeSheetCreateType(sheetCreateType)}
                  />

                  <div className="flexRow">
                    {isDestAppType && readTable(sheetData)?.sheetCreateType !== CREATE_TYPE.SELECT_EXIST && (
                      <SheetGroupSelect
                        appId={dest.id}
                        value={readTable(sheetData)?.appSectionId}
                        onChange={(rawValue: unknown) => {
                          const appSectionId = syncNullableString(rawValue);
                          onChangeStateData(sheetData, setSheetData, { appSectionId });
                        }}
                      />
                    )}
                    <div>
                      <p className="mBottom8 bold">{isDestAppType ? _l('工作表名称') : _l('数据表名称')}</p>
                      <div className="sheetNameWidth">
                        {readTable(sheetData)?.sheetCreateType === CREATE_TYPE.SELECT_EXIST ? (
                          <SelectTables
                            className="selectItem mBottom20"
                            value={readTable(sheetData)?.sheetNameValue}
                            options={readOptions()?.sheetOptionList}
                            onChangeOptions={(value: unknown) =>
                              onChangeOptionsData({ sheetOptionList: syncOptions(value) })
                            }
                            onChangeTable={onChangeSheet}
                            projectId={currentProjectId}
                            datasourceId={dest.id}
                            dbName={readTable(sheetData)?.dbName}
                            schema={readTable(sheetData)?.schemaName}
                            isAppType={isDestAppType}
                            isSameDbObj={
                              !isDestAppType
                                ? source.id === dest.id &&
                                  currentTab.db === readTable(sheetData)?.dbName &&
                                  (!destHasSchema || currentTab.schema === readTable(sheetData)?.schemaName)
                                : source.id === dest.id
                            }
                            sourceTables={[isDestAppType ? currentTab.table : currentTab.tableName]}
                          />
                        ) : (
                          <Input
                            className="mBottom20 w100"
                            value={readTable(sheetData)?.sheetName || readTable(sheetData)?.tableName}
                            onBlur={event =>
                              onChangeStateData(sheetData, setSheetData, {
                                sheetName: event.target.value.replace(namePattern, ''),
                              })
                            }
                            onChange={sheetName => onChangeStateData(sheetData, setSheetData, { sheetName })}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pBottom20 h100 flexColumn">
                    {loading && <LoadDiv className="mTop10" />}

                    {!loading &&
                      (readTable(sheetData)?.sheetCreateType !== CREATE_TYPE.SELECT_EXIST ||
                        !!readTable(sheetData)?.sheetNameValue) &&
                      readTable(fieldsMapping)?.fieldsMapping && (
                        <React.Fragment>
                          {!isSourceAppType && isDestAppType && hasMultiplePks && (
                            <div className="multiplePkTips">
                              {_l(
                                '数据源为多主键表，会新增一个名为composite_primary_key的主键，作为同步到工作表的唯一标识，其值由多个主键值拼接而成。',
                              )}
                            </div>
                          )}
                          {renderPkSet()}
                          <p className="bold">{_l('设置同步字段')}</p>
                          {_.isEmpty(readTable(fieldsMapping)?.fieldsMapping) && source.type !== DATABASE_TYPE.KAFKA ? (
                            <NoDataContent>
                              <div className="TxtCenter">
                                <div className="noContentIcon">
                                  <Icon icon="ic-line" className="Font64" />
                                </div>
                                <p className="textSecondary Font15 mTop24 mBottom0">{_l('数据源暂无可映射字段')}</p>
                              </div>
                            </NoDataContent>
                          ) : (
                            <React.Fragment>
                              <FieldMappingList
                                isCreate={readTable(sheetData)?.sheetCreateType !== CREATE_TYPE.SELECT_EXIST}
                                sourceData={{
                                  sourceFields: readTable(sourceFields)?.fields,
                                  isDbType: !isSourceAppType,
                                  dsType: source.type,
                                }}
                                destData={{
                                  destFields: readTable(destFields)?.fields,
                                  isDbType: !isDestAppType,
                                  dsType: dest.type,
                                }}
                                fieldsMapping={readTable(fieldsMapping)?.fieldsMapping}
                                setFieldsMapping={(value: unknown) =>
                                  onChangeStateData(fieldsMapping, setFieldsMapping, {
                                    fieldsMapping: syncMappings(value),
                                  })
                                }
                                matchedTypes={readTable(matchedTypes)?.matchedTypes}
                              />

                              {source.type === DATABASE_TYPE.KAFKA && (
                                <div className="loadSheetWrap" onClick={() => loadTableFields()}>
                                  <Icon icon="refresh1" className="Font16 mRight8" />
                                  <div>{_l('加载表结构')}</div>
                                </div>
                              )}

                              {isDestAppType &&
                                readTable(sheetData)?.sheetCreateType === CREATE_TYPE.SELECT_EXIST &&
                                renderIdentifyDup()}

                              {isDestAppType && (
                                <React.Fragment>
                                  <p className="mTop20 mBottom8 bold">{_l('触发工作流')}</p>
                                  <p className="mBottom12 textTertiary">
                                    {_l('同步数据时，是否触发工作表绑定的自动化工作流')}
                                  </p>
                                  <div className="flexRow">
                                    {TRIGGER_WORKFLOW_CHECKBOX_OPTIONS.map(item => {
                                      const isChecked =
                                        readTable(sheetData)?.[
                                          item.key === 'insertTrigger'
                                            ? 'insertTrigger'
                                            : item.key === 'updateTrigger'
                                              ? 'updateTrigger'
                                              : 'deleteTrigger'
                                        ];
                                      return (
                                        <Checkbox
                                          key={item.key}
                                          size="small"
                                          className="pRight30"
                                          checked={isChecked}
                                          onClick={() =>
                                            onChangeStateData(sheetData, setSheetData, { [item.key]: !isChecked })
                                          }
                                        >
                                          {item.text}
                                          {item.key === 'deleteTrigger' && (
                                            <Tooltip
                                              title={
                                                <span>
                                                  {_l('删除为彻底删除。')}
                                                  <br />
                                                  {_l('触发流程后，无法获取已删除记录的数据。')}
                                                </span>
                                              }
                                            >
                                              <span className="Hand mLeft4" onClick={e => e.stopPropagation()}>
                                                <Icon icon="info" className="textTertiary Font14" />
                                              </span>
                                            </Tooltip>
                                          )}
                                        </Checkbox>
                                      );
                                    })}
                                  </div>
                                </React.Fragment>
                              )}
                            </React.Fragment>
                          )}
                        </React.Fragment>
                      )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <NoDataContent>
              <div className="TxtCenter">
                <div className="noContentIcon">
                  <Icon icon="ic-line" className="Font64" />
                </div>
                <p className="textSecondary Font15 mTop24 mBottom0">{_l('请先从左侧选择数据对象')}</p>
              </div>
            </NoDataContent>
          )}
        </div>
      </div>
    </OnlySyncWrapper>
  );
}
