import { OtherFieldList, SelectOtherField } from '../components';
import type { DynamicInputProps, DynamicValueSource } from '../dynamicTypes';
import { DynamicValueInputWrap } from '../styled';

export default function (props: DynamicInputProps) {
  const { onDynamicValueChange } = props;

  const setDynamicValue = (newValue: DynamicValueSource[]) => {
    onDynamicValueChange(newValue || []);
  };

  return (
    <DynamicValueInputWrap>
      <OtherFieldList {...props} />
      <SelectOtherField {...props} onDynamicValueChange={setDynamicValue} />
    </DynamicValueInputWrap>
  );
}
