import { Component } from 'react';
import _ from 'lodash';
import moment from 'moment';
import config from './config';
import type { GanttType } from './GanttHeader';

const { TYPE_TO_WIDTH } = config;

/** 与 ./time.ts 的 TimeBucketEntry 结构一致（该接口未导出，按同目录惯例在此局部声明） */
interface TimeEntry {
  pub: string;
  sub: string[];
}

interface GraphBgProps {
  time: TimeEntry[];
  type: GanttType;
  durFromBeginToToday: number;
}

export default class GraphBg extends Component<GraphBgProps> {
  override shouldComponentUpdate(nextProp: GraphBgProps) {
    return !_.isEqual(nextProp.time, this.props.time);
  }

  override render() {
    const { time, type, durFromBeginToToday } = this.props;
    const width = TYPE_TO_WIDTH[type];
    let subWidth = width;
    if (type === 'week') subWidth = width * 7;
    return (
      <div className="graphBg flex flexRow">
        {time.map((item, index: number) => {
          return (
            <div key={`graphFiled-${index}`} className="fields flexRow">
              {item.sub.map((sub, index: number) => {
                if (type === 'month') {
                  const days = moment(`${item.pub}${sub}`, 'YYYYM月').daysInMonth();
                  subWidth = width * days;
                }

                return (
                  <div
                    key={`graphSub-${index}`}
                    style={{
                      width: subWidth - 1,
                      background:
                        type === 'day' &&
                        (moment(`${item.pub}.${sub}`).days() === 6 || moment(`${item.pub}.${sub}`).days() === 0) &&
                        moment(`${item.pub}.${sub}`).format('YYYY-MM-DD') !== moment().format('YYYY-MM-DD')
                          ? 'var(--color-background-secondary)'
                          : '#fff',
                    }}
                    className="subBg"
                  />
                );
              })}
            </div>
          );
        })}
        <div className="isToday" style={{ width, left: durFromBeginToToday * width }} />
      </div>
    );
  }
}
