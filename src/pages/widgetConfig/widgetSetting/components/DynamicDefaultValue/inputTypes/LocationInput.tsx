import { Component } from 'react';
import _ from 'lodash';
import MDMap from 'ming-ui/components/amap/MDMap';
import { getMapConfig } from 'src/utils/control';
import { DynamicInput, OtherFieldList, SelectOtherField } from '../components';
import type { DynamicInputProps } from '../dynamicTypes';
import { DynamicValueInputWrap } from '../styled';

export interface LocationInputState {
  visible: boolean;
}

export default class LocationInput extends Component<DynamicInputProps, LocationInputState> {
  declare $wrap: SelectOtherField | null | undefined;

  constructor(props: DynamicInputProps) {
    super(props);
    this.state = {
      visible: false,
    };
  }

  onTriggerClick = () => {
    const { defaultType } = this.props;
    defaultType && this.$wrap.triggerClick();
  };
  override render() {
    const { defaultType, enumDefault2, advancedSetting = {}, dynamicValue = [], onDynamicValueChange } = this.props;
    const staticValue = _.get(dynamicValue, '0.staticValue');
    return (
      <DynamicValueInputWrap>
        {defaultType ? (
          <DynamicInput {...this.props} onTriggerClick={this.onTriggerClick} />
        ) : (
          <OtherFieldList
            {...this.props}
            removeItem={this.removeItem}
            onClick={() => this.setState({ visible: true })}
          />
        )}
        <SelectOtherField
          {...this.props}
          ref={con => {
            this.$wrap = con;
          }}
        />
        {this.state.visible && (
          <MDMap
            isMobile={false}
            allowCustom={advancedSetting['allowcustom'] === '1'}
            distance={enumDefault2 ? parseInt(advancedSetting['distance'] || '', 10) : 0}
            defaultAddress={staticValue ? JSON.parse(String(staticValue)) : null}
            onAddressChange={({ lng, lat, address, name }: { name?: string; [key: string]: any }) => {
              onDynamicValueChange([
                {
                  rcid: '',
                  cid: '',
                  staticValue: JSON.stringify({
                    x: lng,
                    y: lat,
                    address,
                    title: name,
                    coordinate: getMapConfig() ? 'wgs84' : null,
                  }),
                },
              ]);
              this.setState({ visible: false });
            }}
            onClose={() => this.setState({ visible: false })}
          />
        )}
      </DynamicValueInputWrap>
    );
  }
}
