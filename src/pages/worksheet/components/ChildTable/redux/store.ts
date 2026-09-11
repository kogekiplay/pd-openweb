import { configureStore } from '@reduxjs/toolkit';
import { find, includes, isFunction, isNaN, isNumber } from 'lodash';
import { get } from 'lodash';
import { isEmpty } from 'lodash';
import publicWorksheetAjax from 'src/api/publicWorksheet';
import sheetAjax from 'src/api/worksheet';
import { setRowsFromStaticRows } from 'worksheet/components/ChildTable/redux/actions';
import { formatSearchConfigs } from 'src/pages/widgetConfig/util';
import { canAsUniqueWidget } from 'src/pages/widgetConfig/util/setting';
import { isRelateRecordTableControl, parseAdvancedSetting } from 'src/utils/control';
import { getSubListUniqueError } from 'src/utils/record';
import { handleUpdateDefsourceOfControl } from 'src/utils/record';
import { clearRows, loadRows, resetRows, updateTreeTableViewData } from './actions';
import reducer from './reducer';

function loadWorksheetInfo(worksheetId, { controlId, relationWorksheetId, recordId, instanceId, workId } = {}) {
  const args = { worksheetId, getTemplate: true, getRules: true, relationWorksheetId };
  let getWorksheetInfoPromise;

  if (window.shareState.isPublicWorkflowRecord && window.shareState.shareId) {
    args.linkId = window.shareState.shareId;
    args.controlId = controlId;
    getWorksheetInfoPromise = sheetAjax.getWorksheetInfoByWorkItem;
  } else if (recordId && instanceId && workId) {
    args.instanceId = instanceId;
    args.workId = workId;
    args.controlId = controlId;
    getWorksheetInfoPromise = sheetAjax.getWorksheetInfoByWorkItem;
  } else if (get(window, 'shareState.isPublicForm')) {
    getWorksheetInfoPromise = publicWorksheetAjax.getWorksheetInfo;
  } else {
    getWorksheetInfoPromise = sheetAjax.getWorksheetInfo;
  }

  return getWorksheetInfoPromise(args);
}

