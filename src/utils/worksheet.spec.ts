const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');

function requireEsm(file, stubs = {}) {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const module: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function localRequire(request) {
    if (stubs[request]) {
      return stubs[request];
    }

    return require(request);
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire);
  return module.exports;
}

function createStorage(initialData = {}) {
  const store = { ...initialData };

  return {
    getItem: key => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: key => {
      delete store[key];
    },
    getStore: () => store,
  };
}

function setStorage(storage) {
  Object.defineProperty(global, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  global.safeLocalStorageSetItem = (...args) => global.localStorage.setItem(...args);
}

global.md = { global: { Account: { accountId: 'account-1', isPortal: false } } };
global.safeParse =
  global.safeParse ||
  ((value, defaultValue = {}) => {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue === 'array' ? [] : defaultValue;
    }
  });

const { moveSheetCache, saveSelectExtensionNavType, getSheetStylesOfRelateRecordTable } = requireEsm('./worksheet.js', {
  'src/pages/FormSet/config.js': {
    permitList: {},
  },
  'src/pages/FormSet/util.js': {
    isOpenPermit: () => true,
  },
  'src/pages/widgetConfig/config/widget': {
    WIDGETS_TO_API_TYPE_ENUM: {},
  },
  'src/pages/worksheet/common/ViewConfig/config': {
    CARD_WIDTH_SETTING: {},
  },
  'src/pages/worksheet/common/ViewConfig/utils': {
    getCoverStyle: () => ({}),
  },
});

setStorage(createStorage());

assert.doesNotThrow(() => moveSheetCache('app-1', 'group-1'));

setStorage(
  createStorage({
    'mdAppCache_account-1_app-1': JSON.stringify({
      lastWorksheetId: 'worksheet-1',
      worksheets: [
        { groupId: 'group-1', worksheetId: 'worksheet-1' },
        { groupId: 'group-2', worksheetId: 'worksheet-2' },
      ],
    }),
  }),
);

moveSheetCache('app-1', 'group-1');
assert.deepStrictEqual(JSON.parse(localStorage.getItem('mdAppCache_account-1_app-1')).worksheets, [
  { groupId: 'group-1', worksheetId: '' },
  { groupId: 'group-2', worksheetId: 'worksheet-2' },
]);

setStorage(createStorage({ sheetConfigNavInfo: '{bad json' }));
assert.doesNotThrow(() => saveSelectExtensionNavType('worksheet-1', 'type', 'value'));
assert.deepStrictEqual(JSON.parse(localStorage.getItem('sheetConfigNavInfo')), {
  'worksheet-1': {
    type: 'value',
  },
});

console.log('worksheet utils tests passed');

// 7.5.0：显式选择的树形表格样式优先于较新的管理视图；关闭继承时只用字段列宽。
const tableStyle = (time: number, width: number) => ({
  liststyle: JSON.stringify({ time, styles: [{ cid: 'field', width }] }),
});
const worksheetInfo = {
  advancedSetting: tableStyle(3, 300),
  views: [{ viewId: 'tree', viewType: 2, advancedSetting: { ...tableStyle(1, 100), hierarchyViewType: '3' } }],
};
const inherited = getSheetStylesOfRelateRecordTable({
  control: { advancedSetting: { usecolumnstyle: '1' } },
  viewId: 'tree',
  worksheetInfo,
  manageView: { advancedSetting: tableStyle(5, 500) },
});
assert.strictEqual(inherited.sheetColumnWidths.field, 100);
const fieldOnly = getSheetStylesOfRelateRecordTable({
  control: { advancedSetting: { widths: '[80]' }, showControls: ['field'] },
  viewId: 'tree',
  worksheetInfo,
});
assert.deepStrictEqual(fieldOnly, { columnStyles: {}, sheetColumnWidths: { field: 80 } });
