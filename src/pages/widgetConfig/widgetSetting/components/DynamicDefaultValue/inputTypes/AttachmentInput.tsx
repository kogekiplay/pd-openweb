import { Component } from 'react';
import { OtherFieldList, SelectOtherField } from '../components';
import type { DynamicInputProps } from '../dynamicTypes';
import { DynamicValueInputWrap } from '../styled';

export default class AttachmentInput extends Component<DynamicInputProps, any> {
  constructor(props: DynamicInputProps) {
    super(props);
    this.state = {};
  }

  override render() {
    return (
      <DynamicValueInputWrap>
        <OtherFieldList {...this.props} />
        <SelectOtherField {...this.props} />
      </DynamicValueInputWrap>
    );
  }
}
