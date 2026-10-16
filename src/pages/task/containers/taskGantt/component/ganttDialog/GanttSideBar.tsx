import { Component, type MouseEvent } from 'react';
import cx from 'classnames';
import config from './config';
import type { GanttTaskNode } from './GanttHeader';

const INDENT = 20;

export interface GanttSideBarProps {
  data: GanttTaskNode[];
  handleTaskItemHover: (visible: boolean, event?: MouseEvent<HTMLElement>) => void;
  toggleTask: (args: number[]) => void;
  showDetail: (taskID: string) => void;
}

export default class GanttSideBar extends Component<GanttSideBarProps> {
  declare taskList: HTMLDivElement | null | undefined;

  override componentDidMount() {
    const graphWrap = document.querySelector('.graphWrap');
    const taskList = this.taskList;

    if (!taskList || !(graphWrap instanceof HTMLElement)) return undefined;

    // 监听挂在 taskList 自己身上（scroll 不冒泡），e.target / e.currentTarget 都是它
    taskList.addEventListener('scroll', () => {
      taskList.className == config.scrollingEle && (graphWrap.scrollTop = taskList.scrollTop);
    });
    taskList.addEventListener('mouseover', () => {
      config.scrollingEle = taskList.className;
    });

    return undefined;
  }

  /**
   * 递归渲染任务列表
   * @param {*} data
   * @param {*} args
   */
  renderTaskList = (data: GanttTaskNode[] | undefined, args: number[] = []) => {
    const prefix = args.length ? args.map(v => ++v).join('.') + '.' : '';
    return (
      data &&
      data.map((item, index: number) => {
        const nextArgs = args.slice();
        nextArgs.push(index);
        return (
          <div key={index + prefix} className="taskItem">
            <div
              style={{ paddingLeft: 12 + INDENT * args.length }}
              className={cx('taskInfo flexRow')}
              onMouseOver={(e: MouseEvent<HTMLDivElement>) => this.props.handleTaskItemHover(true, e)}
              onMouseOut={() => this.props.handleTaskItemHover(false)}
            >
              <div
                className={cx(
                  'toggleTask colorPrimary',
                  {
                    haveChildren: item.child && item.child.length,
                    childrenVisible: item.childrenVisible,
                  },
                  item.childrenVisible ? 'icon-remove_circle_outline' : 'icon-add_circle',
                )}
                onClick={() => this.props.toggleTask(nextArgs)}
              />
              <span className="seq">{`${prefix}${index + 1})`}</span>
              <span className="name textOverflow" onClick={() => this.props.showDetail(item.taskID)}>
                {item.taskName}
              </span>
            </div>
            {item.child && item.childrenVisible && (
              <div className="childrenWrap">{this.renderTaskList(item.child, nextArgs)}</div>
            )}
          </div>
        );
      })
    );
  };

  override render() {
    const { data } = this.props;
    return (
      <div className="ganttSideBarWrap flexColumn">
        <header>{_l('任务列表')}</header>
        <div className="taskListWrap" ref={node => { this.taskList = node; }}>
          {this.renderTaskList(data)}
        </div>
      </div>
    );
  }
}
