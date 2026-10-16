import { Component, type MouseEvent } from 'react';
import moment from 'moment';
import config from './config';
import GraphBg from './GraphBg';
import GraphContent, { type GanttProcessTaskNode } from './GraphContent';
import { byDay, byMonth, byWeek } from './time';
import { durDays } from './time';
import TimeHeader from './TimeHeader';
import type { GanttType } from './GanttHeader';

const { TYPE_TO_WIDTH } = config;

/** 与 ./time.ts 的 TimeBucketEntry 结构一致（该接口未导出，按同目录惯例局部声明） */
interface TimeEntry {
  pub: string;
  sub: string[];
}

export interface GanttContentProps {
  type: GanttType;
  beginTime: moment.Moment;
  endTime: moment.Moment;
  data: GanttProcessTaskNode[];
  handleTaskItemHover: (visible: boolean, event?: MouseEvent<HTMLElement>) => void;
  showDetail: (taskID: string) => void;
}

export default class ganttContent extends Component<GanttContentProps> {
  declare graphWrap: HTMLDivElement | null | undefined;
  declare posList: number[];
  declare timeBox: HTMLElement[];
  declare getIndex: (val: number) => number;

  /**
   * 组件成功挂载
   * 1. 绑定滚动事件以实现同步滚动
   * 2. 重新计算甘特图的背景高度
   */
  override componentDidMount() {
    const $taskList = document.querySelector('.taskListWrap');
    const { graphWrap } = this;

    if (graphWrap) {
      // 监听挂在 graphWrap 自己身上（scroll 不冒泡），e.target / e.currentTarget 都是它
      graphWrap.addEventListener('scroll', () => {
        if ($taskList instanceof HTMLElement && graphWrap.className == config.scrollingEle) {
          $taskList.scrollTop = graphWrap.scrollTop;
        }
      });
      graphWrap.addEventListener('mouseover', () => {
        config.scrollingEle = graphWrap.className;
      });
    }

    this.computeBgHeight();

    return undefined;
  }

  /**
   * 获取当前的滚动是在哪一个时间窗口
   */
  getPosList = (timeBox: NodeListOf<Element>): void => {
    const boxes: HTMLElement[] = [];

    timeBox.forEach(ele => {
      if (ele instanceof HTMLElement) boxes.push(ele);
    });

    this.timeBox = boxes;
    this.posList = boxes.map(ele => ele.offsetLeft);
    this.getIndex = (val: number): number => {
      if (this.posList.length <= 1) return 0;

      for (let i = 0; i < this.posList.length; i++) {
        const current = this.posList[i];
        const next = this.posList[i + 1];

        if (current !== undefined && next !== undefined && current <= val && val <= next) {
          return i;
        }
      }

      return this.posList.length - 1;
    };
  };

  /**
   * 当甘特图沿x轴滚动时,使上方的时间条有吸附左边缘的效果
   */
  handleScroll = (el: EventTarget | null): void => {
    if (!(el instanceof HTMLElement)) return undefined;

    const left = el.scrollLeft;
    const index = this.getIndex(left);
    const box = this.timeBox[index];
    const pos = this.posList[index];

    if (box && pos !== undefined) {
      box.style.paddingLeft = left - pos + 15 + 'px';
    }

    return undefined;
  };

  /**
   * 当组件挂载和更新后重新计算甘特图的背景高度使之与内容高度相等
   */
  computeBgHeight() {
    const content = document.querySelector('.graphContent');
    const wrap = document.querySelector('.graphWrap');

    if (!(content instanceof HTMLElement) || !(wrap instanceof HTMLElement)) return undefined;

    const contentHeight = content.getBoundingClientRect().height;
    const wrapHeight = wrap.getBoundingClientRect().height;
    const $bg = document.querySelector('.graphBg');
    const $taskListWrap = document.querySelector('.taskListWrap');

    if ($bg instanceof HTMLElement && $taskListWrap instanceof HTMLElement) {
      $bg.style.height = $taskListWrap.style.height = Math.max(contentHeight, wrapHeight) + 'px';
    }

    return undefined;
  }

  override componentDidUpdate() {
    this.computeBgHeight();
  }

  override render() {
    const { type, beginTime, endTime, data, handleTaskItemHover, showDetail } = this.props;

    /**
     * 计算从开始到今天经过的天数
     */
    const tempBegin = beginTime.clone();
    const durFromBeginToToday = Math.floor(durDays(moment(tempBegin), moment()));

    /**
     * 根据类型渲染不同的宽度
     */
    const width = TYPE_TO_WIDTH[type];

    /**
     * 根据类型处理日期数据
     */
    let time: TimeEntry[];

    if (type === 'day') {
      time = byDay(beginTime, endTime);
    } else if (type === 'week') {
      time = byWeek(beginTime, endTime);
    } else {
      time = byMonth(beginTime, endTime);
    }

    return (
      <div className="ganttContentBox flex flexColumn" onScroll={e => this.handleScroll(e.target)}>
        <TimeHeader {...{ time, type }} getPosList={this.getPosList} />
        <div className="graphWrap" ref={node => { this.graphWrap = node; }}>
          <GraphBg {...{ time, type, durFromBeginToToday }} />
          <GraphContent {...{ time, width, type, beginTime, data, handleTaskItemHover, showDetail }} />
        </div>
      </div>
    );
  }
}
