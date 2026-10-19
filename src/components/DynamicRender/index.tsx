import { Fragment, useCallback, useEffect, useState } from 'react';
import { Select } from 'antd';
import _ from 'lodash';
import { Icon, Input, Radio } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import './index.less';

/** Cloud-print metadata from Worksheet.LoadCloudPrintDatas (serviceType 0), and its actual UI writes.
 * The eight known field keys form a union; extra wire properties stay on the original objects.
 * Descriptions parsed from user JSON are opaque and are only handed to the legacy renderer.
 */
export interface CloudControlOption {
  value?: string | undefined;
  label?: import('react').ReactNode;
  disabled?: boolean;
}
export interface CloudMapping {
  fromKey?: string | number | undefined;
  isDetail?: boolean | undefined;
  toControlId?: string | undefined;
  fromTableName?: string | undefined;
  toControlOptions?: CloudControlOption[] | undefined;
}
export interface CloudSourceField {
  text?: string | number | undefined;
  tableName?: string | undefined;
  desc?: unknown;
  sheetName?: string | undefined;
  sheetIndex?: number | undefined;
}
export interface CloudSystemField {
  controlId?: string | undefined;
  tableName?: string | undefined;
  // The renderer can select its deleted-control option, whose label is a React element.
  controlName?: import('react').ReactNode;
  toControlOptions?: CloudControlOption[] | undefined;
}
interface CloudFieldMetadata {
  title?: string | undefined;
  desc?: string | undefined;
  hint?: string | undefined;
  required?: boolean | undefined;
}
type CloudTextKey = 'name' | 'sn' | 'templateId';
type CloudTextField = {
  [K in CloudTextKey]: CloudFieldMetadata & {
    fieldKey: K;
    type: 'text';
    value?: string | undefined;
    placeholder?: string | undefined;
  };
}[CloudTextKey];
export type CloudPrintField =
  | CloudTextField
  | (CloudFieldMetadata & { fieldKey: 'serviceKey'; type: 'title'; value?: string | undefined })
  | (CloudFieldMetadata & {
      fieldKey: 'cloudPrintType';
      type: 'radio';
      value?: string | undefined;
      options?: Array<{ value: string; text?: string | undefined }> | undefined;
    })
  | (CloudFieldMetadata & {
      fieldKey: 'linkButton';
      type: 'button';
      value?: string | undefined;
      name?: string | undefined;
      link?: string | undefined;
    })
  | (CloudFieldMetadata & {
      fieldKey: 'functionFields';
      type: 'function';
      value?: string | undefined;
      name?: string | undefined;
      onClick?: (() => void) | undefined;
    })
  | (CloudFieldMetadata & {
      fieldKey: 'renderData';
      type: 'mapping';
      value?: CloudMapping[] | undefined;
      masterDesc?: string | undefined;
      subDesc?: string | undefined;
      fromField?: { title?: string | undefined; fields?: CloudSourceField[] | undefined } | undefined;
      systemField?: { title?: string | undefined; fields?: CloudSystemField[] | undefined } | undefined;
    });
export type CloudFieldKey = CloudPrintField['fieldKey'];
/** Lodash's object matcher chooses exactly this discriminant; no copying or validation is performed. */
export type FindCloudField = <K extends CloudFieldKey>(
  data: CloudPrintField[] | undefined,
  matcher: { fieldKey: K },
) => Extract<CloudPrintField, { fieldKey: K }> | undefined;
export interface DynamicRenderProps<Field extends CloudPrintField = CloudPrintField> {
  data?: Field[] | undefined;
  onChange?: ((data: Field[]) => void) | undefined;
}

/** The control type and field key supplied by renderField select a fixed member of the wire union. */
export type CloudScalarField = Extract<CloudPrintField, { type: 'text' | 'radio' }>;
export type CloudMappingField = Extract<CloudPrintField, { type: 'mapping' }>;
type FindMappingIndex = (values: CloudMapping[] | undefined, predicate: (value: CloudMapping) => unknown) => number;
export interface CloudFieldChange {
  (value: string, type: 'text', fieldKey: CloudTextKey): void;
  (value: string, type: 'radio', fieldKey: 'cloudPrintType'): void;
  (value: CloudControlOption, type: 'mapping', fieldKey: 'renderData', fieldIndex: number): void;
}

