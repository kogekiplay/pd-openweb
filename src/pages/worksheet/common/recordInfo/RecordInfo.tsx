import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _, { find, get } from 'lodash';
import type { DebouncedFunc } from 'lodash';
import PropTypes from 'prop-types';
import { Button, Dialog, EditingBar, WaterMark } from 'ming-ui';
import externalPortalAjax from 'src/api/externalPortal';
import paymentAjax from 'src/api/payment.js';
import worksheetAjax from 'src/api/worksheet';
import DragCore from 'worksheet/common/DragCore';
import DragMask from 'worksheet/common/DragMask';
import { RECORD_INFO_FROM, RELATE_RECORD_SHOW_TYPE } from 'worksheet/constants/enum';
import { checkRuleLocked } from 'src/components/Form/core/formUtils';
import { valueRecord } from 'src/components/Form/core/formUtils/valueBoundary';
import { isPublicLink } from 'src/components/Form/core/utils';
import { permitList } from 'src/pages/FormSet/config.js';
import { isOpenPermit } from 'src/pages/FormSet/util.js';
import SheetWorkflow from 'src/pages/workflow/components/SheetWorkflow';
import { getTranslateInfo } from 'src/utils/app';
import {
  emitter,
  getRowGetType,
  KVGet,
  removeTempRecordValueFromLocal,
  saveTempRecordValueToLocal,
} from 'src/utils/common';
import { getTitleTextFromControls, isRelateRecordTableControl, updateOptionsOfControls } from 'src/utils/control';
import type { FormControl } from 'src/utils/controlTypes';
import { VersionProductType } from 'src/utils/enum';
import { addBehaviorLog, getFeatureStatus } from 'src/utils/project';
import { getRecordTempValue } from 'src/utils/record';
import { decodeTempRecordSnapshot } from 'src/utils/tempRecordCache';
import type { TempRecordSnapshot } from 'src/utils/tempRecordCache';
import styled from 'src/utils/typedStyled';
import SheetContext from '../Sheet/SheetContext';
import { deleteRecord, handleSubmitDraft, loadRecord, RecordApi, updateRecord, updateRecordLockStatus } from './crtl';
import RecordEditLock from './RecordEditLock';
import RecordForm from './RecordForm';
import Header from './RecordForm/Header';
import {
  badRecordIds,
  loadedRecord,
  portalDiscussion,
  recordDictionary,
  recordDictionaryOrEmpty,
  recordError,
  recordOwner,
  recordReload,
  recordRow,
  rowEditLock,
} from './recordInfoBoundary';
import RecordInfoContext from './RecordInfoContext';
import RecordInfoRight from './RecordInfoRight';
import type {
  LoadRecordInfoOptions,
  RecordCellRegistration,
  RecordFormRef,
  RecordInfoData,
  RecordInfoProps,
  RecordInfoRow,
  RecordInfoState,
  RecordRefreshCallback,
  RecordRefreshOptions,
  RecordSaveResult,
} from './recordInfoTypes';
import './RecordInfo.less';

const SIDE_MIN_WIDTH = 200 + 226;

/**
 * onSubmit 的入参。全都可选 —— 调用方既有 onSubmit()（普通保存），
 * 也有 onSubmit({ draftType: 'submit' })、以及草稿的一整套 ignore*。
 * 不写这个类型的话 TS 只会从几个默认值推出
 * `{ ignoreAlert?: boolean | undefined; ignoreDialog?: boolean | undefined; silent?: boolean }`，
 * 于是 callback / noSave / draftType 全部报 TS2339。
 */
interface SubmitOptions {
  /** 提交结束回调，实参形如 { error } / { logId }，不传参表示成功 */
  callback?: ((res?: { error?: unknown; logId?: string | undefined }) => void) | undefined;
  /** 只跑校验、不落库 */
  noSave?: boolean | undefined;
  /** 校验有错也继续提交 */
  ignoreError?: boolean | undefined;
  ignoreAlert?: boolean | undefined;
  ignoreDialog?: boolean | undefined;
  silent?: boolean | undefined;
  /** save: 保存  submit: 提交 */
  draftType?: 'save' | 'submit' | undefined;
}

const Drag = styled(DragCore)`
  z-index: 11;
  width: 10px;
  height: 100%;
  margin-right: -10px;
  cursor: ew-resize;
  &:hover {
    border-left: 2px solid var(--color-border-primary);
  }
`;

const LoadMask = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--color-background-overlay-white);
  z-index: 2;
