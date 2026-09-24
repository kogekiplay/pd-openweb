import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import moment from 'moment';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Icon, MdAntDatePicker } from 'ming-ui';
import { getTimeZoneText } from 'src/utils/control';
import { getDatePickerConfigs, getDateToEn, getShowFormat } from 'src/utils/controlCommon';
import {
  dateAppZoneToServerZone,
  dateConvertToServerZone,
  dateConvertToUserZone,
  dateServerZoneToAppZone,
} from 'src/utils/project';
import { getDynamicValue } from '../../../core/formUtils';
import { compareWithTime } from '../../../core/formUtils/helper';
import { useWidgetEvent } from '../../../core/useFormEventManager';

const DateZoneWrap = styled.div`
  display: flex;
  .customAntPicker {
    flex: 1;
    min-width: 0;
    ${props => (props.showTimeZone ? 'border-radius: var(--radius-sm) 0 0 var(--radius-sm) !important;' : '')}
  }
  .timeZoneTag {
    display: flex;
    align-items: center;
    padding: 0 5px;
    border: 1px solid var(--color-border-tertiary);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    border-left: none;
    background: var(--color-background-primary);
    ${props => (props.isCell ? 'border: none;' : '')}
  }
`;

const DateWidgets = props => {
  const {
    dropdownClassName,
    advancedSetting = {},
    type,
    disabled,
    controlId,
    value: propValue,
    onChange,
    formData,
    masterData,
    onBlur = () => {},
    notConvertZone,
    hideIcon = false,
    compProps = {},
    formItemId,
    appId,
    createEventHandler = () => {},
  } = props;

  const [originValue, setOriginValue] = useState('');
  const [dateProps, setDateProps] = useState(getDatePickerConfigs(props));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [open, setOpen] = useState(compProps.showDatePicker);
  const pickerRef = useRef(null);
  const tempDateValueRef = useRef('');
  const appTimeZone = window[`timeZone_${appId}`];
  const timeZoneText = advancedSetting.showtimezone === '1' ? getTimeZoneText(props, appId) : '';

  useEffect(() => {
    setDateProps(getDatePickerConfigs(props));
  }, [advancedSetting.showtype]);

  useWidgetEvent(
    formItemId,
    useCallback(data => {
      const { triggerType } = data;

      switch (triggerType) {
        case 'trigger_tab_enter':
          setShowDatePicker(true);
          break;
        case 'trigger_tab_leave':
          setShowDatePicker(false);
          setOpen(false);
          break;
        case 'Enter':
          setOpen(true);
          break;
        default:
          break;
      }
    }, []),
  );

  useEffect(() => {
    if (pickerRef.current && showDatePicker) {
      pickerRef.current.focus();
    }
  }, [showDatePicker]);

  const handleChange = value => {
    if (value) {
      const date = moment(moment(value).format(dateProps.formatMode));
      value =
        type === 15
          ? date.format('YYYY-MM-DD')
          : notConvertZone
            ? date.format('YYYY-MM-DD HH:mm:ss')
            : advancedSetting.timezonetype === '1'
              ? dateAppZoneToServerZone(date, appTimeZone)
              : dateConvertToServerZone(date);
    }

    tempDateValueRef.current = '';
    onChange(value);
  };

  const renderIcon = value => {
    if (!disabled && !hideIcon) {
      return (
        <Fragment>
          {value && (
            <Icon
              icon="cancel"
              className="Font14 dateClearIcon"
              onClick={e => {
                e.stopPropagation();
                onChange('');
              }}
            />
          )}
          <Icon icon="bellSchedule" className="Font14 textTertiary bellScheduleIcon" />
        </Fragment>
      );
    }

    return null;
  };

  const renderValue = (showformat: string, value) => {
    const { hint = '' } = props;

    return (
      <div
        className={cx('customFormControlBox flexRow flexCenter classtabfocus', {
          controlDisabled: disabled,
          dateTimeIcon: value,
        })}
        data-instance-id={formItemId}
        onClick={() => {
          if (!disabled) {
            setShowDatePicker(true);
            setOpen(true);
          }
        }}
      >
        <span className={cx('flex ellipsis', { textDisabled: !value })}>
          {value ? getDateToEn(showformat, value, advancedSetting.showformat) : hint}
          {value && timeZoneText && <span className="mLeft8">{timeZoneText}</span>}
        </span>
        {renderIcon(value)}
      </div>
    );
  };

  let value = propValue;

  if (/^\d+$/.test(String(value)) && String(value).length < 5) {
    value = '';
  }

  const showformat = getShowFormat(props);
  const allowweek = advancedSetting.allowweek || '1234567';
  const allowtime = advancedSetting.allowtime || '00:00-24:00';
  const timeInterval = parseInt(advancedSetting.timeinterval || '1');
  const currentMinute = moment().minute();
  const defaultValue =
    timeInterval === 1 ? new Date() : moment().minute(currentMinute - (currentMinute % timeInterval));
  const dateTime = value
    ? type === 15 || notConvertZone
      ? value
      : advancedSetting.timezonetype === '1'
        ? dateServerZoneToAppZone(value, appTimeZone)
        : dateConvertToUserZone(value)
    : defaultValue;

  let minDate;
  let maxDate;

  if (advancedSetting.min) {
    minDate = getDynamicValue(
      formData,
      Object.assign({}, props, { advancedSetting: { defsource: advancedSetting.min } }),
      masterData,
    );
  }

  if (advancedSetting.max) {
    maxDate = getDynamicValue(
      formData,
      Object.assign({}, props, { advancedSetting: { defsource: advancedSetting.max } }),
      masterData,
    );
  }

  let showTime;
  const timeArr = allowtime.split('-');

  if (type === 16 && props.showTime !== false) {
    showTime = {
      defaultValue: parseInt(timeArr[0]) === 0 && parseInt(timeArr[1]) === 24 ? moment() : moment(timeArr[0], 'HH:mm'),
    };
  }

  const isOpen = showDatePicker || compProps.showDatePicker;

  return (
    <Fragment>
      {!isOpen ? (
        renderValue(showformat, value ? dateTime : '')
      ) : (
        <DateZoneWrap showTimeZone={advancedSetting.showtimezone === '1'} isCell={compProps.isCell}>
          <MdAntDatePicker
            ref={pickerRef}
            className={cx('w100 customAntPicker customFormControlBox', { controlDisabled: disabled })}
            disabled={disabled}
            value={value ? moment(dateTime) : ''}
            {...(minDate && advancedSetting.locationbegin === '1' && !value
              ? { defaultPickerValue: moment(minDate) }
              : {})}
            picker={dateProps.mode === 'datetime' ? 'date' : dateProps.mode}
            showTime={showTime || false}
            format={showformat}
            open={open}
            placeholder={showformat}
            suffixIcon={!disabled && !hideIcon ? <Icon icon="bellSchedule" className="Font14 textDisabled" /> : null}
            hideDisabledOptions
            minuteStep={timeInterval}
            onKeyDown={event => {
              createEventHandler(event, () => {
                // 阻止enter键触发tab事件，导致日期无法选择
                if (event.key === 'Enter' && open) {
                  event.stopPropagation();
                  return;
                }
              });
            }}
            disabledDate={currentDate => {
              if (currentDate) {
                const day = currentDate.day();
                let isBetween = true;

                if (minDate && isBetween) {
                  isBetween = currentDate.isSameOrAfter(moment(minDate), 'day');
                }

                if (maxDate && isBetween) {
                  isBetween = currentDate.isSameOrBefore(moment(maxDate), 'day');
                }

                return allowweek.indexOf(day === 0 ? '7' : day) === -1 || !isBetween;
              }
              return undefined;
            }}
            disabledTime={current => {
              return {
                disabledHours: () => {
                  const start = parseInt(allowtime.split('-')[0]);
                  const end = allowtime.split('-')[1];
                  const result = [];

                  for (let i = 0; i < 24; i++) {
                    if (i < start || compareWithTime(`${i}:00`, end, 'isAfter')) {
                      result.push(i);
                    }
                  }

                  if (current && minDate && moment(current).isSame(moment(minDate), 'day')) {
                    for (let i = 0; i < 24; i++) {
                      if (minDate.split(' ')[1] && i < moment(minDate).hour()) {
                        result.push(i);
                      }
                    }
                  }

                  if (current && maxDate && moment(current).isSame(moment(maxDate), 'day')) {
                    for (let i = 0; i < 24; i++) {
                      if (maxDate.split(' ')[1] && i > moment(maxDate).hour()) {
                        result.push(i);
                      }
                    }
                  }

                  return result;
                },
                disabledMinutes: selectHours => {
                  let start = allowtime.split('-')[0];
                  const end = allowtime.split('-')[1];
                  const result = [];

                  for (let i = 0; i < 60; i++) {
                    if (
                      compareWithTime(`${selectHours}:${i}`, start, 'isBefore') ||
                      compareWithTime(`${selectHours}:${i}`, end, 'isAfter')
                    ) {
                      result.push(i);
                    }
                  }

                  if (current && minDate && moment(current).isSame(moment(minDate), 'day')) {
                    for (let i = 0; i < 60; i++) {
                      if (moment(current).hour() === moment(minDate).hour() && i < moment(minDate).minute()) {
                        result.push(i);
                      }
                    }
                  }

                  if (current && maxDate && moment(current).isSame(moment(maxDate), 'day')) {
                    for (let i = 0; i < 60; i++) {
                      if (moment(current).hour() === moment(maxDate).hour() && i > moment(maxDate).minute()) {
                        result.push(i);
                      }
                    }
                  }

                  return result;
                },
              };
            }}
            /* antd 6：dropdownClassName 已废弃 -> classNames.popup.root
               （这个类名下面 onOpenChange 里还要靠 $(`.customAntPicker_${controlId}`) 找弹层滚时间列，
                 所以不能只是删掉，必须换到新位置上） */
            classNames={{ popup: { root: `customAntPicker_${controlId} ${dropdownClassName || ''}` } }}
            onOpenChange={open => {
              if (open && parseInt(timeArr[0]) === 0 && parseInt(timeArr[1]) === 24) {
                setTimeout(() => {
                  $(`.customAntPicker_${controlId}`).find('.ant-picker-time-panel-column:first').scrollTop(220);
                }, 200);
              }

              if (!open && tempDateValueRef.current) {
                handleChange(tempDateValueRef.current);
              }

              setShowDatePicker(open);
              setOpen(open);
            }}
            onFocus={e => setOriginValue(e.target.value.trim())}
            onBlur={() => {
              onBlur(originValue);
            }}
            /* antd 6：onSelect 已废弃 -> onCalendarChange。单选 DatePicker 下第一个参数
               仍然是选中的日期（见 @rc-component/picker 的 SinglePicker.d.ts），语义一致。 */
            onCalendarChange={value => (tempDateValueRef.current = value)}
            onChange={handleChange}
            {...compProps}
          />
          {timeZoneText && <div className="timeZoneTag">{timeZoneText}</div>}
        </DateZoneWrap>
      )}
    </Fragment>
  );
};

DateWidgets.propTypes = {
  dropdownClassName: PropTypes.string,
  advancedSetting: PropTypes.object,
  from: PropTypes.number,
  type: PropTypes.number,
  disabled: PropTypes.bool,
  controlId: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  formData: PropTypes.arrayOf(PropTypes.shape({})),
  masterData: PropTypes.object,
  onBlur: PropTypes.func,
  notConvertZone: PropTypes.bool,
};

export default DateWidgets;
