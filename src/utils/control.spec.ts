const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');

const WIDGETS_TO_API_TYPE_ENUM = {
  TEXT: 2,
  MOBILE_PHONE: 3,
  TELEPHONE: 4,
  EMAIL: 5,
  NUMBER: 6,
  CRED: 7,
  MONEY: 8,
  FLAT_MENU: 9,
  MULTI_SELECT: 10,
  DROP_DOWN: 11,
  ATTACHMENT: 14,
  DATE: 15,
  DATE_TIME: 16,
  AREA_PROVINCE: 19,
  AREA_CITY: 23,
  AREA_COUNTY: 24,
  SPLIT_LINE: 22,
  SECTION: 52,
  USER_PICKER: 26,
  DEPARTMENT: 27,
  SCORE: 28,
  RELATE_SHEET: 29,
  SHEET_FIELD: 30,
  FORMULA_NUMBER: 31,
  AUTO_ID: 33,
  SUB_LIST: 34,
  CASCADER: 35,
  SWITCH: 36,
  LOCATION: 40,
  RICH_TEXT: 41,
  SIGNATURE: 42,
  TIME: 46,
  ORG_ROLE: 48,
  SEARCH: 50,
};

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

global._l = global._l || (text => text);
global.window = {
  platformENV: {
    isLocal: true,
    isOverseas: false,
  },
};
global.md = {
  global: {
    FileStoreConfig: {
      documentHost: 'https://files.example.com/storage',
      pictureHost: 'https://images.example.com/storage',
    },
  },
};

global.safeParse =
  global.safeParse ||
  ((value, defaultValue = {}) => {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue === 'array' ? [] : defaultValue;
    }
  });

const RELATE_RECORD_SHOW_TYPE = { CARD: 1, LIST: 2, DROPDOWN: 3, TABLE: 5, TAB_TABLE: 6 };

const {
  convertAiRecommendControlToControlData,
  convertControlTypeToAiRecommendControlType,
  formatAttachmentValue,
  formatControlValue,
  getControlsSorts,
  renderText,
  toFixed,
  updateOptionsOfControl,
} = requireEsm('./control.js', {
  'copy-to-clipboard': () => {},
  'worksheet/constants/enum': {
    CONTROL_EDITABLE_WHITELIST: {},
    RELATE_RECORD_SHOW_TYPE,
    RELATION_SEARCH_SHOW_TYPE: {},
    SYSTEM_CONTROLS: [],
  },
  'src/components/Form/core/config': {
    FROM: {},
  },
  'src/components/Form/core/enum': {
    DEFAULT_TEXT: {},
    enumWidgetType: [],
    HAVE_VALUE_STYLE_WIDGET: [],
    WIDGETS_TO_API_TYPE_ENUM,
  },
  'src/pages/widgetConfig/config': {
    OPTION_COLORS_LIST: [],
  },
  'src/pages/widgetConfig/config/setting': {
    TITLE_SIZE_OPTIONS: [],
    UNIT_TO_TEXT: {},
    UNIT_TYPE: [],
  },
  'src/pages/widgetConfig/config/widget': {
    DEFAULT_DATA: {},
    SYSTEM_CONTROL_WITH_UAID: [],
    WIDGETS_TO_API_TYPE_ENUM,
    WORKFLOW_SYSTEM_CONTROL: [],
  },
  'src/pages/widgetConfig/util': {
    enumWidgetType: [],
    isSheetDisplay: () => false,
  },
  'src/pages/widgetConfig/util/setting': {
    canSetWidgetStyle: () => false,
    getDateToEn: value => value,
    getShowFormat: () => '',
    getTitleStyle: () => ({}),
  },
  'src/utils/controlCommon': {
    canSetWidgetStyle: () => false,
    dealMaskValue: value => value,
    getAdvanceSetting: () => ({}),
    getDateToEn: value => value,
    getShowFormat: () => '',
    getTitleStyle: () => ({}),
    handleAdvancedSettingChange: data => data,
    isSheetDisplay: () => false,
  },
  'src/pages/worksheet/components/CellControls/enum': {
    RELATION_TYPE_NAME: {},
  },
  'src/utils/common': {
    accMul: (a, b) => a * b,
    browserIsMobile: () => false,
    countChar: str => String(str || '').length,
    domFilterHtmlScript: value => value,
    getTemporaryAttachmentFromUrl: value => value,
  },
  'src/utils/expression': {
    __esModule: true,
    default: {
      fileIsPicture: () => false,
    },
  },
  'src/utils/project': {
    dateConvertToUserZone: value => value,
    dateServerZoneToAppZone: value => value,
    getTimeZone: () => ({ serverZone: 480, userZone: 480 }),
  },
});

