import _ from 'lodash';
import {
  DATABASE_TYPE,
  DEPT_FIELDS,
  isPostgresqlDestinationType,
  isValidName,
  namePattern,
  PERSONNEL_FIELDS,
  RELATED_RECORD_FIELDS,
  SYSTEM_FIELD_IDS,
} from 'src/pages/integration/dataIntegration/constant.js';
import { DEFAULT_DATA } from 'src/pages/widgetConfig/config/widget.js';
import { canSetAsTitle, enumWidgetType } from 'src/pages/widgetConfig/util';
import type {
  MatchedTypes,
  SyncField,
  SyncMapping,
  SyncWorksheetControl,
} from './connector/components/OnlySyncStep/connectorTypes';

type IntegrationWorksheetControl = Pick<
  SyncWorksheetControl,
  | 'controlId'
  | 'controlName'
  | 'alias'
  | 'type'
  | 'advancedSetting'
  | 'enumDefault'
  | 'dot'
  | 'required'
  | 'strDefault'
  | 'sourceControlType'
  | 'remark'
>;
type WidgetDefaults = Pick<SyncWorksheetControl, 'advancedSetting' | 'enumDefault' | 'type' | 'dot' | 'controlName'>;

export const getInitFieldsMapping = (
  sourceFields: SyncField[],
  isSourceAppType: boolean,
  destDsType: string | undefined,
): SyncMapping[] => {
  const isDestAppType = destDsType === DATABASE_TYPE.APPLICATION_WORKSHEET;
  const needReplace = !isSourceAppType || !isDestAppType;
  const isExistJoinPk = !!(sourceFields || []).filter(item => item.isUniquePk).length;
  const mapping = sourceFields.map(item => {
    const getInitName = () => {
      if (destDsType === DATABASE_TYPE.MONGO_DB && item.isPk) {
        return '_id';
      } else {
        if (isSourceAppType && isDestAppType && item.isUniquePk) {
          return 'rowid';
        } else {
          let n = needReplace ? item.name.replace(namePattern, '') : item.name;

          if (isPostgresqlDestinationType(destDsType)) {
            n = n.toLowerCase();
          }

          return n;
        }
      }
    };

    const initDestName = getInitName();
    const initDestAliasRaw = item.alias || initDestName;
    const initDestAlias = isPostgresqlDestinationType(destDsType) ? initDestAliasRaw.toLowerCase() : initDestAliasRaw;

    return {
      sourceField: item,
      destField: {
        dependFieldIds: [item.id],
        isCheck: item.isPk,
        //存在多表连接主键，joinPK不允许为null, 其余主键必须允许为null;
        //不存在多表连接，主键不允许为null
        isNotNull: isExistJoinPk ? item.isUniquePk : item.isPk,
        isPk: item.isPk,
        isUniquePk: item.isUniquePk,
        name: initDestName,
        alias: initDestAlias,
        dataType: null,
        jdbcTypeId: null,
        precision: null,
        scale: null,
        mdType: item.isUniquePk ? item.mdType : null, //仅用于工作表
        controlSetting: null, //仅用于工作表

        id: null,
        status: 'NORMAL',
        orderNo: null,
        isTitle: false, //仅用于工作表
        comment: isSourceAppType ? item.controlSetting?.remark : item.comment,
      },
    };
  });
  return getDuplicateFieldsRenamedList(mapping);
};

export const getDuplicateFieldsRenamedList = <T extends { destField: { name: string } }>(list: T[]): T[] => {
  const counts = new Map<string, number>();
  list.forEach(item => {
    const fieldName = item.destField.name;
    const count = (counts.get(fieldName) || 0) + 1;
    counts.set(fieldName, count);
    if (count > 1) {
      item.destField.name = fieldName + Math.floor(Math.random() * 10000);
    }
  });
  return list;
};