export default function DynamicRender<Field extends CloudPrintField = CloudPrintField>(
  props: DynamicRenderProps<Field>,
) {
  const { data = [], onChange } = props;
  const [formData, setFormData] = useState(data);

  useEffect(() => {
    setFormData(data);
  }, [data]);

  const handleChange = useCallback<CloudFieldChange>(
    (
      value: string | CloudControlOption,
      type: 'text' | 'radio' | 'mapping',
      fieldKey: CloudTextKey | 'cloudPrintType' | 'renderData',
      fieldIndex?: number,
    ) => {
      setFormData(prevData => {
        const newData = [...prevData];
        const index = newData.findIndex(item => item.fieldKey === fieldKey);

        if (['text', 'radio'].includes(type)) {
          newData[index] = { ...newData[index]!, value };
        } else if (type === 'mapping') {
          // mapping 类型：更新对应字段的映射值

          const currentValue = (newData[index]! as CloudMappingField).value![fieldIndex!]!;
          currentValue.toControlId = (value as CloudControlOption).value;

          if (!(newData[index] as CloudMappingField | undefined)?.systemField?.fields) {
            (newData[index]! as CloudMappingField).systemField!.fields! = [];
          }

          const currentField = (newData[index]! as CloudMappingField).systemField!.fields![fieldIndex!];
          (newData[index]! as CloudMappingField).systemField!.fields![fieldIndex!] = {
            ...currentField,
            controlId: (value as CloudControlOption).value,
            controlName: (value as CloudControlOption).label,
          };
        }

        onChange && onChange(newData);
        return newData;
      });
    },
    [onChange],
  );

  const renderTitle = (item: CloudFieldMetadata) => {
    if (!item.title) return null;

    return (
      <div className="dynamicTitleWrap">
        <div className="title">
          <span className="TxtMiddle"> {item.title}</span>
          {item.hint && (
            <Tooltip title={item.hint}>
              <Icon icon="help" className="TxtMiddle hint" />
            </Tooltip>
          )}
        </div>
        {item.desc && <div className="desc">{item.desc}</div>}
      </div>
    );
  };

  const renderField = (item: CloudPrintField) => {
    const { type, value, fieldKey } = item;

    switch (type) {
      case 'text':
        return (
          <div key={fieldKey} className="dynamicField">
            {renderTitle(item)}
            <Input
              className="dynamicInput"
              placeholder={item.placeholder || ''}
              value={value || ''}
              onChange={(val: string) => handleChange(val, type, fieldKey)}
            />
          </div>
        );

      case 'radio':
        return (
          <div key={fieldKey} className="dynamicField">
            {renderTitle(item)}
            <div className="dynamicRadioBox">
              {item.options?.map((option, optIndex) => (
                <Radio
                  key={optIndex}
                  value={option.value}
                  text={option.text}
                  checked={value === option.value}
                  onClick={() => handleChange(option.value, type, fieldKey)}
                />
              ))}
            </div>
          </div>
        );

      case 'button':
        return (
          <div key={fieldKey} className="dynamicField">
            {renderTitle(item)}
            <div
              className="dynamicButton"
              onClick={() => {
                if (item.link) {
                  window.open(item.link);
                }
              }}
            >
              {item.name}
              {item.link && <Icon icon="arrow-right-border" />}
            </div>
          </div>
        );

      case 'function':
        return (
          <div key={fieldKey} className="dynamicField">
            {renderTitle(item)}
            <div className="functionButton" onClick={item.onClick}>
              {item.name}
            </div>
          </div>
        );

      case 'mapping':
        if (!item.value || !item.value.length) return null;
        const lastMasterFieldIndex =
          (_.findIndex as FindMappingIndex)(item.value, v => v.isDetail) > -1 &&
          (_.findLastIndex as FindMappingIndex)(item.value, v => !v.isDetail);

        return (
          <div key={fieldKey} className="dynamicField mappingField">
            <div className="mappingHeader flexRow alignItemsCenter mBottom20">
              <div className="fromField flex">{item.fromField?.title || _l('源字段')}</div>
              <div style={{ width: 40 }}></div>
              <div className="systemField flex">{item.systemField?.title || _l('系统字段')}</div>
            </div>
            {_.isNumber(lastMasterFieldIndex) ? <div className="Font13 bold mBottom15">{item.masterDesc}</div> : null}
            {item.value.map((fromFieldItem, fieldIndex) => {
              const fromFieldDesc = _.find(item.fromField?.fields, (_v, i) => i === fieldIndex)
                ?.desc as import('react').ReactNode;
              const options = fromFieldItem.toControlOptions || [];
              const isDelete =
                !!fromFieldItem.toControlId && !_.find(options, option => option.value === fromFieldItem.toControlId);

              return (
                <Fragment key={fieldIndex}>
                  {_.isNumber(lastMasterFieldIndex) &&
                  (_.findIndex as FindMappingIndex)(item.value, v => v.isDetail) === fieldIndex ? (
                    <div className="Font13 bold mBottom15 pTop10">{item.subDesc}</div>
                  ) : null}
                  <div key={fieldIndex} className="mappingItem flexRow">
                    <div className="flex minWidth0">
                      <div className="fromField ellipsis">{fromFieldItem.fromKey}</div>
                      {fromFieldDesc && <div className="mTop5 Font12 textSecondary ellipsis">{fromFieldDesc}</div>}
                    </div>
                    <Icon icon="arrow_forward" className="Font20 colorPrimary mLeft10 mRight10 LineHeight36" />
                    <Select<string, CloudControlOption>
                      className="Height36 flex minWidth0"
                      classNames={{ popup: { root: 'mappedFieldPopup' } }}
                      showSearch={{ optionFilterProp: 'label' }}
                      optionLabelProp="label"
                      value={fromFieldItem.toControlId || ''}
                      placeholder={_l('请选择')}
                      options={
                        isDelete
                          ? [
                              {
                                value: fromFieldItem.toControlId,
                                label: <span className="textError">{_l('已删除')}</span>,
                              },
                              ...options,
                            ]
                          : options
                      }
                      onChange={(_value, data) => handleChange(data as CloudControlOption, type, fieldKey, fieldIndex)}
                    />
                  </div>
                </Fragment>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  return <div className="dynamicRenderContainer">{formData.map(item => renderField(item))}</div>;
}
