import cx from 'classnames';
import _ from 'lodash';
import moment from 'moment';
import filterXSS from 'xss';
import { OptionChip } from 'src/components/OptionChip';
import { checkCellIsEmpty, renderText as renderCellText } from 'src/utils/control';
import type { FormControl } from 'src/utils/controlTypes';
import { getDatePickerConfigs } from '../../../../util/setting';
import type { DynamicValueSource } from '../dynamicTypes';
import { dynamicDisplayPath, dynamicDisplayRecord, dynamicDisplayValue, dynamicObject } from '../dynamicTypes';
import { DynamicTextWrap, FieldInfo, OptionControl, RelateControl } from '../styled';
import { getControlType, getDateType, getTypeList } from '../util';
import OtherField from './OtherField';
import type { OtherFieldProps } from './OtherField';

const getValue = (item: DynamicValueSource, type: string | undefined): unknown => {
  if (_.includes(['user', 'role', 'department', 'area', 'cascader', 'relateSheet'], type)) {
    return safeParse(item.staticValue);
  }

  if (_.includes(['email', 'phone'], type) && String(item.staticValue).indexOf('accountId') > -1) {
    return safeParse(item.staticValue);
  }

  return item.staticValue;
};

export default ({
  dynamicValue = [],
  data = {},
  ...rest
}: Omit<OtherFieldProps, 'data'> & { data?: FormControl | undefined }) => {
  if (_.isEmpty(dynamicValue)) return <span>{_l('清空')}</span>;
  if (_.isEmpty(data)) return '';

  return (
    <DynamicTextWrap>
      {dynamicValue.map((item, index) => {
        if (!checkCellIsEmpty(item.staticValue)) {
          const type = getControlType(data);

          try {
            const value = getValue(item, type);

            if (type === 'user' || _.get(value, 'accountId') === 'user-self') {
              const { accountId, fullname, avatar, name } = dynamicDisplayRecord(value);
              let userSrc = _.includes(avatar, 'UserAvatar')
                ? avatar
                : `${md.global.FileStoreConfig.pictureHost}/UserAvatar/${avatar}`;

              if (accountId === 'user-self') {
                userSrc = `${md.global.FileStoreConfig.pictureHost}/UserAvatar/user-self.png?imageView2/1/w/100/h/100/q/90`;
              }

              return (
                <FieldInfo key={accountId} title={fullname || name}>
                  <img className="avatar" src={userSrc} />
                  <div className="name">{fullname || name}</div>
                </FieldInfo>
              );
            }

            if (type === 'role') {
              const { organizeId, organizeName } = dynamicDisplayRecord(value);

              return (
                <FieldInfo key={organizeId} title={organizeName}>
                  <div className="departWrap">
                    <i className="icon-group"></i>
                  </div>
                  <div className="name">{organizeName}</div>
                </FieldInfo>
              );
            }

            if (type === 'department') {
              const { departmentName, departmentId } = dynamicDisplayRecord(value);
              return (
                <FieldInfo key={departmentId} title={departmentName}>
                  <div className="departWrap">
                    <i className="icon-department"></i>
                  </div>
                  <div className="name">{departmentName}</div>
                </FieldInfo>
              );
            }

            if (type === 'date' || type === 'time') {
              const types = getDateType(data);
              let text: string | number | undefined = '';

              if (_.includes(['2', '3'], value)) {
                text = _.find(types, type => type.value === value)?.text || '';
              } else {
                const dateProps = getDatePickerConfigs(data);
                text = type === 'date' ? moment(item.staticValue).format(dateProps.formatMode) : item.staticValue;
              }

              return <span className="dynamicText breakAll">{text}</span>;
            }

            if (type === 'switch') {
              const text = _.get(_.find(getTypeList(data), ct => ct.id === String(item.staticValue)) || {}, 'text');
              return <span className="dynamicText breakAll">{text}</span>;
            }

            if (_.includes(['cascader', 'relateSheet'], type)) {
              let name;

              if (item.relateSheetName) {
                name = item.relateSheetName;
              } else {
                const titleControl = _.find(data.relationControls || [], re => re.attribute === 1);
                const record = dynamicObject(safeParse(Array.isArray(value) ? value[0] : undefined));

                if (type === 'cascader' && _.get(data, 'advancedSetting.allpath') === '1') {
                  name = dynamicDisplayPath(record);
                } else {
                  const titleControlItem = titleControl?.controlId ? record[titleControl.controlId] : undefined;
                  name = renderCellText({ ...titleControl, value: titleControlItem }) || _l('未命名');
                }
              }

              return (
                <RelateControl>
                  <i className="icon-link-worksheet" />
                  <span className="overflow_ellipsis">{name}</span>
                </RelateControl>
              );
            }

            if (type === 'option') {
              const option = _.find(data.options || [], o => o.key === value);
              return (
                <OptionControl
                  className={cx('option pointer overflow_ellipsis mRight6', { isDeleted: _.isEmpty(option) })}
                >
                  {data.enumDefault2 === 1 && option?.color ? (
                    <OptionChip color={option.color} title={option?.value || ''}>
                      {option.value}
                    </OptionChip>
                  ) : (
                    <div className="text overflow_ellipsis">{option?.value || _l('已删除')}</div>
                  )}
                </OptionControl>
              );
            }

            if (type === 'area') {
              return <span className="dynamicText breakAll">{dynamicDisplayRecord(value).name}</span>;
            }

            if (type === 'richtext') {
              return (
                <div
                  className="w100 mTop0 mBottom0"
                  dangerouslySetInnerHTML={{ __html: filterXSS(String(value ?? '')) }}
                ></div>
              );
            }

            return <span className="dynamicText breakAll">{dynamicDisplayValue(value)}</span>;
          } catch (error) {
            console.log(error);
            return null;
          }
        } else {
          return <OtherField key={index} dynamicValue={dynamicValue} data={data} item={item} {...rest} />;
        }
      })}
    </DynamicTextWrap>
  );
};
