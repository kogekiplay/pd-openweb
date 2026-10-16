import { Component, Fragment } from 'react';
import cx from 'classnames';
import Icon from 'ming-ui/components/Icon';
import config from './config';

const { TYPE_TO_WIDTH } = config;

/** 甘特图显示粒度，与 config.TYPE_TO_WIDTH 的键一致 */
export type GanttType = keyof typeof TYPE_TO_WIDTH;

/** 任务节点：只声明本目录组件实际读取的字段 */
export interface GanttTaskNode {
  taskID: string;
  taskName: string;
  child?: GanttTaskNode[];
  childrenVisible?: boolean;
}

export interface GanttHeaderProps {
  type: GanttType;
  data: GanttTaskNode[];
  name: string;
  switchDisplayType: (type: GanttType) => void;
  refresh: () => void;
  exportData: () => void;
  closeLayer: () => void;
  scrollToToday: () => void;
}

const chooseDisplayType: { type: GanttType; text: string }[] = [
  { type: 'day', text: _l('按天') },
  { type: 'week', text: _l('按周') },
  { type: 'month', text: _l('按月') },
];

export default class GanttHeader extends Component<GanttHeaderProps> {
  constructor(props: GanttHeaderProps) {
    super(props);
  }

  override render() {
    const { type, data, name, switchDisplayType, refresh, exportData, closeLayer, scrollToToday } = this.props;
    return (
      <div className="ganttHeader flexRow">
        <div className="projectName ellipsis">{name}</div>
        {data && data.length ? (
          <Fragment>
            <div className="controlWrap flex flexRow">
              <div className="today" onClick={scrollToToday}>
                {_l('今天')}
              </div>
              <div className="chooseDisplayType ">
                {chooseDisplayType.map(item => (
                  <span
                    onClick={() => switchDisplayType(item.type)}
                    className={cx(item.type, { active: item.type === type })}
                    key={item.type}
                  >
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
            <div className="operationWrap flexRow">
              <div className="refresh operation colorPrimary" onClick={refresh}>
                <Icon icon="refresh" />
                <span>{_l('刷新')}</span>
              </div>
              <div className="export operation colorPrimary" onClick={exportData}>
                <Icon icon="export" />
                <span>{_l('导出')}</span>
              </div>
              <canvas id="ganttCanvas" className="Hidden" />
            </div>
          </Fragment>
        ) : (
          <div className="flex" />
        )}
        <div className="close operation colorPrimary pointer" onClick={closeLayer}>
          <Icon icon="delete" />
        </div>
      </div>
    );
  }
}
