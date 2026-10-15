import _ from 'lodash';
import worksheetApi from 'src/api/worksheet';
import dataSourceApi from 'src/pages/integration/api/datasource.js';
import TaskFlow from 'src/pages/integration/api/taskFlow.js';
import {
  DATABASE_TYPE,
  DEPT_FIELDS,
  PERSONNEL_FIELDS,
  RELATED_RECORD_FIELDS,
} from 'src/pages/integration/dataIntegration/constant.js';
import {
  ALL_OPERATION_TYPE_DATA,
  DATE_TIME_DATA_PARTICLE,
  NODE_TYPE_LIST,
  num_jdbcTypeIds,
  ONLY_TIME_DATA_PARTICLE,
  OPERATION_TYPE_DATA,
  text_jdbcTypeIds,
  TIME_DATA_PARTICLE,
  TIME_GATHER_PARTICLE,
  time_jdbcTypeIds,
} from 'src/pages/integration/dataIntegration/TaskCon/TaskCanvas/config.js';
import {
  syncFields,
  syncMappings,
  syncMatchedTypes,
  syncRecord,
} from '../../connector/components/OnlySyncStep/connectorBoundary';
import type { MatchedTypes, SyncField, SyncMapping } from '../../connector/components/OnlySyncStep/connectorTypes';
import { getDefaultData, getInitWorkSheetFields } from '../../utils';
import type { CanvasFieldRequest, CanvasLine, CanvasMappingDefaults, CanvasNode, UnionField } from './canvasTypes';

export const formatTaskNodeData = (dataList: CanvasNode[] = [], firstId: string | undefined) => {
  // const firstId = "source1";
  if (dataList.length <= 0) {
    return [];
  }

  let parentIds: Array<string | undefined> = [];
  let maxY = 0;
  const list: CanvasNode[] = dataList.map(o => {
    const { x: _x, y: _y, ...node } = o;
    return {
      ...node,
      prevIds:
        ['JOIN', 'UNION'].includes(o.nodeType) && (o.prevIds || []).length > 1
          ? [o.nodeConfig?.config?.leftTableId, o.nodeConfig?.config?.rightTableId]
          : o.prevIds,
    };
  });

  const generateCoordinateX = (currentId: string | undefined, x = 0, y = 0, ancestors = new Set<string>()) => {
    const currentItem = list.find(item => item.nodeId === currentId);
    if (!currentItem || ancestors.has(currentItem.nodeId)) return;
    const branch = new Set(ancestors).add(currentItem.nodeId);

    currentItem.x = currentId === firstId ? 0 : x;
    currentItem.y = currentId === firstId ? 0 : y;

    if ((currentItem.prevIds || []).length) {
      parentIds = parentIds.concat(currentItem.prevIds || []);
    }

    (currentItem.nextIds || []).forEach(o => {
      generateCoordinateX(o, (currentItem.x || 0) + 1, currentItem.y, branch);
    });
  };

  const generateCoordinateParent = (
    parentIds: Array<string | undefined>,
    newY?: number,
    ancestors = new Set<string>(),
  ) => {
    parentIds.forEach(currentId => {
      const currentItem = list.find(item => item.nodeId === currentId);

      if (!currentItem || ancestors.has(currentItem.nodeId)) {
        return;
      }

      const parentNode = list.find(obj => (obj.prevIds || []).indexOf(currentId) > -1);
      if (!parentNode || parentNode.x === undefined) return;

      if (!newY || (parentNode.prevIds || []).indexOf(currentId) > 0) {
        maxY = maxY + 1;
      }

      currentItem.x = parentNode.x - 1;
      currentItem.y = maxY;
      generateCoordinateParent(currentItem.prevIds || [], maxY, new Set(ancestors).add(currentItem.nodeId));
    });
  };

  // 所有大于0 x轴平移
  const translationX = () => {
    let minX = 0;

    list.forEach(item => {
      if (item.x !== undefined && item.x < minX) {
        minX = item.x;
      }
    });

    minX = Math.abs(minX);

    list.forEach(item => {
      if (item.x !== undefined && (item.x !== 0 || item.y !== 0)) {
        item.x = item.x + minX;
      }
    });
  };

  // 计算所有行的位置情况
  const calculationAllRowPosition = () => {
    const rowObj: Record<string, number[]> = {};
    let allowMergeRow: number[] = [];

    list
      .filter(item => (item.y || 0) > 0)
      .forEach(item => {
        if (item.y === undefined || item.x === undefined) return;
        (rowObj[item.y] ||= []).push(item.x);
      });

    Object.keys(rowObj).forEach((key, index) => {
      if (index !== Object.keys(rowObj).length - 1) {
        const nextRow = Object.keys(rowObj)[index + 1];
        if (nextRow === undefined) return;
        const mergeArr = (rowObj[key] || []).concat(rowObj[nextRow] || []);

        if (_.uniq(mergeArr).length === mergeArr.length) {
          allowMergeRow.push(parseInt(key) + 1);
        }
      }
    });

    allowMergeRow
      .sort((a, b) => b - a)
      .forEach(line => {
        list
          .filter(item => item.y !== undefined && item.y >= line)
          .forEach(item => {
            item.y = (item.y || 0) - 1;
          });
      });
  };

  generateCoordinateX(firstId);
  generateCoordinateParent(parentIds);
  translationX();
  calculationAllRowPosition();
  return list;
};

