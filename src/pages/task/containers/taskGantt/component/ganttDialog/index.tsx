import { Component, Fragment, type MouseEvent } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types';
import Dialog from 'ming-ui/components/Dialog';
import DialogBase from 'ming-ui/components/Dialog/DialogBase';
import LoadDiv from 'ming-ui/components/LoadDiv';
import taskReq from 'src/api/taskCenter';
import ErrorState from 'src/components/errorPage/errorState';
import { downloadFile, getToken } from 'src/utils/common';
import { requireBase64FileToken } from 'src/utils/commonRequestBoundary';
import TaskDetail from '../../../taskDetail/taskDetail';
import config from './config';
import { ganttChartResult, ganttExportKey } from './dataBoundary';
import type { GanttChartResult } from './dataBoundary';
import GanttContent from './GanttContent';
import GanttHeader, { type GanttType } from './GanttHeader';
import GanttSideBar from './GanttSideBar';
import type { GanttProcessTaskNode } from './GraphContent';
import { durDays, momentTime } from './time';
import './index.less';

export interface GanttDialogProps {
  closeLayer?: ((value: boolean) => void) | undefined;
  folderID: string;
}

interface GanttDialogState {
  taskID: string;
  name: string;
  /** 未加载完成前没有有效时间范围，此时不会被任何子组件读取 */
  beginTime: moment.Moment;
  endTime: moment.Moment;
  data: GanttProcessTaskNode[];
  type: GanttType;
  taskDetailVisible: boolean;
  loading: boolean;
  refreshLoading: boolean;
  showExportDialog: boolean;
  buildImgSuccess: boolean;
  errorMsg: string;
  /** 导出图片上传成功后的下载地址 */
  url?: string | undefined;
}

export default class GanttDialog extends Component<GanttDialogProps, GanttDialogState> {
  static override propTypes = {
    folderID: PropTypes.string.isRequired,
    closeLayer: PropTypes.func,
  };
  static defaultProps = {
    closeLayer: () => {},
  };
  override state: GanttDialogState = {
    taskID: '',
    name: '',
    beginTime: moment.invalid(),
    endTime: moment.invalid(),
    data: [],
    type: 'day',
    taskDetailVisible: false,
    loading: true,
    refreshLoading: false,
    showExportDialog: false,
    buildImgSuccess: false,
    errorMsg: '',
  };

  override componentDidMount() {
    this.getData();
  }

  /**
   * 获取数据并处理之
   */
  getData() {
    const { folderID } = this.props;

    return taskReq
      .getTaskStaticGanttChart({ folderID })
      .then((value: unknown) => {
        let res: GanttChartResult;

        try {
          res = ganttChartResult(value);
        } catch (error: unknown) {
          this.handleLoadError(error);
          return;
        }

        if (res.status === false) {
          this.setState({
            loading: false,
            refreshLoading: false,
            errorMsg: res.message || _l('加载失败，请稍后重试'),
          });
          return;
        }

        const { taskData, maxCompleteTime, minStartTime, folderName } = res.data;
        const formatBeginTime = momentTime(minStartTime);
        const formatEndTime = momentTime(maxCompleteTime);

        if (taskData.length && (!formatBeginTime.isValid() || !formatEndTime.isValid())) {
          throw new TypeError('Invalid gantt time range');
        }

        const data = this.dealWithData(taskData);
        if (!data) throw new TypeError('Invalid gantt task list');
        config.beginTime = formatBeginTime;
        config.endTime = formatEndTime;
        const { beginTime, endTime } = this.handleTime(formatBeginTime.clone(), formatEndTime.clone());
        this.setState({
          loading: false,
          refreshLoading: false,
          data,
          beginTime,
          endTime,
          name: folderName,
          errorMsg: '',
        });
      })
      .catch(this.handleLoadError);
  }

  handleLoadError = (error: unknown) => {
    console.error(error);
    this.setState({ loading: false, refreshLoading: false, errorMsg: _l('加载失败，请稍后重试') });
  };

  /**
   * 处理时间
   */
  handleTime = (beginTime: moment.Moment, endTime: moment.Moment) => {
    const { type } = this.state;

    if (type === 'day') {
      beginTime.subtract(7, 'day');
      endTime.add(8, 'day');
    }

    if (type === 'week') {
      beginTime.subtract(1, 'week').startOf('week');
      endTime.add(1, 'week').endOf('week');
    }

    if (type === 'month') {
      beginTime.subtract(1, 'month').startOf('month');
      endTime.add(1, 'month').endOf('month');
    }

    return { beginTime, endTime };
  };

  /**
   * 数据处理 为每个任务添加一个是否显示子项目的标识
   * @param {Array} data
   */
  dealWithData(data: GanttProcessTaskNode[] | null | undefined): GanttProcessTaskNode[] | undefined {
    if (!Array.isArray(data)) return undefined;
    data.forEach((item: GanttProcessTaskNode) => {
      item.child && (item.childrenVisible = true);
      this.dealWithData(item.child);
    });
    return data;
  }