assert.deepStrictEqual(getControlsSorts([{ controlId: 'a' }, {}, { data: { controlId: 'b' } }, { data: {} }, null]), [
  'a',
  'b',
]);

assert.deepStrictEqual(getControlsSorts([{ controlId: 'a' }, {}, { data: { controlId: 'b' } }], ['b', 'missing']), [
  'b',
  'a',
]);

assert.strictEqual(toFixed(1.005, 2), '1.01');
assert.strictEqual(toFixed(-1.005, 2), '-1.01');
assert.strictEqual(toFixed(1, 2), '1.00');

assert.deepStrictEqual(JSON.parse(formatAttachmentValue('{bad json')).attachments, []);

assert.doesNotThrow(() => {
  const value = JSON.stringify([
    {
      ext: '.txt',
      fileID: 'file-1',
      fileUrl: 'https://files.example.com/storage/docs/readme.txt',
      filesize: 12,
      originalFilename: 'readme',
      previewUrl: 'https://files.example.com/storage/docs/readme.txt',
    },
  ]);
  const result = JSON.parse(formatAttachmentValue(value, true));
  assert.strictEqual(result.attachments[0].url, 'https://files.example.com/storage/docs/readme.txt');
});

// 【ext 缺失时 filePath 必须仍然被剥掉】2026-09-18 修的一个静默 bug：
// 原先拼的是 fileName + item.ext，ext 是 undefined 时得到 "readme undefined" 这种串，
// 在 pathname 里永远匹配不上，于是 filePath 把文件名整个留着（应当只剩目录）。
assert.doesNotThrow(() => {
  const value = JSON.stringify([
    {
      fileID: 'file-2',
      fileUrl: 'https://files.example.com/storage/docs/readme',
      filesize: 12,
      originalFilename: 'readme',
    },
  ]);
  const result = JSON.parse(formatAttachmentValue(value));
  assert.strictEqual(result.attachments[0].filePath, 'storage/docs/', '缺 ext 时 filePath 应当只剩目录');
  assert.strictEqual(result.attachments[0].fileName, 'readme');
});

assert.doesNotThrow(() => {
  const control = updateOptionsOfControl({ options: [] }, '["add_custom"]', '{bad json');
  assert.deepStrictEqual(control.options, [
    {
      index: 1,
      isDeleted: false,
      key: undefined,
      color: '#1677ff',
      value: 'custom',
    },
  ]);
});

// ── AI 推荐字段类型的双向映射 ────────────────────────────────────────
// 这两个函数以前各有一处"永远走不到的分支"：
//   正向：引用了 WIDGETS_TO_API_TYPE_ENUM 上不存在的成员（LONG_TEXT / AUTOID /
//         FORMULA / RELATE / MULTI_RELATED / RELATED_TABLE / TAB），
//         等于在比较 `type === undefined`，自增ID/公式/关联记录/分割线/标签页一律返回 null；
//   反向：`['text','longText'].includes(type)` 把 longText 提前吞掉，
//         下面给长文本置 enumDefault = 2 的分支永远执行不到。
// 下面这些断言就是用来钉住修好之后的行为的。
assert.strictEqual(convertControlTypeToAiRecommendControlType({ type: 2 }), 'text');
assert.strictEqual(convertControlTypeToAiRecommendControlType({ type: 2, enumDefault: 2 }), 'longText');
assert.strictEqual(convertControlTypeToAiRecommendControlType({ type: 33 }), 'autoid');
assert.strictEqual(convertControlTypeToAiRecommendControlType({ type: 31 }), 'formula');
assert.strictEqual(convertControlTypeToAiRecommendControlType({ type: 22 }), 'section');
assert.strictEqual(convertControlTypeToAiRecommendControlType({ type: 52 }), 'tab');