//计算pathIds
export const formatDataWithLine = (dataList: CanvasNode[]) => {
  let list = dataList.map(o => {
    return {
      ...o,
      prevIds:
        ['JOIN', 'UNION'].includes(o.nodeType) && (o.prevIds || []).length > 1
          ? [o.nodeConfig?.config?.leftTableId, o.nodeConfig?.config?.rightTableId]
          : o.prevIds,
    };
  });
  const l = list.map(o => {
    const pathIds: CanvasLine[] = [];

    if ((o.nextIds || []).length > 0) {
      (o.nextIds || []).map(it => {
        pathIds.push({ fromDt: o, toDt: list.find(a => a.nodeId === it) || {} });
      });
    }

    return {
      ...o,
      pathIds,
    };
  });
  list.map(o => {
    if ((o.prevIds || []).length > 0) {
      (o.prevIds || []).map(it => {
        let index = list.findIndex(a => a.nodeId === it);

        const fromNode = l[index];

        if (fromNode) {
          l[index] = { ...fromNode, pathIds: [...fromNode.pathIds, { fromDt: fromNode, toDt: o }] };
        }
      });
    }
  });
  return l;
};

//通过中间类型转换成筛选组件使用的type
export const formatControls = (controls: SyncField[]) => {
  const templateControls = controls.map(o => {
    switch (o.jdbcTypeId) {
      case 93:
      case 92:
      case 2013:
      case 91:
      case 2014:
        return { ...o, type: 16, controlId: o.alias, controlName: o.alias };
      case 6:
      case 3:
      case 8:
      case -6:
      case 4:
      case 2:
      case -5:
      case -7:
      case 16:
      case 5:
      case 7:
        return { ...o, type: 6, controlId: o.alias, controlName: o.alias };
      default:
        //其他都转成文本类型
        return { ...o, type: 2, controlId: o.alias, controlName: o.alias };
    }
  });
  return templateControls;
};

export const getNodeInfo = async (projectId: string, flowId: string, nodeId: string): Promise<unknown> => {
  const node = await TaskFlow.getNodeInfo({
    projectId,
    flowId,
    nodeId,
  });
  return node;
};

/**
 * @param {Object} props
 * {Array} props.initMapping 要更新的fieldsMapping
 * {Array} props.sourceFields 源表字段列表
 * {boolean} props.isCreate 目的地表是否新建
 * {boolean} props.matchedTypes 设置默认数据但不需要重新拉取matchedTypes
 * {boolean} props.isSetDefaultFields 是否设置默认选中字段--仅对于选择已有表
 * {Array} props.destFields 目的地表字段列表
 * @returns
 */
