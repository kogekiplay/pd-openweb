import { Component } from 'react';
import en_US from 'antd/es/date-picker/locale/en_US';
import ja_JP from 'antd/es/date-picker/locale/ja_JP';
import zh_CN from 'antd/es/date-picker/locale/zh_CN';
import zh_TW from 'antd/es/date-picker/locale/zh_TW';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types';
import TimePicker from 'src/components/Form/DesktopForm/widgets/Time';
import { TimePicker as AntTimePicker } from 'src/ming-ui/components/mdAntPickers';
import { FILTER_CONDITION_TYPE } from '../../enum';
import type { PrimitiveValue, TimeFilterProps, TimeRangeChange } from '../../primitiveTypes';

export default class Date extends Component<TimeFilterProps, Record<string, never>> {
  static override propTypes = {
    disabled: PropTypes.bool,
    onChange: PropTypes.func,
    value: PropTypes.string,
    dateRange: PropTypes.number,
    minValue: PropTypes.string,
    maxValue: PropTypes.string,
    type: PropTypes.number,
  };
  constructor(props: TimeFilterProps) {
    super(props);
    this.state = {};
  }
  override render() {
    const { control = {}, type, value, minValue, maxValue, onChange } = this.props;
    const lang = getCookie('i18n_langtag') || window.getDefaultLangKey();
    const datePickerLocales: Record<string, typeof en_US> = {
      en: en_US,
      ja: ja_JP,
      'zh-Hans': zh_CN,
      'zh-Hant': zh_TW,
    };
    const datePickerLocale = datePickerLocales[lang] || en_US;
    const unit = String(control.unit);
    const timeFormat = _.includes(['1', '8'], unit) ? 'HH:mm' : 'HH:mm:ss';
    return (
      <div className="worksheetFilterDateCondition">
        {type === FILTER_CONDITION_TYPE.DATE_BETWEEN || type === FILTER_CONDITION_TYPE.DATE_NBETWEEN ? (
          <div className="dateRangeInputCon">
            <AntTimePicker.RangePicker
              format={timeFormat}
              locale={datePickerLocale}
              defaultValue={minValue && maxValue ? [moment(minValue, timeFormat), moment(maxValue, timeFormat)] : []}
              popupClassName="filterDateRangeInputPopup"
              onOpenChange={(isOpen: boolean) => {
                // 手动修复激活面板定位问题，官方有问题
                if (isOpen) {
                  const $arrow = $('.filterDateRangeInputPopup .ant-picker-range-arrow');

                  if ($arrow) {
                    const arrowLeft = $arrow.css('left');
                    $('.filterDateRangeInputPopup .ant-picker-panel-container').css({
                      marginLeft: parseInt(arrowLeft === undefined ? 'undefined' : arrowLeft),
                    });
                  }
                }
              }}
              onChange={(...args: Parameters<TimeRangeChange>) => {
                const moments = args[0];
                const values = moments && _.isArray(moments) ? moments : [];

                onChange({
                  minValue: values[0] && values[0].format(timeFormat),
                  maxValue: values[1] && values[1].format(timeFormat),
                });
              }}
            />
          </div>
        ) : (
          <div className="customDate dateInputCon">
            <TimePicker
              {...control}
              value={value && moment(value, timeFormat)}
              onChange={(timeValue: PrimitiveValue) => {
                onChange({
                  dateRange: 18,
                  value: timeValue ? moment(timeValue, timeFormat).format(timeFormat) : undefined,
                });
              }}
              compProps={{
                placeholder: _l('请选择'),
              }}
            />
          </div>
        )}
      </div>
    );
  }
}
