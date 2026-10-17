import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import { Tooltip } from 'ming-ui/antd-components';
import ClickAway from 'ming-ui/components/ClickAway';
import createTask from 'src/components/createTask/load';
import type { AppDispatch, RootState } from 'src/redux/types';
import GanttDialog from '../../component/ganttDialog';
import config from '../../config/config';
import {
  changeFilterWeekend,
  changeSubTaskLevel,
  changeTaskStatus,
  changeView,
  getTimeAxisSource,
  updateDataSource,
} from '../../redux/actions';
import './folderToolbar.less';

const ClickAwayable = ClickAway;

/**
 * connect 注入的状态片段。
 *
 * `stateConfig` 直接取自 RootState —— 它有真实形状（来自 `config/stateConfig.ts`
 * 的默认值），不需要另写一份会漂移的副本。
 *
 * `taskConfig` **不能**这样取：`RootState['task']['taskConfig']` 实测是 `any`。
 * 原因是 `src/pages/task/redux/reducers.ts` 的 taskConfig reducer 没有显式返回类型，
 * 而它的分支里写了 `Object.assign({}, state, action.taskConfig)`；`ReduxAction` 的
 * 默认载荷是 `{ [key: string]: any }`，`action.taskConfig` 因此是 `any`，
 * `Object.assign` 的返回类型被污染成 `any`，整个推导结果就是 `any`。
 * 用 `Pick` 取出一个 `any` 字段等于**没有类型**，那是假类型化，所以这里如实写成 `unknown`。
 *
 * 组件本身只把它交给 `_.isEqual` 做整体比较（不读任何字段），`unknown` 完全够用，
 * 且它是 `any` 的反面 —— 谁将来想读 `taskConfig.folderId` 都必须先做收窄，
 * 不会像 `any` 那样静默放过。要真正拿到形状，需要由 lead 修范围外的 taskConfig reducer
 * （给它标注返回类型或给 ReduxAction 传真实载荷），我不越界修改。
 */
interface FolderToolbarStateProps {
  stateConfig: RootState['task']['stateConfig'];
  taskConfig: unknown;
}

/** 组件自身需要的 props（由父组件 taskGantt.tsx 传入） */
interface FolderToolbarOwnProps {
  showStaticGantt?: boolean | undefined;
}

/** connect 默认注入 dispatch */
interface FolderToolbarDispatchProps {
  dispatch: AppDispatch;
}

type FolderToolbarProps = FolderToolbarStateProps & FolderToolbarOwnProps & FolderToolbarDispatchProps;

interface FolderToolbarState {
  ganttDialogVisible: boolean;
  showOperator: boolean;
  showLevel: boolean;
  /** 层级浮层的 left 偏移；未打开过时为 undefined（浮层此时不渲染） */
  taskLevelOffsetLeft?: number | undefined;
}

class FolderToolbar extends Component<FolderToolbarProps, FolderToolbarState> {
  constructor(props: FolderToolbarProps) {
    super(props);

    this.state = {
      ganttDialogVisible: false,
      showOperator: false,
      showLevel: false,
    };
  }

  /**
   * 返回当前状态所对应的名称
   */