export default function generateStore(
  control,
  {
    from,
    relationWorksheetId,
    controls,
    searchConfig,
    masterData,
    recordId,
    instanceId,
    workId,
    initRowIsCreate,
    DataFormat,
  } = {},
) {
  let worksheetInfo;

  const logger = () => next => action => {
    const emptyCount = Number(get(control, 'advancedSetting.blankrow'));
    action.emptyCount = isNumber(emptyCount) && !isNaN(emptyCount) ? emptyCount : 1;
    return next(action);
  };

  const worksheetId = control.dataSource;

  // 原来这里手工探测并挂 window.__REDUX_DEVTOOLS_EXTENSION__，configureStore 默认
  // devTools: true 已经做了同一件事（且只在非 production 生效），所以那段删掉了。
  // thunk 也由默认中间件提供，只需把自定义的 logger 追加上去。
  const store = configureStore({
    reducer,
    // base / lastAction 这两片整体豁免两个 dev 检查（豁免理由见下），其余 slice
    // （rows / originRows / changes / treeTableViewData…）仍然受保护 —— 真正会藏 bug 的是那几片。
    // lastAction 必须一起豁免：它的 reducer 是 `(state, action) => action`，
    // 把【整个 action 原样存进 state】，于是 UPDATE_BASE 的 payload 又从
    // lastAction.value.control 这条路进来一次。只豁免 base 的话报错只会换个路径继续崩。
    //
    // 【为什么必须豁免：dev 下打开带子表的记录会直接崩】
    // base 存的是构造期从表单层接过来的【活对象】，不是数据快照：base.control 是父表单
    // 的控件实例，而 DataFormat 会把子表自己的 store 挂回控件上（DataFormat.ts:184
    // item.store = this.getControlStore(item)），ChildTable 又把 React 组件实例挂到
    // store 上（ChildTable/index.tsx:101 this.store.ref = ref）。于是：
    //     state.base.control.store.ref → React 实例 → props.store → 同一个 store → …
    // 一个长度 3 的环。immutableCheck 的 trackProperties 是深度优先递归，撞上环就是
    // RangeError: Maximum call stack size exceeded，ChildTable 被 ErrorBoundary 接住，
    // 表现为「记录能打开一瞬间随后弹程序错误」。
    //
    // 【别指望 RTK 自己的环检测】trackProperties 签名里确实有个 checkedObjects Set
    // 看着像防环，但它是默认参数、递归调用处又没把它传下去（@reduxjs/toolkit 2.12.0
    // dist/redux-toolkit.modern.mjs:175-199），每层递归都新建一个空 Set —— 等于没有。
    // 所以不要因为「RTK 有防环」就以为这里只是噪音。
    //
    // serializableCheck 不会崩，但会被 base.control.refreshRecord 这类函数刷屏，
    // 每次 dispatch 一条，把控制台里真正的报错淹掉；UPDATE_BASE 这个 action 的
    // payload 就是 base 本身，所以按 action 名一并豁免。
    //
    // 这不是 antd 6 带来的，是本仓 redux 3 → RTK 迁移的后果：createStore 没有这两个
    // 中间件，所以旧版一直相安无事。两个检查都只在非 production 生效，线上不受影响。
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: { ignoredActions: ['UPDATE_BASE'], ignoredPaths: ['base', 'lastAction'] },
        immutableCheck: { ignoredPaths: ['base', 'lastAction'] },
      }).concat(logger),
  });
  store.name = Math.floor(Math.random() * 1000);
  async function init({ noMountInit = false } = {}) {
    if (store.initialized) return;
    if (isFunction(store.setLoadingInfo)) {
      store.setLoadingInfo('store_' + control.controlId, true);
    }

    if (
      !noMountInit &&
      isFunction(store.setLoadingInfo) &&
      ((recordId && instanceId && workId) || get(window, 'shareState.isPublicWorkflowRecord'))
    ) {
      store.setLoadingInfo('loadRows_' + control.controlId, true);
    }

    store.initialized = true;
    try {
      let { max, treeLayerControlId } = parseAdvancedSetting(control.advancedSetting);

      if (!controls) {
        worksheetInfo = await loadWorksheetInfo(worksheetId, {
          relationWorksheetId,
          controlId: control.controlId,
          recordId,
          instanceId,
          workId,
        });
        // await new Promise(resolve => setTimeout(resolve, 5000)); // TEST: 测试子表未加载完成时的提交问题
        controls = get(worksheetInfo, 'template.controls');
        controls = handleUpdateDefsourceOfControl({
          recordId,
          relateRecordControl: { ...control, worksheetId: relationWorksheetId },
          masterData,
          controls,
        });
      }

      if (!searchConfig) {
        const queryRes = await sheetAjax.getQueryBySheetId({ worksheetId });
        searchConfig = formatSearchConfigs(queryRes).filter(i => i.eventType !== 1);
      }

      const { uniqueControlIds } = parseAdvancedSetting(control.advancedSetting);
      controls = controls.map(c => ({
        ...c,
        uniqueInRecord: includes(uniqueControlIds, c.controlId) && canAsUniqueWidget(c),
      }));
      const isWorkflow =
        ((instanceId && workId) || window.shareState.isPublicWorkflowRecord) &&
        worksheetInfo.workflowChildTableSwitch !== false;

      if (isWorkflow && isFunction(control.updateRelationControls)) {
        control.updateRelationControls(control.controlId, controls);
      }

      const treeLayerControl = find(controls, { controlId: treeLayerControlId });
      store.dispatch({
        type: 'UPDATE_BASE',
        value: {
          from,
          control,
          max,
          searchConfig,
          controls,
          masterData,
          recordId,
          instanceId,
          workId,
          worksheetInfo,
          initRowIsCreate,
          discussId: control.discussId,
          isTreeTableView:
            treeLayerControl &&
            treeLayerControl.type === 29 &&
            !isRelateRecordTableControl(treeLayerControl) &&
            !!treeLayerControlId,
          originControls: controls,
        },
      });
      store.dispatch({ type: 'UPDATE_BASE_LOADING', value: false });
      if (typeof control.value === 'string' && !isEmpty(safeParse(control.value))) {
        const params = {
          recordId,
          masterData,
          staticRows: safeParse(control.value),
        };
        setRowsFromStaticRows(params)(store.getState, store.dispatch, DataFormat);
      }

      if (!isEmpty(store.waitList)) {
        store.waitList.forEach(fn => fn());
        store.waitList = [];
      }
    } catch (err) {
      // init 失败后 loadRows 不会再发起，需清掉上面打的 loadRows_ 标记，否则保存被永久挂起
      if (isFunction(store.setLoadingInfo)) {
        store.setLoadingInfo('loadRows_' + control.controlId, false);
      }

      throw err;
    } finally {
      if (isFunction(store.setLoadingInfo)) {
        store.setLoadingInfo('store_' + control.controlId, false);
      }
    }
  }

  store.init = init;
  store.waitList = [];
  store.waitListForLoadRows = [];
  store.reset = () => {
    // 保存成功后大表单会调用 reset 清理脏态(changes/errors)，但并不会重新拉取 rows，
    // 此时 state.rows 仍是筛选后的子集。RESET 会顺带清空 filterControls / realCount，
    // 造成"数据仍是筛选结果、筛选器指示却消失"的状态错位，并让筛选态判空必填回退失真。
    // 故 RESET 后回填当前筛选条件与未筛选真实总数，使筛选视图前后保持一致。
    const { filterControls, realCount, treeTableViewData } = store.getState();
    store.dispatch({ type: 'RESET' });
    if (!isEmpty(filterControls)) {
      store.dispatch({ type: 'UPDATE_FILTER_CONTROLS', filterControls });
      if (isNumber(realCount)) {
        store.dispatch({ type: 'SET_REAL_COUNT', value: realCount });
      }
    }

    // RESET 会清空树形 treeMap 但 rows 并未重置（RESET 不在 rows 处理列表，引用不变），
    // 组件自愈按 rows 引用去重会拒绝重建，导致保存后展开 icon 消失且只能手动刷新恢复。
    // 这里按当前 rows 立即重建，并复用清空前的 treeMap 保留用户已展开的层级。
    store.dispatch(updateTreeTableViewData({ prevTreeMap: get(treeTableViewData, 'treeMap') }));

    store.dispatch({
      type: 'UPDATE_CELL_ERRORS',
      value: {},
    });
  };

  store.resetRows = () => {
    store.dispatch(resetRows());
  };

  store.setEmpty = () => {
    store.dispatch(clearRows());
    store.dispatch({
      type: 'UPDATE_CELL_ERRORS',
      value: {},
    });
  };

  store.cancelChange = () => {
    store.dispatch(resetRows());
    store.dispatch({
      type: 'UPDATE_CELL_ERRORS',
      value: {},
    });
  };

  store.resetRows = () => {
    store.dispatch(resetRows());
  };

  store.clearSubListErrors = () => {
    store.dispatch({
      type: 'UPDATE_CELL_ERRORS',
      value: {},
    });
  };

  store.initAndLoadRows = async ({ worksheetId, recordId, controlId } = {}) => {
    await store.init();
    const state = store.getState();
    const { base = {} } = state;

    // 预取路径（编辑记录/草稿的校验前置加载）打上行加载标记，让大表单保存挂起等待行数据返回，
    // 否则 rows 未加载完时保存，行内必填校验对空 rows 空转放过
    if (isFunction(store.setLoadingInfo)) {
      store.setLoadingInfo('loadRows_' + controlId, true);
    }

    store.dispatch(
      loadRows({
        worksheetId,
        recordId,
        controlId,
        from: get(base, 'from'),
        // 与组件内 ChildTable.loadRows 同口径传入：loadRows 只认参数不读 base，
        // 漏传时预加载（必填子表/草稿箱）只落 rows 不建树，树形展示全靠组件自愈兜底
        isTreeTableView: get(base, 'isTreeTableView'),
        setLoadingInfo: store.setLoadingInfo,
      }),
    );
  };

  store.setUniqueError = ({ badData = [] } = {}) => {
    const { controlId, error } = getSubListUniqueError({ store, badData, control });
    if (controlId !== control.controlId) return;
    if (!isEmpty(error)) {
      store.dispatch({
        type: 'UPDATE_CELL_ERRORS',
        value: error,
      });
    }
  };

  return store;
}