export const getInitWorkSheetFields = (
  controls: IntegrationWorksheetControl[],
  isGetDest: boolean | undefined,
  isSourceAppType: boolean | undefined,
  isDestAppType: boolean,
  workSheetId: string,
  withRowId?: boolean,
  withSys?: boolean,
): SyncField[] => {
  const initWorkSheetFields: SyncField[] = [];
  const rowIDField: SyncField[] = (controls || [])
    .filter(c => c.controlId === 'rowid')
    .map(rowId => {
      return {
        id: 'rowid',
        oid: workSheetId + '_rowid',
        name: 'rowid',
        alias: 'rowid',
        dataType: null,
        jdbcTypeId: null,
        precision: 0,
        scale: 0,
        isPk: true,
        isNotNull: true,
        isCheck: true,
        status: 'NORMAL',
        mdType: rowId.type,
        isTitle: false,
        orderNo: null,
        controlSetting: {
          advancedSetting: rowId.advancedSetting,
          enumDefault: rowId.enumDefault,
          dot: rowId.dot,
          remark: rowId.remark,
        },
      };
    });

  controls
    .filter(c =>
      //目的地表或表到表情况，过滤系统字段
      isGetDest || (isSourceAppType && isDestAppType && !withSys)
        ? !_.includes(SYSTEM_FIELD_IDS, c.controlId)
        : c.controlId !== 'rowid',
    )
    .forEach(control => {
      if (typeof control.controlName !== 'string') throw new TypeError('Missing worksheet control name');
      const commonObj = {
        id: control.controlId,
        oid: `${workSheetId}_${control.controlId}`,
        name: control.controlName,
        alias: control.alias || control.controlName,
        dataType: null,
        jdbcTypeId: null,
        precision: 0,
        scale: 0,
        isPk: false,
        isNotNull: control.required,
        isCheck: false,
        status: 'NORMAL',
        mdType: control.type,
        isTitle: false,
        orderNo: null,
        controlSetting: {
          advancedSetting: control.advancedSetting,
          enumDefault: control.enumDefault,
          dot: control.dot,
          strDefault: control.strDefault,
          sourceControlType: control.sourceControlType,
          remark: control.remark,
        },
      };

      if (!isDestAppType && _.includes([26, 27, 29], control.type)) {
        if (control.type === 26) {
          //人员字段拆分
          const isExternalUser = control.advancedSetting?.usertype === '2'; // 外部成员

          if (isExternalUser) {
            initWorkSheetFields.push({
              ...commonObj,
              id: `${control.controlId}_pName`,
              oid: `${workSheetId}_${control.controlId}_pName`,
            });
          } else {
            PERSONNEL_FIELDS.forEach(item => {
              const childField = {
                ...commonObj,
                id: `${control.controlId}_${item.id}`,
                oid: `${workSheetId}_${control.controlId}_${item.id}`,
                name: `${control.controlName}_${item.name}`,
                alias: `${control.alias || control.controlName}_${item.name}`,
              };
              initWorkSheetFields.push(childField);
            });
          }
        } else {
          (control.type === 27 ? DEPT_FIELDS : RELATED_RECORD_FIELDS).forEach(item => {
            //部门和关联记录字段拆分
            const childField = {
              ...commonObj,
              id: `${control.controlId}_${item.id}`,
              oid: `${workSheetId}_${control.controlId}_${item.id}`,
              name: `${control.controlName}_${item.name}`,
              alias: `${control.alias || control.controlName}_${item.name}`,
            };
            initWorkSheetFields.push(childField);
          });
        }
      } else {
        initWorkSheetFields.push(commonObj);
      }
    });

  return isSourceAppType || withRowId ? rowIDField.concat(initWorkSheetFields) : initWorkSheetFields;
};

export const getMatchedFieldsOptions = (
  types: MatchedTypes | null | undefined,
  sourceField: SyncField,
  destFields: SyncField[] | null | undefined,
  _isSourceAppType: boolean | undefined,
  isDestAppType: boolean | undefined,
): SyncField[] => {
  const matchedTypeIds = _.uniq((types || {})[String(sourceField.id)] || []).map(type => type.dataType);
  const matchedMdTypeIds = _.uniq((types || {})[String(sourceField.id)] || []).map(type => type.mdType);

  const matchedFieldsOptions = isDestAppType
    ? (destFields || []).filter(o => _.includes(matchedMdTypeIds, o.mdType))
    : (destFields || []).filter(o => _.includes(matchedTypeIds, o.jdbcTypeId));
  return matchedFieldsOptions;
};

