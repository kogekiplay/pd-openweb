import { Component, type MouseEvent } from 'react';
import cx from 'classnames';
import moment from 'moment';
import type { GanttTaskNode } from './GanttHeader';
import ProcessBar from './ProcessBar';
import type { ProcessState, ProcessStatus } from './ProcessBar';
import { durDays, parseTime } from './time';

/** 接口返回的任务节点时间字段：原始字符串，可能缺失 */
interface GanttTaskTimeFields {
  actualStartTime?: string | null | undefined;
  completeTime?: string | null | undefined;
  deadline?: string | null | undefined;
  startTime?: string | null | undefined;
}

/** 绘制时间条所需的任务节点（时间字段先按原始字符串读取，再统一转成 moment） */
export type GanttProcessTaskNode = GanttTaskNode & GanttTaskTimeFields;

export interface GraphContentProps {
  data: GanttProcessTaskNode[];
  width: number;
  beginTime: moment.Moment;
  handleTaskItemHover: (visible: boolean, event?: MouseEvent<HTMLElement>) => void;
  showDetail: (taskID: string) => void;
}

/**
 * 根据最早开始时间和实际起止时间计算时间跨度
 * @param {*} beginTime 最早开始时间
 * @param {*} startTime 起始时间
 * @param {*} endTime 结束时间
 */
const getWidthAndLeft = (beginTime: moment.Moment, startTime: moment.Moment, endTime: moment.Moment) => {
  if (startTime.isValid() && endTime.isValid()) {
    return {
      leftDays: durDays(beginTime, startTime),
      widthDays: durDays(startTime, endTime) + 1,
    };
  }

  if (startTime.isValid() && !endTime.isValid()) {
    return {
      leftDays: durDays(beginTime, startTime),
      widthDays: 1,
    };
  }

  if (!startTime.isValid() && endTime.isValid()) {
    return {
      leftDays: durDays(beginTime, endTime),
      widthDays: 1,
    };
  }

  return {
    leftDays: 0,
    widthDays: 0,
  };
};

export default class GraphContent extends Component<GraphContentProps> {
  constructor(props: GraphContentProps) {
    super(props);
  }

  renderProcess(data: GanttProcessTaskNode[]) {
    const { width, handleTaskItemHover, beginTime } = this.props;

    return data.map((item, index: number) => {
      let expectState: ProcessState | undefined;
      let actualState: ProcessState | undefined;
      let status: ProcessStatus | undefined;
      const { actualStartTime: rawActualStartTime, completeTime: rawCompleteTime } = item;
      const { deadline: rawDeadline, startTime: rawStartTime } = item;

      /**
       * 确定计划时间是否需要向前或向后补一天
       */
      if (!rawStartTime && rawDeadline) expectState = 'noStart';
      if (rawStartTime && !rawDeadline) expectState = 'noEnd';

      /**
       * 确实实际时间是否需要向前或向后补一天
       */
      if (!rawActualStartTime && rawCompleteTime) actualState = 'noStart';
      if (rawActualStartTime && !rawCompleteTime) actualState = 'noEnd';

      /**
       *  当有实际完成时间且时间早于此刻时,状态为超前
       */
      if (rawCompleteTime && moment(rawCompleteTime).isBefore(moment())) status = 'inAdvance';
      if ((rawActualStartTime && !rawCompleteTime) || (rawCompleteTime && moment(rawCompleteTime) > moment())) {
        status = 'normal';
      }

      /**
       * 解析时间
       */
      const actualStartTime = moment(parseTime(rawActualStartTime));
      const completeTime = moment(parseTime(rawCompleteTime));
      const deadline = moment(parseTime(rawDeadline));
      const startTime = moment(parseTime(rawStartTime));

      /**
       * 获取时间条的宽度和距左边的距离
       */
      const expectPos = getWidthAndLeft(beginTime, startTime, deadline);
      const actualPos = getWidthAndLeft(beginTime, actualStartTime, completeTime);
      const expectLeft = expectPos.leftDays * width;
      const expectWidth = expectPos.widthDays * width;
      const actualLeft = actualPos.leftDays * width;
      const actualWidth = actualPos.widthDays * width;

      return (
        <div key={index} className="processWrap">
          <div
            className={cx('processBox flexRow')}
            onClick={() => this.props.showDetail(item.taskID)}
            onMouseOver={e => handleTaskItemHover(true, e)}
            onMouseOut={() => handleTaskItemHover(false)}
          >
            <div>
              {!!expectWidth && (
                <div className="expectProcess">
                  <ProcessBar width={expectWidth} left={expectLeft} className="expectBar" state={expectState} />
                </div>
              )}

              {!!actualWidth && (
                <div className="actualProcess">
                  <ProcessBar
                    width={actualWidth}
                    left={actualLeft}
                    className="actualBar"
                    state={actualState}
                    status={status}
                  />
                </div>
              )}
            </div>
            <div className="taskName ellipsis">{item.taskName}</div>
          </div>
          {item.child && item.childrenVisible && (
            <div className="childrenProcess">{this.renderProcess(item.child)}</div>
          )}
        </div>
      );
    });
  }
  override render() {
    const { data } = this.props;
    return <div className="graphContent">{this.renderProcess(data)}</div>;
  }
}
