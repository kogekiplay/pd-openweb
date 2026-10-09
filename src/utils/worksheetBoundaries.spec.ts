const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');

type Button = { btnId?: string; status?: number; name?: string; icon?: string; extra?: string };
type Print = { id?: string; name?: string; extra?: string };
type View = { viewType?: number; advancedSetting?: Record<string, string> };
type Menu = {
  workSheetId?: string;
  type?: number;
  status?: number;
  navigateHide?: boolean;
  items?: Menu[];
  icon?: string;
};
interface WorksheetUtils {
  findSheet: (id: string, menus: Menu[]) => Menu | null;
  getSheetListFirstId: (menus: Menu[], isCharge?: boolean) => string | null | undefined;
  moveSheetCache: (appId: string, groupId: string) => void;
  saveSelectExtensionNavType: (worksheetId: string, navType: string, value: string) => void;
  getListStyle: (view?: string, worksheet?: string) => unknown;
  getSheetColumnWidthsMap: (view?: View, worksheet?: View) => unknown;
  getCardWidth: (view: View) => number | undefined;
  getSheetOperatesButtons: (view?: View, options?: { buttons?: Button[]; printList?: Print[] }) => unknown;
  getSheetOperatesButtonsStyle: (view?: View) => {
    style: string | undefined;
    showIcon: boolean;
    visibleNum: number;
    primaryNum: number;
  };
  getOperatesButtonsWidth: (options?: {
    buttons?: Button[];
    style?: string;
    visibleNum?: number;
    showIcon?: boolean;
  }) => number;
  getSheetStylesOfRelateRecordTable: (options: {
    control?: { showControls?: string[]; advancedSetting?: Record<string, string> };
    worksheetInfo?: View;
    manageView?: View;
  }) => unknown;
  getGroupControlId: (view?: View) => string | undefined;
}
const storage: Record<string, string> = {};
globalThis.md = { global: { Account: { accountId: 'account', isPortal: false } } };
globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value;
  },
};
globalThis.safeLocalStorageSetItem = (key: string, value: string) => {
  storage[key] = value;
};
globalThis.document = {
  createElement: () => ({
    style: {},
    innerHTML: '',
    get clientWidth() {
      return this.innerHTML.length * 8;
    },
  }),
  body: { appendChild: () => {}, removeChild: () => {} },
};
const stubs: Record<string, unknown> = {
  'src/pages/FormSet/config.js': { permitList: {} },
  'src/pages/FormSet/util.js': { isOpenPermit: () => true },
  'src/pages/widgetConfig/config/widget': { WIDGETS_TO_API_TYPE_ENUM: {} },
  'src/pages/worksheet/common/ViewConfig/config': { CARD_WIDTH_SETTING: { 1: 200, 2: 240, 3: 300, 4: 400 } },
  'src/pages/worksheet/common/ViewConfig/utils': { getCoverStyle: () => ({ coverPosition: '1' }) },
};
const source = process.env.WORKSHEET_BOUNDARY_SOURCE || path.join(__dirname, 'worksheet.ts');
const { code } = transformFileSync(source, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
const moduleLike: { exports: Partial<WorksheetUtils> } = { exports: {} };
new Function('module', 'exports', 'require', 'safeParse', '_l', code)(
  moduleLike,
  moduleLike.exports,
  (name: string) => {
    if (name === 'lodash') return require('lodash');
    if (Object.hasOwn(stubs, name)) return stubs[name];
    throw new Error(`Unexpected worksheet dependency ${name}`);
  },
  (value: unknown, fallback?: string) => {
    if (!value) return fallback === 'array' ? [] : {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      return fallback === 'array' ? [] : {};
    }
  },
  (value: string) => value,
);
const utils = moduleLike.exports as WorksheetUtils;
const style = (time: number | string, width: number) =>
  JSON.stringify({ time, styles: [{ cid: 'field', width, direction: 1, metadata: 'retained' }] });

// Validate the serialized contracts used by reducers, buttons and persisted navigation.
assert.deepEqual(utils.getListStyle(style('10', 10), style('9', 9)), JSON.parse(style('9', 9)));
assert.deepEqual(utils.getListStyle(style(10, 10), style(9, 9)), JSON.parse(style(10, 10)));
assert.deepEqual(utils.getSheetColumnWidthsMap({ advancedSetting: { liststyle: style(10, 10) } }), {
  time: 10,
  map: { field: 10 },
});
assert.deepEqual(utils.getSheetColumnWidthsMap(), {});
assert.equal(utils.getCardWidth({ advancedSetting: { cardwidth: '1' } }), 296);
assert.equal(utils.getCardWidth({ advancedSetting: { cardwidth: '01' } }), 97);
assert.equal(utils.getCardWidth({ advancedSetting: { cardwidth: '280' } }), 280);
const buttons = [
  { btnId: 'active', status: 1, name: 'Run', icon: 'action', extra: 'kept' },
  { btnId: 'disabled', status: 0 },
];
const printList = [{ id: 'template', name: 'Receipt', extra: 'original' }];
const group = { type: 'group', id: 'group1', name: 'Team', btns: ['disabled', 'active', 'missing'] };
const buttonView = {
  advancedSetting: {
    actioncolumn: JSON.stringify([
      { type: 'group', id: 'group1' },
      { type: 'btn', id: 'disabled' },
      { type: 'btn', id: 'active' },
      { type: 'print', id: 'template' },
      { type: 'delete' },
    ]),
    listgroup: JSON.stringify([group]),
  },
};
assert.deepEqual(utils.getSheetOperatesButtons(buttonView, { buttons, printList }), [
  {
    type: 'group_ref',
    btnId: 'group:list:group1',
    id: 'group1',
    source: undefined,
    name: 'Team',
    icon: undefined,
    iconUrl: undefined,
    iconColor: undefined,
    buttons: [{ ...buttons[0], type: 'custom_button' }],
  },
  { ...buttons[0], type: 'custom_button' },
  {
    name: 'Receipt',
    icon: 'print',
    color: 'var(--color-primary)',
    type: 'print',
    btnId: 'template',
    printItem: printList[0],
  },
  { type: 'delete', btnId: 'delete', name: '删除', icon: 'trash', color: '#F44336' },
]);
assert.deepEqual(
  utils.getSheetOperatesButtonsStyle({
    advancedSetting: { acstyle: '{"icon":"1","style":"2","btncount":"4","primarycount":null}' },
  }),
  { showIcon: false, style: 'text', visibleNum: 4, primaryNum: 0 },
);
assert.equal(utils.getOperatesButtonsWidth({ buttons, style: 'standard', visibleNum: 1, showIcon: true }), 122);
const menu = [
  {
    type: 2,
    items: [
      { workSheetId: 'sheet', status: 2, icon: 'grid' },
      { workSheetId: 'visible', status: 4 },
    ],
  },
];
assert.equal(utils.findSheet('sheet', menu), menu[0].items[0]);
assert.equal(utils.getSheetListFirstId(menu, false), 'visible');
const cacheKey = 'mdAppCache_account_app';
storage[cacheKey] = JSON.stringify({
  lastViewId: 'view',
  lastWorksheetId: 'sheet',
  extension: { retained: true },
  worksheets: [
    { groupId: 'group', worksheetId: 'sheet', viewId: 'view', extra: 'kept' },
    { groupId: 'other', worksheetId: 'other' },
  ],
});
utils.moveSheetCache('app', 'group');
assert.deepEqual(JSON.parse(storage[cacheKey]), {
  lastViewId: 'view',
  lastWorksheetId: '',
  extension: { retained: true },
  worksheets: [
    { groupId: 'group', worksheetId: '', viewId: 'view', extra: 'kept' },
    { groupId: 'other', worksheetId: 'other' },
  ],
});
storage['sheetConfigNavInfo'] = JSON.stringify(
  Object.fromEntries(Array.from({ length: 10 }, (_: unknown, i: number) => [`s${i}`, { type: 'old' }])),
);
utils.saveSelectExtensionNavType('new', 'type', 'details');
assert.equal(Object.keys(JSON.parse(storage['sheetConfigNavInfo'])).length, 10);
assert.equal(Object.hasOwn(JSON.parse(storage['sheetConfigNavInfo']), 's0'), false);
assert.deepEqual(
  utils.getSheetStylesOfRelateRecordTable({ control: { advancedSetting: { widths: '{"field":"85"}' } } }),
  { columnStyles: {}, sheetColumnWidths: { field: '85' } },
);
console.log('worksheet normal-input contracts passed');

if (process.env.WORKSHEET_NORMAL_ONLY !== '1') {
  // The old real functions throw on parsed JSON null and non-array values.
  assert.deepEqual(utils.getSheetColumnWidthsMap({ advancedSetting: { liststyle: 'null' } }), {
    time: undefined,
    map: {},
  });
  assert.deepEqual(
    utils.getSheetColumnWidthsMap({
      advancedSetting: { liststyle: '{"time":2,"styles":[null,{"cid":"good","width":80},{"cid":"bad","width":{}}]}' },
    }),
    { time: 2, map: { good: 80 } },
  );
  assert.deepEqual(utils.getSheetOperatesButtons({ advancedSetting: { actioncolumn: 'null' } }), []);
  assert.deepEqual(utils.getSheetOperatesButtons({ advancedSetting: { actioncolumn: '[null,{"type":"copy"}]' } }), [
    { type: 'copy', btnId: 'copy', name: '复制', icon: 'copy', color: '#1677ff' },
  ]);
  assert.deepEqual(
    utils.getSheetOperatesButtons(
      {
        advancedSetting: {
          actioncolumn: '[{"type":"group","id":"bad"}]',
          listgroup: '[{"type":"group","id":"bad","btns":4}]',
        },
      },
      { buttons },
    ),
    [],
  );
  assert.deepEqual(utils.getSheetOperatesButtonsStyle({ advancedSetting: { acstyle: 'null' } }), {
    showIcon: true,
    style: 'standard',
    visibleNum: 3,
    primaryNum: 1,
  });
  assert.equal(
    utils.getSheetOperatesButtonsStyle({ advancedSetting: { acstyle: '{"style":"constructor"}' } }).style,
    undefined,
  );
  assert.equal(utils.getOperatesButtonsWidth(), 22);
  const damagedStyle = utils.getSheetOperatesButtonsStyle({
    advancedSetting: { acstyle: '{\"btncount\":{\"valueOf\":1,\"toString\":1}}' },
  });
  assert.equal(Number.isNaN(damagedStyle.visibleNum), true);
  const sparse: Menu[] = [];
  sparse.length = 1;
  sparse.push({ workSheetId: 'safe' });
  assert.equal(utils.findSheet('safe', sparse)?.workSheetId, 'safe');
  assert.equal(utils.getSheetListFirstId(sparse), 'safe');
  storage[cacheKey] = 'null';
  utils.moveSheetCache('app', 'group');
  assert.deepEqual(JSON.parse(storage[cacheKey]), { worksheets: [], lastWorksheetId: '' });
  storage[cacheKey] = '{"worksheets":[null,4,{"groupId":"group","worksheetId":"sheet"}],"lastViewId":"retain"}';
  utils.moveSheetCache('app', 'group');
  assert.deepEqual(JSON.parse(storage[cacheKey]), {
    worksheets: [{ groupId: 'group', worksheetId: '' }],
    lastViewId: 'retain',
    lastWorksheetId: '',
  });
  storage['sheetConfigNavInfo'] = 'null';
  utils.saveSelectExtensionNavType('sheet', 'type', 'record');
  assert.deepEqual(JSON.parse(storage['sheetConfigNavInfo']), { sheet: { type: 'record' } });
  storage['sheetConfigNavInfo'] = '{"sheet":"bad","other":{"type":"keep"}}';
  utils.saveSelectExtensionNavType('sheet', 'type', 'record');
  assert.deepEqual(JSON.parse(storage['sheetConfigNavInfo']), { other: { type: 'keep' }, sheet: { type: 'record' } });
  assert.equal(utils.getGroupControlId({ advancedSetting: { groupsetting: '[{"controlId":4}]' } }), undefined);
  assert.deepEqual(
    utils.getSheetStylesOfRelateRecordTable({ control: { advancedSetting: { widths: '{"field":{},"good":90}' } } }),
    { columnStyles: {}, sheetColumnWidths: { good: 90 } },
  );
  console.log('worksheet malformed-input boundaries passed');
}

if (process.env.WORKSHEET_NORMAL_ONLY !== '1') {
  interface Permit {
    type?: number;
    state?: boolean;
    viewIds?: string[];
  }
  interface PermitUtils {
    isOpenPermit: (type: number, permits?: Permit[], viewId?: string) => boolean | undefined;
    formatSwitches: (permits?: Permit[]) => Permit[];
  }
  const permitModule: { exports: Partial<PermitUtils> } = { exports: {} };
  const permitSource = process.env.WORKSHEET_PERMIT_SOURCE || path.join(__dirname, '../pages/FormSet/util.ts');
  const permitCode = transformFileSync(permitSource, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', permitCode)(permitModule, permitModule.exports, (name: string) => {
    if (name === 'lodash') return require('lodash');
    if (name === 'src/pages/FormSet/containers/FunctionalSwitch/config.js') return { allSwitchKeys: [1, 21, 22] };
    throw new Error(`Unexpected permit dependency ${name}`);
  });
  const permitUtils = permitModule.exports as PermitUtils;
  assert.equal(permitUtils.isOpenPermit(21, [{ type: 21, state: true, viewIds: [] }], 'view'), true);
  assert.equal(permitUtils.isOpenPermit(21, [{ type: 21, state: true, viewIds: ['other'] }], 'view'), false);
  assert.equal(permitUtils.isOpenPermit(21, [{ type: 21, state: true }]), true);
  assert.equal(permitUtils.isOpenPermit(1, [{ type: 1, state: true }], 'view'), true);
  assert.equal(permitUtils.isOpenPermit(21, []), false);
  assert.equal(permitUtils.isOpenPermit(21, [{ type: 21, state: true }], 'view'), false);
  assert.equal(permitUtils.isOpenPermit(22, [{ type: 21, state: false }], 'view'), true);
  console.log('worksheet permit scopes passed');

  // Exercise the real reset thunk with the real worksheet utility, rather than a getter imitation.
  type Action = { type: string; [key: string]: unknown };
  type Thunk = (dispatch: (action: Action | Thunk) => unknown, getState: () => Record<string, unknown>) => unknown;
  interface LayoutActions {
    resetSheetLayout: () => Thunk;
    setColumnStyles: (view: View, worksheet: View) => Thunk;
  }
  let localColumnStyle = '{}';
  const layoutStubs: Record<string, unknown> = {
    'src/api/worksheet': { __esModule: true, default: {} },
    'worksheet/api': {},
    'worksheet/common/TreeTableHelper': {},
    'worksheet/common/TreeTableHelper/index.js': {},
    'src/components/Form/core/formUtils': { getRuleErrorInfo: () => [] },
    'src/pages/widgetConfig/config/widget': {
      SYSTEM_CONTROL_WITH_UAID: [],
      WORKFLOW_SYSTEM_CONTROL: [],
      WIDGETS_TO_API_TYPE_ENUM: {},
    },
    'src/utils/common': {
      getLRUWorksheetConfig: () => localColumnStyle,
      saveLRUWorksheetConfig: () => {},
      clearLRUWorksheetConfig: () => {},
    },
    'src/utils/filter': {},
    'src/utils/record': {},
    'src/utils/translate': {},
    'src/utils/worksheet': utils,
    './navFilter.js': {},
    './util.js': {},
  };
  const layoutModule: { exports: Partial<LayoutActions> } = { exports: {} };
  const layoutSource =
    process.env.WORKSHEET_LAYOUT_SOURCE || path.join(__dirname, '../pages/worksheet/redux/actions/sheetview.ts');
  const layoutCode = transformFileSync(layoutSource, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  new Function('module', 'exports', 'require', layoutCode)(layoutModule, layoutModule.exports, (name: string) => {
    if (name === 'lodash') return require('lodash');
    if (Object.hasOwn(layoutStubs, name)) return layoutStubs[name];
    throw new Error(`Unexpected layout dependency ${name}`);
  });
  const layoutActions = layoutModule.exports as LayoutActions;
  const dispatched: Action[] = [];
  const layoutState = () => ({
    sheet: {
      base: { worksheetId: 'worksheet', viewId: 'view' },
      views: [{ viewId: 'view', viewType: 0 }],
      worksheetInfo: {},
    },
  });
  const dispatch = (action: Action | Thunk): unknown => {
    if (typeof action === 'function') return action(dispatch, layoutState);
    dispatched.push(action);
    return action;
  };
  dispatch(layoutActions.resetSheetLayout());
  const widths = dispatched.filter(action => action.type === 'WORKSHEET_SHEETVIEW_INIT_COLUMN_WIDTH');
  assert.ok(widths.length >= 1);
  assert.deepEqual(widths[0].value, {});
  console.log('worksheet real resetSheetLayout missing-config passed');

  // Use the real style thunk for numeric and legacy numeric-string timestamps.
  for (const configTime of [10, '10']) {
    for (const localTime of [9, 11]) {
      localColumnStyle = JSON.stringify({ time: localTime, styles: { field: { cid: 'field', width: 200 } } });
      dispatched.length = 0;
      dispatch(layoutActions.setColumnStyles({ advancedSetting: { liststyle: style(configTime, 100) } }, {}));
      const widthAction = dispatched.find(action => action.type === 'WORKSHEET_SHEETVIEW_INIT_COLUMN_WIDTH');
      assert.deepEqual(widthAction?.value, { field: localTime > Number(configTime) ? 200 : 100 });
    }
  }
  console.log('worksheet real setColumnStyles numeric timestamp parity passed');
}
