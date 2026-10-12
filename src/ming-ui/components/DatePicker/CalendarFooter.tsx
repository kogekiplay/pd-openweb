import React, { Component } from 'react';
import type { ReactNode } from 'react';
import PropTypes from 'prop-types';
import Icon from 'ming-ui/components/Icon';
import TimePicker from 'ming-ui/components/TimePicker/TimePicker';
import type { TimePickerProps } from '../TimePicker/types';
import type { CalendarMode, CalendarView, FooterLocale } from './footerTypes';

export interface CalendarFooterProps extends TimePickerProps {
  locale: FooterLocale;
  prefixCls: string;
  mode?: CalendarMode | undefined;
  view?: CalendarView | undefined;
  openView?: ((view: CalendarView) => void) | undefined;
  timePicker?: boolean | undefined;
  selectedValue?: import('../TimePicker/types').TimeValue;
  onSelect?: ((value: import('../TimePicker/types').TimeValue) => void) | undefined;
  allowClear?: boolean | undefined;
  onClear?: (() => void) | undefined;
  onOk?: (() => void) | undefined;
  onToday?: (() => void) | undefined;
  onToMorrow?: (() => void) | undefined;
}
class CalendarFooter extends Component<CalendarFooterProps> {
  static defaultProps = { allowClear: true };
  /**
   * 后退到指定 view
   */
  back = () => {
    let toView: CalendarView = 'month';

    if (this.props.mode === 'date' || this.props.mode === 'datetime') {
      toView = 'date';
    }

    if (this.props.openView) {
      this.props.openView(toView);
    }
  };

  override render() {
    const props = this.props;
    const { locale, prefixCls, timePicker } = props;

    let footerBtns: ReactNode;
    let clearBtn: React.JSX.Element | null = null;

    if (this.props.allowClear) {
      clearBtn = (
        <a onClick={() => props.onClear?.()} className={`${prefixCls}-clear-btn`} role="button">
          {locale.lang.clear}
        </a>
      );
    }

    const okBtn = (
      <a onClick={() => props.onOk?.()} className={`${prefixCls}-ok-btn`} role="button">
        {locale.lang.ok}
      </a>
    );

    const timeBtn = (
      <span className={`${prefixCls}-timepicker`}>
        <span className={`${prefixCls}-timepicker-title`}>{locale.lang.timepicker}</span>
        <TimePicker
          {...props}
          popupParentNode={props.popupParentNode}
          onChange={val => props.onSelect?.(val)}
          className={`${prefixCls}-timepicker-btn`}
        />
      </span>
    );

    let needBack = false;

    if (
      (this.props.view === 'year' && this.props.mode !== 'year') ||
      (this.props.view === 'month' && (this.props.mode === 'date' || this.props.mode === 'datetime'))
    ) {
      needBack = true;
    }

    if (needBack) {
      footerBtns = (
        <div className={`${prefixCls}-footer-back`}>
          <Icon
            icon="cancel"
            onClick={() => {
              this.back();
            }}
          />
        </div>
      );
    } else if (timePicker || this.props.mode === 'datetime') {
      footerBtns = (
        <div className={`${prefixCls}-footer-timepicker`}>
          {timeBtn}
          {clearBtn}
          {okBtn}
        </div>
      );
    } else {
      footerBtns = (
        <div className={`${prefixCls}-range-footer-basic`}>
          {clearBtn}
          {okBtn}
        </div>
      );
    }

    return <div className={`${prefixCls}-footer`}>{footerBtns}</div>;
  }
}

CalendarFooter.propTypes = {
  prefixCls: PropTypes.string,
  /**
   * 选择模式
   */
  mode: PropTypes.oneOf([
    /**
     * 【默认】日期（等同于 timePicker = false）
     */
    'date',
    /**
     * 日期时间（等同于 timePicker = true）
     */
    'datetime',
    /**
     * 月
     */
    'month',
    /**
     * 年
     */
    'year',
  ]),
  /**
   * 当前视图
   * date - 日
   * month - 月
   * year - 年
   */
  view: PropTypes.oneOf([
    /**
     * 【默认】日期（等同于 timePicker = false）
     */
    'date',
    /**
     * 月
     */
    'month',
    /**
     * 年
     */
    'year',
  ]),
  /**
   * 切换当前视图
   */
  openView: PropTypes.func,
  timePicker: PropTypes.bool,
  selectedValue: PropTypes.any,
  onSelect: PropTypes.func,
  allowClear: PropTypes.bool,
  onClear: PropTypes.func,
  onToday: PropTypes.func,
  onToMorrow: PropTypes.func,
  value: PropTypes.object,
  defaultValue: PropTypes.object,
  popupParentNode: PropTypes.func,
};

export default CalendarFooter;