export const setFieldsMappingDefaultData = async (
  props: CanvasMappingDefaults,
): Promise<{ fieldsMapping: SyncMapping[]; matchedTypes?: MatchedTypes | null | undefined }> => {
  const {
    initMapping,
    sourceFields,
    isCreate,
    matchedTypes,
    isSetDefaultFields,
    destFields,
    dataDestType,
    isSourceAppType,
    isDestAppType,
  } = props;

  if (matchedTypes) {
    return {
      fieldsMapping: syncMappings(
        getDefaultData(initMapping, matchedTypes, isSetDefaultFields, destFields, isSourceAppType, isDestAppType),
      ),
    };
  }

  //通过接口获取当前源字段对应 目的地字段字段可选的字段类型
  const res: unknown = await dataSourceApi.fieldsDataTypeMatch({
    dataDestType,
    sourceFields,
    isCreate,
  });
  if (!syncRecord(res)) throw new TypeError('Invalid canvas matched types response');
  const nextMatchedTypes = res['matchedTypes'] === null ? null : syncMatchedTypes(res['matchedTypes']);
  return {
    fieldsMapping: syncMappings(
      getDefaultData(initMapping, nextMatchedTypes, isSetDefaultFields, destFields, isSourceAppType, isDestAppType),
    ),
    matchedTypes: nextMatchedTypes,
  };
};

//获取当前节点的fields
export const getFields = async ({
  node,
  projectId,
  isGetDest,
  isSourceAppType,
  isDestAppType = true,
  withRowId,
  withSys,
  destType,
}: CanvasFieldRequest): Promise<SyncField[] | undefined> => {
  let { dsType, workSheetId, tableName, dbName, schema, datasourceId, dataDestId } = node.nodeConfig?.config || {};

  if (dsType === DATABASE_TYPE.APPLICATION_WORKSHEET) {
    if (!workSheetId) return undefined;
    const res = await worksheetApi.getWorksheetInfo({ worksheetId: workSheetId, getTemplate: true });
    const resFields = isGetDest
      ? res?.template?.controls || []
      : (res?.template?.controls || []).map(o => {
          return { ...o, alias: o.controlName };
        });
    const fieldsParams = syncFields(
      getInitWorkSheetFields(resFields, isGetDest, isSourceAppType, isDestAppType, workSheetId, withRowId, withSys),
    );

    if (_.isEmpty(fieldsParams)) {
      return [];
    } else {
      const ress = await dataSourceApi.fillJdbcType({ worksheetId: workSheetId, fields: fieldsParams });
      return Array.isArray(ress) ? syncFields(ress) : [];
    }
  } else {
    if (!tableName) {
      return undefined;
    }

    const params = {
      projectId,
      datasourceId: datasourceId || dataDestId,
      dbName,
      tableName,
      destType,
      schema: dsType === DATABASE_TYPE.HANA ? dbName : schema,
    };
    const res = await dataSourceApi.getTableFields(params);
    return Array.isArray(res) ? syncFields(res) : [];
  }
};

export const formatFieldsByType = (list: SyncField[]): SyncField[] => {
  const initWorkSheetFields: SyncField[] = [];
  const oidStrList = [...PERSONNEL_FIELDS, ...DEPT_FIELDS, ...RELATED_RECORD_FIELDS].map(o => o.id);

  const isIn = (str: string | null | undefined) => {
    let inStr = false;
    oidStrList.forEach(o => {
      if ((str || '').indexOf(o) >= 0) {
        inStr = true;
      }
    });
    return inStr;
  };

  list.forEach(control => {
    const commonObj = control;

    if (_.includes([26, 27, 29], control.mdType) && !isIn(control.oid)) {
      const type = control.mdType;

      if (type === 26) {
        //人员字段拆分
        const isExternalUser = _.get(control, 'controlSetting.advancedSetting.usertype') === '2'; // 外部成员

        if (isExternalUser) {
          initWorkSheetFields.push({
            ...commonObj,
            id: `${control.id}_pName`,
            oid: `${control.oid}_pName`,
          });
        } else {
          PERSONNEL_FIELDS.forEach(item => {
            const childField = {
              ...commonObj,
              id: `${control.id}_${item.id}`,
              name: `${control.name} - ${item.name}`,
              alias: `${control.alias || control.name} - ${item.name}`,
              oid: `${control.oid}_${item.id}`,
            };
            initWorkSheetFields.push(childField);
          });
        }
      } else {
        (type === 27 ? DEPT_FIELDS : RELATED_RECORD_FIELDS).forEach(item => {
          //部门和关联记录字段拆分
          const childField = {
            ...commonObj,
            id: `${control.id}_${item.id}`,
            name: `${control.name} - ${item.name}`,
            alias: `${control.alias || control.name} - ${item.name}`,
            oid: `${control.oid}_${item.id}`,
          };
          initWorkSheetFields.push(childField);
        });
      }
    } else {
      initWorkSheetFields.push(commonObj);
    }
  });
  return initWorkSheetFields;
};