  /**
   * 切换日期显示形式
   */
  switchDisplayType = (type: GanttType) => {
    this.setState({ type }, () => {
      const { beginTime: cachedBegin, endTime: cachedEnd } = config;
      if (cachedBegin === '' || cachedEnd === '') throw new TypeError('Gantt time range is not loaded');
      const { beginTime, endTime } = this.handleTime(cachedBegin.clone(), cachedEnd.clone());
      this.setState({
        beginTime,
        endTime,
      });
    });
  };

  /**
   * 刷新数据
   */
  refresh = () => {
    this.setState({ refreshLoading: true }, () => {
      this.getData();
    });
  };

  /**
   * 导出数据
   */
  exportData = () => {
    const { name } = this.state;
    const $el = $('.ganttContentBox');
    const width = $el.find('.graphWrap').width() ?? 0;
    const height = ($el.find('.graphContent').height() ?? 0) + 70;
    const $box = $el.clone(true);
    let removed = false;

    const cleanup = () => {
      if (removed) return;
      removed = true;
      $box.remove();
    };

    $box.css({
      minWidth: width,
      maxWidth: width,
      minHeight: height,
    });

    $('body').append($box);

    const target = $('body > .ganttContentBox')[0];

    if (!(target instanceof HTMLElement)) {
      cleanup();
      this.handleExportError(new TypeError('Missing gantt export element'));
      return undefined;
    }

    html2canvas(target)
      .then(canvas => {
        try {
          const newCanvas = document.getElementById('ganttCanvas');

          if (!(newCanvas instanceof HTMLCanvasElement)) throw new TypeError('Missing gantt export canvas');

          newCanvas.width = width;
          newCanvas.height = height + 51;

          const ctx = newCanvas.getContext('2d');

          if (!ctx) throw new TypeError('Missing gantt export context');

          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, width, 50);
          ctx.font = '20px Microsoft YaHei';
          ctx.fillStyle = '#151515';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, width / 2, 25);
          ctx.moveTo(0, 51);
          ctx.lineTo(width, 51);
          ctx.strokeStyle = '#e0e0e0';
          ctx.stroke();
          ctx.drawImage(canvas, 0, 51);

          if (newCanvas.toDataURL() === 'data:,') {
            alert(_l('长度过长，请切换"周"或"月"视图后重试'), 2);
          } else {
            this.setState({ showExportDialog: true, buildImgSuccess: false });
            this.putb64(newCanvas.toDataURL());
          }
        } finally {
          cleanup();
        }
      })
      .catch((error: unknown) => {
        cleanup();
        this.handleExportError(error);
      });

    return undefined;
  };

  /**
   * 上传到七牛
   */
  putb64(base64: string) {
    return getToken([{ bucket: 2, ext: '.png' }])
      .then(res => {
        if (!Array.isArray(res)) {
          this.setState({ showExportDialog: false, buildImgSuccess: false });
          alert(res.error);
          return undefined;
        } else {
          const token = requireBase64FileToken(res);
          const url = `${md.global.FileStoreConfig.uploadHost}/putb64/-1/key/${btoa(token.key)}`;
          return axios
            .post<unknown>(url, base64.replace('data:image/png;base64,', ''), {
              headers: {
                'Content-Type': 'application/octet-stream',
                Authorization: `UpToken ${token.uptoken}`,
              },
            })
            .then(({ data }) => {
              const key = ganttExportKey(data);
              this.setState({
                buildImgSuccess: true,
                url: `${md.global.FileStoreConfig.pubHost}/${key}?attname=${encodeURIComponent(
                  this.state.name + moment().format('YYYY-MM-DD'),
                )}.png`,
              });
            })
            .catch(error => {
              this.handleExportError(error);
            });
        }
      })
      .catch((error: unknown) => {
        this.handleExportError(error);
      });
  }

  handleExportError = (error: unknown) => {
    console.error(error);
    this.setState({ showExportDialog: false, buildImgSuccess: false });
    alert(_l('保存失败!'), 2);
  };

  /**
   * 获取文件key
   */
  getFileKey(length: number) {
    const randStrArr = [
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
      'I',
      'J',
      'K',
      'L',
      'M',
      'N',
      'O',
      'P',
      'Q',
      'R',
      'S',
      'T',
      'U',
      'V',
      'W',
      'X',
      'Y',
      'Z',
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      'l',
      'm',
      'n',
      'o',
      'p',
      'q',
      'r',
      's',
      't',
      'u',
      'v',
      'w',
      'x',
      'y',
      'z',
    ];

    const randArr = [];

    for (let i = 0; i < length; i++) {
      randArr.push(randStrArr[Math.floor(Math.random() * randStrArr.length)]);
    }

    return randArr.join('');
  }

  /**
   * 关闭弹窗
   */
  closeLayer = () => {
    this.props.closeLayer?.(false);

    return undefined;
  };

  /**
   * 切换子项目的显示隐藏
   */
  toggleTask = (args: number[]) => {
    const { data } = this.state;
    const cloneData = _.cloneDeep(data);

    this.toggleData(cloneData, args);
    this.setState({
      data: cloneData,
    });
  };

  /**
   * 递归改变子数据的属性
   */
  toggleData = (data: GanttProcessTaskNode[], args: number[]) => {
    const currentIndex = args[0];
    const current = currentIndex === undefined ? undefined : data[currentIndex];

    if (current === undefined) return undefined;

    if (args.length === 1) {
      current.childrenVisible = !current.childrenVisible;

      return undefined;
    }

    this.toggleData(current.child ?? [], args.slice(1));

    return undefined;
  };

  /**
   * 处理子任务hover状态
   */
  handleTaskItemHover = (layerVisible: boolean, e?: MouseEvent<HTMLElement>) => {
    const activeLayer = document.querySelector('.activeLayer');

    if (!(activeLayer instanceof HTMLElement)) return undefined;

    if (layerVisible) {
      if (!e) return undefined;

      const $el = e.currentTarget;
      const top = $el.getBoundingClientRect().top - 51;

      if (top >= 50) {
        activeLayer.style.display = 'block';
        activeLayer.style.top = top + 'px';
      }
    } else {
      activeLayer.style.display = 'none';
    }

    return undefined;
  };

  /**
   * 显示任务详情
   */
  showDetail = (taskID: string) => {
    this.setState({
      taskID,
      taskDetailVisible: true,
    });
  };

  /**
   * 横向滚动至今天
   */
  scrollToToday = () => {
    const { type, beginTime } = this.state;
    const { TYPE_TO_WIDTH } = config;
    const width = TYPE_TO_WIDTH[type];
    const $el = document.querySelector('.ganttContentBox');

    if (!($el instanceof HTMLElement)) return undefined;

    const elWidth = Math.round($el.getBoundingClientRect().width / 2);
    const durWidth = Math.round(durDays(beginTime, moment()) * width + width / 2 - elWidth);
    $el.scrollLeft = durWidth;

    return undefined;
  };

  /**
   * 下载
   */
  onOk = () => {
    const { buildImgSuccess, url } = this.state;

    if (buildImgSuccess && url) {
      window.open(downloadFile(url));
      this.setState({ showExportDialog: false });
    }
  };

  override render() {
    const {
      type,
      data,
      loading,
      refreshLoading,
      errorMsg,
      taskID,
      taskDetailVisible,
      name,
      showExportDialog,
      buildImgSuccess,
    } = this.state;
    const {
      switchDisplayType,
      refresh,
      exportData,
      closeLayer,
      toggleTask,
      handleTaskItemHover,
      showDetail,
      scrollToToday,
    } = this;
    let width = 0;

    if (refreshLoading) {
      const timeHeaderWidth = $('.timeHeader').width() ?? 0;
      const contentWidth = $('.ganttContentBox').width() ?? 0;

      width = timeHeaderWidth > contentWidth ? contentWidth : timeHeaderWidth;
    }

    return (
      // 原实现写的是 onCancel={this.handleClose}，而 handleClose 并不存在，
      // 因此 DialogBase 读取到的回调一直是 undefined。
      // 为保持与原行为一致，这里不再传 onCancel；关闭弹窗仍由 GanttHeader 的关闭入口
      // 走 closeLayer。若要开启遮罩/ESC 关闭，应作为独立行为修复单独提交。
      <DialogBase dialogClasses="flatFishGanttDialog" visible>
        <div className="flatFishGanttWrap flexColumn">
          <GanttHeader {...{ type, name, data, switchDisplayType, refresh, exportData, closeLayer, scrollToToday }} />
          {loading ? (
            <LoadDiv />
          ) : errorMsg ? (
            <ErrorState text={errorMsg} />
          ) : (
            <div className="ganttContentWrap flex flexRow">
              {!data.length ? (
                <div className="emptyGantt">
                  <img src="/staticfiles/images/empty_gantt.png" alt="empty" />
                  <div className="explain">{_l('该甘特图下暂无任务')}</div>
                </div>
              ) : (
                <Fragment>
                  <GanttSideBar {...{ ...this.state, handleTaskItemHover, toggleTask, showDetail }} />
                  <GanttContent {...{ ...this.state, handleTaskItemHover, showDetail }} />
                </Fragment>
              )}
              <div className="activeLayer" />
              {refreshLoading && (
                <div className="refreshLoading" style={{ width }}>
                  <LoadDiv />
                </div>
              )}
            </div>
          )}
          {taskDetailVisible && (
            <TaskDetail
              visible={taskDetailVisible}
              taskId={taskID}
              openType={3}
              closeCallback={() => this.setState({ taskDetailVisible: false })}
            />
          )}
          {showExportDialog && (
            <Dialog
              visible
              title={_l('导出图片')}
              okText={_l('下载')}
              className={buildImgSuccess ? '' : 'saveImgBtnDisabled'}
              onCancel={() => this.setState({ showExportDialog: false })}
              onOk={this.onOk}
            >
              <span className="textTertiary">
                {buildImgSuccess ? _l('已生成图片') : _l('正在整理要导出的数据，请稍候...')}
              </span>
            </Dialog>
          )}
        </div>
      </DialogBase>
    );
  }
}
