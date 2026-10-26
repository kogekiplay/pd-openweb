import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import moment from 'moment';

/**
 * 这个组件的两个真实调用点传的全部 props（形状取自调用点本身，不在这里另立一套）：
 * - src/pages/FormExtend/utils.tsx renderLimitInfo()
 * - src/pages/PublicWorksheet/FillWorksheet.tsx 填写页
 * 两处都传 className / endTime / beforeText / afterText / arriveText；endTime 来自
 * HapApi.MD.Entity.Worksheet.PublicForm.LinkSwitchTime.endTime（声明为 string | undefined），
 * 按生成声明的写法带上显式 undefined —— exactOptionalPropertyTypes 下调用点的
 * `endTime={linkSwitchTime.endTime}` 才成立。
 */
export interface CountDownProps {
  className?: string | undefined;
  endTime?: string | undefined;
  beforeText?: string | undefined;
  afterText?: string | undefined;
  arriveText?: string | undefined;
}

/**
 * state 的真实形状：endTime 初值取 props.endTime，缺项时落成 new Date()；
 * componentDidUpdate 里 endTime 变化时直接写回 props.endTime（可能又是 undefined），
 * 之后的 func() 靠解构默认值再落成 new Date()。
 * timeStr 只在 func() 里写入 —— 首次 render 早于 componentDidMount 的 func()，
 * 那时读到的是 undefined。
 */
export interface CountDownState {
  endTime: string | Date | undefined;
  isArrive: boolean;
  timeStr?: string | undefined;
}

// 定时器句柄：保持原声明与原调用，不动 clearInterval(timer) 的形态。
// 终点配置下 func() 里的 clearInterval(timer) 仍报 TS2769（clearInterval 的合并重载是
// NodeJS.Timeout | string | number | undefined，不含 null）—— 这一条作为真实存量债务留着，
// 不靠改 sentinel、guard 或 Reflect.apply 把它抹平。要清零得先决定「没有活定时器」用什么语义表达，
// 那是行为决定，不在本切片的类型合同里。
let timer: NodeJS.Timeout | null = null;

export default class CountDown extends Component<CountDownProps, CountDownState> {
  constructor(props: CountDownProps) {
    super(props);
    this.state = {
      endTime: props.endTime || new Date(),
      isArrive: false,
    };
  }
  override componentDidMount() {
    this.func();
    timer = setInterval(() => {
      this.func();
    }, 1000);
  }

  override componentDidUpdate(prevProps: Readonly<CountDownProps>) {
    if (!shallowEqual(prevProps, this.props)) {
      if (prevProps.endTime !== this.props.endTime) {
        this.setState(
          {
            endTime: this.props.endTime,
          },
          () => {
            this.func();
            timer = setInterval(() => {
              this.func();
            }, 1000);
          },
        );
      }
    }
  }

  func = () => {
    const { endTime = new Date() } = this.state;

    const diffTime = moment(endTime).diff(moment());
    let durationTime = moment.duration(diffTime);
    let diffDays = moment(endTime).diff(moment(), 'days');

    if (diffTime < 0) {
      clearInterval(timer);
    }

    this.setState({
      timeStr: this.formatTime(diffDays, durationTime.hours(), durationTime.minutes(), durationTime.seconds()),
      isArrive: diffTime < 0,
    });
  };

  formatTime = (d: number, h: number, m: number, s: number) => {
    if (d > 0) {
      return _l('%0天%1时%2分%3秒', d, h, m, s);
    } else if (h > 0) {
      return _l('%0时%1分%2秒', h, m, s);
    } else if (m > 0) {
      return _l(`%0分%1秒`, m, s);
    } else {
      return _l(`%0秒`, s);
    }
  };

  override render() {
    const { className, beforeText, afterText, arriveText } = this.props;
    let { timeStr, isArrive } = this.state;

    return isArrive && arriveText ? (
      <span>{arriveText}</span>
    ) : (
      <React.Fragment>
        <span>{beforeText || ''}</span>
        <span className={`mLeft5 mRight5 ${className || ''}`}>{timeStr}</span>
        <span>{afterText || ''}</span>
      </React.Fragment>
    );
  }
}