// 三种关联都是 RELATE_SHEET(29)，只能靠 enumDefault + showtype 区分
assert.strictEqual(convertControlTypeToAiRecommendControlType({ type: 29 }), 'related');
assert.strictEqual(convertControlTypeToAiRecommendControlType({ type: 29, enumDefault: 2 }), 'multiRelated');
assert.strictEqual(
  convertControlTypeToAiRecommendControlType({
    type: 29,
    enumDefault: 2,
    advancedSetting: { showtype: String(RELATE_RECORD_SHOW_TYPE.TAB_TABLE) },
  }),
  'relatedTable',
);

// 不认识的类型仍然返回 null，不要退化成某个具体名字
assert.strictEqual(convertControlTypeToAiRecommendControlType({ type: 99 }), null);
assert.strictEqual(convertControlTypeToAiRecommendControlType(), null);

// 子表：subFields 递归转换。
// 【这条钉的是「不要把函数直接交给 map」】map 会把下标当第二个实参传进去，
// 于是 { worksheetId, allWidgets } 是从一个数字上解构出来的 —— 碰巧不出错，但是巧合。
assert.doesNotThrow(() => {
  const sub = convertAiRecommendControlToControlData({
    type: 'subform',
    name: '明细',
    subFields: [
      { type: 'text', name: '品名', id: 'f1' },
      { type: 'text', name: '数量', id: 'f2' },
    ],
  });
  assert.strictEqual(sub.relationControls.length, 2);
  assert.deepStrictEqual(
    sub.relationControls.map(c => c.controlName),
    ['品名', '数量'],
  );
  // showControls 取的是内层控件的 controlId，不是下标
  assert.deepStrictEqual(sub.showControls, ['f1', 'f2']);
});

// 关联记录：displayField 取 fieldID
assert.deepStrictEqual(
  convertAiRecommendControlToControlData({
    type: 'related',
    name: '关联客户',
    relatedWorksheet: { id: 'ws-1' },
    displayField: [{ fieldID: 'c1' }, { fieldID: 'c2' }],
  }).showControls,
  ['c1', 'c2'],
);
// relatedWorksheet 为 'self' 时用传进来的 worksheetId
assert.strictEqual(
  convertAiRecommendControlToControlData({ type: 'related', relatedWorksheet: 'self' }, { worksheetId: 'ws-self' })
    .dataSource,
  'ws-self',
);

// 反向：长文本必须建成 TEXT + enumDefault 2，而不是单行文本
assert.strictEqual(convertAiRecommendControlToControlData({ type: 'text' }).enumDefault, undefined);
assert.strictEqual(convertAiRecommendControlToControlData({ type: 'longText' }).type, 2);
assert.strictEqual(convertAiRecommendControlToControlData({ type: 'longText' }).enumDefault, 2);

console.log('control utils tests passed');

// ── renderText / formatControlValue 的分支 ────────────────────────────────
//
// 【为什么补这一组】renderText 是全站每个单元格都要过的函数，此前【一条断言都没有】。
// 2026-09-18 把它那十几个 case 里共用的 `let parsedData: any` 拆成逐分支的具名类型时，
// 才发现没有任何东西能证明改动没走样 —— 所以先把行为钉下来。
//
// 【解析失败一律得到空串，但路径有两种】有的分支在 catch 里把 parsedData 兜成 []，
// 有的只写了 value = '' 却仍然往下走、在下一行抛 TypeError，由 renderText 最外层的
// catch 接住返回 ''。两种都得覆盖：它们结果相同但机制不同，改写时最容易碰坏后者。

// 地区：JSON 里取 name
assert.strictEqual(renderText({ type: 19, value: '{"name":"安徽省"}' }), '安徽省');
assert.strictEqual(renderText({ type: 23, value: '{"name":"铜陵市"}' }), '铜陵市');
assert.strictEqual(renderText({ type: 19, value: '{坏 JSON' }), '');

