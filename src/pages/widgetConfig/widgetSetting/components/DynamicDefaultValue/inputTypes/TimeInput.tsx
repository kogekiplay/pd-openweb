import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import _ from 'lodash';
import moment from 'moment';
import type { Moment } from 'moment';
import { func, number, shape } from 'prop-types';
import { MdAntTimePicker, MdAntTimeRangePicker } from 'ming-ui';
import { DYNAMIC_FROM_MODE } from 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/config.js';
import { DynamicInput, OtherFieldList, SelectOtherField } from '../components';
import type { DynamicInputProps } from '../dynamicTypes';
import { DynamicValueInputWrap, WrapMaxOrMin } from '../styled';

export default class TimeInput extends Component<DynamicInputProps, { defValue: string | number; isDynamic: boolean }> {
  declare $wrap: SelectOtherField | null | undefined;

  static override propTypes = {
    onDynamicValueChange: func,
    data: shape({ enumDefault: number }),
    clearOldDefault: func,
  };
  static defaultProps = {
    onDynamicValueChange: _.noop,
    clearOldDefault: _.noop,
  };
  constructor(props: DynamicInputProps) {
    super(props);
    this.state = {
      defValue: '',
      isDynamic: false,
    };
  }

  override componentDidMount() {
    this.updateValue();
  }

  override componentDidUpdate(prevProps: DynamicInputProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (!_.isEqual(this.props.dynamicValue, prevProps.dynamicValue)) {
        this.updateValue(this.props);
      }
    }
  }

  updateValue(nextProps?: DynamicInputProps) {
    const { dynamicValue = [] } = nextProps || this.props;
    const { staticValue, cid = '' } = _.get(dynamicValue, '0') || {};
    const tempValue = !cid && staticValue && staticValue !== '2' ? staticValue : '';
    this.setState({
      defValue: tempValue || '',
      isDynamic: !!cid || _.includes(['2'], staticValue),
    });
  }

  handleClick = () => {
    this.updateValue();
  };

  handleTimeChange = (date: Moment | [Moment | null, Moment | null] | null, formatMode: string) => {
    if (!date || (Array.isArray(date) && (!date[0] || !date[1]))) {
      this.setState({ defValue: '', isDynamic: false });
      this.props.onDynamicValueChange([]);
      return;
    }

    const formatDate = (value: Moment) => moment(value).format(formatMode);

    const time = _.isArray(date)
      ? `${date[0] ? formatDate(date[0]) : ''}-${date[1] ? formatDate(date[1]) : ''}`
      : formatDate(date);
    this.setState({ defValue: time });
    const newValue = [{ rcid: '', cid: '', staticValue: time }];
    this.props.onDynamicValueChange(newValue);
  };

  onTriggerClick = () => {
    const { defaultType } = this.props;
    defaultType && this.$wrap?.triggerClick();
  };

  renderContent() {
    const { data, withMaxOrMin, from } = this.props;
    const { isDynamic, defValue = '' } = this.state;
    const formatMode = data.unit === '6' ? 'HH:mm:ss' : 'HH:mm';

    if (isDynamic) {
      return <OtherFieldList {...this.props} onClick={this.handleClick} formatMode={formatMode} />;
    }

    if (withMaxOrMin && from === DYNAMIC_FROM_MODE.FAST_FILTER) {
      const [minValue, maxValue] = String(defValue).split('-');
      return (
        <WrapMaxOrMin className="flexRow alignItemsCenter">
          <MdAntTimeRangePicker
            showNow
            className="timeMaxOrMinCon"
            placeholder={[_l('开始时间'), _l('结束时间')]}
            value={minValue && maxValue ? [moment(minValue, formatMode), moment(maxValue, formatMode)] : []}
            format={formatMode}
            onChange={(time: Moment | [Moment | null, Moment | null] | null) => this.handleTimeChange(time, formatMode)}
          />
        </WrapMaxOrMin>
      );
    }

    return (
      <MdAntTimePicker
        className="datePicker"
        format={formatMode}
        value={defValue ? moment(defValue, formatMode) : ''}
        onChange={(time: Moment | [Moment | null, Moment | null] | null) => this.handleTimeChange(time, formatMode)}
      />
    );
  }

  override render() {
    const { defaultType } = this.props;

    return (
      <DynamicValueInputWrap>
        {defaultType ? <DynamicInput {...this.props} onTriggerClick={this.onTriggerClick} /> : this.renderContent()}
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
