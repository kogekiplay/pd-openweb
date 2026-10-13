const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const { transformSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
global._l = (text: string) => text;
const root = path.resolve(__dirname, '../../../..');
function load(relative: string, imports: Record<string, unknown>, source?: string) {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const code = transformSync(source ?? fs.readFileSync(path.join(root, relative), 'utf8'), {
    filename: path.join(root, relative),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', code)(output, output.exports, (name: string) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error('Unstubbed ' + name);
  });
  return output.exports;
}
function invoke(exports: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
  const fn = exports[name];
  if (typeof fn !== 'function') throw new Error('Missing ' + name);
  return Reflect.apply(fn, undefined, args);
}
const common = load('src/utils/controlCommon.ts', {
  'immutability-helper': require('immutability-helper'),
  lodash,
  moment: require('moment'),
  'src/components/Form/core/enum': { HAVE_VALUE_STYLE_WIDGET: [] },
  './advancedSettingBoundary': load('src/utils/advancedSettingBoundary.ts', {}),
});
const boundaryPath = 'src/pages/widgetConfig/util/advancedSettingBoundary.ts';
const boundary = load(boundaryPath, { 'src/utils/controlCommon': common });
const rawWidthMap = { fieldB: 265.1666717529297, fieldA: 163 };
const control = { advancedSetting: { widths: JSON.stringify(rawWidthMap) } };
assert.deepEqual(invoke(boundary, 'getWidgetAdvanceSetting', control, 'widths'), rawWidthMap);
assert.strictEqual(
  invoke(boundary, 'getWidgetAdvanceSetting', { advancedSetting: { widths: rawWidthMap } }, 'widths'),
  rawWidthMap,
);
assert.deepEqual(
  invoke(boundary, 'getWidgetDisplayWidths', control, ['fieldA', 'missing', 'fieldB']),
  [163, 160, 265.1666717529297],
);
for (const [widths, expected] of [
  ['[80,240]', [80, 240]],
  ['[80]', [80, 160]],
  ['[80,240,999]', [80, 240]],
  ['{"fieldA":"85","fieldB":240}', [85, 240]],
  ['{}', [160, 160]],
  ['[]', [160, 160]],
  ['{"fieldA":null,"fieldB":240}', [160, 240]],
  ['["wrong",240]', [160, 240]],
  ['[0,-1]', [160, 160]],
  ['{"fieldA":{},"fieldB":240}', [160, 240]],
  ['null', [160, 160]],
  ['true', [160, 160]],
  ['"wrong"', [160, 160]],
] as const) {
  assert.deepEqual(
    invoke(boundary, 'getWidgetDisplayWidths', { advancedSetting: { widths } }, ['fieldA', 'fieldB']),
    expected,
    widths,
  );
}
assert.deepEqual(invoke(boundary, 'getWidgetDisplayWidths', undefined, ['fieldA', 'fieldB']), [160, 160]);
assert.deepEqual(
  invoke(boundary, 'getWidgetDisplayWidths', { advancedSetting: { widths: '{}' } }, ['constructor', '__proto__']),
  [160, 160],
);
assert.equal(
  control.advancedSetting.widths,
  JSON.stringify(rawWidthMap),
  'Reading widths must not rewrite persisted settings',
);

// The previous boundary rejects the persisted map before any preview can render.
const before = process.env['WIDGET_WIDTHS_BEFORE_REV'];
if (before) {
  const old = load(
    boundaryPath,
    { 'src/utils/controlCommon': common },
    cp.execFileSync('git', ['show', before + ':' + boundaryPath], { cwd: root, encoding: 'utf8' }),
  );
  assert.throws(() => invoke(old, 'getWidgetAdvanceSetting', control, 'widths'), /Invalid widget setting list/);
}

// Render the actual three preview components with real React. Only layout shells and external requests are stubbed.
const settingSource = fs.readFileSync(path.join(root, 'src/pages/widgetConfig/util/setting.ts'), 'utf8');
const showControlsSource = settingSource.slice(
  settingSource.indexOf('export const getShowControls ='),
  settingSource.indexOf('export const getDefaultOptions ='),
);
const controlsModule = load(
  'src/pages/widgetConfig/util/setting.ts',
  { lodash },
  'import _ from "lodash"; const isEmpty = _.isEmpty; const SYSTEM_CONTROLS = [];\n' + showControlsSource,
);
const settings = {
  getAdvanceSetting: boundary['getWidgetAdvanceSetting'],
  getShowControls: controlsModule['getShowControls'],
};
const PreviewShell = ({ children }: { children?: import('react').ReactNode }) =>
  React.createElement('div', null, children);
const imports = {
  react: React,
  'react/jsx-runtime': require('react/jsx-runtime'),
  lodash,
  'src/api/worksheet': {
    getWorksheetInfo: () => {
      throw new Error('Unexpected request in editor preview');
    },
  },
  'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/config.js': { SYSTEM_FIELD_TO_TEXT: {} },
  '../../config/widget': { SYSTEM_CONTROL: [] },
  '../../styled': { CommonDisplay: PreviewShell, EditModelWrap: PreviewShell, EmptySheetPlaceHolder: PreviewShell },
  '../../util': { isSheetDisplay: () => true },
  '../../util/setting': settings,
  '../../util/advancedSettingBoundary': boundary,
};
const relationControls = [
  { controlId: 'fieldA', controlName: 'Alpha', type: 2 },
  { controlId: 'fieldB', controlName: 'Beta', type: 2 },
];
for (const name of ['sub_list', 'relate_sheet', 'relation_search']) {
  const mod = load('src/pages/widgetConfig/widgetDisplay/displayTypes/' + name + '.tsx', imports);
  const fn = mod['default'];
  if (typeof fn !== 'function') throw new Error('Missing preview ' + name);
  const Preview = (props: { data: unknown; fromType: string }): import('react').ReactNode =>
    Reflect.apply(fn, undefined, [props]);
  for (const [widths, expected] of [
    ['{"fieldA":163,"fieldB":"85"}', ['163px', '85px', '248px']],
    ['[80,240]', ['80px', '240px', '320px']],
    ['{"fieldA":null,"fieldB":240}', ['160px', '240px', '400px']],
  ] as const) {
    const html = renderToStaticMarkup(
      React.createElement(Preview, {
        fromType: 'editor',
        data: {
          type: 34,
          enumDefault: 2,
          relationControls,
          showControls: ['fieldB', 'deleted', 'fieldA'],
          advancedSetting: { widths },
        },
      }),
    );
    for (const width of expected) assert.ok(html.includes('width:' + width), name + ' ' + width + ' ' + html);
    assert.ok(html.indexOf('Beta') < html.indexOf('Alpha'), name + ' follows visible field order');
  }
}
const fixtureDir = process.env['WIDGET_WIDTHS_FIXTURE_DIR'];
if (fixtureDir) {
  const fixture: unknown = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'widths.json'), 'utf8'));
  const items: unknown = fixture !== null && typeof fixture === 'object' ? Reflect.get(fixture, 'out') : undefined;
  assert.ok(Array.isArray(items));
  let count = 0;
  for (const item of items) {
    if (item === null || typeof item !== 'object') throw new Error('Invalid fixture');
    const value: unknown = Reflect.get(item, 'widths');
    if (typeof value !== 'string') throw new Error('Missing captured widths');
    const raw: unknown = JSON.parse(value);
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected captured ID map');
    assert.deepEqual(
      invoke(boundary, 'getWidgetAdvanceSetting', { advancedSetting: { widths: value } }, 'widths'),
      raw,
    );
    if (before) {
      const old = load(
        boundaryPath,
        { 'src/utils/controlCommon': common },
        cp.execFileSync('git', ['show', before + ':' + boundaryPath], { cwd: root, encoding: 'utf8' }),
      );
      assert.throws(
        () => invoke(old, 'getWidgetAdvanceSetting', { advancedSetting: { widths: value } }, 'widths'),
        /Invalid widget setting list/,
      );
    }
    count++;
  }
  console.log('Captured production width maps verified:', count);
}
console.log('widget widths maps, legacy arrays, fallbacks, source immutability and three real previews passed');