export const hsMorePkControl = (preNode: CanvasNode | undefined, list: CanvasNode[]) => {
  //多源且多主键的情况
  const pks = (preNode?.nodeConfig?.fields || []).filter(o => o.isPk);
  const sourceNodes = list.filter(o => ['SOURCE_TABLE'].includes(o.nodeType));
  const destNodes = list.find(o => ['DEST_TABLE'].includes(o.nodeType));
  return (
    pks.length > 1 &&
    (sourceNodes.length > 1 || _.get(destNodes, 'nodeConfig.config.dsType') === DATABASE_TYPE.APPLICATION_WORKSHEET)
  );
};

export const getUnionFeids = (defaultFields: SyncField[] = [], list: CanvasNode[], node: CanvasNode) => {
  const { leftTableId, rightTableId } = node.nodeConfig?.config || {};
  let leftNode = list.find(o => o.nodeId === leftTableId);
  let rightNode = list.find(o => o.nodeId === rightTableId);
  const leftFields = (leftNode?.nodeConfig?.fields || []).filter(o => o.isCheck);
  const rightFields = (rightNode?.nodeConfig?.fields || []).filter(o => o.isCheck);
  let othersFields = rightFields;
  const fields: UnionField[] = leftFields.map(o => {
    let rightField = rightFields.find(it => it.alias === o.alias && it.jdbcTypeId === o.jdbcTypeId);

    if (rightField) {
      othersFields = othersFields.filter(it => it.id !== rightField.id);
    }

    return { leftField: o, rightField: rightField, resultField: o };
  });
  return setAllUnionFieldsCheck([
    ...fields,
    ...othersFields.map(o => {
      return { rightField: o, resultField: o };
    }),
  ]).map(o => {
    return {
      ...o,
      resultField: {
        ...o.resultField,
        isCheck: !!defaultFields.find(it => it.id === o.resultField.id)?.isCheck,
      },
    };
  });
};

export const setAllUnionFieldsCheck = (fieldList: UnionField[], setCheck?: boolean) => {
  const fields = setCheck
    ? fieldList.map(it => {
        return {
          ...it,
          resultField: {
            ...it.resultField,
            isCheck: true,
          },
        };
      })
    : fieldList;
  return fields.map(o => {
    let data = fields.filter(it => _.get(it, 'resultField.alias') === _.get(o, 'resultField.alias'));

    //同名只能勾选一个
    if (data.length > 1 && _.get(o, 'resultField.id') !== _.get(data[0], 'resultField.id')) {
      return { ...o, resultField: { ...o.resultField, isCheck: false } };
    } else {
      return o;
    }
  });
};

export const setFeildAlias = <T extends SyncField>(fields: T[]): T[] => {
  let newFeilds: T[] = [];
  let result = _.groupBy(fields, 'alias');
  _.forEach(result, a => {
    if (a.length > 1) {
      a.map((it, i) => {
        newFeilds = newFeilds.concat({ ...it, alias: `${it.alias || _l('未命名')}${i > 0 ? i : ''}` });
      });
    } else {
      newFeilds = newFeilds.concat(a);
    }
  });
  return newFeilds;
};

