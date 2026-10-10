import React, { Component, Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JsonView from '@mingdaocom/json-view';
import cx from 'classnames';
import _ from 'lodash';
import { Avatar, Dialog, Icon, LoadDiv, ScrollView, Textarea } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import type { ScrollViewHandle } from 'ming-ui/components/ScrollView';
import appManagementAjax from 'src/api/appManagement';
import homeApp from 'src/api/homeApp';
import ajaxRequest from 'src/api/worksheet';
import integrationAjax from 'src/pages/integration/api/syncTask';
import processAjax from 'src/pages/workflow/api/process';
import { SHARE_STATE, ShareState, VerificationPass } from 'worksheet/components/ShareState';
import preall from 'src/common/preall';
import RestrictAccessStatus from 'src/components/restrictAccessStatus';
import AliasDialog from 'src/pages/FormSet/components/AliasDialog';
import { FIELD_TYPE_LIST } from 'src/pages/workflow/WorkflowSettings/enum';
import { VIEW_DISPLAY_TYPE, VIEW_TYPE_ICON } from 'src/pages/worksheet/constants/enum';
import { getTranslateInfo, setFavicon, shareGetAppLangDetail } from 'src/utils/app';
import { browserIsMobile } from 'src/utils/common';
import copy from 'src/utils/copyToClipboard';
import {
  apiAppInfo,
  apiAuthorizes,
  apiDocuments,
  apiFields,
  apiMenuItems,
  apiOptions,
  apiShare,
  apiSidebarItems,
  apiSideItems,
  apiWorkflow,
  apiWorksheetMetadata,
  cachedPosition,
  displayDescription,
  errorInfo,
  isRecord,
  optionParameters,
  parseExample,
  relationExample,
  textField,
  viewDescriptions,
} from './boundary';
import FiltersGenerate from './components/FiltersGenerate';
import Header from './components/Header';
import Mcp from './components/Mcp';
import MoreOption from './components/MoreOption';
import RequestFormat from './components/RequestFormat';
import SecretKey from './components/SecretKey';
import Summary from './components/Summary';
import WorkAliasDialog from './components/WorkAliasDialog';
import {
  appInfoParameters,
  appRoleErrorData,
  appSuccessData,
  ERROR_CODE,
  MENU_LIST_APPENDIX,
  MENU_LIST_APPROLE,
  OPTIONS_FUNCTION_LIST,
  sameParameters,
} from './core/apiV2Config';
import {
  ADD_API_CONTROLS,
  ADD_WORKSHEET_SUCCESS,
  DATA_PIPELINE_FILTERS,
  DATA_PIPELINE_MENUS,
  MENU_LIST_APPENDIX_HEADER,
  WORKSHEETINFO_SUCCESS_DATA,
} from './core/applicationConfig';
import { MENU_LIST_MAP, SIDEBAR_LIST_MAP, TAB_TYPE } from './core/enum';
import { convertControl } from './core/utils';
import type {
  ApiAuthorize,
  ApiDocNode,
  ApiField,
  ApiHeader,
  ApiMenuItem,
  ApiRecord,
  ApiSection,
  ApiShareData,
  ApiShareResponse,
  ApiSideItem,
  ApiWorksheetState,
  WorksheetApiProps,
} from './types';
import './index.less';

const FIELD_TYPE = FIELD_TYPE_LIST.concat([
  { text: _l('对象'), value: 10000006, en: 'object' },
  { text: _l('文本'), value: 1, en: 'string' },
]);
const isMobile = browserIsMobile();

export class WorksheetApi extends Component<WorksheetApiProps, ApiWorksheetState> {
  declare canScroll: boolean;
  private disposed = false;
  private appVersion = 0;
  private selectionVersion = 0;
  private authorizeVersion = 0;
  private pipelineVersion = 0;
  private requests = new Set<ApiResultOf<unknown>>();
  private stateCompletions = new Set<() => void>();
  private retryRequest: (() => Promise<void>) | undefined;
  private scrollTimer: ReturnType<typeof setTimeout> | undefined;

  /** IP 白名单输入框（Textarea），由 manualRef 回填 */
  whiteList?: HTMLTextAreaElement | null;
  contentScrollRef: React.RefObject<ScrollViewHandle | null>;
  handleGetId: () => string | undefined;

  constructor(props: WorksheetApiProps) {
    super(props);
    this.state = {
      data: [],
      selectId: props.isSharePage ? 'summary' : 'authorizationInstr',
      dataApp: {},
      loading: true,
      showMoreOption: false,
      appKey: '',
      authorizes: [],
      addSecretKey: false,
      errorCode: 0, // 1：工作表不存在 2：应用过期
      aliasDialog: { visible: false, type: 'control' },
      templateControls: [],
      sheetSwitchPermit: [],
      appInfo: {},
      whiteListDialog: false,

      showWorksheetAliasDialog: false,
      // 新增 / 编辑选项集参数列表
      addOptionsParams: [],

      // 获取选项集参数列表
      getOptionsParams: [],

      // 封装业务流程
      selectWorkflowId: '',
      pbcList: [],
      workflowInfo: {},
      shareVisible: false,
      dataPipelineList: undefined,
      expandIds: [],
      webhookList: [],
      visibleAppKeys: [],
      visibleSigns: [],
      tabIndex: TAB_TYPE[props.isSharePage ? 'API_V2' : 'APPLICATION'],
      // 工作流别名相关
      workflowAliasDialog: false,
      workflowAlias: '',
    };
    this.canScroll = true;
    this.contentScrollRef = React.createRef<ScrollViewHandle>();
    this.handleGetId = this.getId.bind(this);
  }

  override componentDidMount() {
    this.disposed = false;
    void this.getAppInfo();
  }
  override componentWillUnmount() {
    this.disposed = true;
    this.appVersion++;
    this.selectionVersion++;
    this.authorizeVersion++;
    this.pipelineVersion++;
    this.requests.forEach(request => request.abort());
    this.requests.clear();
    this.stateCompletions.forEach(finish => finish());
    this.stateCompletions.clear();
    this.scroll.cancel();
    clearTimeout(this.scrollTimer);
  }
  private track<T>(request: ApiResultOf<T>): ApiResultOf<T> {
    this.requests.add(request);
    return request;
  }
  private failure(error: unknown, retry: () => Promise<void>): void {
    if (this.disposed) return;
    const info = errorInfo(error);
    this.retryRequest = retry;
    this.setState({ loading: false, dataPipelineLoading: false, errorCode: info.errorCode, loadError: info.message });
  }

  /** Checked actual menu fields; metadata and shared menu/array identities are retained. */
  get MENU_LIST(): ApiMenuItem[] {
    const { tabIndex } = this.state;

    return apiMenuItems(MENU_LIST_MAP[tabIndex] || []);
  }

  get hideMcp() {
    return _.includes(_.get(md, 'global.Config.DisableModules') || [], 'mcp');
  }

  get hideDataPipeline() {
    return (
      _.get(md, 'global.SysSettings.hideDataPipeline') ||
      ((window.platformENV.isOverseas || window.platformENV.isLocal) && !_.get(md, 'global.Config.EnableDataPipeline'))
    );
  }

  getAppInfo(): Promise<void> {
    const { isSharePage, shareData = {} } = this.props;
    const version = ++this.appVersion;

    this.setState({
      loading: true,
      loadError: undefined,
    });

    const promiseList = isSharePage
      ? [
          // 获取应用下所有工作表信息
          homeApp.getWorksheetsByAppId({
            appId: this.getId(),
            type: 0,
          }),
          homeApp.getApiInfo({ appId: this.getId() }),

          // 获取选项集参数接口
          ajaxRequest.addOrUpdateOptionSetApiInfo(),
          ajaxRequest.optionSetListApiInfo(),
          processAjax.getProcessListApi({ relationId: this.getId() }),
        ]
      : [
          // 获取应用下所有工作表信息
          homeApp.getWorksheetsByAppId({
            appId: this.getId(),
            type: 0,
          }),
          homeApp.getApiInfo({ appId: this.getId() }),
          // 获取选项集参数接口
          ajaxRequest.addOrUpdateOptionSetApiInfo(),
          ajaxRequest.optionSetListApiInfo(),
          processAjax.getProcessListApi({ relationId: this.getId() }),
          // 获取应用详细信息
          homeApp.getApp(
            {
              appId: this.getId(),
              getLang: true,
            },
            {
              silent: true,
            },
          ),
          appManagementAjax.getAuthorizes({ appId: this.getId() }),
        ];

    promiseList.forEach(request => this.track(request));
    return Promise.all(promiseList)
      .then(async (res: unknown[]) => {
        if (this.disposed || version !== this.appVersion) return;
        const worksheetList = apiSideItems(res[0] === undefined ? [] : res[0]);
        const appInfo = apiAppInfo(res[1] === undefined ? {} : res[1]);
        const addOptionsParams = apiOptions(res[2] === undefined ? [] : res[2]);
        const getOptionsParams = apiOptions(res[3] === undefined ? [] : res[3]);
        const processList = apiSideItems(res[4] === undefined ? [] : res[4]);
        const dataApp = apiAppInfo(isSharePage || res[5] === undefined ? {} : res[5]);
        const authorizes = apiAuthorizes(isSharePage || res[6] === undefined ? [] : res[6]);

        if (isSharePage) {
          dataApp.iconUrl = shareData.appIcon;
          dataApp.id = shareData.appId;
          dataApp.iconColor = shareData.appIconColor;
          dataApp.name = shareData.appName;
          dataApp.projectId = shareData.projectId;
          dataApp.navColor = shareData.appNavColor;
        }

        const { langInfo, id: appId, projectId } = dataApp;

        if (isSharePage && appId && projectId) {
          await shareGetAppLangDetail({ appId, projectId });
        } else if (langInfo && langInfo.appLangId && langInfo.version !== window[`langVersion-${appId}`]) {
          const langRequest = this.track(
            appManagementAjax.getAppLangDetail({ projectId, appId, appLangId: langInfo.appLangId }),
          );
          let lang: unknown;
          try {
            lang = await langRequest;
          } finally {
            this.requests.delete(langRequest);
          }
          if (this.disposed || version !== this.appVersion) return;
          if (!isRecord(lang)) throw new TypeError('Invalid application language response');
          window[`langData-${appId}`] = lang['items'];
          window[`langVersion-${appId}`] = langInfo.version;
        }

        if (this.disposed || version !== this.appVersion) return;
        const appName = appId === undefined ? undefined : getTranslateInfo(appId, null, appId).name;
        dataApp.name = appName || dataApp.name;

        worksheetList.forEach((item: ApiSideItem) => {
          const sheetName = appId === undefined ? undefined : getTranslateInfo(appId, null, item.workSheetId).name;
          item.workSheetName = sheetName || item.workSheetName;
        });

        setFavicon(dataApp.iconUrl, dataApp.iconColor);

        for (const item of optionParameters(addOptionsParams) || []) {
          item.required = item.isRequired ? _l('是') : _l('否');
          item.type = item.dataType;
          item.desc = item.description;
        }

        for (const item of optionParameters(getOptionsParams) || []) {
          item.required = item.isRequired ? _l('是') : _l('否');
          item.type = item.dataType;
          item.desc = item.description;
        }

        if (dataApp.appStatus === 20) {
          this.setState({ errorCode: 2, loading: false });
        }
        // else if (worksheetList.length <= 0) {
        //   this.setState({ errorCode: 1 });
        // }
        else {
          await new Promise<void>(resolve => {
            let complete = false;
            const finish = () => {
              if (complete) return;
              complete = true;
              this.stateCompletions.delete(finish);
              resolve();
            };
            this.stateCompletions.add(finish);
            this.setState(
              {
                dataApp,
                worksheetList,
                authorizes,
                appInfo,
                addOptionsParams,
                getOptionsParams,
                pbcList: processList.filter((l: ApiSideItem) => l.startAppType !== 7),
                webhookList: processList.filter((l: ApiSideItem) => l.startAppType === 7),
              },
              () => {
                if (this.disposed || version !== this.appVersion) {
                  finish();
                  return;
                }
                document.title = dataApp.name + ' - ' + _l('API说明');
                const first = worksheetList[0];
                if (first) {
                  void this.getWorksheetApiInfo(first.workSheetId).then(finish);
                } else {
                  this.setState({ loading: false });
                  finish();
                }
              },
            );
          });
        }
      })
      .catch((error: unknown) => {
        if (version === this.appVersion) this.failure(error, () => this.getAppInfo());
      })
      .finally(() => promiseList.forEach(request => this.requests.delete(request)));
  }

  getAuthorizes = (): Promise<void> => {
    const version = ++this.authorizeVersion;
    const request = this.track(appManagementAjax.getAuthorizes({ appId: this.getId() }));
    return request
      .then((raw: unknown) => {
        if (this.disposed || version !== this.authorizeVersion) return;
        const authorizes = apiAuthorizes(raw);
        this.setState({ authorizes, loadError: undefined });
      })
      .catch((error: unknown) => {
        if (version === this.authorizeVersion) this.failure(error, this.getAuthorizes);
      })
      .finally(() => this.requests.delete(request));
  };

  getWorksheetApiInfo = (worksheetId: string | undefined): Promise<void> => {
    const selectId = this.state.selectId;
    const version = ++this.selectionVersion;
    if (!worksheetId) {
      this.failure(new TypeError('Missing worksheet ID'), () => this.getAppInfo());
      return Promise.resolve();
    }
    const documentRequest = this.track(ajaxRequest.getWorksheetApiInfo({ worksheetId, appId: this.getId() }));
    const worksheetRequest = this.track(ajaxRequest.getWorksheetInfo({ worksheetId, getTemplate: true }));
    return Promise.all([documentRequest, worksheetRequest])
      .then(([raw, rawList]: [unknown, unknown]) => {
        if (this.disposed || version !== this.selectionVersion) return;
        let data = apiDocuments(raw === undefined ? [] : raw);
        const list = apiWorksheetMetadata(rawList);
        if (!data[0]?.worksheetId) throw new TypeError('Missing worksheet API documentation ID');
        const isDataPipeline = (selectId || '').includes('dataPipeline');
        if (list?.alias) data = data.map(row => ({ ...row, alias: list.alias }));
        if (!isDataPipeline) {
          this.MENU_LIST.forEach(menu => {
            if (menu.id === 'List')
              (menu.data || []).forEach(field => {
                if (field.name === 'viewId') field.desc = viewDescriptions(data[0]?.views || []);
              });
          });
        }
        this.setState(
          state => ({
            ...state,
            ...(isDataPipeline ? { dataPipelineData: data } : { data }),
            templateControls: list?.template?.controls || [],
            sheetSwitchPermit: list?.switches,
            loading: false,
            loadError: undefined,
            alias: list?.alias,
          }),
          () => this.scrollToFixedPosition(),
        );
      })
      .catch((error: unknown) => {
        if (version === this.selectionVersion) this.failure(error, () => this.getWorksheetApiInfo(worksheetId));
      })
      .finally(() => {
        this.requests.delete(documentRequest);
        this.requests.delete(worksheetRequest);
      });
  };

  getWorkflowApiInfo = (processId: string): Promise<void> => {
    const version = ++this.selectionVersion;
    const request = this.track(processAjax.getProcessApiInfo({ processId, relationId: this.getId() }));
    return request
      .then((raw: unknown) => {
        const result = apiWorkflow(raw);
        if (this.disposed || version !== this.selectionVersion) return;
        this.setState({ workflowInfo: { ...result, processId }, loadError: undefined }, () =>
          this.scrollToFixedPosition(),
        );
      })
      .catch((error: unknown) => {
        if (version === this.selectionVersion) this.failure(error, () => this.getWorkflowApiInfo(processId));
      })
      .finally(() => this.requests.delete(request));
  };

  getDataPipelineWorksheet = (): Promise<void> => {
    const version = ++this.pipelineVersion;
    const { appInfo } = this.state;
    if (this.hideDataPipeline) return Promise.resolve();
    this.setState({ dataPipelineLoading: true, loadError: undefined });
    const request = this.track(
      integrationAjax.list(
        {
          projectId: appInfo.apiResponse?.projectId,
          appId: appInfo.apiResponse?.appId,
          status: 'RUNNING',
          pageSize: 1000,
          pageNo: 0,
          taskType: 1,
        },
        { isAggTable: true },
      ),
    );
    return request
      .then((raw: unknown) => {
        if (this.disposed || version !== this.pipelineVersion) return;
        if (!isRecord(raw)) throw new TypeError('Invalid data pipeline response');
        const dataPipelineList = apiSideItems(raw['content']);
        if (!this.disposed) this.setState({ dataPipelineList, dataPipelineLoading: false });
      })
      .catch((error: unknown) => {
        if (version === this.pipelineVersion) this.failure(error, this.getDataPipelineWorksheet);
      })
      .finally(() => this.requests.delete(request));
  };

  getId(): string | undefined {
    const { isSharePage } = this.props;

    if (isSharePage) {
      return this.props.appId;
    }

    const ids = window.location.pathname.replace(/.*\/worksheetapi\//g, '').split('/');
    return ids[0];
  }

  /**
   * 滚动到固定位置
   */
  scrollToFixedPosition(id?: string) {
    const selectId = (id || this.state.selectId || '').replace('dataPipeline', '');

    if (!$(`#${selectId}-content`)[0]) return;

    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      if (this.disposed) return;
      this.canScroll = true;
      if (this.contentScrollRef.current) {
        this.contentScrollRef.current.scrollToElement($(`#${selectId}-content`)[0]);
      }
    }, 0);
  }

  /**
   * 设置selectId并滚动(三级工作表需获取数据)
   */
  setSelectId({
    selectId,
    worksheetId,
    workflowId,
    expandIds,
  }: {
    selectId?: string | undefined;
    worksheetId?: string | undefined;
    workflowId?: string | undefined;
    expandIds?: Array<string | null | undefined> | undefined;
  }) {
    this.canScroll = false;
    this.setState(
      {
        selectId,
        selectWorkflowId: workflowId,
        workflowInfo: {},
        expandIds: expandIds || this.state.expandIds,
      },
      () => {
        if (worksheetId) {
          this.getWorksheetApiInfo(worksheetId);
          return;
        }

        if (workflowId) {
          this.getWorkflowApiInfo(workflowId);
          return;
        }

        if (selectId === 'dataPipeline' && !this.state.dataPipelineList) {
          this.getDataPipelineWorksheet();
          return;
        }

        this.scrollToFixedPosition();
      },
    );
  }

  /**
   * 渲染二三级工作表
   */
  renderSideItem(props?: { type?: string }) {
    const { worksheetList = [], selectId, dataPipelineList = [], expandIds = [] } = this.state;
    const type = _.get(props, 'type') || 'worksheetCreateForm';
    const list =
      type === 'dataPipeline' ? this.MENU_LIST.filter(l => DATA_PIPELINE_MENUS.includes(l.id)) : this.MENU_LIST;

    return (type === 'dataPipeline' ? dataPipelineList : worksheetList).map((item: ApiSideItem) => {
      const worksheetId = item.workSheetId || item.worksheetId;
      const isSelect = (expandIds[1] || '').includes(String(worksheetId));
      const prefix = type === 'dataPipeline' ? type : '';

      return (
        <div key={worksheetId} className="worksheetApiMenu">
          <div
            className="worksheetApiMenuItem overflow_ellipsis"
            onClick={() => {
              let id = prefix + worksheetId + (this.MENU_LIST[0]?.id || '');
              isSelect
                ? this.setState({ expandIds: [expandIds[0]] })
                : this.setSelectId({
                    selectId: id,
                    worksheetId: worksheetId,
                    expandIds: [expandIds[0], id],
                  });
            }}
          >
            <i className={cx('mRight5 textTertiary', isSelect ? 'icon-arrow-down' : 'icon-arrow-right-tip')} />
            {item.workSheetName || item.name}
          </div>
          {isSelect
            ? list.map(o => {
                const id = `${prefix}${worksheetId}${o.id}`;
                return (
                  <div
                    key={worksheetId + o.id}
                    className={cx('worksheetApiMenuItem pLeft58 overflow_ellipsis', {
                      active: selectId === id,
                    })}
                    onClick={() => this.setSelectId({ selectId: id })}
                  >
                    {o.title}
                  </div>
                );
              })
            : null}
        </div>
      );
    });
  }

  /**
   * 渲染工作表侧栏
   */
  renderWorksheetSide() {
    const { selectId, expandIds = [], tabIndex } = this.state;
    const isOpen = expandIds[0] === 'worksheetCreateForm';

    return (
      <div className="worksheetApiMenu">
        <div
          className="worksheetApiMenuTitle"
          onClick={() => {
            isOpen
              ? this.setState({ expandIds: [] })
              : this.setSelectId({
                  selectId: 'worksheetCreateForm',
                  expandIds: ['worksheetCreateForm'],
                });
          }}
        >
          <i className={cx('mRight5 textTertiary', isOpen ? 'icon-arrow-down' : 'icon-arrow-right-tip')} />
          {_l('工作表')}
        </div>
        {isOpen && (
          <Fragment>
            {tabIndex === TAB_TYPE.API_V2 && (
              <Fragment>
                {[
                  { id: 'worksheetCreateForm', label: _l('新建工作表') },
                  { id: 'worksheetFormInfo', label: _l('获取工作表结构信息') },
                ].map(({ id, label }) => (
                  <div
                    key={id}
                    className={cx('worksheetApiMenuItem overflow_ellipsis', {
                      active: selectId === id,
                    })}
                    onClick={() => this.setSelectId({ selectId: id })}
                  >
                    {label}
                  </div>
                ))}
              </Fragment>
            )}

            {this.renderSideItem()}
          </Fragment>
        )}
      </div>
    );
  }

  // 渲染聚合表侧栏
  renderDataPipelineSide() {
    const { expandIds = [], dataPipelineLoading } = this.state;
    const isOpen = expandIds[0] === 'dataPipeline';

    if (this.hideDataPipeline) return null;

    return (
      <div className="worksheetApiMenu">
        <div
          className="worksheetApiMenuTitle"
          onClick={() =>
            isOpen
              ? this.setState({ expandIds: [] })
              : this.setSelectId({ selectId: 'dataPipeline', expandIds: ['dataPipeline'] })
          }
        >
          <i className={cx('mRight5 textTertiary', isOpen ? 'icon-arrow-down' : 'icon-arrow-right-tip')} />
          {_l('聚合表')}
        </div>
        {dataPipelineLoading && <LoadDiv />}
        {isOpen && this.renderSideItem({ type: 'dataPipeline' })}
      </div>
    );
  }

  /**
   * 渲染封装业务流程、webhook侧栏
   */
  renderPBCSide({ type, listKey, title }: { type: string; listKey: string; title: string }) {
    const { selectWorkflowId, expandIds = [] } = this.state;
    const isOpen = expandIds[1] === type;
    const list = listKey === 'pbcList' ? this.state.pbcList : this.state.webhookList;
    if (!list.length) return null;
    const firstId = list[0]?.id;

    return (
      <div className="worksheetApiMenu">
        <div
          className="worksheetApiMenuItem"
          onClick={() => {
            isOpen
              ? this.setState({ expandIds: [] })
              : this.setSelectId({
                  selectId: 'workflowInfo',
                  ...(firstId ? { workflowId: firstId } : {}),
                  expandIds: [expandIds[0], type],
                });
          }}
        >
          <i className={cx('mRight5 textTertiary', isOpen ? 'icon-arrow-down' : 'icon-arrow-right-tip')} />
          {title}
        </div>
        {isOpen &&
          list.map((item: ApiSideItem, index) => {
            return (
              <div
                key={index}
                className={cx('worksheetApiMenuItem pLeft58 overflow_ellipsis', {
                  active: item.id === selectWorkflowId,
                })}
                onClick={() =>
                  this.setSelectId({ selectId: 'workflowInfo', ...(item.id ? { workflowId: item.id } : {}) })
                }
              >
                {item.name + ' POST'}
              </div>
            );
          })}
      </div>
    );
  }

  /**
   * 渲染工作流侧栏
   */
  renderWorkflow() {
    const { expandIds = [] } = this.state;
    const isOpen = expandIds[0] === 'workflow';
    return (
      <div className="worksheetApiMenu">
        <div
          className="worksheetApiMenuTitle"
          onClick={() => {
            isOpen
              ? this.setState({ expandIds: [], selectId: '' })
              : this.setSelectId({ expandIds: ['workflow'], selectId: 'workflow' });
          }}
        >
          <i className={cx('mRight5 textTertiary', isOpen ? 'icon-arrow-down' : 'icon-arrow-right-tip')} />
          {_l('工作流')}
        </div>
        {isOpen && (
          <Fragment>
            {[
              { type: 'workflowInfo', listKey: 'pbcList', title: _l('封装业务流程') },
              { type: 'webhook', listKey: 'webhookList', title: _l('Webhook') },
            ].map(item => this.renderPBCSide(item))}
          </Fragment>
        )}
      </div>
    );
  }

  /**
   * 渲染应用角色、筛选侧栏(应用角色为1、筛选为2)
   */
  renderOtherSide(type: string) {
    const { selectId, addOptionsParams, getOptionsParams, expandIds } = this.state;
    const optionSource = apiMenuItems(OPTIONS_FUNCTION_LIST);
    optionSource[0] && (optionSource[0].data = optionParameters(addOptionsParams));
    optionSource[1] && (optionSource[1].data = optionParameters(getOptionsParams));
    optionSource[2] && (optionSource[2].data = optionParameters(addOptionsParams));
    const { title, source } = [
      {
        title: _l('应用角色'),
        source: MENU_LIST_APPROLE,
      },
      {
        title: _l('筛选'),
        source: MENU_LIST_APPENDIX,
      },
      {
        title: _l('选项集'),
        source: optionSource,
      },
    ][Number(type)] || { title: '', source: [] };
    const currentList = apiMenuItems(source);
    const first = currentList[0];
    if (!first) return null;
    const isOpen = expandIds[0] === first.id;

    return (
      <div className="worksheetApiMenu">
        <div
          className="worksheetApiMenuTitle Hand"
          onClick={() => {
            let id = first.id;
            isOpen ? this.setState({ expandIds: [] }) : this.setSelectId({ selectId: id, expandIds: [id] });
          }}
        >
          <i className={cx('mRight5 textTertiary', isOpen ? 'icon-arrow-down' : 'icon-arrow-right-tip')} />
          {title}
        </div>
        {isOpen
          ? currentList.map(o => {
              return (
                <div
                  key={o.id}
                  className={cx('worksheetApiMenuItem overflow_ellipsis', { active: selectId === o.id })}
                  onClick={() => this.setSelectId({ selectId: o.id })}
                >
                  {o.title}
                </div>
              );
            })
          : null}
      </div>
    );
  }

  /**
   * 渲染内容
   */
  renderContent(item: ApiDocNode, i: number, type = 'worksheet') {
    const menuList =
      type === 'dataPipeline' ? this.MENU_LIST.filter(l => DATA_PIPELINE_MENUS.includes(l.id)) : this.MENU_LIST;

    return (
      <Fragment key={i + type}>
        {menuList.map((o, i) => {
          const index = _.findIndex(this.MENU_LIST, l => l.id === o.id);
          return (
            <div
              className="flexRow worksheetApiLi"
              key={i + type}
              id={item.worksheetId + (this.MENU_LIST[index]?.id || '') + '-content'}
            >
              {['FieldTable', 'ViewTable'].includes(o.id)
                ? this.renderComparisonTable(item, i, type)
                : this.renderWorksheetCommon(item, index, type)}
            </div>
          );
        })}
      </Fragment>
    );
  }

  /**
   * 渲染应用信息
   */
  renderAppInfo() {
    const { appInfo = {} } = this.state;
    const { apiRequest = {}, apiUrl = '' } = appInfo;
    const url = apiUrl + 'open/app/get';
    return (
      <Fragment>
        <div className="worksheetApiContent1">
          <div className="Font22 bold">{_l('获取应用信息 GET')}</div>
          <input
            name="worksheetApi1"
            autoComplete="off"
            className="mTop24 worksheetApiInput"
            value={_l('请求URL：') + url}
          />
          <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
            <div className="w32">{_l('参数')}</div>
            <div className="mLeft30 w18">{_l('必选')}</div>
            <div className="mLeft30 w14">{_l('类型')}</div>
            <div className="mLeft30 w36">{_l('说明')}</div>
          </div>
          {appInfoParameters.map(o => {
            return (
              <div key={o.name} className="flexRow worksheetApiLine flexRowHeight">
                <div className="w32">{o.name}</div>
                <div className="mLeft30 w18">{o.required}</div>
                <div className="mLeft30 w14">{o.type}</div>
                <div className="mLeft30 w36">{displayDescription(o.desc)}</div>
              </div>
            );
          })}
        </div>
        {this.renderRightContent({
          data: this.getUrl(url, {
            appKey: apiRequest.appKey || 'YOUR_APP_KEY',
            sign: apiRequest.sign || 'YOUR_SIGN',
          }),
          successData: appSuccessData,
          errorData: appRoleErrorData,
          enableClipboard: true,
        })}
      </Fragment>
    );
  }

  /**
   * 渲染工作表信息(工作表结构)
   */
  renderWorksheetInfo() {
    const { data = [] } = this.state;

    if (data.length <= 0) {
      return null;
    }
    const firstData = data[0];
    if (!firstData) return null;

    return (
      <Fragment>
        <div className="worksheetApiContent1">
          <div className="Font22 bold">{_l('获取工作表结构信息 POST')}</div>
          <input
            name="worksheetApi2"
            autoComplete="off"
            className="mTop24 worksheetApiInput"
            value={_l('请求URL：') + firstData.apiUrl + 'worksheet/getWorksheetInfo'}
          />
          <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
            <div className="w32">{_l('参数')}</div>
            <div className="mLeft30 w18">{_l('必选')}</div>
            <div className="mLeft30 w14">{_l('类型')}</div>
            <div className="mLeft30 w36">{_l('说明')}</div>
          </div>
          {apiFields(sameParameters).map(o => {
            return (
              <div key={o.name} className="flexRow worksheetApiLine flexRowHeight">
                <div className="w32">{o.name}</div>
                <div className="mLeft30 w18">{o.required}</div>
                <div className="mLeft30 w14">{o.type}</div>
                <div className="mLeft30 w36">{displayDescription(o.desc)}</div>
              </div>
            );
          })}
        </div>
        {this.renderRightContent({
          data: {
            appKey: firstData.appKey || 'YOUR_APP_KEY',
            sign: firstData.sign || 'YOUR_SIGN',
            worksheetId: firstData.alias || firstData.worksheetId,
          },
          successData: WORKSHEETINFO_SUCCESS_DATA,
          errorData: appRoleErrorData,
        })}
      </Fragment>
    );
  }

  /**
   * 渲染新建工作表
   */
  renderCreateWorksheet() {
    const { data = [], appInfo } = this.state;

    if (data.length <= 0) {
      return null;
    }
    const firstData = data[0];
    if (!firstData) return null;

    const sectionIds: ApiDocNode[] = (appInfo.apiResponse?.sections || []).flatMap<ApiDocNode>((l: ApiSection) => {
      let items = (l.items || []).filter((it: ApiDocNode) => it.type === 2);
      if (items.length === 0) return l;

      let items2 = items.map((m: ApiDocNode) => {
        return {
          ...m,
          keyName: `${l.name}-${m.name}`,
        };
      });

      return [l, ...items2];
    });
    const sectionIdsFlat = sectionIds.map((l: ApiDocNode) => {
      return {
        [String(l.keyName || l.name)]: l.id || l.sectionId,
      };
    });

    let param = [
      {
        name: 'appKey',
        required: _l('是'),
        type: 'string',
        desc: 'AppKey',
      },
      {
        name: 'sign',
        required: _l('是'),
        type: 'string',
        desc: _l('签名'),
      },
      {
        name: 'name',
        required: _l('是'),
        type: 'string',
        desc: _l('工作表名称'),
      },
      {
        name: 'alias',
        required: _l('否'),
        type: 'string',
        desc: _l('别名'),
      },
      {
        name: 'sectionId',
        required: _l('否'),
        type: 'string',
        desc: JSON.stringify(sectionIdsFlat),
      },
      {
        name: 'controls',
        required: _l('是'),
        type: 'list',
        desc: () => {
          return (
            <Fragment>
              <div>{_l('控件数据，传参规范见右侧示例')}</div>
              <div>{_l('controlName：控件名称，必填')}</div>
              <div>{_l('alias：控件别名')}</div>
              <div>
                {_l(
                  'type：控件类型，目前支持控件类型有 2:文本、6:数值、9:单选、10:多选、46:时间、15:日期（年-月-日）、16:日期 （年-月-日 时:分）、26:成员、14:附件、29:关联记录',
                )}
              </div>
              <div>{_l('required：是否必选，true：必填，false：非必填')}</div>
              <div>{_l('attribute：标题字段标识，1:标题，0:非标题，工作表中只能设置一个标题字段')}</div>
              <div>{_l('dot：保留小数位（0-14），控件类型为6:数值,8:金额时填入')}</div>
              <div>
                {_l(
                  'enumDefault：类型为26:成员时，表示成员数量，填入规则 0：单选,1：多选。类型为29:关联记录时，表示关联记录数量，填入规则 1：单条 2：多条',
                )}
              </div>
              <div>{_l('options：选项信息，控件类型为 11:单选,10:多选时填入')}</div>
              <div>{_l('max：等级最大值，控件类型为28:等级时填入,填入规则（0-10）')}</div>
              <div>{_l('dataSource：数据源 id，类型为 29 （关联记录）时传入,表示关联表 id)')}</div>
              <div>
                {_l(
                  'advancedSetting: 类型为15、16 日期时传入，格式{“showtype": “6”}，显示类型 5：年 4：年月 3：年月日 2：年月日时 1：年月日时分 6：年月日时分秒',
                )}
              </div>
              <div>{_l('unit：类型为46时间时传入，1：时分，6：时分秒')}</div>
            </Fragment>
          );
        },
      },
    ];

    return (
      <Fragment>
        <div className="worksheetApiContent1">
          <div className="Font22 bold">{_l('新建工作表 POST')}</div>
          <input
            name="worksheetApi3"
            autoComplete="off"
            className="mTop24 worksheetApiInput"
            value={_l('请求URL：') + firstData.apiUrl + 'worksheet/addWorksheet'}
          />
          <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
            <div className="w32">{_l('参数')}</div>
            <div className="mLeft30 w18">{_l('必选')}</div>
            <div className="mLeft30 w14">{_l('类型')}</div>
            <div className="mLeft30 w36">{_l('说明')}</div>
          </div>
          {param.map(o => {
            return (
              <div key={o.name} className="flexRow worksheetApiLine flexRowHeight">
                <div className="w32">{o.name}</div>
                <div className="mLeft30 w18">{o.required}</div>
                <div className="mLeft30 w14">{o.type}</div>
                <div className="mLeft30 w36">{typeof o.desc === 'function' ? o.desc() : o.desc}</div>
              </div>
            );
          })}
        </div>
        {this.renderRightContent({
          data: {
            appKey: firstData.appKey || 'YOUR_APP_KEY',
            sign: firstData.sign || 'YOUR_SIGN',
            name: firstData.name || 'NAME',
            alias: firstData.alias,
            sectionId: appInfo.apiResponse?.sections?.[0]?.sectionId || 'sectionId',
            controls: ADD_API_CONTROLS,
          },
          successData: ADD_WORKSHEET_SUCCESS,
          errorData: appRoleErrorData,
        })}
      </Fragment>
    );
  }

  /**
   * 渲染工作流信息
   */
  renderWorkflowInfo() {
    const { workflowInfo, tabIndex, webhookList } = this.state;
    if (_.isEmpty(workflowInfo)) return null;
    const inputs = workflowInfo.inputs,
      outputs = workflowInfo.outputs;
    if (!inputs || !outputs) return null;
    const isWebhook = !!_.find(webhookList, l => l.id === workflowInfo.processId);
    let inputExample: ApiRecord = {};
    let outputExample: ApiRecord = {};

    const renderInputs = (source: ApiField[]) => {
      return source.map((o: ApiField, index) => {
        if (o.dataSource && _.find(inputs, item => item.controlId === o.dataSource)?.type === 10000007) {
          return null;
        }

        return (
          <Fragment key={index}>
            <div key={o.controlId} className="flexRow worksheetApiLine flexRowHeight">
              <div className="w32">
                {o.dataSource && <span className="pLeft20" />}
                {o.alias || o.controlName}
              </div>
              <div className="mLeft30 w18">{o.required ? _l('是') : _l('否')}</div>
              <div className="mLeft30 w14">{FIELD_TYPE.find(obj => obj.value === o.type)?.text || ''}</div>
              <div className="mLeft30 w36">{displayDescription(o.desc)}</div>
            </div>
            {renderInputs(inputs.filter((item: ApiField) => item.dataSource === o.controlId))}
          </Fragment>
        );
      });
    };

    const renderOutputs = (source: ApiField[]) => {
      return source.map((o: ApiField, index) => {
        if (o.dataSource && _.find(outputs, item => item.controlId === o.dataSource)?.type === 10000007) {
          return null;
        }

        return (
          <Fragment key={index}>
            <div key={o.controlId} className="flexRow worksheetApiLine flexRowHeight">
              <div className="w32">
                {o.dataSource && <span className="pLeft20" />}
                {o.alias || o.controlName}
              </div>
              <div className="mLeft30 w36">{displayDescription(o.desc)}</div>
            </div>
            {renderOutputs(outputs.filter((item: ApiField) => item.dataSource === o.controlId))}
          </Fragment>
        );
      });
    };

    if (workflowInfo.outType === 1) {
      inputExample['callbackURL'] = '';
    }

    inputs
      .filter((item: ApiField) => !item.dataSource)
      .forEach((item: ApiField) => {
        inputExample[String(item.alias || item.controlName)] =
          item.value && _.includes([10000003, 10000007, 10000008], item.type)
            ? parseExample(item.value)
            : item.value || '';
      });

    outputs
      .filter((item: ApiField) => !item.dataSource)
      .forEach((item: ApiField) => {
        outputExample[String(item.alias || item.controlName)] =
          item.value && _.includes([10000003, 10000007, 10000008], item.type)
            ? parseExample(item.value)
            : item.value || '';
      });

    return (
      <Fragment>
        <div className="worksheetApiContent1">
          <div className="Font22 bold">{workflowInfo.name + ' POST'}</div>
          {/* <div className="Font14 bold mTop20">
            <span className="mRight20 textSecondary">
              {_l('流程ID：')}
              {workflowInfo.processId}
            </span>
            <span className="textSecondary">
              {_l('流程别名：')}
              {workflowAlias}
            </span>
            {tabIndex === TAB_TYPE.APPLICATION && (
              <span
                className="Hand Font13 mLeft20"
                style={{ color: 'var(--color-primary)' }}
                onClick={() => this.setState({ workflowAliasDialog: true })}
              >
                {_l('设置')}
              </span>
            )}
          </div> */}
          {tabIndex === TAB_TYPE.API_V2 && (
            <input
              name="worksheetApi4"
              autoComplete="off"
              className="mTop24 worksheetApiInput"
              value={_l('请求URL：') + workflowInfo.url}
            />
          )}
          <div className="valignWrapper justifyContentBetween Font17 bold mTop30">
            <span>{_l('请求参数')}</span>
            {/* {tabIndex === TAB_TYPE.APPLICATION && (
              <span className="Hand Font13 mLeft20" style={{ color: 'var(--color-primary)' }}>
                {_l('设置参数别名')}
              </span>
            )} */}
          </div>
          <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
            <div className="w32">{_l('参数')}</div>
            <div className="mLeft30 w18">{_l('必选')}</div>
            <div className="mLeft30 w14">{_l('类型')}</div>
            <div className="mLeft30 w36">{_l('说明')}</div>
          </div>
          {workflowInfo.outType === 1 && (
            <div className="flexRow worksheetApiLine flexRowHeight">
              <div className="w32">callbackURL</div>
              <div className="mLeft30 w18">{_l('否')}</div>
              <div className="mLeft30 w14">{_l('文本')}</div>
              <div className="mLeft30 w36">{_l('用于接受流程执行完毕输出的参数')}</div>
            </div>
          )}
          {renderInputs(inputs.filter((o: ApiField) => !o.dataSource))}
          {tabIndex === TAB_TYPE.API_V2 && !isWebhook && (
            <Fragment>
              <div className="Font17 bold mTop30">{_l('响应参数')}</div>
              <div className="bold mTop10">
                {workflowInfo.outType === 1
                  ? _l('将向回调地址（请求时附带的参数callbackURL）返回以下内容，如果未附带该参数将不做返回')
                  : _l('将直接向请求地址返回以下参数')}
              </div>
              <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
                <div className="w32">{_l('参数')}</div>
                <div className="mLeft30 w36">{_l('说明')}</div>
              </div>
              {renderOutputs(outputs.filter((o: ApiField) => !o.dataSource))}
            </Fragment>
          )}
        </div>
        {/* 修改工作流别名 */}
        {/* {workflowAliasDialog && (
          <WorkAliasDialog
            type="workflow"
            onClose={() => this.setState({ workflowAliasDialog: false })}
            alias={workflowAlias}
            appId={this.getId()}
            updateAlias={alias => {
              this.setState({
                workflowAlias: alias,
                data: this.state.data.map(o => ({ ...o, alias })),
                showWorksheetAliasDialog: false,
              });
            }}
          />
        )} */}

        {this.renderRightContent({ data: inputExample, outputData: outputExample })}
      </Fragment>
    );
  }

  /**
   * 渲染应用角色
   */
  renderAppRoleContent() {
    const { appInfo = {} } = this.state;
    const roleMenus = apiMenuItems(MENU_LIST_APPROLE);
    return (
      <Fragment>
        {roleMenus.map(({ id, isGet, title, data = [], apiName, successData, errorData }, i) => {
          const url = appInfo.apiUrl + (apiName || '');
          const dataObj: ApiRecord = {};
          data.forEach(({ name, desc, example }) => {
            if (!name) return;
            dataObj[name] = _.includes(['appKey', 'sign'], name)
              ? (this.state.data[0] || {})[name] || { appKey: 'YOUR_APP_KEY', sign: 'YOUR_SIGN' }[name]
              : example || desc;
          });

          return (
            <div key={i} className="flexRow worksheetApiLi" id={id + '-content'}>
              <div className="worksheetApiContent1">
                {i === 0 && <div className="Font22 bold mBottom40">{_l('应用角色')}</div>}
                <div className="Font17 bold">{title}</div>
                <input
                  name="worksheetApi5"
                  autoComplete="off"
                  className="mTop24 worksheetApiInput"
                  value={_l('请求URL：') + url}
                />
                <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
                  <div className="w32">{_l('参数')}</div>
                  <div className="mLeft30 w18">{_l('必选')}</div>
                  <div className="mLeft30 w14">{_l('类型')}</div>
                  <div className="mLeft30 w36">{_l('说明')}</div>
                </div>
                {data.map(o => {
                  return (
                    <div key={o.name} className="flexRow worksheetApiLine flexRowHeight">
                      <div className="w32">{o.name}</div>
                      <div className="mLeft30 w18">{o.required}</div>
                      <div className="mLeft30 w14">{o.type}</div>
                      <div className="mLeft30 w36">{displayDescription(o.desc)}</div>
                    </div>
                  );
                })}
              </div>
              {this.renderRightContent({ data: isGet ? this.getUrl(url, dataObj) : dataObj, successData, errorData })}
            </div>
          );
        })}
      </Fragment>
    );
  }

  /**
   * 拼接url
   */
  getUrl(url = '', data: ApiRecord = {}): ApiRecord {
    let curUrl = url + '?';

    for (let key in data) {
      curUrl += key + '=' + data[key] + '&';
    }

    curUrl = curUrl.substring(0, curUrl.length - 1);
    return { URL: curUrl };
  }

  onCopy(text: string) {
    copy(text, { format: 'text/plain' });
    alert(_l('已复制'));
  }

  /**
   * 渲染附录内容
   */
  renderAppendixContent(list?: unknown[]) {
    const { tabIndex } = this.state;
    const getWidth = (headerData: ApiHeader[], key: string): number | undefined =>
      _.get(_.find(headerData, headerObj => headerObj.key === key) || {}, 'width');
    const data = apiMenuItems(list || MENU_LIST_APPENDIX);

    return (
      <Fragment>
        {data.map((o: ApiMenuItem, i: number) => {
          const headerData: ApiHeader[] = MENU_LIST_APPENDIX_HEADER[o.id] || [];
          const isFirst = !list && i === 0;

          return (
            <div className="flexRow worksheetApiLi" key={i} id={o.id + '-content'}>
              <div className="flex worksheetApiContent1">
                {isFirst && <div className="Font22 bold mBottom40">{_l('附录')}</div>}

                <div className="Font17 bold">{o.title}</div>

                {!!headerData.length && (
                  <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
                    {headerData.map((header: ApiHeader, headerIdx: number) => (
                      <div key={headerIdx} className={cx(`w${header.width}`, { mLeft30: headerIdx > 0 })}>
                        {header.title}
                      </div>
                    ))}
                  </div>
                )}

                {(o.data || []).map((child, childIdx) => {
                  return (
                    <div key={`${child.id}-${childIdx}`} className="flexRow worksheetApiLine flexRowHeight">
                      <div className={cx(`w${getWidth(headerData, 'name')}`)}>{child.name}</div>
                      {child.required && (
                        <div className={cx(`mLeft30 w${getWidth(headerData, 'required')}`)}>{child.required}</div>
                      )}
                      {child.type && <div className={cx(`mLeft30 w${getWidth(headerData, 'type')}`)}>{child.type}</div>}
                      <div className={cx(`mLeft30 w${getWidth(headerData, 'desc')}`)}>
                        {typeof child.desc === 'object' ? JSON.stringify(child.desc) : child.desc}
                        {child.linkid && (
                          <a className="colorPrimary" onClick={() => this.scrollToFixedPosition(child.linkid)}>
                            {_l('附录')}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {o.id === 'AreaInfo' && (
                  <Fragment>
                    <div className="Font15 bold mTop20">{_l('获取地区信息')}</div>
                    <div className="Font14 mTop15">
                      {_l('接口地址：') + __api_server__.main}FixedData/getCitysByParentID
                    </div>
                    <div className="Font14">{_l('提交参数：{"parentId": "国家or省份or城市id", "keywords": ""}')}</div>
                    <div className="Font14">{_l('提交方式：')}POST</div>
                    <div className="Font14">{_l('返回内容：')}JSON</div>
                  </Fragment>
                )}
              </div>

              {isFirst ? (
                this.renderRightContent({
                  data: {
                    controlId: 'ordernumber',
                    dataType: 6,
                    spliceType: 1,
                    filterType: 13,
                    value: '2',
                  },
                })
              ) : o.id === 'AreaInfo' ? (
                <div className="worksheetApiContent2">
                  <div className="Font14 mTop20 textWhite mBottom6">{_l('获取地区信息')}</div>
                  <JsonView data={o['cityData']} />
                </div>
              ) : (
                tabIndex === TAB_TYPE.API_V2 && <div className="worksheetApiContent2" />
              )}
            </div>
          );
        })}
      </Fragment>
    );
  }

  /**
   * 对照表
   */
  renderComparisonTable(item: ApiDocNode, i: number, type: string) {
    const menu = this.MENU_LIST[i];
    if (!menu) return null;
    const { isSharePage } = this.props;
    const {
      aliasDialog = { visible: false },
      templateControls = [],
      showWorksheetAliasDialog,
      alias,
      dialogType,
      dataApp,
      sheetSwitchPermit,
      tabIndex,
    } = this.state;
    const isFieldTable = i === 0;
    const data = item[menu.type === 'control' ? 'controls' : 'views'];

    return (
      <Fragment>
        <div className="flex worksheetApiContent1">
          {isFieldTable && (
            <React.Fragment>
              <div className="flexRow alignItemsCenter">
                <div className="Font22 bold flex">{item.name}</div>
                {!isSharePage && (
                  <FiltersGenerate
                    controls={templateControls}
                    projectId={dataApp.projectId}
                    appId={this.getId()}
                    sheetSwitchPermit={sheetSwitchPermit}
                  />
                )}
              </div>
              <div className="Font14 bold mTop20 mBottom40">
                <span className="mRight20 textSecondary">{_l('工作表ID：') + item.worksheetId}</span>
                <span className="textSecondary">{_l('工作表别名：') + (alias || '')}</span>
                {!isSharePage && (
                  <span
                    className="Hand Font13 mLeft20"
                    style={{ color: 'var(--color-primary-text)' }}
                    onClick={() => this.setState({ showWorksheetAliasDialog: true, dialogType: type })}
                  >
                    {_l('设置')}
                  </span>
                )}
              </div>
            </React.Fragment>
          )}

          <div className="Font17 bold">
            {menu.title}
            {!isSharePage && (
              <span
                className="Right Hand Font13"
                style={{ color: 'var(--color-primary-text)' }}
                onClick={() => {
                  this.setState({ aliasDialog: { visible: true, type: menu.type }, dialogType: type });
                }}
              >
                {menu.btnText}
              </span>
            )}
          </div>
          <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
            {(menu.fields || []).map(field => (
              <div key={field.key} className={field.className}>
                {field.text}
              </div>
            ))}
          </div>
          {(isFieldTable ? item.controls || [] : item.views || []).map((o, index: number) => {
            return (
              <div key={`${o.controlId || o.viewId}-${index}`} className="flexRow worksheetApiLine flexRowHeight">
                {(menu.fields || []).map(field => {
                  let type = null;
                  let options: Array<{
                    key: string | number | null | undefined;
                    value: string | number | null | undefined;
                  }> = [];

                  if (field.key === 'controlType' || field.key === 'desc') {
                    const control = _.find(templateControls, numberType => numberType.controlId === o.controlId) || {};
                    type = control.type;
                    if (typeof type === 'number' && [9, 10, 11].includes(type)) {
                      options = (control.options || []).map(option => ({ key: option.key, value: option.value }));
                    }
                  }

                  return (
                    <div key={`data-${field.key}`} className={field.className}>
                      {['controlId', 'viewId'].includes(field.key) && (
                        <Fragment>
                          <div>{textField(o[field.key])}</div>
                          {o.alias && <div>({o.alias})</div>}
                        </Fragment>
                      )}

                      {field.key === 'controlType' &&
                        `${typeof o.type === 'string' ? o.type.replace(/（/g, '(').replace(/）/g, ')') : o.type}(${type} | ${convertControl(type)})`}

                      {field.key === 'viewType' &&
                        (_.find(VIEW_TYPE_ICON, { id: _.get(VIEW_DISPLAY_TYPE, String(o.type)) }) || {}).text}

                      {field.key === 'desc' && (
                        <div className="descBox">
                          <div>{displayDescription(o.desc)}</div>
                          {options?.length > 0 && <pre className="descPre">{JSON.stringify(options, null, 2)}</pre>}
                        </div>
                      )}

                      {!['controlId', 'viewId', 'controlType', 'viewType', 'desc'].includes(field.key) &&
                        textField(o[field.key])}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {aliasDialog.visible && aliasDialog.type === menu.type && dialogType === type && (
          <AliasDialog
            type={menu.type || ''}
            data={data}
            controlTypeList={data}
            worksheetId={item.worksheetId}
            appId={this.getId()}
            onClose={(isUpdate: boolean) => {
              this.setState({ aliasDialog: { visible: false }, dialogType: undefined });
              isUpdate && item.worksheetId && this.getWorksheetApiInfo(item.worksheetId);
            }}
          />
        )}
        {showWorksheetAliasDialog && dialogType === type && isFieldTable && (
          <WorkAliasDialog
            onClose={() => this.setState({ showWorksheetAliasDialog: false, dialogType: undefined })}
            alias={alias}
            appId={this.getId()}
            worksheetId={item.worksheetId}
            updateAlias={(alias: string) => {
              this.setState({
                alias,
                data: this.state.data.map(o => ({ ...o, alias: alias })),
                showWorksheetAliasDialog: false,
                dialogType: undefined,
              });
            }}
          />
        )}
        {tabIndex === TAB_TYPE.API_V2 && <div className="worksheetApiContent2" />}
      </Fragment>
    );
  }

  /**
   * 授权管理
   */
  renderAuthorizationManagement = () => {
    const { authorizes = [], addSecretKey, visibleAppKeys, visibleSigns, tabIndex } = this.state;

    const renderIconRow = (visibleState: 'visibleAppKeys' | 'visibleSigns', text: string) => {
      const values = visibleState === 'visibleAppKeys' ? this.state.visibleAppKeys : this.state.visibleSigns;
      const visible = values.includes(text);

      return (
        <div className="flexRow alignItemsCenter mTop4">
          <Tooltip title={visible ? _l('隐藏') : _l('显示')}>
            <Icon
              icon={visible ? 'visibility_off' : 'eye_off'}
              className="Font16 pointer textSecondary hoverColorPrimaryDark"
              onClick={() => {
                const changed = visible ? values.filter(item => item !== text) : values.concat(text);
                this.setState(state => ({ ...state, [visibleState]: changed }));
              }}
            />
          </Tooltip>
          <Tooltip title={_l('复制')}>
            <Icon
              icon="copy"
              className="Font16 pointer textSecondary hoverColorPrimaryDark mLeft8"
              onClick={() => this.onCopy(text)}
            />
          </Tooltip>
        </div>
      );
    };

    return (
      <Fragment>
        <div className="worksheetApiContent1">
          <div className="Font22 bold">{_l('授权管理')}</div>
          {authorizes.length > 0 && (
            <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
              <div className="w14">{_l('名称')}</div>
              <div className="mLeft10 w12">AppKey</div>
              <div className="mLeft10 w26">Sign</div>
              <div className="mLeft10 w18">{_l('授权类型')}</div>
              <div className="mLeft10 w22">{_l('创建者')}</div>
              <div className="mLeft10 w8">{_l('操作')}</div>
            </div>
          )}
          {authorizes.map(o => {
            return (
              <div key={o.appKey} className="flexRow worksheetApiLine flexRowHeight pTop8 pBottom8">
                <div className="w14">{o.name}</div>
                <div className="mLeft10 w12">
                  {visibleAppKeys.includes(o.appKey) && <div>{o.appKey}</div>}
                  <div className="textTertiary">{o.remark}</div>
                  {renderIconRow('visibleAppKeys', o.appKey)}
                </div>
                <div className="mLeft10 w26">
                  {visibleSigns.includes(o.sign) && <div>{o.sign}</div>}
                  {renderIconRow('visibleSigns', o.sign)}
                </div>
                <div className="mLeft10 w18">
                  <div>
                    {o.status === 2
                      ? _l('授权已关闭')
                      : o.type === 1
                        ? _l('本应用全部接口')
                        : o.type === 2
                          ? _l('本应用只读接口')
                          : _l('自定义')}
                  </div>
                  {o.status !== 2 && o.viewNull && <div>{_l('空视图参数不返回数据')}</div>}
                </div>
                <div className="mLeft10 w22">
                  <div className="flexRow alignItemsCenter">
                    <Avatar src={o.creater?.avatar} size={20} className="flex-shrink-0" />
                    <div className="mLeft4">{o.creater?.fullname}</div>
                  </div>
                  <div className="mTop4">{o.createTime}</div>
                </div>
                <div className="mLeft10 w8 Relative">
                  <Icon
                    icon="more_horiz"
                    className="Font18 Hand Relative"
                    onClick={() => {
                      this.setState({ showMoreOption: true, appKey: o.appKey });
                    }}
                  />
                  {this.moreOption(o)}
                </div>
              </div>
            );
          })}
          <span
            className="addSecretKey Font14 Hand LineHeight28 mTop20 InlineBlock"
            onClick={() => this.setState({ addSecretKey: true })}
          >
            <Icon icon="add" className="Font18 mRight8" />
            {_l('新建授权密钥')}
          </span>
          {addSecretKey && (
            <SecretKey
              appId={this.getId()}
              getAuthorizes={this.getAuthorizes}
              onClose={() => this.setState({ addSecretKey: false })}
            />
          )}
        </div>
        {tabIndex === TAB_TYPE.API_V2 && <div className="worksheetApiContent2" />}
      </Fragment>
    );
  };

  moreOption = (data: ApiAuthorize) => {
    const { showMoreOption, appKey = '' } = this.state;

    if (!showMoreOption || appKey !== data.appKey) {
      return undefined;
    }

    return (
      <MoreOption
        getAuthorizes={() => this.getAuthorizes()}
        showMoreOption={this.state.showMoreOption}
        appId={this.getId()}
        data={data}
        setFn={(showMoreOption: boolean) => {
          this.setState({
            showMoreOption: showMoreOption,
          });
        }}
        onClickAwayExceptions={['.mui-dialog-container', '.tencent-captcha__transform']}
        onClickAway={() => this.setState({ showMoreOption: false })}
      />
    );
  };

  /**
   * IP 白名单
   */
  renderWhiteList = () => {
    const { dataApp, whiteListDialog, tabIndex } = this.state;

    return (
      <Fragment>
        <div className="worksheetApiContent1">
          <div className="Font22 bold">{_l('IP 白名单')}</div>
          <div className="mTop24">
            {_l('在 IP 白名单内的 IP 来源地址才能发起请求。未设置则所有 IP 来源都可发起请求。')}
          </div>
          {(dataApp.openApiWhiteList || []).map((ip, index: number) => {
            return (
              <div className={index === 0 ? 'mTop20' : ''} key={index}>
                {ip}
              </div>
            );
          })}
          <div className="mTop20">
            <span className="addSecretKey Font14 Hand" onClick={() => this.setState({ whiteListDialog: true })}>
              {_l('修改')}
            </span>
          </div>
        </div>
        {tabIndex === TAB_TYPE.API_V2 && <div className="worksheetApiContent2" />}

        {whiteListDialog && (
          <Dialog
            className="addSheetFieldDialog"
            title={_l('IP 白名单')}
            visible={true}
            width={480}
            onOk={() => {
              const textarea = this.whiteList;
              if (!textarea) {
                alert(_l('请输入正确的 IP 地址'), 2);
                return;
              }
              const whiteList = _.uniq(
                textarea.value
                  .split('\n')
                  .filter(o => o.trim())
                  .map(o => o.trim()),
              );
              let hasError = false;

              whiteList.forEach(ip => {
                if (!/^((2[0-4]\d|25[0-5]|[01]?\d\d?)\.){3}(2[0-4]\d|25[0-5]|[01]?\d\d?)$/.test(ip)) {
                  hasError = true;
                }
              });

              if (hasError) {
                alert(_l('请输入正确的 IP 地址'), 2);
              } else {
                homeApp
                  .editWhiteList({ appId: dataApp.id, projectId: dataApp.projectId, whiteIps: whiteList })
                  .then((raw: unknown) => {
                    if (isRecord(raw) && raw['data']) {
                      this.setState({
                        dataApp: Object.assign({}, dataApp, { openApiWhiteList: whiteList }),
                        whiteListDialog: false,
                      });
                    } else {
                      alert(_l('修改失败'), 2);
                    }
                  })
                  .catch(() => alert(_l('修改失败'), 2));
              }
            }}
            onCancel={() => this.setState({ whiteListDialog: false })}
          >
            <Textarea
              className="w100"
              defaultValue={(dataApp.openApiWhiteList || []).join('\n')}
              minHeight={150}
              maxHeight={400}
              placeholder={_l('请填写 IP 地址，一行一个')}
              spellCheck={false}
              manualRef={whiteList => {
                this.whiteList = whiteList;
              }}
            />
          </Dialog>
        )}
      </Fragment>
    );
  };

  /**
   * 渲染请求内容
   */
  renderPostContent(item: ApiDocNode, i: number, otherOptions: ApiRecord, rightOptions: ApiRecord = {}) {
    if (this.state.data.length <= 0) {
      return null;
    }
    const firstData = this.state.data[0];
    if (!firstData) return null;
    const menu = this.MENU_LIST[i];
    if (!menu) return null;
    const url = firstData.apiUrl + (menu.apiName || '');

    return (
      <Fragment>
        {this.renderLeftContent(i)}
        {this.renderRightContent({
          data: menu.isGet
            ? this.getUrl(url, this.setCommonPostParameters(item, otherOptions))
            : this.setCommonPostParameters(item, otherOptions),
          errorData: appRoleErrorData,
          ...rightOptions,
        })}
      </Fragment>
    );
  }

  /**
   * 渲染通用的左内容
   */
  renderLeftContent(i: number) {
    const { data = [] } = this.state;

    if (data.length <= 0) {
      return null;
    }
    const firstData = data[0];
    if (!firstData) return null;
    const menu = this.MENU_LIST[i];
    if (!menu) return null;

    return (
      <div className="worksheetApiContent1">
        <div />
        <div className="Font17 bold">{menu.title}</div>
        <input
          name="worksheetApi6"
          autoComplete="off"
          className="mTop24 worksheetApiInput"
          value={_l('请求URL：') + firstData.apiUrl + (this.MENU_LIST[i]?.apiName || '')}
        />
        <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
          <div className="w32">{_l('参数')}</div>
          <div className="mLeft30 w18">{_l('必选')}</div>
          <div className="mLeft30 w14">{_l('类型')}</div>
          <div className="mLeft30 w36">{_l('说明')}</div>
        </div>
        {(menu.data || []).map(o => {
          return (
            <div key={o.name} className="flexRow worksheetApiLine flexRowHeight">
              <div className="w32">{o.name}</div>
              <div className="mLeft30 w18">{o.required}</div>
              <div className="mLeft30 w14">{o.type}</div>
              <div className="mLeft30 w36">
                {typeof o.desc === 'object' ? JSON.stringify(o.desc) : o.desc}
                {o.linkid && (
                  <a className="colorPrimary" onClick={() => this.scrollToFixedPosition(o.linkid)}>
                    {_l('附录')}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /**
   * 渲染通用的右内容
   */
  /**
   * 【四个字段都要标成可选】解构形参不写注解时，TS 会把它们全当成必填，
   * 于是只传 data 的那 4 处调用点报"缺少 outputData"。
   * 但函数体自己就写着 `successData ? ...` 和 `!!outputData &&` 的守卫 ——
   * 可选是如实描述，不是放水。
   */
  renderRightContent({
    data,
    successData,
    errorData,
    outputData,
  }: {
    data?: unknown;
    successData?: unknown;
    errorData?: unknown;
    outputData?: unknown;
    /** 有一处调用点传了它，但函数体并不读 —— 如实列出，不动调用方的意图 */
    enableClipboard?: boolean;
  }) {
    return (
      <div className="worksheetApiContent2">
        <div className="mBottom16 Font14 textDisabled">{_l('提交数据提示')}</div>

        <JsonView data={data} />

        {successData ? (
          <Fragment>
            <div className="mTop16 mBottom16 Font14 textDisabled">{_l('返回数据示例')}</div>
            {successData && <JsonView data={successData} rootKey={_l('成功')} />}
            <JsonView data={errorData} rootKey={_l('失败')} />
          </Fragment>
        ) : null}

        {!!outputData && (
          <Fragment>
            <div className="mTop16 mBottom16 Font14 textDisabled">{_l('返回数据示例')}</div>{' '}
            <JsonView data={outputData} />
          </Fragment>
        )}
      </div>
    );
  }

  /**
   * 设置通用的请求参数
   */
  setCommonPostParameters(item: ApiDocNode, otherOptions: ApiRecord): ApiRecord {
    const { rowId, ...restOptions } = otherOptions || {};

    return {
      appKey: item.appKey || 'YOUR_APP_KEY',
      sign: item.sign || 'YOUR_SIGN',
      worksheetId: item.alias || item.worksheetId,
      ...(rowId ? { rowId } : {}), // 如果有 rowId，放到前面
      ...restOptions,
    };
  }

  renderMapItem = (o: ApiField): ApiRecord => {
    const { templateControls = [] } = this.state;
    const relationValue = relationExample(o.relationValue === undefined ? [] : o.relationValue);
    const { controlId, value, alias } = o;
    const list: ApiRecord = {
      controlId: alias || controlId,
      value,
    };

    if (
      _.get(
        _.find(templateControls, item => item.controlId === controlId),
        'type',
      ) === 14
    ) {
      list['editType'] = _l('数据更新类型，0=覆盖，1=新增（默认0:覆盖，新建记录可不传该参数）');
      list['valueType'] = _l(
        '提交值类型，1=外部文件链接，2=文件流字节编码 base64格式 字符串 (默认1,为1时 外部链接放在value参数中，为2时 文件流base64信息放在controlFiles参数中 )',
      );
      list['controlFiles'] = [
        {
          baseFile: _l('base64字符串（文件流字节编码）'),
          fileName: _l('文件名称，带后缀'),
        },
      ];
    }

    if (
      _.includes(
        [9, 10, 11],
        _.get(
          _.find(templateControls, item => item.controlId === controlId),
          'type',
        ),
      )
    ) {
      list['valueType'] = _l(
        '提交值类型，1=不增加选项，2=允许增加选项（默认为1，为1时匹配不到已有选项时传入空，为2时，匹配不到时会创建新选项并写入）',
      );
    }

    return relationValue.length !== undefined && relationValue.length <= 0
      ? list
      : {
          ...list,
          relationValue: {
            rowIds: relationValue.rowIds,
            isAdd: relationValue.isAdd,
          },
        };
  };

  fillFilters() {
    return new Array(3).fill(1).map((_o, i) => {
      return {
        controlId: `control${i + 1}`,
        dataType: 6,
        spliceType: 1,
        filterType: 13,
        value: '2',
      };
    });
  }

  fillControls = (item: { controls?: ApiField[] | undefined }, isSupportSys = false): ApiRecord[] => {
    return (item.controls || [])
      .filter(
        o => !!o.controlId && o.isSupport && (isSupportSys || o.controlId.length > 20 || o.controlId === 'ownerid'),
      )
      .map(o => this.renderMapItem(o));
  };

  renderWorksheetCommon(item: ApiDocNode, i: number, type: string) {
    const specification = this.MENU_LIST[i];
    if (!specification) return null;
    const rightOptions: { successData?: unknown; errorData?: unknown } = {};
    const pipelineFilter =
      specification.id === 'List'
        ? DATA_PIPELINE_FILTERS.List
        : specification.id === 'TotalNum'
          ? DATA_PIPELINE_FILTERS.TotalNum
          : undefined;
    const needFilter = type === 'dataPipeline' && pipelineFilter !== undefined;
    const omitted = new Set(needFilter ? pipelineFilter : []);
    const otherOptions: ApiRecord = {};
    Object.entries(specification.requestData || {}).forEach(([key, value]) => {
      if (!omitted.has(key)) otherOptions[key] = value;
    });

    if (needFilter)
      specification.data = (specification.data || []).filter(
        l => typeof l.name !== 'string' || !pipelineFilter.includes(l.name),
      );
    if (specification.successData) rightOptions.successData = specification.successData;
    if (specification.errorData) rightOptions.errorData = specification.errorData;
    if (specification.id === 'List') otherOptions['filters'] = this.fillFilters();
    if (['AddRow', 'AddRows', 'UpdateDetail', 'UpdateDetails'].includes(specification.id)) {
      const controls = this.fillControls(item, specification.id === 'UpdateDetails');
      otherOptions[specification.id === 'AddRows' ? 'rows' : 'controls'] =
        specification.id === 'AddRows' ? [controls] : controls;
    }

    (specification.data || []).forEach(obj => {
      const name = obj.name;
      if (!name) return;
      if (
        !_.includes(['appKey', 'sign', 'worksheetId', 'viewId', 'pageSize', 'pageIndex', 'listType'], name) &&
        !otherOptions[name]
      ) {
        if (name === 'control' && specification.id === 'UpdateDetails') return;
        otherOptions[name] = obj.desc;
      }
    });

    return this.renderPostContent(item, i, otherOptions, rightOptions);
  }

  /**
   * scrollView滚动
   */
  scroll = _.throttle(({ scrollTop }: { scrollTop: number }) => {
    if (!this.canScroll) {
      return;
    }

    const heightArr: Array<{ id: string; h: number | undefined; height?: number | undefined }> = [];
    let totalHeight = 0;
    let isExist = false;

    $('.scrollViewContainer .worksheetApiLi').map((_index: number, el) => {
      heightArr.push({
        id: String($(el).attr('id') || '').replace('-content', ''),
        h: $(el).height(),
      });
    });
    heightArr
      .filter(item => Number(item.height) > 0)
      .forEach(item => {
        totalHeight += Number(item.h);
        if (!isExist && totalHeight - Number(item.h) * 0.3 > scrollTop) {
          isExist = true;
          this.setState({ selectId: item.id });
        }
      });
  }, 300);

  /**
   * 渲染选项集
   */
  renderOptions() {
    const { appInfo = {} } = this.state;
    const { apiRequest = {} } = appInfo;
    return (
      <Fragment>
        {OPTIONS_FUNCTION_LIST.map(({ id, title, data = [], apiName, requestData, successData, errorData }, i) => {
          const url = appInfo.apiUrl + apiName;
          return (
            <div key={i} className="flexRow worksheetApiLi" id={id + '-content'}>
              <div className="worksheetApiContent1">
                {i === 0 && <div className="Font22 bold mBottom40">{_l('选项集')}</div>}
                <div className="Font17 bold">{title}</div>
                <input
                  name="worksheetApi7"
                  autoComplete="off"
                  className="mTop24 worksheetApiInput"
                  value={_l('请求URL：') + url}
                />
                <div className="flexRow worksheetApiLine flexRowHeight bold mTop25">
                  <div className="w32">{_l('参数')}</div>
                  <div className="mLeft30 w18">{_l('必选')}</div>
                  <div className="mLeft30 w14">{_l('类型')}</div>
                  <div className="mLeft30 w36">{_l('说明')}</div>
                </div>
                {data.map(o => {
                  return (
                    <div key={o.name} className="flexRow worksheetApiLine flexRowHeight">
                      <div className="w32">{o.name}</div>
                      <div className="mLeft30 w18">{o.required}</div>
                      <div className="mLeft30 w14">{o.type}</div>
                      <div className="mLeft30 w36">{displayDescription(o.desc)}</div>
                    </div>
                  );
                })}
              </div>
              {this.renderRightContent({
                data: {
                  ...requestData,
                  appKey: apiRequest.appKey || 'YOUR_APP_KEY',
                  sign: apiRequest.sign || 'YOUR_SIGN',
                },
                successData,
                errorData,
              })}
            </div>
          );
        })}
      </Fragment>
    );
  }

  updateTabIndex = (nexTabIndex: string) => {
    const { selectId, expandIds, tabIndex } = this.state;
    // 存储当前tab下菜单的位置
    sessionStorage.setItem(
      `ApiTabIndex-${tabIndex}`,
      JSON.stringify({
        selectId,
        expandIds,
      }),
    );
    let targetId = '';

    switch (nexTabIndex) {
      case TAB_TYPE.APPLICATION:
        targetId = 'authorizationInstr';
        break;
      case TAB_TYPE.API_V2:
        targetId = 'summary';
        break;
      default:
        break;
    }

    // 获取目标tab下菜单的位置
    const targetPosition = cachedPosition(sessionStorage.getItem(`ApiTabIndex-${nexTabIndex}`));
    const targetSelectId = this.hideMcp && targetPosition.selectId === 'mcpServer' ? targetId : targetPosition.selectId;
    this.setState(
      {
        tabIndex: nexTabIndex,
        selectId: targetSelectId || targetId,
        expandIds: targetPosition.expandIds || [],
      },
      () => {
        this.scrollToFixedPosition();
      },
    );
  };

  renderSidebar(name: string, args: number | undefined): React.ReactNode {
    if (name === 'renderWorksheetSide') return this.renderWorksheetSide();
    if (name === 'renderDataPipelineSide') return this.renderDataPipelineSide();
    if (name === 'renderWorkflow') return this.renderWorkflow();
    if (name === 'renderOtherSide' && args !== undefined) return this.renderOtherSide(String(args));
    return null;
  }

  override render() {
    const {
      data = [],
      loading,
      selectId,
      dataApp,
      errorCode,
      appInfo,
      dataPipelineData = [],
      tabIndex,
      authorizes,
    } = this.state;
    const { isSharePage } = this.props;
    const appId = this.getId();
    const sidebarList = apiSidebarItems(SIDEBAR_LIST_MAP[tabIndex] || []).filter(item => {
      if (this.hideMcp && item.key === 'mcpServer') return false;
      if (this.hideDataPipeline && item.key === 'dataPipeline') return false;
      return true;
    });
    const lang = window.getCurrentLang();
    const theme = document.documentElement.getAttribute('data-theme') || 'light';

    if (errorCode === 2) {
      return (
        <div className="flexColumn h100">
          <div className="errorBox">
            <span>
              <Icon icon="info" />
            </span>
            {_l('应用已过期，无法使用 API')}
          </div>
        </div>
      );
    }

    if (errorCode === 300016) {
      return <RestrictAccessStatus />;
    }

    if (this.state.loadError) {
      return (
        <div role="alert" className="pAll24">
          <div>{this.state.loadError}</div>
          <button
            onClick={() => {
              void this.retryRequest?.();
            }}
          >
            {_l('重试')}
          </button>
        </div>
      );
    }

    if (loading) {
      return <LoadDiv />;
    }

    return (
      <div className="flexColumn h100">
        <Header
          isSharePage={isSharePage}
          data={data}
          dataApp={dataApp}
          appId={appId}
          appInfo={appInfo}
          tabIndex={tabIndex}
          updateTabIndex={this.updateTabIndex}
          getId={this.handleGetId}
        />
        <div className="flex flexRow minHeight0 bgPrimary">
          {tabIndex === TAB_TYPE.API_V3 ? (
            <iframe
              width="100%"
              height="100%"
              style={{ border: 'none' }}
              allowTransparency={true}
              allowFullScreen
              src={`${md.global.Config.OpenApiDocUrl}/application_v3/appkey-sign/${lang === 'zh-Hans' ? 'zh-Hans' : 'en'}/?ts=${Date.now()}&theme=${theme}&noHeader=true`}
            />
          ) : (
            <Fragment>
              <div className="worksheetApiSide h100">
                <ScrollView>
                  {sidebarList.map(({ key, title, render, args }, index) => {
                    return render ? (
                      <Fragment key={index}>{this.renderSidebar(render, args)}</Fragment>
                    ) : (
                      <div
                        key={index}
                        className={cx('worksheetApiMenuTitle', { active: selectId === key })}
                        onClick={() => this.setSelectId({ selectId: key })}
                      >
                        {title}
                      </div>
                    );
                  })}
                </ScrollView>
              </div>
              <div className="flex h100 minWidth0">
                <ScrollView ref={this.contentScrollRef} className="worksheetApiScroll" onScrollEnd={this.scroll}>
                  {/* 应用授权 */}
                  {tabIndex === TAB_TYPE.APPLICATION && (
                    <Fragment>
                      {/* 授权管理 */}
                      <div className="flexRow worksheetApiLi" id="authorizationInstr-content">
                        {this.renderAuthorizationManagement()}
                      </div>
                      {!this.hideMcp && <Mcp authorizes={authorizes} appInfo={appInfo} />}
                      {/* IP白名单 */}
                      <div className="flexRow worksheetApiLi" id="whiteList-content">
                        {this.renderWhiteList()}
                      </div>
                      <div id="list-content">{data.map((item, i) => this.renderContent(item, i))}</div>
                      <div id="dataPipeline-content">
                        {dataPipelineData.map((item, i) => this.renderContent(item, i, 'dataPipeline'))}
                      </div>
                    </Fragment>
                  )}
                  {/* API 2.0 */}
                  {tabIndex === TAB_TYPE.API_V2 && (
                    <Fragment>
                      {/* 概述 */}
                      <Summary />
                      {/* 请求格式 */}
                      <RequestFormat />
                      {/* 获取应用信息 */}
                      <div className="flexRow worksheetApiLi" id="appInfo-content">
                        {this.renderAppInfo()}
                      </div>
                      {/* 新建工作表 */}
                      <div className="flexRow worksheetApiLi" id="worksheetCreateForm-content">
                        {this.renderCreateWorksheet()}
                      </div>
                      {/* 获取工作表结构信息 */}
                      <div className="flexRow worksheetApiLi" id="worksheetFormInfo-content">
                        {this.renderWorksheetInfo()}
                      </div>
                      <div id="list-content">{data.map((item, i) => this.renderContent(item, i))}</div>
                      <div className="flexRow worksheetApiLi" id="workflowInfo-content">
                        {this.renderWorkflowInfo()}
                      </div>
                      {/** 应用角色 */}
                      {this.renderAppRoleContent()}
                      {/** 筛选(附录) */}
                      {this.renderAppendixContent()}
                      {/** 选项集 */}
                      {this.renderOptions()}
                      {this.renderAppendixContent(ERROR_CODE)}
                    </Fragment>
                  )}
                </ScrollView>
              </div>
            </Fragment>
          )}
        </div>
      </div>
    );
  }
}

const MobileUnsupported = ({ shareData }: { shareData: ApiShareData }) => {
  const dataApp = {
    iconUrl: shareData.appIcon,
    iconColor: shareData.appIconColor,
    name: shareData.appName,
    projectId: shareData.projectId,
    navColor: shareData.appNavColor,
  };

  return (
    <div className="flexColumn h100">
      <Header isSharePage={true} data={dataApp} dataApp={dataApp} appId={shareData.appId} />
      <div className="worksheetApiMobileUnsupported flex">
        <Icon icon="pc-mac-circle" className="textDisabled" />
        <div className="Font17 textTertiary mTop30">{_l('当前文档暂不支持在移动端查看')}</div>
        <div className="Font17 textTertiary mTop12">{_l('请前往电脑端进行查看')}</div>
      </div>
    </div>
  );
};

export const Entry = () => {
  const isSharePage = location.pathname.includes('/public/');
  const pathname = location.pathname.split('/');
  const id = pathname[pathname.length - 1] || '';
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<ApiShareResponse>({});
  const [loadError, setLoadError] = useState<string | undefined>();
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const requests = useRef(new Set<ApiResultOf<unknown>>());

  const getEntityShareById = useCallback(
    async (data: ApiRecord): Promise<ApiShareResponse> => {
      const version = ++requestVersion.current;
      const request = appManagementAjax.getEntityShareById({ id, sourceType: 45, ...data });
      requests.current.add(request);
      try {
        const raw: unknown = await request;
        const result = apiShare(raw);
        if (!mounted.current || version !== requestVersion.current) throw new Error('API share request cancelled');
        const clientId = result.data?.clientId;
        Reflect.set(window, 'clientId', clientId);
        if (clientId) sessionStorage.setItem(id, clientId);
        return result;
      } finally {
        requests.current.delete(request);
      }
    },
    [id],
  );

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    if (!isSharePage) {
      preall({ type: 'function' });
      Promise.resolve().then(() => {
        if (!cancelled) setLoading(false);
      });
    } else {
      const clientId = sessionStorage.getItem(id);
      Reflect.set(window, 'clientId', clientId);
      const pending = getEntityShareById({ clientId, langType: getCurrentLangCode() });
      const version = requestVersion.current;
      void pending
        .then(result => {
          if (cancelled || version !== requestVersion.current) return;
          preall({ type: 'function' }, { allowNotLogin: true, requestParams: { projectId: result.data?.projectId } });
          setShare(result);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (!cancelled && version === requestVersion.current) {
            setLoadError(errorInfo(error).message);
            setLoading(false);
          }
        });
    }
    return () => {
      cancelled = true;
      mounted.current = false;
      requestVersion.current++;
      requests.current.forEach(request => request.abort());
    };
  }, [getEntityShareById, id, isSharePage]);

  const renderContent = () => {
    if (share.resultCode !== undefined && [14, 18, 19].includes(share.resultCode)) {
      return (
        <VerificationPass
          validatorPassPromise={(value: string, captchaResult: ApiRecord): Promise<ApiShareResponse> => {
            if (!value) return Promise.reject();
            const pending = getEntityShareById({ password: value, ...captchaResult });
            const version = requestVersion.current;
            return pending.then(result => {
              if (result.resultCode !== 1)
                return Promise.reject(result.resultCode === undefined ? undefined : SHARE_STATE[result.resultCode]);
              if (!mounted.current || version !== requestVersion.current)
                return Promise.reject(new Error('API share request cancelled'));
              setShare(result);
              return result;
            });
          }}
        />
      );
    }
    return <ShareState code={share.resultCode} />;
  };
  if (loading)
    return (
      <div className="w100 h100 flexColumn alignItemsCenter justifyContentCenter">
        <LoadDiv />
      </div>
    );
  if (loadError)
    return (
      <div role="alert" className="pAll24">
        {loadError}
        <button onClick={() => window.location.reload()}>{_l('重试')}</button>
      </div>
    );
  if (!isSharePage) return <WorksheetApi isSharePage={isSharePage} />;
  if (share.resultCode === 1 && share.data) {
    if (isMobile) return <MobileUnsupported shareData={share.data} />;
    return <WorksheetApi isSharePage={isSharePage} appId={share.data.appId} shareData={share.data} />;
  }
  return (
    <div className="flexColumn h100">
      {share.data && <Header isAuthorization={true} share={share} />}
      {renderContent()}
    </div>
  );
};

const appElement = document.getElementById('app');
if (!appElement) throw new TypeError('Worksheet API root is missing');
const root = createRoot(appElement);

root.render(<Entry />);