export const getDefaultData = (
  mapping: SyncMapping[] | null | undefined,
  types: MatchedTypes | null | undefined,
  isSetDefaultFields: boolean | undefined,
  destFields: SyncField[] | null | undefined,
  isSourceAppType: boolean | undefined,
  isDestAppType: boolean | undefined,
  notCanvas?: boolean,
): SyncMapping[] => {
  const widgetDefaults: Readonly<Partial<Record<string, WidgetDefaults>>> = DEFAULT_DATA;
  let hasSetFields: Record<string, number> = {};
  let isSetTitle = false; //是否已经设置过标题默认值

  const newFieldsMapping = (mapping || []).map(item => {
    const isValidField = isValidName(item.sourceField.name) || isSourceAppType;

    //设置默认选中字段(第一个名称相同的字段)--仅对于选择已有表情况
    if (isSetDefaultFields) {
      const matchedFields = getMatchedFieldsOptions(
        types,
        item.sourceField,
        destFields,
        isSourceAppType,
        isDestAppType,
      );
      const sameNameFields = matchedFields.filter(f => f.name === item.sourceField.name);
      const sameNameField = sameNameFields[0];

      if (!item.destField.id && sameNameField && !hasSetFields[sameNameField.name]) {
        hasSetFields[sameNameField.name] = 1;
        return {
          sourceField: { ...item.sourceField, isCheck: isValidField },
          destField: isValidField
            ? {
                ...item.destField,
                isCheck: true,
                isPk: sameNameField.isPk,
                isNotNull: sameNameField.isNotNull,
                id: sameNameField.id,
                oid: sameNameField.oid,
                name: sameNameField.name,
                alias: sameNameField.alias,
                dataType: sameNameField.dataType,
                jdbcTypeId: sameNameField.jdbcTypeId,
                precision: sameNameField.precision,
                scale: sameNameField.scale,
                mdType: sameNameField.mdType,
                controlSetting: sameNameField.controlSetting,
              }
            : item.destField,
        };
      }
    }

    const itemOptions = (types || {})[String(item.sourceField.id)] || [];
    const firstOption = itemOptions[0];

    //不支持类型的主键isCheck设置为false
    if (!firstOption) {
      return {
        sourceField: { ...item.sourceField, isCheck: false },
        destField: { ...item.destField, isCheck: false },
      };
    }

    //过滤出和源字段类型一样的字段，没有则返回{}
    const initOption = itemOptions.filter(o =>
      isDestAppType ? o.mdType === item.sourceField.mdType : o.typeName.toLowerCase() === item.sourceField.dataType,
    )[0];

    //工作表-默认controlSetting
    const ENUM_TYPE: unknown = firstOption.mdType == null ? undefined : enumWidgetType[firstOption.mdType];
    const settingData =
      ENUM_TYPE === 'DATE_TIME'
        ? { type: firstOption.mdType, advancedSetting: { showtype: '6' } }
        : {
            ..._.omit(typeof ENUM_TYPE === 'string' ? widgetDefaults[ENUM_TYPE] : undefined, ['controlName']),
            type: firstOption.mdType,
            dot: firstOption.defaultScale,
          };

    //工作表-设置默认类型，是否可设置默认标题判断
    const mdType = item.destField.isUniquePk ? 2 : (initOption || firstOption).mdType;
    const canSetTitle = canSetAsTitle({ type: mdType }) && (item.sourceField.oid || '').split('_')[1] !== 'rowid';
    const isTitle = isDestAppType ? notCanvas && canSetTitle && !isSetTitle : null;

    if (!isSetTitle && canSetTitle) {
      isSetTitle = true;
    }

    return {
      sourceField: { ...item.sourceField, disabled: !isValidField },
      destField: !isSetDefaultFields
        ? {
            ...item.destField,
            dataType: (initOption || firstOption).typeName.toLowerCase(),
            jdbcTypeId: (initOption || firstOption).dataType,
            precision: (initOption || firstOption).maxLength,
            scale: (initOption || firstOption).defaultScale,
            //工作表
            mdType,
            controlSetting: isDestAppType
              ? _.pick(settingData, ['advancedSetting', 'enumDefault', 'type', 'dot'])
              : null,
            isTitle,
          }
        : item.destField,
    };
  });

  return newFieldsMapping;
};

export const isNotSupportField = (sourceField: SyncField, matchedTypes: MatchedTypes) => {
  const isOtherTable_onlyDisplay_orLink =
    sourceField.mdType === 30 &&
    (sourceField.controlSetting?.strDefault === '10' || sourceField.controlSetting?.sourceControlType === 21); //他表字段-仅显示,他表字段-自由连接类型
  const isRelated_multiple = sourceField.mdType === 29 && sourceField.controlSetting?.enumDefault === 2; //关联记录-多条
  const isNotSupport =
    !(matchedTypes[String(sourceField.id)] || []).length || isOtherTable_onlyDisplay_orLink || isRelated_multiple;
  return isNotSupport;
};

/** The legacy form protocol forwards the first JSON value unchanged, including opaque values. */
function firstJsonSelection(raw: unknown): unknown {
  const parsed: unknown = JSON.parse(String(raw));
  if (parsed === null) throw new TypeError('Invalid connection selection');
  if (typeof parsed === 'string' || Array.isArray(parsed)) return parsed[0];
  if (typeof parsed === 'object') return Reflect.get(parsed, '0');
  return undefined;
}

interface ConnectionExtraParams {
  /** These form values are forwarded unchanged; this helper only reads the first serialized selection. */
  serviceName?: unknown;
  SID?: unknown;
  isSrvProtocol?: unknown;
  authType?: unknown;
  saslMechanism?: unknown;
}
export const getExtraParams = (type: string | undefined, formData: Record<string, unknown>): ConnectionExtraParams => {
  let extraParams: ConnectionExtraParams = {};

  switch (type) {
    case DATABASE_TYPE.ORACLE:
      extraParams = {
        [firstJsonSelection(formData['serviceType']) === 'ServiceName' ? 'serviceName' : 'SID']:
          formData['serviceName'],
      };
      break;
    case DATABASE_TYPE.MONGO_DB:
      extraParams = { isSrvProtocol: formData['isSrvProtocol'] };
      break;
    case DATABASE_TYPE.KAFKA:
      extraParams = {
        authType: firstJsonSelection(formData['authType']),
        saslMechanism: formData['saslMechanism'] ? firstJsonSelection(formData['saslMechanism']) : undefined,
      };
  }

  return extraParams;
};