export const getNodeName = (
  flowData: { datasources?: { id?: string | undefined; name?: string | undefined }[] | undefined },
  nodeData: Partial<Pick<CanvasNode, 'nodeType' | 'nodeConfig' | 'name'>>,
) => {
  const defaultInfo = NODE_TYPE_LIST.find(it => it.nodeType === nodeData.nodeType);
  const sourceName = (
    (flowData.datasources || []).find(o =>
      [
        _.get(nodeData, 'nodeConfig.config.datasourceId'),
        _.get(nodeData, 'nodeConfig.config.dataSourceId'),
        _.get(nodeData, 'nodeConfig.config.dataDestId'),
      ].includes(o.id),
    ) || {}
  ).name;
  return (
    (['DEST_TABLE', 'SOURCE_TABLE'].includes(nodeData.nodeType || '')
      ? _.get(nodeData, 'nodeConfig.config.dsType') === DATABASE_TYPE.APPLICATION_WORKSHEET
        ? _l('应用工作表')
        : sourceName || nodeData.name
      : nodeData.name) ||
    defaultInfo?.name ||
    ''
  );
};

export const isTimeTypes = (data: Pick<SyncField, 'jdbcTypeId'>) => {
  return [91, 93, 2013, 92, 2014].includes(data.jdbcTypeId ?? NaN);
};

export const getDefaultAggregate = (jdbcTypeId: number | null | undefined) => {
  if (92 === jdbcTypeId) return 'HOUR_FOR_TIME';
  if (2013 === jdbcTypeId) return 'CUR_HOUR';
  return 'TODAY';
};

//时间字段的归组方式
export const getTimeGroupDropData = (jdbcTypeId: number | null | undefined) => {
  if ([92].includes(jdbcTypeId ?? NaN)) {
    // 时间：时、分
    // 集合：时
    return [...ONLY_TIME_DATA_PARTICLE, ...TIME_GATHER_PARTICLE].filter(o =>
      ['TIME', 'HOUR_FOR_TIME', 'HOUR'].includes(o.value),
    );
  }

  if ([2013].includes(jdbcTypeId ?? NaN)) {
    // 时间：时、分
    // 集合：时
    return [...TIME_DATA_PARTICLE, ...TIME_GATHER_PARTICLE].filter(o =>
      ['CUR_HOUR', 'CUR_MINUTE', 'HOUR'].includes(o.value),
    );
  }

  if ([91, 93, 2014].includes(jdbcTypeId ?? NaN)) {
    return [...DATE_TIME_DATA_PARTICLE, ...TIME_GATHER_PARTICLE];
  }

  return undefined;
};

//获取当前字段的集合配置
export const getAggData = (data: {
  aggFuncType?: string | undefined;
}): Partial<(typeof ALL_OPERATION_TYPE_DATA)[number]> => {
  return ALL_OPERATION_TYPE_DATA.find(a => a.value === data.aggFuncType) || {};
};

//获取当前字段可配置的集合配置
export const getAggregateData = (jdbcTypeId: number | null | undefined, isRowsCount?: boolean) => {
  return OPERATION_TYPE_DATA.filter(it =>
    isRowsCount
      ? it.value === 'COUNT'
      : text_jdbcTypeIds.includes(jdbcTypeId ?? NaN)
        ? ['MAX', 'MIN'].includes(it.value) //文本类型=>最大值|最小值
        : time_jdbcTypeIds.includes(jdbcTypeId ?? NaN)
          ? ['COUNT', 'DISTINCT_COUNT'].includes(it.value)
          : num_jdbcTypeIds.includes(jdbcTypeId ?? NaN)
            ? ['SUM', 'MAX', 'MIN', 'AVG', 'COUNT', 'DISTINCT_COUNT'].includes(it.value) //数值类型=>求和|平均值|最大值|最小值,计数，去重计数
            : !['COUNT', 'DISTINCT_COUNT'].includes(it.value),
  );
};
