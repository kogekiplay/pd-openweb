import type { MouseEventHandler } from 'react';
import { Fragment } from 'react';
import _ from 'lodash';
import moment from 'moment';
import { renderText as renderCellText } from 'src/utils/control';
import type { FormControl } from 'src/utils/controlTypes';
import { CUR_DEPARTMENT, CUR_ROLE, CUR_USER } from '../config';
import type { DynamicInputProps } from '../dynamicTypes';
import type { DynamicValueSource } from '../dynamicTypes';
import { dynamicDisplayPath, dynamicDisplayRecord, dynamicDisplayValue, dynamicObject } from '../dynamicTypes';
import { FieldInfo, OtherFieldList, RelateControl } from '../styled';
import { getControlType, getDateType, getTypeList, showClear } from '../util';
import OtherField from './OtherField';

const isOnlySelect = (dynamicValue: DynamicValueSource[], data: FormControl) => {
  const type = getControlType(data);
  if (type === 'text') return false;
  if (type === 'user') {
    if (data.enumDefault === 1 && dynamicValue.length < 1) return true;
    return false;
  }

  return _.some(dynamicValue, item => !!item.cid);
};

const getValue = (item: DynamicValueSource, type: string | undefined): unknown => {
  if (type === 'date' || type === 'time') return item.staticValue;
  if (_.includes(['cascader', 'relateSheet'], type)) {
    return item.relateSheetName || JSON.parse(String(item.staticValue));
  }

  const value: unknown = typeof item.staticValue === 'string' ? JSON.parse(item.staticValue) : item.staticValue;

  if (_.includes(['email', 'phone', 'user'], type) && _.get(value, 'accountId') === 'user-self') {
    return { ...dynamicObject(value), name: CUR_USER[0]?.text };
  }

  if (type === 'department' && _.get(value, 'departmentId') === 'user-departments') {
    return { ...dynamicObject(value), departmentName: CUR_DEPARTMENT[0]?.text };
  }

  if (type === 'role' && _.get(value, 'organizeId') === 'user-role') {
    return { ...dynamicObject(value), organizeName: CUR_ROLE[0]?.text };
  }

  return value;
};

const parseValue = (value: unknown): unknown => {
  if (_.isArray(value)) return value;
  try {
    if (typeof value === 'string' && _.isArray(JSON.parse(value))) return JSON.parse(value);
  } catch (error) {
    console.log(error);
    return value;
  }

  return value;
};

const getPlaceHolder = (data: FormControl) => {
  const text: Record<number, string> = {
    14: _l('请选择'),
    16: _l('请输入日期'),
    26: _l('请输入人员'),
    27: _l('请输入部门'),
    10000008: _l('选择子表或关联记录'),
  };
  return data.type === undefined ? undefined : text[data.type];
};

interface OtherFieldListProps extends Omit<
  DynamicInputProps,
  'allControls' | 'onChange' | 'clearOldDefault' | 'dynamicValue'
> {
  dynamicValue?: DynamicInputProps['dynamicValue'] | undefined;
  allControls?: FormControl[] | undefined;
  onChange?: DynamicInputProps['onChange'] | undefined;
  clearOldDefault?: DynamicInputProps['clearOldDefault'] | undefined;
  onClick?: MouseEventHandler<HTMLDivElement> | undefined;
  removeItem?: ((id: string) => void) | undefined;
  removeRelateSheet?: ((value: string | number | undefined) => void) | undefined;
  titleControl?: FormControl | undefined;
  formatMode?: string | undefined;
}

