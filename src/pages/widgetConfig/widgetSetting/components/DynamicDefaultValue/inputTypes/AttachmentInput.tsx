import { Component } from 'react';
import { OtherFieldList, SelectOtherField } from '../components';
import { DynamicValueInputWrap } from '../styled';

export default class AttachmentInput extends Component<any, any> {
  constructor(props) {
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