// 时间段：两端各自格式化后用 ' - ' 连接；17 只到日，18 带时分
assert.strictEqual(renderText({ type: 17, value: '["2026-01-02","2026-03-04"]' }), '2026-01-02 - 2026-03-04');
assert.strictEqual(renderText({ type: 17, value: '["2026-01-02",""]' }), '2026-01-02 - ');
assert.strictEqual(renderText({ type: 17, value: '{坏 JSON' }), '');

// 定位：title + 空格 + address；不是对象就空串
assert.strictEqual(renderText({ type: 40, value: '{"title":"公司","address":"铜陵"}' }), '公司 铜陵');
assert.strictEqual(renderText({ type: 40, value: '{"title":"公司"}' }), '公司 ');
assert.strictEqual(renderText({ type: 40, value: '"就是个字符串"' }), '');
assert.strictEqual(renderText({ type: 40, value: '{坏 JSON' }), '');

// 成员：数组和【单个对象】都要收（有接口给的不是数组）
assert.strictEqual(renderText({ type: 26, value: '[{"fullname":"张三"},{"fullname":"李四"}]' }), '张三、李四');
assert.strictEqual(renderText({ type: 26, value: '{"fullname":"张三"}' }), '张三');
assert.strictEqual(renderText({ type: 26, value: '{坏 JSON' }), '');

// 部门：缺 departmentName 时落到「该部门已删除」
assert.strictEqual(renderText({ type: 27, value: '[{"departmentName":"数字化部"}]' }), '数字化部');
assert.strictEqual(renderText({ type: 27, value: '[{}]' }), '该部门已删除');
assert.strictEqual(renderText({ type: 27, value: '{坏 JSON' }), '');

// 附件：originalFilename + ext；两个都缺时是空串而不是 "undefinedundefined"
assert.strictEqual(renderText({ type: 14, value: '[{"originalFilename":"报表","ext":".xlsx"}]' }), '报表.xlsx');
assert.strictEqual(renderText({ type: 14, value: '[{}]' }), '');
assert.strictEqual(renderText({ type: 14, value: '{坏 JSON' }), '');

// 级联：逗号连接，缺 name 落「未命名」；坏 JSON 兜成 [] 而不是抛
assert.strictEqual(renderText({ type: 35, value: '[{"name":"一级"},{"name":"二级"}]' }), '一级,二级');
assert.strictEqual(renderText({ type: 35, value: '[{}]' }), '未命名');
assert.strictEqual(renderText({ type: 35, value: '{坏 JSON' }), '');

// 组织角色：缺 organizeName 时落到「该组织角色已删除」
assert.strictEqual(renderText({ type: 48, value: '[{"organizeName":"超级管理员"}]' }), '超级管理员');
assert.strictEqual(renderText({ type: 48, value: '[{}]' }), '该组织角色已删除');
assert.strictEqual(renderText({ type: 48, value: '{坏 JSON' }), '');

// formatControlValue：同样的值，返回的是【结构】而不是展示文本
assert.strictEqual(formatControlValue({ type: 19, value: '{"name":"安徽省"}' }), '安徽省');
assert.deepStrictEqual(formatControlValue({ type: 26, value: '[{"fullname":"张三"}]' }), ['张三']);
assert.deepStrictEqual(formatControlValue({ type: 26, value: '{"fullname":"张三"}' }), ['张三']);
assert.deepStrictEqual(formatControlValue({ type: 26, value: '["已经是字符串"]' }), ['已经是字符串']);
assert.strictEqual(formatControlValue({ type: 35, value: '[{"name":"一级"}]' }), '一级');
assert.strictEqual(formatControlValue({ type: 35, value: '[]' }), undefined);
assert.deepStrictEqual(formatControlValue({ type: 40, value: '{"title":"公司","address":"铜陵"}' }), {
  title: '公司',
  address: '铜陵',
});
assert.strictEqual(formatControlValue({ type: 40, value: '"就是个字符串"' }), undefined);
// 解析失败走最外层 catch，返回 undefined（不是空串）
assert.strictEqual(formatControlValue({ type: 19, value: '{坏 JSON' }), undefined);

console.log('renderText / formatControlValue 分支断言通过');