export default ({
  dynamicValue = [],
  onClick,
  data,
  removeItem,
  removeRelateSheet,
  titleControl,
  totalWidth,
  ...rest
}: OtherFieldListProps) => (
  <OtherFieldList
    isHaveField={isOnlySelect(dynamicValue, data)}
    onClick={onClick}
    isHaveClear={showClear(data, dynamicValue)}
    totalWidth={totalWidth}
  >
    <Fragment>
      {_.isEmpty(dynamicValue) ? (
        <span className="textPlaceholder LineHeight20 mTop5">{getPlaceHolder(data)}</span>
      ) : (
        <Fragment>
          {dynamicValue.map((item, index) => {
            if (item.staticValue !== undefined && item.staticValue !== '') {
              const type = getControlType(data);

              try {
                const value = getValue(item, type);

                if (_.includes(['user-self'], _.get(value, 'accountId')) && type !== 'user') {
                  return (
                    <OtherField
                      className="timeField"
                      dynamicValue={dynamicValue}
                      data={data}
                      item={item}
                      text={dynamicDisplayRecord(value).name}
                      {...rest}
                    />
                  );
                }

                if (type === 'user') {
                  const { accountId, fullname, avatar, name } = dynamicDisplayRecord(value);

                  return (
                    <FieldInfo key={accountId}>
                      {accountId === 'user-self' ? (
                        <div className="departWrap">
                          <i className="icon-account_circle"></i>
                        </div>
                      ) : (
                        <img
                          className="avatar"
                          src={
                            _.includes(avatar, 'UserAvatar')
                              ? avatar
                              : `${md.global.FileStoreConfig.pictureHost}/UserAvatar/${avatar}`
                          }
                        />
                      )}

                      <div className="name">{fullname || name}</div>
                      <div
                        className="remove"
                        onClick={e => {
                          e.stopPropagation();
                          if (accountId !== undefined) removeItem?.(accountId);
                          else rest.onDynamicValueChange(dynamicValue.filter((_item, at) => at !== index));
                        }}
                      >
                        <i className="icon-close" />
                      </div>
                    </FieldInfo>
                  );
                }

                if (type === 'role') {
                  const { organizeId, organizeName } = dynamicDisplayRecord(value);

                  return (
                    <FieldInfo key={organizeId}>
                      <div className="departWrap">
                        <i className="icon-group"></i>
                      </div>
                      <div className="name">{organizeName}</div>
                      <div
                        className="remove"
                        onClick={e => {
                          e.stopPropagation();
                          if (organizeId !== undefined) removeItem?.(organizeId);
                          else rest.onDynamicValueChange(dynamicValue.filter((_item, at) => at !== index));
                        }}
                      >
                        <i className="icon-close" />
                      </div>
                    </FieldInfo>
                  );
                }

                if (type === 'department') {
                  const { departmentName, departmentId } = dynamicDisplayRecord(value);
                  return (
                    <FieldInfo key={departmentId}>
                      <div className="departWrap">
                        <i className="icon-department"></i>
                      </div>
                      <div className="name">{departmentName}</div>
                      <div
                        className="remove"
                        onClick={e => {
                          e.stopPropagation();
                          if (departmentId !== undefined) removeItem?.(departmentId);
                          else rest.onDynamicValueChange(dynamicValue.filter((_item, at) => at !== index));
                        }}
                      >
                        <i className="icon-close" />
                      </div>
                    </FieldInfo>
                  );
                }

                if (type === 'date' || type === 'time') {
                  const types = getDateType(data);
                  let text = '';

                  if (_.includes(['2', '3'], value)) {
                    text = _.find(types, type => type.value === value)?.text || '';
                  } else {
                    text = moment(item.staticValue).format(rest.formatMode);
                  }

                  return (
                    <OtherField
                      className="timeField"
                      dynamicValue={dynamicValue}
                      data={data}
                      item={item}
                      text={text}
                      {...rest}
                    />
                  );
                }

                if (type === 'switch') {
                  const text = _.get(_.find(getTypeList(data), ct => ct.id === String(item.staticValue)) || {}, 'text');
                  return (
                    <OtherField
                      className="timeField"
                      dynamicValue={dynamicValue}
                      data={data}
                      item={item}
                      text={text}
                      {...rest}
                    />
                  );
                }

                if (type === 'location') {
                  return (
                    <OtherField
                      className="timeField"
                      dynamicValue={dynamicValue}
                      data={data}
                      item={item}
                      text={_l('自定义')}
                      {...rest}
                    />
                  );
                }

                if (_.includes(['cascader', 'relateSheet'], type)) {
                  const parsedValue = parseValue(value);
                  const removeValue = item.staticValue;

                  if (_.isArray(parsedValue)) {
                    return parsedValue.map((item: unknown, index) => {
                      let name;

                      if (_.isObject(item)) {
                        name = dynamicDisplayRecord(item).fullname || dynamicDisplayRecord(item).name;
                      } else {
                        const record = dynamicObject(safeParse(item));

                        if (type === 'cascader' && _.get(data, 'advancedSetting.allpath') === '1') {
                          name = dynamicDisplayPath(record);
                        } else {
                          const titleControlItem = titleControl?.controlId ? record[titleControl.controlId] : undefined;
                          name = renderCellText({ ...titleControl, value: titleControlItem }) || _l('未命名');
                        }
                        // 处理关联表默认记录的标题字段是人员字段情况
                        // if (/\[\{['"]accountId["']:\s*['"].*['"].*\}\]/.test(titleControlItem)) {
                        //   const firstUser = _.head(JSON.parse(titleControlItem));
                        //   name = firstUser.fullname || firstUser.name;
                        // }
                      }

                      return (
                        <RelateControl key={index}>
                          <i
                            className={`${type === 'cascader' ? 'icon-cascade_selection' : 'icon-link-worksheet-relate'}`}
                          />
                          <span className="overflow_ellipsis">{name}</span>
                          <i
                            className="icon-close"
                            onClick={e => {
                              e.stopPropagation();
                              removeRelateSheet?.(removeValue);
                            }}
                          ></i>
                        </RelateControl>
                      );
                    });
                  }

                  return (
                    <RelateControl>
                      <i
                        className={`${type === 'cascader' ? 'icon-cascade_selection' : 'icon-link-worksheet-relate'}`}
                      />
                      <span className="overflow_ellipsis">{dynamicDisplayValue(value)}</span>
                      <i
                        className="icon-close"
                        onClick={e => {
                          e.stopPropagation();
                          removeRelateSheet?.(removeValue);
                        }}
                      ></i>
                    </RelateControl>
                  );
                }

                return <OtherField dynamicValue={dynamicValue} data={data} item={item} {...rest} />;
              } catch (error) {
                console.log(error);
                return null;
              }
            } else {
              return <OtherField key={index} dynamicValue={dynamicValue} data={data} item={item} {...rest} />;
            }
          })}
        </Fragment>
      )}
    </Fragment>
    {showClear(data, dynamicValue) && (
      <div
        className="clearOp"
        onClick={e => {
          e.stopPropagation();
          rest.onDynamicValueChange([]);
        }}
      >
        <span className="icon icon-cancel Font15"></span>
      </div>
    )}
  </OtherFieldList>
);