  override componentDidUpdate(prevProps: FolderToolbarProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (!_.isEqual(this.props.taskConfig, prevProps.taskConfig)) {
        this.setState({
          ganttDialogVisible: false,
        });
      }
    }
  }

  /**
   * 返回当前状态所对应的名称
   */
  getTaskStatusName() {
    switch (this.props.stateConfig.currentStatus) {
      case 0:
        return _l('进行中');
      case 1:
        return _l('已完成');
      case -1:
        return _l('全部');
    }
    return undefined;
  }

  /**
   * 修改任务状态
   * @param  {number} status
   */
  switchStatus(status: number) {
    this.setState({ showOperator: false });
    this.props.dispatch(changeTaskStatus(status));
    this.props.dispatch(updateDataSource());
  }

  /**
   * 切换视图
   * @param  {number} viewType
   */
  switchView(viewType: number) {
    this.props.dispatch(changeView(viewType));
    this.props.dispatch(getTimeAxisSource());
    this.props.dispatch(updateDataSource());
  }

  /**
   * 是否显示周末
   * @param  {boolean} filter  true: 不显示  false: 显示
   */
  filterWeekend(filter: boolean) {
    this.props.dispatch(changeFilterWeekend(filter));
    this.props.dispatch(getTimeAxisSource());
    this.props.dispatch(updateDataSource());
  }

  /**
   * 显示子任务层级
   * @param  {object} evt
   */
  showTaskLevel(evt: { currentTarget: HTMLElement }) {
    this.setState({
      showLevel: !this.state.showLevel,
      taskLevelOffsetLeft: evt.currentTarget.offsetLeft,
    });
  }

  /**
   * 切换显示子任务的层级
   * @param  {number} level
   */
  switchLevel(level: number) {
    this.setState({ showLevel: false });
    this.props.dispatch(changeSubTaskLevel(level));
    this.props.dispatch(updateDataSource());
  }

  /**
   * 创建任务
   */
  createTask() {
    createTask();
  }

  /**
   * 打开关闭静态甘特图
   */
  switchGanttDialogVisible = (visible = true) => {
    this.setState({
      ganttDialogVisible: visible,
    });
  };

  override render() {
    const { stateConfig } = this.props;
    const { ganttDialogVisible } = this.state;
    const taskStatusList = [
      { text: _l('进行中'), icon: 'icon-task-have-in', value: config.TASKSTATUS.NO_COMPLETED },
      { text: _l('已完成'), icon: 'icon-done_all', value: config.TASKSTATUS.COMPLETED },
      { text: _l('全部'), icon: 'icon-task-all', value: config.TASKSTATUS.ALL },
    ];
    const viewTypeList = [
      { text: _l('天'), value: config.VIEWTYPE.DAY },
      { text: _l('周%05034'), value: config.VIEWTYPE.WEEK },
      { text: _l('月%06010'), value: config.VIEWTYPE.MONTH },
    ];
    const filterWeekendList = [
      { text: _l('仅工作日'), value: true },
      { text: _l('显示周末'), value: false },
    ];
    const taskLevelList = [
      { text: _l('展开全部层级'), value: config.SUBTASKLEVEL.ALL },
      { text: _l('展开到%0级任务', 1), value: config.SUBTASKLEVEL.ONE },
      { text: _l('展开到%0级任务', 2), value: config.SUBTASKLEVEL.TWO },
      { text: _l('展开到%0级任务', 3), value: config.SUBTASKLEVEL.THREE },
      { text: _l('展开到%0级任务', 4), value: config.SUBTASKLEVEL.FOUR },
      { text: _l('展开到%0级任务', 5), value: config.SUBTASKLEVEL.FIVE },
    ];

    return (
      <div className="folderToolbar">
        <span className="taskStatusBox">
          <span
            className="taskStatus pointer"
            onClick={() => this.setState({ showOperator: !this.state.showOperator })}
          >
            <span>{this.getTaskStatusName()}</span>
            <i className="Font12 icon-arrow-down-border" />
          </span>
        </span>

        {this.state.showOperator ? (
          <ClickAwayable
            component="ul"
            className={cx('taskStatusList boxShadow5 boderRadAll_3', { Hidden: !this.state.showOperator })}
            onClickAway={() => this.setState({ showOperator: false })}
          >
            {taskStatusList.map((item, i) => {
              return (
                <li
                  key={i}
                  className={cx('bgColorPrimary', { colorPrimary: stateConfig.currentStatus === item.value })}
                  onClick={() => this.switchStatus(item.value)}
                >
                  <i className={item.icon} />
                  {item.text}
                </li>
              );
            })}
          </ClickAwayable>
        ) : undefined}

        <ul className="folderGanttBtn">
          {viewTypeList.map((item, i) => {
            return (
              <li
                key={i}
                className={cx({ active: stateConfig.currentView === item.value })}
                onClick={() => this.switchView(item.value)}
              >
                {item.text}
              </li>
            );
          })}
        </ul>

        <ul className="folderGanttBtn folderGanttWeekBtn">
          {filterWeekendList.map((item, i) => {
            return (
              <li
                key={i}
                className={cx({ active: stateConfig.filterWeekend === item.value })}
                onClick={() => this.filterWeekend(item.value)}
              >
                {item.text}
              </li>
            );
          })}
        </ul>

        <Tooltip title={_l('展开层级')}>
          <span className="folderGanttLevelBtn pointer" onClick={evt => this.showTaskLevel(evt)}>
            <i className="icon-task-show-tree Font15" />
          </span>
        </Tooltip>

        {this.state.showLevel ? (
          <ClickAwayable
            component="ul"
            className={cx('taskLevel boxShadow5 boderRadAll_3', { Hidden: !this.state.showLevel })}
            style={{ left: this.state.taskLevelOffsetLeft }}
            onClickAway={() => this.setState({ showLevel: false })}
          >
            {taskLevelList.map((item, i) => {
              return (
                <li key={i} className="bgColorPrimary" onClick={() => this.switchLevel(item.value)}>
                  {item.text}
                </li>
              );
            })}
          </ClickAwayable>
        ) : undefined}

        {this.props.showStaticGantt && (
          <span
            className="Right pointer mRight20 folderStaticGantt colorPrimary"
            onClick={() => this.switchGanttDialogVisible()}
          >
            <i className="Font16 icon-gantt_chart mRight5" />
            {_l('甘特图')}
          </span>
        )}
        {ganttDialogVisible && <GanttDialog folderID={config.folderId} closeLayer={this.switchGanttDialogVisible} />}
      </div>
    );
  }
}

export default connect((state: RootState) => {
  const { stateConfig, taskConfig } = state.task;

  return {
    stateConfig,
    taskConfig,
  };
})(FolderToolbar);
