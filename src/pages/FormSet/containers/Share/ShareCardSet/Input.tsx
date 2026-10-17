import _ from 'lodash';
import styled from 'styled-components';
import { Input } from 'ming-ui';
import DynamicDefaultValue from 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue';
import type { FormControl } from 'src/utils/controlTypes';
import type { ShareInputProps } from './value';

const Wrap = styled.div`
  &.chooseControl {
    & > div {
      width: 100%;
    }
    .fieldList li {
      max-width: 100%;
    }
  }
`;

function InputForShare(props: ShareInputProps) {
  const { canUseControl, controls, defaultValue, onChangeValue, worksheetInfo, placeholder } = props;

  const renderInput = () => {
    return (
      <Input
        className="flex"
        {...props}
        onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
        onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
          e.stopPropagation();
          const newValue = e.target.value;

          if (!_.isEqual(defaultValue, newValue)) {
            onChangeValue(newValue);
          }
        }}
      />
    );
  };

  return (
    <Wrap className="flexRow chooseControl">
      {canUseControl ? (
        <DynamicDefaultValue
          hideTitle
          propFiledVisible
          hideRelateSheetHeader
          hideSearchAndFun
          globalSheetInfo={_.pick(worksheetInfo, ['appId', 'groupId', 'name', 'projectId', 'worksheetId'])}
          placeholder={placeholder}
          onChange={(d: Pick<FormControl, 'advancedSetting'>) => {
            const { advancedSetting = {} } = d;
            let { defsource } = advancedSetting;
            onChangeValue(defsource);
          }}
          allControls={controls}
          data={{
            type: 2,
            advancedSetting: {
              defsource: defaultValue,
            },
          }}
          from={10}
          defaultType={false}
        />
      ) : (
        renderInput()
      )}
    </Wrap>
  );
}

export default InputForShare;