`;

function getSideVisible(from: number | undefined): boolean {
  if (from === RECORD_INFO_FROM.DRAFT) {
    return false;
  } else if (from === RECORD_INFO_FROM.WORKFLOW) {
    const data = localStorage.getItem('recordInfoOfWorkflowSideVisible');
    return _.isNull(data) ? true : Boolean(data);
  } else {
    const data = localStorage.getItem('recordInfoSideVisible');
    return _.isNull(data) ? true : Boolean(data);
  }
}

export default class RecordInfo extends Component<RecordInfoProps, RecordInfoState> {
  // 下面这些都是构造函数或 ref 回调里赋的实例字段。
  // declare 是纯类型声明，babel 的 TS preset 会整行擦掉，运行时零影响 ——
  // 不要改成带初始值的类字段，那会真的生成赋值语句，覆盖掉 ref 回调写进来的值。
  /** 水印开关，挂在 window 上由部署层注入 */
  declare hadWaterMark: boolean | undefined;
  declare debounceRefresh: DebouncedFunc<RecordInfo['refreshEvent']>;
  /** 子组件注册上来的刷新回调，key 是 controlId 或 'loadcustombtns' 这类固定名 */
  declare refreshEvents: Record<string, RecordRefreshCallback>;
  /** 子组件注册上来的单元格实例，key 是 controlId */
  declare cellObjs: { [controlId: string]: { item: FormControl; cell: unknown } };
  /** save: 保存  submit: 提交 */
  declare draftType: 'save' | 'submit' | undefined;
  /** onSubmit 的入参暂存，等表单校验回调时再取出来用 */
  declare submitOptions: SubmitOptions | undefined;
  /** saveTempRecordValueToLocal 的返回值；只写不读，留着是为了保持原行为 */
  declare tempSaving: ReturnType<typeof saveTempRecordValueToLocal>;
  declare recordEditLock: RecordEditLock | undefined;
  declare hasFocusingRelateRecordTags: boolean;
  /** 记录详情最外层容器 */
  declare con: HTMLDivElement | null;
  /** 左右分栏的拖拽手柄 */
  declare drag: HTMLDivElement | null;
  /** RecordForm 通过 mountRef 回传的 customwidget ref */
  declare recordform: RecordFormRef | undefined;

  private disposed = false;
  private loadVersion = 0;
  private payVersion = 0;

  static override propTypes = {
    width: PropTypes.number,
    visible: PropTypes.bool,
    isCharge: PropTypes.bool,
    allowAdd: PropTypes.bool,
    isOpenNewAddedRecord: PropTypes.bool,
    notDialog: PropTypes.bool,
    showPrevNext: PropTypes.bool,
    instanceId: PropTypes.string, // 仅工作流调用需要 流程实例id
    workId: PropTypes.string, // 仅工作流调用需要 运行节点id
    appId: PropTypes.string,
    appSectionId: PropTypes.string,
    viewId: PropTypes.string,
    recordId: PropTypes.string,
    worksheetId: PropTypes.string,
    from: PropTypes.number,
    view: PropTypes.shape({}),
    sheetSwitchPermit: PropTypes.arrayOf(PropTypes.shape({})),
    isSubList: PropTypes.bool,
    allowEdit: PropTypes.bool,
    updateSuccess: PropTypes.func,
    updateWorksheetControls: PropTypes.func,
    projectId: PropTypes.string,
    currentIndex: PropTypes.number,
    hideRecordInfo: PropTypes.func,
    updateRows: PropTypes.func,
    hideRows: PropTypes.func,
    currentSheetRows: PropTypes.arrayOf(PropTypes.shape({})),
    renderHeader: PropTypes.func, // 渲染头部组件的方法
    renderAbnormal: PropTypes.func, // 渲染异常
    workflow: PropTypes.element,
    hideEditingBar: PropTypes.bool, // 隐藏编辑提示层
    handleSwitchRecord: PropTypes.func, //切换记录回调
    customBtnTriggerCb: PropTypes.func, //自定义按钮回调
    worksheetInfo: PropTypes.shape({}), // 工作表信息（草稿记录弹层使用）
    updateDraftList: PropTypes.func, // 更新草稿列表
    addNewRecord: PropTypes.func, // 草稿提交后更新记录列表
    isRelateRecord: PropTypes.bool, // 是否是关联表记录
  };
  static defaultProps = {
    showPrevNext: false,
    editable: true,
    view: {},
    sheetSwitchPermit: [],
    hideRecordInfo: (_recordId?: string) => {},
    updateRows: (
      _ids: Array<string | undefined>,
      _value: Record<string, unknown>,
      _changed?: Record<string, unknown>,
    ) => {},
    hideRows: (_ids: Array<string | undefined>) => {},
    from: RECORD_INFO_FROM.WORKSHEET,
    currentSheetRows: [],
    hideEditingBar: false,
  };
  static override contextType = SheetContext;
  constructor(props: RecordInfoProps) {
    super(props);
    this.state = {
      loading: true,
      submitLoading: false,
      isSettingTempData: false,
      sideWidth: this.getSideWidth(),
      /* 【必须在这里初始化】它在 render 里参与算宽度
         （EditingBar 的 style、formWidth、拖拽条的 left/max），
         但原先只在 loadRecord 成功后的 setState 里才第一次赋值（本文件 formSectionWidth: 0 那处）。
         于是数据回来之前的几次渲染它是 undefined，`width - formSectionWidth - sideWidth` 得到 NaN，
         React 报 "`NaN` is an invalid value for the `width` css style property" 并丢弃该样式 ——
         正在编辑那条提示条这几帧是没有宽度的。
         这条告警只出现在 DevTools 的 Issues 面板里，Console 搜不到，很容易漏掉。 */
      formSectionWidth: 0,
      recordinfo: {},
      tempFormData: [],
      updateControlIds: [],
      sheetSwitchPermit: props.sheetSwitchPermit,
      appId: props.appId,
      worksheetId: props.worksheetId,
      viewId: props.viewId,
      recordId: props.recordId,
      abnormal: false, // 异常
      sideVisible: getSideVisible(props.from),
      currentIndex: _.findIndex(props.currentSheetRows, item => {
        return _.get(item, 'rowid') === props.recordId;
      }),
      allowExAccountDiscuss: false, //允许外部用户讨论
      exAccountDiscussEnum: 0, //外部用户的讨论类型 0：所有讨论 1：不可见内部讨论
      approved: false, //允许外部用户允许查看审批流转详情
      forceShowFullValue: null,
      widgetStyle: props.widgetStyle,
      relateRecordData: {},
      restoreVisible: false,
      payConfig: {}, //支付相关
      discussCount: undefined,
      editLockedUser: null,
      isRecordLock: false, // 记录锁定
    };
    this.hadWaterMark = window.hadWaterMark;
    this.debounceRefresh = _.debounce(this.refreshEvent, 1000);
    this.refreshEvents = {};
    this.cellObjs = {};
    this.draftType = 'save'; // save: 保存  submit: 提交,
  }

  override componentDidMount() {
    this.disposed = false;
    emitter.addListener('RELOAD_RECORD_INFO', this.debounceRefresh);
    window.addEventListener('keydown', this.handleRecordInfoKeyDown);
    this.loadRecord({ recordId: this.state.recordId });
    this.getPayConfig(this.state.recordId);
  }

  override componentDidUpdate(prevProps: RecordInfoProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if ((this.props.recordId !== prevProps.recordId || this.props.flag !== prevProps.flag) && this.props.recordId) {
        this.setState({
          loading: true,
          recordId: this.props.recordId,
          abnormal: false,
          currentIndex: _.findIndex(prevProps.currentSheetRows, item => {
            return _.get(item, 'rowid') === this.props.recordId;
          }),
        });
        this.loadRecord({
          recordId: this.props.recordId,
          props: this.props,
        });
        this.getPayConfig(this.props.recordId);
      }

      const changes: Partial<Pick<RecordInfoState, 'worksheetId' | 'viewId' | 'appId'>> = {};

      if (this.props.worksheetId !== this.state.worksheetId) {
        changes.worksheetId = this.props.worksheetId;
      }

      if (this.props.viewId !== this.state.viewId) {
        changes.viewId = this.props.viewId;
      }

      if (this.props.appId !== this.state.appId) {
        changes.appId = this.props.appId;
      }

      if (!_.isEmpty(changes)) {
        this.setState(previous => ({ ...previous, ...changes }));
      }
    }
  }

  override componentWillUnmount() {
    this.disposed = true;
    this.loadVersion += 1;
    this.payVersion += 1;
    window.removeEventListener('keydown', this.handleRecordInfoKeyDown);
    emitter.removeListener('RELOAD_RECORD_INFO', this.debounceRefresh);

    this.recordEditLock?.destroy();
    this.debounceRefresh.cancel();
  }

  private hideRecordInfo(recordId?: string) {
    (this.props.hideRecordInfo === undefined ? RecordInfo.defaultProps.hideRecordInfo : this.props.hideRecordInfo)(
      recordId,
    );
  }

  get isPublicShare() {
    return (
      _.get(window, 'shareState.isPublicRecord') ||
      _.get(window, 'shareState.isPublicView') ||
      _.get(window, 'shareState.isPublicPage') ||
      _.get(window, 'shareState.isPublicQuery') ||
      _.get(window, 'shareState.isPublicPrint')
    );
  }

  get discussId() {
    const url = new URL(location.href);
    const discussId = url.searchParams.get('inboxId');

    if (this.props.notDialog && discussId) {
      return discussId;
    }

    return undefined;
  }

  loadTempValue({ updateTime }: { updateTime?: string | undefined } = {}) {
    const { recordId } = this.props;
    const version = this.loadVersion;
    const current = () => !this.disposed && version === this.loadVersion;
    const { viewId, iseditting, tempFormData, isRecordLock } = this.state;
    if (!viewId || isRecordLock) return;
    let tempData: string | null | undefined;

    const handleFillValue = () => {
      if (!current()) return;
      if (tempData && !iseditting) {
        this.setState({ isSettingTempData: true });
        let savedData: TempRecordSnapshot | undefined;
        try {
          savedData = decodeTempRecordSnapshot(tempData);
        } catch (error) {
          console.error(error);
          this.setState({ isSettingTempData: false });
          return;
        }

        if (!savedData) {
          this.setState({ isSettingTempData: false });
          return;
        }

        const { create_at, value } = savedData;
        const tempRecordCreateTime = new Date(create_at === undefined ? NaN : create_at);
        const recordUpdateTime = new Date(updateTime === undefined ? NaN : updateTime);

        if (tempRecordCreateTime > recordUpdateTime) {
          const newTempData = tempFormData.map(c =>
            typeof value[String(c.controlId)] !== 'undefined' &&
            !((c.type === 29 && c.enumDefault !== 1) || c.type === 34)
              ? {
                  ...c,
                  value:
                    c.type === 34
                      ? {
                          // action: 'clearAndSet',con
                          rows: value[String(c.controlId)],
                        }
                      : value[String(c.controlId)],
                }
              : c,
          );

          if (
            _.isEmpty(
              newTempData.filter(
                c =>
                  typeof value[String(c.controlId)] !== 'undefined' &&
                  !((c.type === 29 && c.enumDefault !== 1) || c.type === 34),
              ),
            )
          ) {
            this.setState({ isSettingTempData: false });
            return;
          }

          this.setState(
            {
              restoreVisible: tempRecordCreateTime,
              tempFormData: newTempData,
              formFlag: Math.random().toString(),
              isSettingTempData: false,
            },
            () => {
              setTimeout(() => {
                if (!current()) return;
                if (this.recordform?.current && this.recordform?.current.dataFormat) {
                  this.recordform.current.dataFormat.controlIds = tempFormData
                    .filter(
                      c => value[String(c.controlId)] && !((c.type === 29 && c.enumDefault !== 1) || c.type === 34),
                    )
                    .flatMap(c => (c.controlId === undefined ? [] : [c.controlId]));
                }
              }, 300);
            },
          );
        } else {
          this.setState({ isSettingTempData: false });
        }
      }
    };

    if (window.isWxWork) {
      KVGet(`${md.global.Account.accountId}${viewId}-${recordId}-recordInfo`)
        .then(data => {
          tempData = data;
          handleFillValue();
        })
        .catch(error => {
          if (!current()) return;
          console.error(error);
          this.setState({ isSettingTempData: false });
        });
    } else {
      tempData = localStorage.getItem(`recordInfo_${viewId}-${recordId}`);
      handleFillValue();
    }
  }
  getPortalConfigSet = async (nextProps: { appId?: string | undefined }) => {
    const { appId } = nextProps;

    if (!appId) {
      return {};
    }

    return portalDiscussion(await externalPortalAjax.getConfig({ appId }));
  };

  getPayConfig = (recordId?: string, updateFlag?: boolean) => {
    const { worksheetId, viewId, enablePayment, from } = this.props;
    const isPayShare = location.search.includes('payshare=true');
    // 支付配置（开启支付或分享支付） && 不是草稿箱
    if (!((enablePayment || isPayShare) && from !== RECORD_INFO_FROM.DRAFT)) return undefined;
    const rowId = recordId || this.state.recordId;
    const version = ++this.payVersion;
    const current = () => !this.disposed && version === this.payVersion;

    return paymentAjax
      .checkPayOrderForRowDetail({
        worksheetId,
        rowId,
        viewId,
        isOtherPayment: location.search.includes('payshare=true'),
      })
      .then((res: unknown) => {
        if (!current()) return;
        this.setState({ payConfig: res, formFlag: updateFlag ? Math.random().toString() : this.state.formFlag });
      })
      .catch((error: unknown) => {
        if (current()) console.error(error);
      });
  };

  getSideWidth() {
    const sideWidth = parseInt(localStorage.getItem('RECORD_INFO_SIDE_WIDTH') || '400', 10);

    if (_.isNaN(sideWidth)) {
      return 400;
    }

    // SIDE_MIN_WIDTH
    return sideWidth;
  }

  getAllowEdit = (recordinfo: RecordInfoData) => {
    const { from, allowAdd, allowEdit } = this.props;

    return from === RECORD_INFO_FROM.DRAFT ? allowAdd : _.isUndefined(allowEdit) ? recordinfo.allowEdit : allowEdit;
  };

  getIsEditLockOpen = (recordinfo: RecordInfoData) => {
    const { projectId, from } = this.props;
    const featureType = getFeatureStatus(projectId, VersionProductType.editProtect);
    const lock = rowEditLock(safeParse(recordinfo.advancedSetting?.['roweditlock']));

    return (
      featureType === '1' &&
      from !== RECORD_INFO_FROM.DRAFT &&
      !_.get(window, 'shareState.isPublicForm') &&
      this.getAllowEdit(recordinfo) &&
      lock.isopen === '1'
    );
  };

  async loadRecord({
    recordId,
    props,
    needReLoadSheetSwitch,
    closeWhenNotViewData,
    needUpdateControlIds,
    cb = _.noop,
  }: LoadRecordInfoOptions) {
    const version = ++this.loadVersion;
    const current = () => !this.disposed && version === this.loadVersion;
    const {
      from,
      view = {},
      controls,
      allowAdd,
      appId,
      viewId,
      worksheetId,
      relationWorksheetId,
      instanceId,
      workId,
      rules,
      isWorksheetQuery,
      isWorksheetRowLand,
      hideRows = RecordInfo.defaultProps.hideRows,
      hideRecordInfo = RecordInfo.defaultProps.hideRecordInfo,
      disableOpenRecordFromRelateRecord,
      isRelateRecord,
      onError = _.noop,
      notDialog,
    }: RecordInfoProps = props || this.props;
    let { sheetSwitchPermit } = this.state;
    const { isPublicShare } = this;
    const { tempFormData } = this.state;
    const isManageView = viewId === worksheetId;

    try {
      if (needReLoadSheetSwitch && !isManageView) {
        sheetSwitchPermit = await worksheetAjax.getSwitchPermit({ worksheetId });
      }

      if (!current()) return;
      const raw = await loadRecord({
        appId,
        viewId,
        worksheetId,
        instanceId,
        workId,
        recordId,
        getType: !isRelateRecord && getRowGetType(from, { discussId: !!this.discussId }),
        getRules: !rules,
        controls,
        relationWorksheetId,
        discussId: this.discussId,
      });
      if (!current()) return;
      const data = loadedRecord(raw);
      !isRelateRecord &&
        getRowGetType(from, { discussId: !!this.discussId }) !== 21 &&
        notDialog &&
        addBehaviorLog('worksheetRecord', worksheetId, { rowId: recordId }, true);

      let portalConfigSet = portalDiscussion({});
      const appInfo = valueRecord(window['appInfo']);
      const windowAppId = appInfo?.['id'];
      const portalConfig = appInfo?.['portalConfig'] || {};
      const isSameApp = data?.appId === windowAppId;
      const isPublic =
        isPublicShare || _.get(window, 'shareState.isPublicForm') || _.get(window, 'shareState.isPublicWorkflowRecord');

      if (isSameApp) {
        portalConfigSet = portalDiscussion(portalConfig);
      } else if (!isPublic) {
        const showDiscuss = isOpenPermit(permitList.recordDiscussSwitch, sheetSwitchPermit, viewId);
        const showApprove = isOpenPermit(permitList.approveDetailsSwitch, sheetSwitchPermit, viewId);

        if (showDiscuss || showApprove) {
          // 非同一个应用且讨论或审批没有关闭 去获取外部门户讨论设置
          try {
            portalConfigSet = await this.getPortalConfigSet(data);
          } catch (e) {
            console.log(e);
          }
        }
      }

      if (!current()) return;
      portalConfigSet.allowExAccountDiscuss = portalConfigSet.allowExAccountDiscuss && portalConfigSet.isEnable;
      // 关联记录可能属于其他应用，工作表名翻译需以记录实际所在应用 data.appId 为准
      data.worksheetName = getTranslateInfo(data.appId || appId || '', null, worksheetId).name || data.worksheetName;
      // 设置隐藏字段的 hidden 属性
      data.formData = data.formData.map((c: FormControl) => {
        const newControl = {
          ...c,
          hidden: c.hidden || (view.controls || data.view?.controls || []).includes(String(c.controlId)),
        };

        if (disableOpenRecordFromRelateRecord) {
          try {
            if (!newControl.advancedSetting) throw new TypeError('Missing control settings');
            newControl.advancedSetting.allowlink = '0';
          } catch (err) {
            console.error(err);
          }
        }

        if (c.type === 29 && get(c, 'advancedSetting.showtype') === String(RELATE_RECORD_SHOW_TYPE.TABLE)) {
          // 关联表格配置了过滤结果后，需要不显示实际关联数量，显示过滤后数量
          const strDefault = c.strDefault || '';
          const [isHiddenOtherViewRecord] = strDefault.split('');
          const resultfilters: unknown = safeParse(get(c, 'advancedSetting.resultfilters'));
          const filterResult =
            (Array.isArray(resultfilters) && resultfilters.length > 0) || !!Number(isHiddenOtherViewRecord);
          return filterResult
            ? {
                ...newControl,
                initialValue: c.value,
              }
            : newControl;
        } else {
          return newControl;
        }
      });
      if ((isWorksheetRowLand && viewId && !data.isViewData) || isPublicShare) {
        data.allowEdit = false;
      }

      if (_.isBoolean(closeWhenNotViewData) && closeWhenNotViewData && viewId && !data.isViewData) {
        hideRows([recordId]);
        if (from !== RECORD_INFO_FROM.WORKSHEET_ROW_LAND) {
          hideRecordInfo(recordId);
          return;
        }
      }

      if (this.getIsEditLockOpen(data)) {
        if (!worksheetId || !recordId) throw new TypeError('Missing record edit lock identifiers');
        if (this.recordEditLock) {
          this.recordEditLock.destroy();
          this.recordEditLock.checkAndLock.cancel();
        }

        this.recordEditLock = new RecordEditLock({
          worksheetId,
          recordId,
          rowEditLock: rowEditLock(safeParse(data.advancedSetting?.['roweditlock'])),
          updateLockedUser: userInfo => this.setState({ editLockedUser: userInfo }),
          onLockCallBack: () => this.handleCancelChange(),
          onRefreshRecord: () => this.handleCancelChange(() => this.handleRefresh({ reloadDiscuss: false })),
        });
      }

      this.setState(
        previous => ({
          ...previous,
          editLockedUser: this.recordEditLock?.lockData.lockAccount,
          ...portalConfigSet,
          sideVisible:
            data.resultCode !== 71 &&
            ((md.global.Account.isPortal &&
              !portalConfigSet.allowExAccountDiscuss &&
              (!portalConfigSet.approved ||
                !isOpenPermit(permitList.approveDetailsSwitch, sheetSwitchPermit, viewId))) ||
            isPublicShare ||
            _.get(window, 'shareState.isPublicForm') ||
            _.get(window, 'shareState.isPublicWorkflowRecord')
              ? false
              : this.state.sideVisible), //外部门户是否开启讨论
          formSectionWidth: 0,
          failure: undefined,
          recordinfo: {
            ...data,
            allowAdd,
            ...(data.rules ? {} : { rules }),
            isWorksheetQuery: isWorksheetQuery || _.isUndefined(isWorksheetQuery),
          },
          tempFormData: needUpdateControlIds
            ? tempFormData
                .filter(c => !_.find(needUpdateControlIds, id => c.controlId === id))
                .concat(
                  needUpdateControlIds
                    .map(id => _.find(data.formData, c => c.controlId === id))
                    .filter((control): control is FormControl => control !== undefined),
                )
            : data.formData,
          formFlag: Math.random().toString(),

          loading: false,
          refreshBtnNeedLoading: false,
          widgetStyle: data.advancedSetting || this.state.widgetStyle,
          ...(needReLoadSheetSwitch ? { sheetSwitchPermit } : {}),
          formDidMountFlag: Math.random().toString(),
          isRecordLock: data.isLock,
        }),
        () => {
          if (!current()) return;
          cb();
          this.loadTempValue({ updateTime: data.updateTime });
        },
      );
    } catch (thrown) {
      if (!current()) return;
      const res = recordError(thrown);
      if (instanceId && workId && res.errorCode === 10) {
        onError(thrown);
      }

      if (res.resultCode === 4) {
        if (from !== RECORD_INFO_FROM.WORKSHEET_ROW_LAND) {
          hideRecordInfo();
          return;
        }

        this.setState({
          abnormal: true,
          loading: false,
          recordinfo: res,
          failure: thrown,
          refreshBtnNeedLoading: false,
        });
        return;
      }

      this.setState({
        abnormal: true,
        loading: false,
        recordinfo: res,
        failure: thrown,
        refreshBtnNeedLoading: false,
      });
    }
  }

  handleCancel = () => {
    if (this.state.iseditting) {
      this.setState({ showCloseDialog: true });
    } else {
      this.hideRecordInfo();
    }
  };

  handleDelete = async (e?: { stopPropagation(): void }) => {
    if (e && _.isFunction(e.stopPropagation)) {
      e.stopPropagation();
    }

    const {
      hideRecordInfo = RecordInfo.defaultProps.hideRecordInfo,
      deleteRows,
      onDeleteSuccess = () => {},
    } = this.props;
    const { recordId, worksheetId } = this.state;

    if (_.isFunction(deleteRows)) {
      deleteRows(worksheetId, [{ rowid: recordId, allowDelete: true }]);
      hideRecordInfo();
      return;
    }

    try {
      await deleteRecord({ worksheetId, recordId });
      hideRecordInfo();
      onDeleteSuccess();
      if (window.customWidgetViewIsActive) {
        emitter.emit('POST_MESSAGE_TO_CUSTOM_WIDGET', {
          action: 'delete-record',
          value: recordId,
        });
      }

      alert(_l('删除成功'));
    } catch (err) {
      console.log(err);
      alert(_l('删除失败'), 2);
    }
  };

  switchRecord = (isNext: boolean) => {
    const { recordId, iseditting, tempFormData, restoreVisible } = this.state;
    const { handleSwitchRecord } = this.props;

    if (iseditting || restoreVisible) {
      alert(_l('请先保存或取消当前更改'), 3);
      return;
    }

    $('.mdEditorSave').click();
    const { currentSheetRows = [] } = this.props;
    const index = _.findIndex(currentSheetRows, record => {
      return record && record.rowid === recordId;
    });
    const newIndex = isNext ? index + 1 : index - 1;

    const selectedRecord = currentSheetRows[newIndex];
    if (!selectedRecord) {
      return;
    }

    if (typeof handleSwitchRecord === 'function') {
      handleSwitchRecord(selectedRecord);
      return;
    }

    const newRecordId = selectedRecord.rowid;
    const appIdValue: unknown = selectedRecord['appId'];
    const appId = typeof appIdValue === 'string' ? appIdValue : undefined;
    const viewIdValue: unknown = selectedRecord['viewId'];
    const viewId = typeof viewIdValue === 'string' ? viewIdValue : undefined;
    const worksheetIdValue: unknown = selectedRecord['worksheetId'];
    const worksheetId = typeof worksheetIdValue === 'string' ? worksheetIdValue : undefined;
    this.setState({
      tempFormData: tempFormData.map(c => (isRelateRecordTableControl(c) ? { ...c, value: undefined } : c)),
    });
    addBehaviorLog('worksheetRecord', worksheetId || this.state.worksheetId, { rowId: newRecordId }); // 埋点
    this.loadRecord({
      needReLoadSheetSwitch: worksheetId !== this.state.worksheetId,
      recordId: newRecordId,
      props: worksheetId
        ? {
            ...this.props,
            appId,
            viewId,
            worksheetId,
          }
        : undefined,
    });
    this.getPayConfig(newRecordId);
    this.setState(previous => ({
      ...previous,
      recordId: newRecordId,
      currentIndex: newIndex,
      ...(worksheetId ? { appId, viewId, worksheetId } : {}),
    }));
  };

  updateRecordLock = () => {
    const { updateRows = RecordInfo.defaultProps.updateRows } = this.props;
    const { recordinfo, recordId } = this.state;

    if (recordinfo.roleType === 2 && !isPublicLink()) {
      updateRecordLockStatus(
        {
          ..._.pick(this.props, ['appId', 'viewId', 'worksheetId']),
          recordId,
          updateType: this.state.isRecordLock ? 42 : 41,
        },
        (_err: unknown, rawResponse: unknown) => {
          if (rawResponse) {
            const resdata = recordRow(rawResponse);
            const changedValue = { sys_lock: resdata.sys_lock };
            updateRows([recordId], _.omit(resdata, ['allowedit', 'allowdelete']), changedValue);
            this.setState({
              recordinfo: { ...recordinfo, ...changedValue },
              isRecordLock: resdata.sys_lock,
            });
            this.handleCancelChange();
            if (resdata.sys_lock) {
              alert(_l('%0锁定成功', recordinfo.entityName || ''));
            } else {
              alert(_l('%0已解锁', recordinfo.entityName || ''));
            }
          }
        },
      );
    }
  };

  handleRecordInfoKeyDown = (e: KeyboardEvent) => {
    const { tableType, showPrevNext } = this.props;
    // 嵌入视图不支持上下页快捷操作
    if (get(this.context, 'config.fromEmbed')) return;

    if (
      tableType === 'classic' &&
      e.key === ' ' &&
      e.target instanceof Element &&
      e.target.tagName.toLowerCase() === 'body' &&
      !this.con?.querySelector('.cell.focus')
    ) {
      this.handleCancel();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const { currentSheetRows = [] } = this.props;
    let activeDialogRecordId;

    try {
      const filterEmbedViewRecord = [...document.querySelectorAll('.recordInfoCon')].filter(i => {
        return !i.closest('.viewContainer');
      });
      activeDialogRecordId = filterEmbedViewRecord.pop()?.getAttribute('data-record-id');
    } catch (err) {
      console.log(err);
    }

    if (activeDialogRecordId !== this.state.recordId) {
      return;
    }

    const canPrev = currentSheetRows.length > 0 && this.state.currentIndex !== 0;
    const canNext = currentSheetRows.length > 0 && this.state.currentIndex !== currentSheetRows.length - 1;

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.keyCode === 188) {
      if (showPrevNext) {
        if (canPrev) {
          this.switchRecord(false);
        } else {
          alert(_l('没有更多了'), 3);
        }
      }

      e.preventDefault();
      e.stopPropagation();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.keyCode === 190) {
      if (showPrevNext) {
        if (canNext) {
          this.switchRecord(true);
        } else {
          alert(_l('没有更多了'), 3);
        }
      }

      e.preventDefault();
      e.stopPropagation();
    }
  };

  renderDialogs() {
    const { hideRecordInfo = RecordInfo.defaultProps.hideRecordInfo } = this.props;
    const { viewId, showCloseDialog } = this.state;

    return (
      <React.Fragment>
        {showCloseDialog && (
          <Dialog
            visible={showCloseDialog}
            title={<span className="Red">{_l('您有未保存的修改，确定要离开此页吗？')}</span>}
            description={_l('如果不保存，修改的内容将会丢失')}
            onCancel={() => {
              this.setState({ showCloseDialog: false });
            }}
            onOk={() => {
              this.recordEditLock?.cancelEditLock();
              removeTempRecordValueFromLocal('recordInfo', viewId + '-' + this.state.recordId);
              hideRecordInfo();
            }}
          />
        )}
      </React.Fragment>
    );
  }

  handleFormChange = (data: FormControl[], ids: string[] = []) => {
    const { from } = this.props;
    const { viewId, recordinfo, updateControlIds } = this.state;

    if (this.recordEditLock && !this.recordEditLock.checkAndLock()) {
      return;
    }

    let doNotTriggerEditing = false;

    if (!this.state.iseditting && ids.length === 1 && get(find(data, { controlId: ids[0] }), 'type') === 37) {
      doNotTriggerEditing = true;
    }

    const tempRecordValue = getRecordTempValue(data, undefined, { updateControlIds: ids });

    if (viewId && !doNotTriggerEditing) {
      this.tempSaving = saveTempRecordValueToLocal(
        'recordInfo',
        viewId + '-' + this.state.recordId,
        JSON.stringify({ create_at: Date.now(), value: tempRecordValue }),
      );
    }

    const isDraftChildTableDefault =
      from === RECORD_INFO_FROM.DRAFT && data.filter(t => t.type === 34).some(it => _.get(it, 'value.isDefault'));
    this.setState({
      restoreVisible: false,
      tempFormData: data.map(c => (c.type === 34 ? { ...c, value: undefined } : c)),
      iseditting: doNotTriggerEditing ? false : !isDraftChildTableDefault && this.getAllowEdit(recordinfo),
      updateControlIds: _.uniq(updateControlIds.concat(ids)),
    });
  };

  onSubmit = ({
    callback,
    noSave,
    ignoreError,
    ignoreAlert = false,
    ignoreDialog = false,
    silent = false,
    draftType,
  }: SubmitOptions = {}) => {
    if (window.isPublicApp) {
      alert(_l('预览模式下，不能操作'), 3);
      return;
    }

    this.draftType = draftType;
    this.submitOptions = { callback, noSave, ignoreError };
    this.setState({ submitLoading: true });
    setTimeout(
      () => {
        this.hasFocusingRelateRecordTags = false;
        const form = this.recordform?.current;
        if (this.disposed) return;
        if (
          !form ||
          typeof form.submitFormData !== 'function' ||
          typeof form.uniqueErrorUpdate !== 'function' ||
          typeof form.updateRenderData !== 'function'
        ) {
          this.setState({ submitLoading: false });
          callback?.({ error: new TypeError('Record form is not ready') });
          return;
        }
        try {
          form.submitFormData({ ignoreAlert, silent, ignoreDialog });
        } catch (error) {
          this.setState({ submitLoading: false });
          callback?.({ error });
          console.error(error);
        }
      },
      this.hasFocusingRelateRecordTags || window.cellTextIsBlurring ? 1000 : 0,
    );
  };

  onSave = (
    error: boolean | undefined,
    { data, updateControlIds, handleRuleError, handleServiceError, alertLockError }: RecordSaveResult,
  ) => {
    if (this.disposed) return undefined;
    const { from, updateDraftList, addNewRecord } = this.props;
    const { callback = () => {}, noSave, ignoreError } = this.submitOptions || {};
    data = data.filter(c => !isRelateRecordTableControl(c, { ignoreInFormTable: true }));
    if (error && !ignoreError) {
      callback({ error: true });
      this.setState({ submitLoading: false });
      return undefined;
    }

    const {
      projectId,
      instanceId,
      workId,
      updateSuccess,
      updateRows = RecordInfo.defaultProps.updateRows,
      hideRows = RecordInfo.defaultProps.hideRows,
      hideRecordInfo = RecordInfo.defaultProps.hideRecordInfo,
      updateWorksheetControls,
      allowEmptySubmit,
      view = {},
      isRelateRecord,
    } = this.props;
    const { appId, viewId, worksheetId, recordId, recordinfo } = this.state;
    let hasError;

    if (hasError && !ignoreError) {
      alert(_l('请正确填写%0', recordinfo.entityName || ''), 3);
      if (_.isFunction(callback)) {
        callback({ error: true });
      }

      this.setState({
        submitLoading: false,
      });
      return false;
    }

    if (noSave) {
      this.setState({
        submitLoading: false,
      });
      callback();
      return undefined;
    }

    this.abortChildTable();

    const isDraft = from === RECORD_INFO_FROM.DRAFT && !isRelateRecord;

    if (isDraft && this.draftType === 'submit') {
      // 提交草稿（转为正常记录）
      handleSubmitDraft(
        {
          formData: data,
          worksheetId,
          viewId,
          appId,
          recordId,
          rules: this.props.worksheetInfo?.rules,
          triggerUniqueError: (badData: unknown) => {
            if (this.recordform?.current && _.isFunction(this.recordform?.current.uniqueErrorUpdate)) {
              this.recordform?.current.uniqueErrorUpdate(badRecordIds(badData));
            }
          },
          setSubListUniqueError: (badData: unknown) => {
            if (this.recordform?.current?.dataFormat) {
              this.recordform.current.dataFormat.callStore('setUniqueError', { badData: badRecordIds(badData) });
            }
          },
          setRuleError: (badData: unknown) => handleRuleError(badRecordIds(badData)),
          alertLockError: () => alertLockError(),
          setServiceError: (badData: unknown) => handleServiceError(badRecordIds(badData)),
          onSubmitEnd: () => {
            this.setState({ submitLoading: false });
            this.hideRecordInfo();
          },
          onSubmitSuccess: rowData => {
            // 更新草稿列表
            if (_.isFunction(updateDraftList)) {
              updateDraftList(recordId);
            }

            // 更新记录列表
            if (_.isFunction(addNewRecord)) {
              addNewRecord(rowData, view);
            }
          },
        },
        (err: unknown) => {
          setTimeout(() => {
            this.setState({
              submitLoading: false,
            });
          }, 600);
          if (err) {
            callback({ error: err });
          }
        },
      );
      return undefined;
    }

    updateRecord(
      {
        appId,
        viewId,
        getType: isDraft || isRelateRecord ? undefined : getRowGetType(from, { discussId: !!this.discussId }),
        worksheetId,
        recordId,
        projectId,
        instanceId,
        workId,
        data,
        updateControlIds,
        updateSuccess,
        isDraft: from === RECORD_INFO_FROM.DRAFT && !isRelateRecord,
        allowEmptySubmit,
        triggerUniqueError: (badData: unknown) => {
          if (this.recordform?.current && _.isFunction(this.recordform?.current.uniqueErrorUpdate)) {
            this.recordform?.current.uniqueErrorUpdate(badRecordIds(badData));
          }
        },
        setSubListUniqueError: (badData: unknown) => {
          if (this.recordform?.current?.dataFormat) {
            this.recordform.current.dataFormat.callStore('setUniqueError', { badData: badRecordIds(badData) });
          }
        },
        setRuleError: (badData: unknown) => handleRuleError(badRecordIds(badData)),
        alertLockError: () => alertLockError(),
        setServiceError: (badData: unknown) => handleServiceError(badRecordIds(badData)),
      },
      (err: unknown, rawResponse: unknown, rawLogId: unknown) => {
        setTimeout(() => {
          this.setState({
            submitLoading: false,
          });
        }, 600);
        if (!err) {
          let resdata: RecordInfoRow;
          try {
            resdata = recordRow(rawResponse);
          } catch (failure) {
            callback({ error: failure });
            this.setState({ submitLoading: false });
            console.error(failure);
            return;
          }
          const logId = typeof rawLogId === 'string' ? rawLogId : undefined;
          if (!recordinfo.formData) throw new TypeError('Missing loaded record fields');
          let newFormData: FormControl[] = recordinfo.formData.map((c: FormControl) => {
            let value = resdata[String(c.controlId)];
            return _.assign({}, c, { value, count: resdata[`rq${c.controlId}`] });
          });
          updateRows([recordId], _.omit(resdata, ['allowedit', 'allowdelete']), _.pick(resdata, updateControlIds));
          // 更新草稿列表
          if (_.isFunction(updateDraftList)) {
            updateDraftList(recordId, resdata);
          }

          if (window.customWidgetViewIsActive) {
            emitter.emit('POST_MESSAGE_TO_CUSTOM_WIDGET', {
              action: 'update-record',
              value: resdata,
            });
          }

          this.refreshAsyncLoadControl();
          if (this.recordform?.current?.dataFormat) {
            this.recordform.current.dataFormat.callStore('reset');
          }

          if (viewId && !resdata.isviewdata) {
            hideRows([recordId]);
            if (from !== RECORD_INFO_FROM.WORKSHEET_ROW_LAND) {
              hideRecordInfo();
            }
          }

          this.getPayConfig();
          if (_.isFunction(callback)) {
            callback({ logId });
          }

          this.setState({ iseditting: false });
          this.recordEditLock?.cancelEditLock();
          // 处理选项自定义选项
          const newOptionControls = updateOptionsOfControls(data, resdata);

          if (newOptionControls.length) {
            if (_.isFunction(updateWorksheetControls)) {
              updateWorksheetControls(newOptionControls);
            }

            newFormData = newFormData.map(c => {
              const optionControl = _.find(newOptionControls, noc => noc.controlId === c.controlId);
              return optionControl
                ? { ...optionControl, value: resdata[String(optionControl.controlId)] || optionControl.value }
                : c;
            });
          }

          this.setState({
            formFlag: Math.random().toString(),
            tempFormData: newFormData,
            recordinfo: { ...recordinfo, formData: newFormData },
            updateControlIds: [],
            isRecordLock: resdata.sys_lock,
          });
          removeTempRecordValueFromLocal('recordInfo', viewId + '-' + this.state.recordId);
          if (_.isFunction(this.refreshEvents['loadcustombtns'])) {
            this.tempSaving?.cancel();

            this.refreshEvents['loadcustombtns']();
          }
        } else {
          callback({ error: err });
        }
      },
    );
    return undefined;
  };

  updateRecordOwner = (rawOwner: unknown, rawRecord: unknown) => {
    const newOwner = recordOwner(rawOwner);
    const record = recordRow(rawRecord);
    const { updateRows = RecordInfo.defaultProps.updateRows } = this.props;
    const { recordId, recordinfo } = this.state;
    const changedValue = { ownerid: JSON.stringify([newOwner]) };
    updateRows([recordId], _.omit(record, ['allowedit', 'allowdelete']), changedValue);
    this.setState({
      recordinfo: { ...recordinfo, ownerAccount: newOwner },
    });
  };

  abortChildTable = () => {
    Object.keys(this.cellObjs).forEach(key => {
      const cell = valueRecord(this.cellObjs[key]?.cell);
      const abort = cell?.['updateAbortController'];
      if (typeof abort === 'function') Reflect.apply(abort, cell, []);
    });
  };

  handleCancelChange = (cb = () => {}) => {
    const { viewId, recordinfo } = this.state;
    this.recordEditLock?.cancelEditLock();
    removeTempRecordValueFromLocal('recordInfo', viewId + '-' + this.state.recordId);
    emitter.emit('SAVE_CANCEL_RECORD');
    this.setState(
      {
        tempFormData: recordinfo.formData || [],
        iseditting: false,
        formFlag: Math.random().toString(),
      },
      () => {
        if (this.recordform?.current?.dataFormat) {
          this.recordform.current.dataFormat.callStore('cancelChange');
        }

        this.abortChildTable();
        _.isFunction(cb) && cb();
      },
    );
  };

  refreshEvent = (value: unknown) => {
    const event = recordReload(value);
    if (!event) return;
    const { worksheetId, recordId, closeWhenNotViewData } = event;
    const { iseditting } = this.state;

    if (!iseditting && worksheetId === this.state.worksheetId && recordId === this.state.recordId) {
      this.handleRefresh({ closeWhenNotViewData, reloadDiscuss: false });
    }
  };

  handleRefresh = ({ closeWhenNotViewData, doNotResetPageIndex, reloadDiscuss = true }: RecordRefreshOptions = {}) => {
    if (this.state.iseditting) {
      return;
    }

    this.setState({ refreshBtnNeedLoading: true });
    const { recordId, worksheetId, appId, viewId } = this.state;
    addBehaviorLog('worksheetRecord', this.state.worksheetId, { rowId: recordId }); // 埋点
    this.loadRecord({
      recordId,
      closeWhenNotViewData,
      props: {
        ...this.props,
        appId,
        viewId,
        worksheetId,
      },
      isRefresh: true,
      cb: () => {
        _.each(this.refreshEvents || {}, fn => {
          if (_.isFunction(fn)) {
            fn({ doNotResetPageIndex });
          }
        });
      },
    });
    this.getPayConfig(recordId);
    if (reloadDiscuss) {
      emitter.emit('RELOAD_RECORD_INFO_DISCUSS');
    }

    emitter.emit('RELOAD_RECORD_INFO_LOG');
    emitter.emit('RELOAD_RECORD_INFO_PRINT_LIST');
  };

  refreshAsyncLoadControl = () => {
    const { tempFormData } = this.state;
    tempFormData.forEach(c => {
      const refresh = this.refreshEvents[String(c.controlId)];
      if (typeof refresh === 'function') refresh({ noLoading: true });
    });
  };

  handleUnMask = () => {
    this.setState({ forceShowFullValue: true });
  };

  getRecordApi = () => {
    const { appId, viewId, worksheetId, recordId } = this.state;
    return new RecordApi({ appId, worksheetId, viewId, recordId });
  };

  // 提交草稿
  submitDraft = () => {
    const { worksheetInfo } = this.props;

    const doubleConfirm = recordDictionaryOrEmpty(safeParse(_.get(worksheetInfo, 'advancedSetting.doubleconfirm')));

    if (_.get(worksheetInfo, 'advancedSetting.enableconfirm') === '1') {
      Dialog.confirm({
        title: (
          <div className="breakAll">
            {typeof doubleConfirm['confirmMsg'] === 'string' ? doubleConfirm['confirmMsg'] : undefined}
          </div>
        ),
        description: typeof doubleConfirm['confirmContent'] === 'string' ? doubleConfirm['confirmContent'] : undefined,
        okText: (
          <div className="InlineBlock ellipsis" style={{ maxWidth: 100 }}>
            {typeof doubleConfirm['sureName'] === 'string' ? doubleConfirm['sureName'] : undefined}
          </div>
        ),
        cancelText: (
          <div className="InlineBlock ellipsis" style={{ maxWidth: 100 }}>
            {typeof doubleConfirm['cancelName'] === 'string' ? doubleConfirm['cancelName'] : undefined}
          </div>
        ),
        onOk: () => this.onSubmit({ draftType: 'submit' }),
      });

      return;
    }

    this.onSubmit({ draftType: 'submit' });
  };

  override render() {
    const {
      isOpenNewAddedRecord,
      renderHeader,
      renderAbnormal,
      controls = [],
      workflow,
      instanceId,
      workId,
      notDialog,
      from,
      appSectionId,
      currentSheetRows = [],
      hideRecordInfo = RecordInfo.defaultProps.hideRecordInfo,
      updateRows = RecordInfo.defaultProps.updateRows,
      isSubList,
      showPrevNext,
      handleAddSheetRow,
      loadRowsWhenChildTableStoreCreated,
      updateWorksheetControls = () => {},
      hideEditingBar,
      workflowStatus,
      hideFormHeader,
      isRelateRecord,
      didMountTimestamp,
      customBtnTriggerCb = () => {},
      worksheetInfo = {},
      printCharge,
      setModalRightComp = () => {},
    } = this.props;
    const {
      loading,
      sheetSwitchPermit,
      submitLoading,
      sideWidth,
      dragLeft,
      refreshBtnNeedLoading,
      abnormal,
      appId,
      viewId,
      worksheetId,
      recordId,
      currentIndex,
      recordinfo,
      tempFormData,
      showError,
      formFlag,
      iseditting,
      restoreVisible,
      sideVisible,
      hideRight,
      dragMaskVisible,
      allowExAccountDiscuss,
      exAccountDiscussEnum,
      approved,
      forceShowFullValue,
      widgetStyle,
      relateRecordData,
      payConfig,
      isSettingTempData,
      discussCount,
      formSectionWidth,
      formDidMountFlag,
      editLockedUser,
      isRecordLock,
    } = this.state;
    let { isCharge } = this.props;

    if (_.isUndefined(isCharge) && appId) {
      isCharge = window[`app_${appId}_is_charge`];
    }

    // 关联表格等入口 openRecordInfo 只传 viewId、不传 view 对象，props.view 为空会丢失分组等视图配置；
    // 回退到 getRowDetail 响应里的 view（后端按 viewId 返回，含 navGroup 等分组信息）。
    const view = _.isEmpty(this.props.view) ? recordinfo.view || {} : this.props.view;

    const isLock = checkRuleLocked(recordinfo.rules, recordinfo.formData, recordId);
    let width = Number(this.props.width);

    if (width > 1600) {
      width = 1600;
    }

    const isSmall = window.innerWidth < 360 + 40;
    const isWorkflow = from === RECORD_INFO_FROM.WORKFLOW;
    const titleControl = _.find(tempFormData, control => control.attribute === 1) || {};
    const showFullValue = _.isNull(forceShowFullValue)
      ? _.get(titleControl, 'advancedSetting.datamask') !== '1'
      : forceShowFullValue;
    const recordTitle =
      this.props.recordTitle ||
      getTitleTextFromControls(tempFormData, undefined, undefined, {
        noMask: showFullValue,
        appId,
      });

    const recordbase = {
      appId: recordinfo?.appId || appId,
      worksheetId,
      appSectionId,
      viewId,
      recordId,
      instanceId,
      workId,
      from,
      notDialog,
      isSubList,
      isCharge,
      isSmall,
      fromIsDraft: from === RECORD_INFO_FROM.DRAFT,
      fromIsWorkflow: from === RECORD_INFO_FROM.WORKFLOW,
      recordTitle,
      editLockedUser,
      allowEdit: this.getAllowEdit(recordinfo) && !editLockedUser,
      roleType: recordinfo.roleType,
      viewType: view.viewType,
    };
    const maskinfo = {
      forceShowFullValue: showFullValue,
      maskPermissions:
        (isCharge || _.get(titleControl, 'advancedSetting.isdecrypt') === '1') &&
        titleControl.value &&
        !showFullValue &&
        !window.shareState.shareId,
      handleUnMask: this.handleUnMask,
    };
    const useWaterMark = !this.hadWaterMark && recordinfo.projectId;
    let Con = useWaterMark ? WaterMark : React.Fragment;

    if (!this.hadWaterMark && loading) {
      return <span />;
    }

    const formWidth = width - (sideVisible ? sideWidth : 0) - formSectionWidth;
    const isDraft = from === RECORD_INFO_FROM.DRAFT && !isRelateRecord;
    const hideStep = sheetSwitchPermit?.find(o => o.type === permitList.approveDetailsSwitch)?.displayFlowChart === 1;
    const ignoreLock =
      from === RECORD_INFO_FROM.WORKFLOW ||
      from === RECORD_INFO_FROM.DRAFT ||
      location.href.indexOf('/public/workflow') > -1;
    return (
      <Con {...(useWaterMark ? { projectId: recordinfo.projectId } : {})}>
        <RecordInfoContext.Provider
          value={{
            api: this.getRecordApi,
            iseditting,
            enterEditingMode: () => {
              this.setState({
                iseditting: true,
              });
            },
            updateWorksheetControls: (newControls: FormControl[]) => {
              newControls.forEach((control: FormControl) => {
                try {
                  if (control.type === 34) {
                    const stored = this.recordform?.current?.dataFormat?.data.find(
                      item => item.controlId === control.controlId,
                    );
                    if (!stored?.advancedSetting || !control.advancedSetting)
                      throw new TypeError('Missing child table settings');
                    stored.advancedSetting.widths = control.advancedSetting.widths;
                  }
                } catch (err) {
                  console.error(err);
                }
              });
              updateWorksheetControls(newControls);
            },
            recordBaseInfo: recordbase,
          }}
        >
          {this.renderDialogs()}
          {(from !== RECORD_INFO_FROM.WORKFLOW || viewId) && !hideEditingBar && (
            <EditingBar
              didMountTimestamp={didMountTimestamp}
              okDisabled={!iseditting}
              loading={submitLoading}
              style={{ left: formSectionWidth, width: width - formSectionWidth - (sideVisible ? sideWidth : 0) }}
              visible={iseditting}
              defaultTop={-50}
              visibleTop={8}
              title={isDraft ? _l('正在修改草稿数据 ···') : _l('正在修改表单数据 ···')}
              saveShortCut
              updateText={_l('保存')}
              onOkMouseDown={() => {
                // hasFocusingRelateRecordTags 点击保存是不是有正在编辑的关联记录卡片字段
                this.hasFocusingRelateRecordTags = !!this.con?.querySelector(
                  '.cellRelateRecordTags.cellControlEdittingStatus',
                );
              }}
              onUpdate={() =>
                this.onSubmit(
                  isDraft ? { draftType: 'save', ignoreError: true, ignoreAlert: true, ignoreDialog: true } : undefined,
                )
              }
              onCancel={this.handleCancelChange}
            />
          )}
          {(from !== RECORD_INFO_FROM.WORKFLOW || viewId) && from !== RECORD_INFO_FROM.DRAFT && (
            <EditingBar
              loading={submitLoading}
              style={{ left: formSectionWidth, width: width - formSectionWidth - (sideVisible ? sideWidth : 0) }}
              visible={!!restoreVisible}
              defaultTop={-50}
              visibleTop={8}
              /* restoreVisible 身兼两职：没有草稿时是 false，有草稿时直接存的是那份草稿的
                 创建时间（Date 对象，见 handleFillValue 里 `restoreVisible: tempRecordCreateTime`）。
                 所以没草稿的时候这里是 new Date(false) === 纪元 0，标题会算成
                 「已恢复到上次中断内容（1970年1月1日 08:00）」。
                 EditingBar 是【常驻渲染】的（靠 defaultTop:-50 停在视口外），
                 标题即使不显示也照样算，DOM 里就一直躺着这句 1970 —— 现在用户看不见，
                 但只要这条 bar 的显示方式改一次（或者读屏、自动化测试扫文本）就会露出来。
                 这里只在拿到真正的时间时才带时间。 */
              title={
                restoreVisible
                  ? _l(
                      '已恢复到上次中断内容（%0）',
                      window.createTimeSpan(
                        restoreVisible instanceof Date ? restoreVisible : new Date(Number(restoreVisible)),
                      ),
                    )
                  : _l('已恢复到上次中断内容')
              }
              onUpdate={() => {
                if (!this.recordEditLock || this.recordEditLock?.checkAndLock()) {
                  this.setState({ restoreVisible: false, iseditting: true });
                }
              }}
              onCancel={() => {
                removeTempRecordValueFromLocal('recordInfo', viewId + '-' + this.state.recordId);
                this.setState({
                  restoreVisible: false,
                  tempFormData: recordinfo.formData || [],
                  formFlag: Math.random().toString(32),
                });
              }}
            />
          )}
          <div
            className={cx('recordInfoCon flexColumn', { abnormal, isWorkflow: from === RECORD_INFO_FROM.WORKFLOW })}
            data-record-id={recordId}
            data-view-id={viewId}
            ref={con => {
              this.con = con;
            }}
            // onClick={e => e.stopPropagation()}
          >
            {!(abnormal && !isWorkflow) &&
              !(
                (_.get(window, 'shareState.isPublicView') || _.get(window, 'shareState.isPublicPage')) &&
                _.get(view, 'viewType') === 6 &&
                String(_.get(view, 'childType')) === '1'
              ) && (
                <Header
                  isCharge={isCharge}
                  printCharge={printCharge}
                  recordTitle={recordTitle}
                  worksheetInfo={worksheetInfo}
                  from={from}
                  isRecordLock={isRecordLock}
                  sideBarBtnVisible={recordinfo.resultCode === 1}
                  isOpenNewAddedRecord={isOpenNewAddedRecord}
                  allowExAccountDiscuss={allowExAccountDiscuss}
                  exAccountDiscussEnum={exAccountDiscussEnum}
                  payConfig={payConfig}
                  approved={approved}
                  loading={loading}
                  view={view}
                  viewId={viewId}
                  isDraft={isDraft || this.props.isDraft || get(this.context, 'config.isDraft')}
                  renderHeader={
                    isDraft
                      ? () => (
                          <div className="flex flexRow w100 alignItemsCenter">
                            <div className="flex Font17 bold pLeft15">{_l('编辑草稿')}</div>
                            {!((from !== RECORD_INFO_FROM.WORKFLOW || viewId) && !hideEditingBar && iseditting) && (
                              <Button className="mRight12" onClick={this.submitDraft}>
                                {_.get(worksheetInfo, 'advancedSetting.sub') || _l('提交')}
                              </Button>
                            )}
                          </div>
                        )
                      : renderHeader
                  }
                  isSmall={isSmall}
                  sideVisible={sideVisible}
                  sheetSwitchPermit={sheetSwitchPermit}
                  recordbase={recordbase}
                  recordinfo={recordinfo}
                  iseditting={iseditting}
                  showPrevNext={showPrevNext}
                  switchRecord={this.switchRecord}
                  currentSheetRows={currentSheetRows}
                  currentIndex={currentIndex}
                  addRefreshEvents={(key: string, fn: RecordRefreshCallback) => {
                    this.refreshEvents[key] = fn;
                  }}
                  onRefresh={this.handleRefresh}
                  onSubmit={this.onSubmit}
                  refreshRotating={refreshBtnNeedLoading}
                  hideRecordInfo={hideRecordInfo}
                  reloadRecord={() => this.handleRefresh({ doNotResetPageIndex: true, reloadDiscuss: false })}
                  onSideIconClick={() => {
                    safeLocalStorageSetItem(
                      from !== RECORD_INFO_FROM.WORKFLOW ? 'recordInfoSideVisible' : 'recordInfoOfWorkflowSideVisible',
                      sideVisible ? '' : 'true',
                    );
                    this.setState({ sideVisible: !sideVisible, hideRight: sideVisible });
                  }}
                  onCancel={this.handleCancel}
                  onUpdate={(rawChangedValue: unknown, rawRecord: unknown) => {
                    const changedValue = recordDictionary(rawChangedValue);
                    const record = recordRow(rawRecord);
                    updateRows([recordId], _.omit(record, ['allowedit', 'allowdelete']), changedValue);
                    let newValue = { ...changedValue };

                    if (_.filter(recordinfo.formData, c => c.type === 34 && changedValue[String(c.controlId)]).length) {
                      newValue = _.omit(record, ['allowedit', 'allowdelete']);
                    }

                    const newFormData = (recordinfo.formData || []).map((c: FormControl) =>
                      _.assign({}, c, {
                        value: !_.isUndefined(newValue[String(c.controlId)]) ? newValue[String(c.controlId)] : c.value,
                      }),
                    );
                    Object.keys(changedValue).forEach(key => {
                      if (_.isFunction(this.refreshEvents[key])) {
                        this.refreshEvents[key]();
                      }
                    });
                    this.setState({
                      formFlag: Math.random().toString(),
                      tempFormData: newFormData,
                      recordinfo: { ...recordinfo, formData: newFormData },
                    });
                  }}
                  onDelete={this.handleDelete}
                  handleAddSheetRow={(row: RecordInfoRow, afterRowId: string | undefined) => {
                    this.loadRecord({ recordId: row.rowid });
                    this.getPayConfig(row.rowid);
                    this.setState({
                      recordId: row.rowid,
                      currentIndex: currentIndex + 1,
                    });
                    if (_.isFunction(handleAddSheetRow)) {
                      handleAddSheetRow(row, afterRowId);
                    }
                  }}
                  customBtnTriggerCb={customBtnTriggerCb}
                  updateDiscussCount={(count: number) => {
                    this.setState({
                      discussCount: count,
                    });
                  }}
                  updateRecordLock={this.updateRecordLock}
                  setModalRightComp={setModalRightComp}
                />
              )}
            <div className="recordBody flex flexRow">
              {submitLoading && <LoadMask />}
              {dragMaskVisible && (
                <DragMask
                  style={
                    formSectionWidth
                      ? {
                          left: formSectionWidth,
                          right: 0,
                          width: 'auto',
                        }
                      : {}
                  }
                  value={dragLeft ? dragLeft - formSectionWidth : 0}
                  min={450}
                  max={width - formSectionWidth - SIDE_MIN_WIDTH}
                  onChange={(value: number) => {
                    safeLocalStorageSetItem('RECORD_INFO_SIDE_WIDTH', String(width - value - formSectionWidth));
                    this.setState({ dragMaskVisible: false, sideWidth: width - value - formSectionWidth });
                  }}
                />
              )}
              <RecordForm
                formDidMountFlag={formDidMountFlag}
                iseditting={iseditting}
                isRecordLock={isRecordLock}
                payConfig={payConfig}
                updatePayConfig={this.getPayConfig}
                ignoreHeader={from === RECORD_INFO_FROM.WORKFLOW && renderHeader && viewId}
                hideFormHeader={hideFormHeader}
                ignoreLock={ignoreLock}
                from={from}
                isDraft={from === RECORD_INFO_FROM.DRAFT || this.props.isDraft || get(this.context, 'config.isDraft')}
                isLock={isLock}
                formWidth={formWidth}
                loading={loading || isSettingTempData}
                recordbase={{ ...recordbase }}
                maskinfo={maskinfo}
                widgetStyle={widgetStyle}
                mountRef={(recordform: RecordFormRef) => (this.recordform = recordform)}
                registerCell={({ item, cell }: RecordCellRegistration) =>
                  (this.cellObjs[String(item.controlId)] = { item, cell })
                }
                formFlag={formFlag}
                abnormal={abnormal}
                recordinfo={recordinfo}
                formdata={tempFormData}
                controlProps={{
                  recordInfoFrom: from,
                  discussId: this.discussId,
                  isCharge,
                  refreshRecord: () => this.handleRefresh({ reloadDiscuss: false }),
                  addRefreshEvents: (id: string, fn: RecordRefreshCallback) => {
                    this.refreshEvents[id] = fn;
                  },
                  updateRelationControls: (controlId: string, newControls: FormControl[]) => {
                    if (!this.recordform?.current?.dataFormat) return;
                    this.recordform.current.dataFormat.data = this.recordform?.current.dataFormat.data.map(item => {
                      if (item.type === 34 && item.controlId === controlId) {
                        return { ...item, relationControls: newControls };
                      } else {
                        return item;
                      }
                    });
                    this.recordform?.current.updateRenderData();
                  },
                  sideVisible,
                  formWidth,
                }}
                worksheetId={worksheetId}
                view={view}
                showError={showError}
                sheetSwitchPermit={sheetSwitchPermit}
                loadRowsWhenChildTableStoreCreated={loadRowsWhenChildTableStoreCreated}
                addRefreshEvents={(key: string, fn: RecordRefreshCallback) => {
                  this.refreshEvents[key] = fn;
                }}
                updateRecordDialogOwner={this.updateRecordOwner}
                updateRecordLock={this.updateRecordLock}
                updateRows={updateRows}
                onChange={this.handleFormChange}
                updateRelateRecordTableCount={(
                  controlId: string,
                  num: number | undefined,
                  { changed }: { changed?: boolean | undefined } = {},
                ) => {
                  if (!get(this, 'recordform.current')) {
                    return;
                  }

                  updateRows([recordId], { [controlId]: String(num) }, { [controlId]: String(num) });
                  const tempFormData = this.state.tempFormData;

                  if (typeof num === 'number' && num >= 0 && this.recordform?.current?.dataFormat) {
                    this.recordform.current.dataFormat.setControlItemValue(controlId, String(num));
                    this.recordform?.current.updateRenderData({ noRule: true });
                    this.setState({
                      tempFormData: tempFormData.map(item =>
                        item.controlId === controlId ? { ...item, value: String(num) } : item,
                      ),
                    });
                    if (changed && _.isFunction(this.refreshEvents['loadcustombtns'])) {
                      this.refreshEvents['loadcustombtns']();
                    }
                  }

                  if (!changed) {
                    return;
                  }

                  tempFormData
                    .filter(c => c.type === 37 && _.includes(c.dataSource, controlId))
                    .forEach(c => {
                      worksheetAjax
                        .getRowDetail({ worksheetId, rowId: recordId, getType: isDraft ? 21 : 1 })
                        .then(data => {
                          const controlValue = recordDictionary(safeParse(data.rowData))[String(c.controlId)];
                          const newFormData = tempFormData.map(cc =>
                            cc.controlId === c.controlId ? { ...cc, value: controlValue } : cc,
                          );

                          if (!_.isUndefined(controlValue)) {
                            this.setState({
                              recordinfo: {
                                ...recordinfo,
                                formData: newFormData,
                              },
                              tempFormData: newFormData,
                            });
                            if (this.recordform?.current?.dataFormat) {
                              this.recordform.current.dataFormat.updateDataSource({
                                controlId: c.controlId,
                                value: controlValue,
                              });
                              this.recordform?.current.updateRenderData();
                            }
                          }
                        });
                    });
                  if (_.isFunction(this.refreshEvents['loadcustombtns'])) {
                    this.refreshEvents['loadcustombtns']();
                  }
                }}
                onSave={this.onSave}
                onCancel={this.handleCancelChange}
                onError={() => {
                  this.setState({ submitLoading: false });
                }}
                currentIndex={currentIndex}
                onRelateRecordsChange={(control: FormControl, records: unknown) => {
                  if (!this.recordform || !this.recordform?.current || from !== RECORD_INFO_FROM.DRAFT) {
                    return;
                  }

                  const newRelateRecordData = {
                    ...relateRecordData,
                    [String(control.controlId)]: { ...control, value: records },
                  };
                  this.setState({ relateRecordData: newRelateRecordData });
                }}
                updateWorksheetControls={(needUpdateControls: FormControl[] = []) => {
                  updateWorksheetControls(
                    controls.map((c: FormControl) => _.find(needUpdateControls, { controlId: c.controlId }) || c),
                  );
                }}
                renderAbnormal={renderAbnormal && (() => renderAbnormal(this.state.failure ?? recordinfo))}
                onRefresh={this.handleRefresh}
                onUpdateFormSectionWidth={(sectionWidth: number) => {
                  this.setState({ formSectionWidth: sectionWidth });
                }}
              />
              {sideVisible && (
                <Drag
                  setRef={(drag: HTMLDivElement | null) => {
                    this.drag = drag;
                  }}
                  onDrag={() => {
                    let newDragLeft = formWidth;

                    try {
                      newDragLeft = (() => {
                        if (!this.drag?.parentElement) throw new TypeError('Missing record resize element');
                        return (
                          this.drag.getBoundingClientRect().left -
                          this.drag.parentElement.getBoundingClientRect().left -
                          1
                        );
                      })();
                    } catch (e) {
                      console.log(e);
                    }

                    this.setState({
                      dragMaskVisible: true,
                      dragLeft: newDragLeft,
                    });
                  }}
                  onDBClick={() => {
                    // set min width and save to local storage
                    safeLocalStorageSetItem('RECORD_INFO_SIDE_WIDTH', String(SIDE_MIN_WIDTH));
                    this.setState({ sideWidth: SIDE_MIN_WIDTH, dragMaskVisible: false });
                  }}
                />
              )}
              {!abnormal && (sideVisible || typeof hideRight !== 'undefined') && (
                <RecordInfoRight
                  workflowStatus={
                    workflowStatus ||
                    _.get(
                      _.find(tempFormData, c => c.controlId === 'wfstatus'),
                      'value',
                    )
                  }
                  discussCount={discussCount}
                  isCharge={isCharge}
                  loading={loading}
                  isOpenNewAddedRecord={isOpenNewAddedRecord}
                  allowExAccountDiscuss={allowExAccountDiscuss}
                  exAccountDiscussEnum={exAccountDiscussEnum}
                  payConfig={payConfig}
                  approved={approved}
                  isHide={hideRight}
                  className={cx({ hide: hideRight })}
                  style={{ width: sideWidth }}
                  recordbase={recordbase}
                  workflow={
                    workflow
                      ? React.cloneElement(workflow, {
                          controls: recordinfo.formData,
                          hideStep: hideStep,
                        })
                      : null
                  }
                  approval={
                    <SheetWorkflow
                      projectId={this.props.projectId || recordinfo.projectId}
                      worksheetId={worksheetId}
                      recordId={recordId}
                      isCharge={recordinfo.roleType === 2}
                      isRecordLock={isRecordLock}
                      refreshBtnNeedLoading={refreshBtnNeedLoading}
                      formWidth={formWidth}
                      appId={appId}
                      controls={recordinfo.formData}
                      reloadRecord={() => this.handleRefresh({ doNotResetPageIndex: true, reloadDiscuss: false })}
                      hideStep={hideStep}
                    />
                  }
                  sheetSwitchPermit={sheetSwitchPermit}
                  projectId={this.props.projectId || recordinfo.projectId}
                  controls={controls}
                  worksheetOperationLogPermission={worksheetInfo?.worksheetOperationLogPermission}
                  formFlag={formFlag}
                  instanceId={instanceId}
                  workId={workId}
                  formdata={tempFormData.map(o => {
                    if (o.controlId === 'ownerid') {
                      //更新拥有者数据
                      return { ...o, value: recordinfo.ownerAccount && JSON.stringify([recordinfo.ownerAccount]) };
                    } else {
                      return o;
                    }
                  })}
                  updatePayConfig={() => this.getPayConfig(recordId, true)}
                />
              )}
            </div>
          </div>
        </RecordInfoContext.Provider>
      </Con>
    );
  }
}
