const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parser, transformSync } = require('../../../../scripts/spec-harness.ts');
const traverse = require('@babel/traverse').default;
const generateCode = require('@babel/generator').default;
const React = require('react');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../../../..');
const revision = 'fc6676e67df423dbee2565791b9ee3f0a5ca8e11';
const { isLeftAppNavigation } = require('../../../utils/appNavigation.ts');
global._l = (text: string) => text;
global.localStorage = { getItem: () => 'null' };

function source(file: string, before = false): string {
  return before
    ? execFileSync('git', ['show', revision + ':' + file], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}

function expressions(file: string, before: boolean) {
  const result: string[] = [];
  const tree = parser.parse(source(file, before), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  traverse(tree, {
    CallExpression(entry) {
      const node = entry.node;
      const code = generateCode(node).code;
      const isNew = node.callee.type === 'Identifier' && node.callee.name === 'isLeftAppNavigation';
      const isOld =
        node.callee.type === 'MemberExpression' &&
        node.callee.property.name === 'includes' &&
        node.callee.object.type === 'ArrayExpression' &&
        node.callee.object.elements.map(value => value.value).join(',') === '1,3';
      if ((before ? isOld : isNew) && code.includes('currentPcNaviStyle')) result.push(code);
    },
  });
  return result;
}

const values: unknown[] = [undefined, null, 0, 1, 2, 3, 4, -1, NaN, Infinity, '1', '3', '', false, true, {}, [], [1]];
let branches = 0;

for (const file of [
  'src/pages/customPage/ConfigHeader.tsx',
  'src/pages/customPage/pageContent/CustomPageHeader.tsx',
  'src/pages/worksheet/WorkSheet.tsx',
  'src/pages/worksheet/common/WorkSheetLeft/ExternalLink.tsx',
  'src/pages/worksheet/components/selectIconDialog/index.ts',
  'src/pages/worksheet/redux/actions/sheetList.ts',
]) {
  const before = expressions(file, true),
    after = expressions(file, false);
  assert.equal(before.length, after.length, 'all changed navigation sites are compared: ' + file);
  assert.ok(before.length);
  before.forEach((old, index) => {
    const original = new Function('currentPcNaviStyle', 'appPkg', 'state', 'return ' + old);
    const current = new Function(
      'currentPcNaviStyle',
      'appPkg',
      'state',
      'isLeftAppNavigation',
      'return ' + after[index],
    );

    for (const value of values) {
      const appPkg = { currentPcNaviStyle: value };
      assert.equal(current(value, appPkg, { appPkg }, isLeftAppNavigation), original(value, appPkg, { appPkg }));
    }

    branches++;
  });
}

assert.equal(branches, 9);

function declaration(file: string, name: string, before: boolean): string {
  const tree = parser.parse(source(file, before), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let code: string | undefined;
  traverse(tree, {
    VariableDeclarator(entry) {
      if (entry.node.id.name === name) code = generateCode(entry.node.init).code;
    },
  });
  if (!code) throw new Error('Missing declaration ' + name);
  return transformSync('const fixture = ' + code + ';', { filename: 'app-contract.tsx' }).code;
}

for (const [file, name] of [
  ['src/pages/Statistics/components/PageMove/index.tsx', 'formatApps'],
  ['src/pages/worksheet/common/SheetMove/SheetMove.tsx', 'formatApps'],
  ['src/utils/worksheet.ts', 'moveSheetCache'],
  [
    'src/pages/worksheet/components/DialogImportExcelCreate/SetImportExcelCreateWorksheetOrApp/index.tsx',
    'getWorksheetList',
  ],
]) {
  assert.equal(
    declaration(file, name, false),
    declaration(file, name, true),
    'input type changes erase exactly: ' + file,
  );
}

const paletteFile = 'src/pages/customPage/components/ConfigSideWrap/index.tsx';

function palette(before: boolean) {
  const code = declaration(paletteFile, 'lightColor', before);
  return new Function('generate', 'iconColor', code + '\nreturn fixture;');
}

const originalPalette = palette(true),
  currentPalette = palette(false);
const generate = require('@ant-design/colors').generate;

for (const color of [undefined, null, '', '#1677ff', '#abc', '#ABCDEF', 'red', 'rgb(1, 2, 3)', 'hsl(120, 50%, 50%)']) {
  assert.equal(
    currentPalette(generate, color),
    originalPalette(generate, color),
    'real palette library retains default and color semantics',
  );
}

const colorFile = 'src/pages/Statistics/components/ChartStyle/components/Color/BaseColor.tsx';
interface ColorFixture {
  state: Record<string, unknown>;
  setState(value: Record<string, unknown>): void;
  render(): unknown;
  handleChangeType(event: { target: { value: number } }): void;
  renderColorGroup: (...args: unknown[]) => unknown;
  renderBaseColorFooter: () => unknown;
}
const colors = [
  { id: 'palette', colors: ['#111111', '#222222'], themeColors: ['#abcabc'] },
  { id: 'other', colors: ['#333333'], themeColors: [] },
];
let theme: string | undefined;

function loadColor(before: boolean) {
  const target = { exports: {} as Record<string, unknown> };
  const imports: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    antd: { Button: () => null, ConfigProvider: () => null, Modal: () => null, Radio: { Group: () => null } },
    classnames: require('classnames'),
    lodash,
    'ming-ui': { ColorPicker: () => null, Icon: () => null },
    'statistics/Charts/common': { getPorjectChartColors: () => colors, reportTypes: { BarChart: 2 } },
    'statistics/common/reportDataUtils': { getIsAlienationColor: () => false },
    'src/redux/configureStore': { getState: () => ({ appPkg: { iconColor: theme } }) },
    'src/utils/common': { pathCompletion: (url: unknown) => url },
    './BaseColor.less': {},
  };
  const code = transformSync(source(colorFile, before), { filename: path.join(root, colorFile) }).code;
  new Function('module', 'exports', 'require', code)(target, target.exports, (name: string) => {
    if (name in imports) return imports[name];
    throw new Error('Unstubbed color import ' + name);
  });
  return target.exports['default'] as new (props: Record<string, unknown>) => ColorFixture;
}

const OldColor = loadColor(true),
  NewColor = loadColor(false);

function observeColor(Component: ReturnType<typeof loadColor>) {
  const instance = new Component({
    currentReport: { style: { colorType: 1, colorGroupId: 'adaptThemeColor' } },
    visible: true,
  });

  instance.setState = value => {
    instance.state = { ...instance.state, ...value };
  };

  const groups: unknown[][] = [];

  instance.renderColorGroup = (...args: unknown[]) => {
    groups.push(args);
    return null;
  };

  instance.renderBaseColorFooter = () => null;
  instance.render();
  instance.handleChangeType({ target: { value: 2 } });
  return { groups, state: instance.state };
}

for (const value of ['#abcabc', '#ABCABC', '#000000', '']) {
  theme = value;
  assert.deepEqual(
    observeColor(NewColor),
    observeColor(OldColor),
    'normal palette matching and custom-color transition retain behavior',
  );
}

theme = undefined;
assert.throws(() => observeColor(OldColor), /toLocaleUpperCase/);
const unloaded = observeColor(NewColor);
assert.ok(unloaded.groups.length);
assert.equal(
  unloaded.groups.some(args => args[2] === true),
  false,
  'no loaded theme means no matching adaptive palette',
);
assert.equal(unloaded.state['type'], 2);
console.log(
  'App consumers: 162 verbatim navigation checks, 4 exact type-erasure checks, real palette and BaseColor unloaded-theme recovery passed',
);
