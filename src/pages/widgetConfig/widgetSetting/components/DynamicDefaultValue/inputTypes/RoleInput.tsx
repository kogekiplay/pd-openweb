import { Component } from 'react';
import update from 'immutability-helper';
import _ from 'lodash';
import { dialogSelectOrgRole } from 'ming-ui/functions';
import { DynamicInput, OtherFieldList, SelectOtherField } from '../components';
import { dynamicStaticText } from '../dynamicTypes';
import type { DynamicValueSource } from '../dynamicTypes';
import type { DynamicInputProps } from '../dynamicTypes';
import { DynamicValueInputWrap } from '../styled';

export default class RoleInput extends Component<DynamicInputProps, Record<string, never>> {
  declare $wrap: SelectOtherField | null | undefined;

  constructor(props: DynamicInputProps) {
    super(props);
    this.state = {};
  }

  // 成员多选数据处理
  removeItem = (id: string) => {
    const { dynamicValue, onDynamicValueChange } = this.props;

    const getId = (item: DynamicValueSource) => {
      const { staticValue } = item;
      if (!staticValue) return '';
      return dynamicStaticText(item, 'organizeId');
    };

    const index = _.findIndex(dynamicValue, item => {
      return getId(item) === id;
    });

    if (index > -1) {
      onDynamicValueChange(update(dynamicValue, { $splice: [[index, 1]] }));
    }
  };
  onTriggerClick = () => {
    const { defaultType } = this.props;
    defaultType && this.$wrap?.triggerClick();
  };
  override render() {
    const { defaultType, data = {}, globalSheetInfo: { projectId } = {}, onDynamicValueChange } = this.props;
    return (
      <DynamicValueInputWrap>
        {defaultType ? (
          <DynamicInput {...this.props} onTriggerClick={this.onTriggerClick} />
        ) : (
          <OtherFieldList
            {...this.props}
            removeItem={this.removeItem}
            onClick={() => {
              dialogSelectOrgRole({
                projectId,
                unique: data.enumDefault === 0,
                onSave: (arr: { organizeName?: string; organizeId: string }[]) => {
                  const value = arr.map(({ organizeName, organizeId }) => ({
                    cid: '',
                    rcid: '',
                    staticValue: JSON.stringify({ organizeId, organizeName }),
                  }));
                  onDynamicValueChange(value);
                },
              });
            }}
          />
        )}
        <SelectOtherField
          {...this.props}
          ref={con => {
            this.$wrap = con;
          }}
        />
      </DynamicValueInputWrap>
    );
  }
}
