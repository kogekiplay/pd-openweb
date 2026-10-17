/** Real historical helpers, real lodash/moment/React, isolated host/CountDown leaf. No mount or network. */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const crypto: typeof import('node:crypto') = require('node:crypto');
const { execFileSync } = require('node:child_process');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const { transformSync, ROOT } = require('../../../scripts/spec-harness.ts');
const BASE = 'ed8251af3f4e1d2084f32ff22a4992a7b93dc86f';
const REL = 'src/pages/FormExtend/utils.tsx';
const filename = path.join(ROOT, REL);
const baseline = execFileSync('git', ['show', `${BASE}:${REL}`], { cwd: ROOT, encoding: 'utf8' });
assert.equal(
  crypto.createHash('sha256').update(baseline).digest('hex'),
  '7f7716a58d07b4619672a0990d1d2d48ae12d04aacd4cb1ecd89a898391412f6',
);
const current = fs.readFileSync(filename, 'utf8');
const translate = (s: string) => s;
const realReact = require('react');
const realLodash = require('lodash');
const realMoment = require('moment');
// This leaf is never called; only the real helper's returned element/props are checked.
function CountDownLeaf() {
  return null;
}
const parseErrors: string[] = [];

function compile(source: string, file = filename): string {
  return transformSync(source, { filename: file, comments: false, compact: true }).code;
}
function declaration(source: string, name: string): string {
  const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const item = tree.program.body.find(item => {
    const node = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    return (
      node &&
      (node.type === 'FunctionDeclaration'
        ? node.id?.name === name
        : node.type === 'VariableDeclaration' &&
          node.declarations.some(d => d.id.type === 'Identifier' && d.id.name === name))
    );
  });
  assert.ok(item && item.start != null && item.end != null, name);
  return source.slice(item!.start!, item!.end!).replace(/^export /, '');
}

// Load the actual safeParse assignment, rather than a JSON-only substitute with different defaults.
const globals = fs.readFileSync(path.join(ROOT, 'src/common/global.ts'), 'utf8');
const globalTree = parser.parse(globals, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const assignment = globalTree.program.body.find(
  item =>
    item.type === 'ExpressionStatement' &&
    item.expression.type === 'AssignmentExpression' &&
    item.expression.left.type === 'MemberExpression' &&
    item.expression.left.object.type === 'Identifier' &&
    item.expression.left.object.name === 'window' &&
    item.expression.left.property.type === 'Identifier' &&
    item.expression.left.property.name === 'safeParse',
);
assert.ok(assignment && assignment.start != null && assignment.end != null);
const host: { safeParse?: (v: unknown) => unknown } = {};
new Function(
  'window',
  'console',
  compile(globals.slice(assignment!.start!, assignment!.end!), path.join(ROOT, 'src/common/global.ts')),
)(host, { error: (e: Error) => parseErrors.push(e.message) });
assert.equal(typeof host.safeParse, 'function');

const enumModule: { exports: Record<string, unknown> } = { exports: {} };
const enumFile = path.join(ROOT, 'src/pages/FormExtend/enum.ts');
new Function('module', 'exports', 'require', '_l', compile(fs.readFileSync(enumFile, 'utf8'), enumFile))(
  enumModule,
  enumModule.exports,
  (name: string) => {
    assert.ok(name.endsWith('.png'), name);
    return name;
  },
  translate,
);
const relationSource = fs.readFileSync(path.join(ROOT, 'src/pages/worksheet/constants/enum.ts'), 'utf8');
const relation = new Function(
  compile(declaration(relationSource, 'RELATION_SEARCH_SHOW_TYPE')) + ';return RELATION_SEARCH_SHOW_TYPE;',
)();

const pageConfigModule: { exports: Record<string, any> } = { exports: {} };
new Function(
  'module',
  'exports',
  'require',
  compile(
    fs.readFileSync(path.join(ROOT, 'src/pages/FormExtend/pageConfig.ts'), 'utf8'),
    path.join(ROOT, 'src/pages/FormExtend/pageConfig.ts'),
  ),
)(pageConfigModule, pageConfigModule.exports, (name: string) => {
  if (name === './enum') return enumModule.exports;
  throw Error(`Uncontrolled page config dependency: ${name}`);
});

const writeModule: { exports: Record<string, any> } = { exports: {} };
new Function(
  'module',
  'exports',
  'require',
  compile(
    fs.readFileSync(path.join(ROOT, 'src/pages/FormExtend/pageConfigWrite.ts'), 'utf8'),
    path.join(ROOT, 'src/pages/FormExtend/pageConfigWrite.ts'),
  ),
)(writeModule, writeModule.exports, (name: string) => {
  if (name === 'lodash') return realLodash;
  if (name === './pageConfig') return pageConfigModule.exports;
  throw Error(`Uncontrolled writer dependency: ${name}`);
});

function load(source: string): Record<string, any> {
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '_l', 'safeParse', compile(source))(
    mod,
    mod.exports,
    (name: string) => {
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      if (name === 'lodash') return realLodash;
      if (name === 'moment') return realMoment;
      if (name === './enum') return enumModule.exports;
      if (name === './pageConfig') return pageConfigModule.exports;
      if (name === 'worksheet/constants/enum') return { RELATION_SEARCH_SHOW_TYPE: relation };
      if (name === './PublicWorksheetConfig/CountDown') return CountDownLeaf;
      throw Error(`Uncontrolled dependency: ${name}`);
    },
    translate,
    host.safeParse,
  );
  return mod.exports;
}
const a = load(baseline),
  b = load(current);
let checks = 0;
function check(name: string, fn: () => void): void {
  fn();
  checks++;
  console.log(`  PASS ${name}`);
}
function outcome(fn: () => unknown) {
  parseErrors.length = 0;
  try {
    return { result: fn(), errors: [...parseErrors] };
  } catch (e) {
    const error = e as Error;
    return { thrown: [error.name, error.message], errors: [...parseErrors] };
  }
}

check('six helpers erase identically; time formatting only spells out two undefined returns', () => {
  for (const name of [
    'getNewControlColRow',
    'getNotSupportControlIds',
    'getDisabledControls',
    'isDisplayPromptText',
    'renderLimitInfo',
    'checkIsDeleted',
  ]) {
    assert.equal(compile(declaration(current, name)), compile(declaration(baseline, name)), name);
  }
  const before = compile(declaration(baseline, 'getLimitWriteTimeDisplayText'));
  const after = compile(declaration(current, 'getLimitWriteTimeDisplayText'));
  assert.equal(after.split('return undefined;').length - 1, 2);
  assert.equal(after.replaceAll('return undefined;', 'return;'), before);
});

check('layout coordinates preserve missing values, NaN, Infinity and empty rows', () => {
  for (const row of [undefined, null, 0, 1, -1, NaN, Infinity])
    for (const col of [undefined, null, 0, 1, -1, NaN, Infinity])
      for (const half of [undefined, true, false]) {
        const controls = [{ controlId: 'x', row, col, half }];
        assert.deepEqual(b.getNewControlColRow(controls, half), a.getNewControlColRow(controls, half));
      }
});

check('position fold preserves sparse entries, native keys, references and input mutation', () => {
  const ids = [undefined, null, 'x', 'undefined', '__proto__', 'constructor', 'toString', Symbol.for('layout-id')];
  for (const id of ids)
    for (const sparse of [false, true])
      for (const row of [undefined, 0, NaN]) {
        const run = (u: Record<string, any>) => {
          const related = [{ controlId: 'nested', type: 26 }];
          const controls = [{ controlId: id, row, col: 0, type: 1, relationControls: related }];
          const positions: any[] = sparse ? new Array(2) : [{ controlId: id, col: 1, row: 2, size: 6 }];
          const result = u.overridePos(controls, positions);
          return {
            result,
            controls,
            positionKeys: Reflect.ownKeys(positions),
            sameObject: result[0] === controls[0],
            sameNested: result[0].relationControls === related,
          };
        };
        assert.deepEqual(
          outcome(() => run(b)),
          outcome(() => run(a)),
        );
      }
});

check('position fold preserves getter read order and inherited IDs', () => {
  const run = (u: Record<string, any>) => {
    const reads: string[] = [];
    const control = {
      get controlId() {
        reads.push('controlId');
        return 'x';
      },
      row: 0,
      col: 0,
    };
    const position = Object.create({ controlId: 'x' });
    Object.defineProperties(position, {
      row: {
        get() {
          reads.push('row');
          return 4;
        },
        enumerable: true,
      },
      col: {
        get() {
          reads.push('col');
          return 1;
        },
        enumerable: true,
      },
    });
    return { result: u.overridePos([control], [position]), reads };
  };
  assert.deepEqual(run(b), run(a));
});

check('subtable filtering and native missing-field errors remain unchanged', () => {
  for (const related of [undefined, [], [{ controlId: 'hide', type: 26 }]])
    for (const shown of [undefined, [], ['hide', 'keep']]) {
      const run = (u: Record<string, any>) => {
        const input = [{ controlId: 'x', type: 34, relationControls: related, showControls: shown }];
        return { result: u.overridePos(input, []), input };
      };
      assert.deepEqual(
        outcome(() => run(b)),
        outcome(() => run(a)),
      );
    }
});

check('time formatting covers all modes, missing arrays, invalid weeks and unknown setting names', () => {
  for (const type of ['month', 'day', 'hour', 'other'])
    for (const code of [0, 1, 2, 3, 4])
      for (const items of [undefined, [], [0], [1, 7], [1, 2]]) {
        const settings = {
          monthSetting: { monthType: code, defineMonth: items },
          daySetting: { dayType: code, defineDay: items, defineWeek: items },
          hourSetting: { hourType: code, rangHour: items },
        };
        assert.deepEqual(
          outcome(() => b.getLimitWriteTimeDisplayText(type, settings)),
          outcome(() => a.getLimitWriteTimeDisplayText(type, settings)),
        );
      }
});

check('prompt values and rendered React elements retain undefined, NaN and countdown props', () => {
  for (const enabled of [undefined, false, true])
    for (const countdown of [false, true])
      for (const completeNumber of [undefined, 0, 4, NaN]) {
        const settings = {
          linkSwitchTime: { isEnable: enabled, isShowCountDown: countdown, endTime: '2030-01-02T03:04:00Z' },
          limitWriteCount: { isEnable: enabled, limitWriteCount: 3 },
          completeNumber,
          limitWriteTime: { isEnable: false },
        };
        assert.deepEqual(b.isDisplayPromptText(settings), a.isDisplayPromptText(settings));
        assert.deepEqual(b.renderLimitInfo(settings), a.renderLimitInfo(settings));
      }
  assert.deepEqual(
    outcome(() => b.renderLimitInfo({})),
    outcome(() => a.renderLimitInfo({})),
  );
});

check('legacy JSON lookup preserves primitives, invalid JSON, null errors and key fallback', () => {
  for (const data of [
    undefined,
    '[]',
    '{}',
    'null',
    'false',
    '"abc"',
    '{bad',
    '[2,true,"x"]',
    '[{"key":"a","layout":2},{"key":"b","cover":"url"}]',
    '{"0":{"key":"a"}}',
  ])
    for (const key of [undefined, '', 'a', 'b', 'missing', '__proto__']) {
      assert.deepEqual(
        outcome(() => b.getPageConfig(data, key)),
        outcome(() => a.getPageConfig(data, key)),
      );
    }
});

check('deleted-field lookup preserves falsy values, absent IDs and first-index semantics', () => {
  for (const id of [undefined, null, '', 'x', 'missing'])
    for (const data of [[], [{}, { controlId: 'x' }]])
      assert.equal(b.checkIsDeleted(id, data), a.checkIsDeleted(id, data));
});

const viewOf = pageConfigModule.exports.readPageConfig;
const themeOf = pageConfigModule.exports.getPageThemeColor;

check('appearance fields are validated lazily without caching or changing getter receivers', () => {
  const reads: string[] = [];
  const raw = {
    get cover() {
      assert.equal(this, raw);
      reads.push('cover');
      return 'https://example.com/a';
    },
    get layout() {
      reads.push('layout');
      return 2;
    },
    get unusedExtension() {
      throw Error('unused metadata was inspected');
    },
  };
  const view = viewOf(raw);
  assert.deepEqual(reads, []);
  assert.equal(view.cover, raw.cover);
  assert.equal(view.cover, raw.cover);
  assert.deepEqual(reads, ['cover', 'cover', 'cover', 'cover']);
  assert.equal(view.layout, 2);
  assert.deepEqual(reads, ['cover', 'cover', 'cover', 'cover', 'layout']);
});

check('valid scalar keys, nullable URLs and QR flags retain their actual values', () => {
  for (const index of [undefined, null, false, true, 0, 2, NaN, Infinity, '2', 'constructor', '__proto__'])
    for (const cover of [undefined, null, '', 'https://example.com/a'])
      for (const qr of [undefined, null, false, true, 0, 1, '', '0', 'false']) {
        const raw = { key: 'source', layout: index, themeColor: index, themeBgColor: null, cover, showQrcode: qr };
        const view = viewOf(raw);
        for (const key of Object.keys(raw)) assert.equal(view[key], raw[key]);
      }
  for (const raw of ['x', 1, true, Symbol.for('page-view')]) {
    const view = viewOf(raw);
    assert.equal(view.cover, undefined);
    assert.equal(view.layout, undefined);
  }
});

check('malformed known fields fail only when read; raw selection and unknown metadata are not rewritten', () => {
  const badFields: Array<[string, unknown]> = [
    ['cover', 1],
    ['cover', {}],
    ['themeBgColor', false],
    ['showQrcode', { enabled: true }],
    ['layout', []],
    ['themeColor', {}],
    ['key', 1],
  ];
  for (const [key, value] of badFields) {
    const raw = { [key]: value, extension: { secret: 'not included in errors' } };
    assert.equal(b.getPageConfig([raw]), raw);
    const view = viewOf(raw);
    if (key !== 'themeColor' && key !== 'themeBgColor') assert.doesNotThrow(() => themeOf(view));
    assert.throws(() => view[key as string], {
      name: 'TypeError',
      message: `Invalid public page configuration field: ${key}`,
    });
  }
});

check('raw lookup preserves object identity, null entry failures and strict primitive getter receivers', () => {
  const raw = [
    { key: 'a', cover: 'one' },
    { key: 'b', cover: 'two' },
  ];
  assert.equal(b.getPageConfig(raw, 'b'), raw[1]);
  assert.equal(b.getPageConfig(raw, 'missing'), raw[0]);
  for (const input of [[null], [undefined], new Array(2)]) {
    assert.deepEqual(
      outcome(() => b.getPageConfig(input, 'a')),
      outcome(() => a.getPageConfig(input, 'a')),
    );
  }
  const saved = Object.getOwnPropertyDescriptor(String.prototype, 'key');
  const seen: string[] = [];
  try {
    Object.defineProperty(String.prototype, 'key', {
      configurable: true,
      get: function () {
        'use strict';
        seen.push(typeof this);
        return String(this);
      },
    });
    const old = a.getPageConfig('"ab"', 'b');
    const before = [...seen];
    seen.length = 0;
    const next = b.getPageConfig('"ab"', 'b');
    assert.equal(next, old);
    assert.deepEqual(seen, before);
    assert.ok(seen.every(x => x === 'string'));
  } finally {
    if (saved) Object.defineProperty(String.prototype, 'key', saved);
    else Reflect.deleteProperty(String.prototype, 'key');
  }
});

const CONSUMERS: Record<string, string> = {
  'src/pages/FormExtend/PublicWorksheetConfig/PublicWorksheetConfigForm.tsx':
    'd43778fa9d7aebbd95728b8c2cea759d7e11156577bcad6c423477e5d1d34e90',
  'src/pages/FormExtend/PublicWorksheetConfig/components/SourceKeys.tsx':
    'ff6981c232e08a43119a53f5f5b237614957d805d82ee6165cfd544a026bf362',
  'src/pages/FormExtend/PublicWorksheetConfig/AppearanceConfig.tsx':
    '0545a288070242d372c6c7a4b23822d4ea10d9b8cd5316ed94fbc811d134aa58',
  'src/pages/PublicWorksheet/PublicWorksheet.tsx': '1ac9fb97500701ce1a3b48a8edd6ad2b43e4364a93d9502670328c6aa8cabac1',
};
function memberSource(source: string, name: string): string {
  const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let range: { start: number; end: number } | undefined;
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    let expression: unknown;
    if (
      'type' in node &&
      node.type === 'ClassProperty' &&
      'key' in node &&
      node.key &&
      typeof node.key === 'object' &&
      'name' in node.key &&
      node.key.name === name &&
      'value' in node
    )
      expression = node.value;
    if (
      'type' in node &&
      node.type === 'VariableDeclarator' &&
      'id' in node &&
      node.id &&
      typeof node.id === 'object' &&
      'name' in node.id &&
      node.id.name === name &&
      'init' in node
    )
      expression = node.init;
    if (
      expression &&
      typeof expression === 'object' &&
      'start' in expression &&
      'end' in expression &&
      typeof expression.start === 'number' &&
      typeof expression.end === 'number'
    )
      range = { start: expression.start, end: expression.end };
    Object.values(node).forEach(visit);
  };
  visit(tree.program);
  assert.ok(range, name);
  return source.slice(range!.start, range!.end);
}
const WRITER_BASE = '8c38a48b70b612ee5aaf37a18c5d348f0762fee4';
const WRITER_SHA: Record<string, string> = {
  'src/pages/FormExtend/PublicWorksheetConfig/AppearanceConfig.tsx':
    '9ee724a2740f5d07c55ca4523999ef34df2c463a334902b7640fe175c984e2a6',
  'src/pages/FormExtend/PublicWorksheetConfig/components/SourceKeys.tsx':
    'fabbcf9432405e0684b0fdf37bf823310e172d0300443cc0f1133b8f4e71fb9d',
  'src/pages/FormExtend/PublicWorksheetConfig/PublicConfig/index.tsx':
    '00f1d3e8b318a28e9795992d685fc874d77063c67e9e962bb5eda4df759d78f2',
  'src/pages/FormExtend/PublicWorksheetConfig/PublicWorksheetConfigForm.tsx':
    'f6aae932f3234033cc874f89d7e491e40be59fecd816d2698f92e24282b2f937',
};
const consumerFactories = new Map<string, Function>();
function consumer(
  rel: string,
  name: string,
  variant: 'old' | 'current',
  pageConfigs: unknown,
  context: Record<string, any> = {},
  base = '2e66bd4fab699ec43452f6a4d881ff588df1cfe3',
): (...args: any[]) => any {
  const cacheKey = `${base}:${variant}:${rel}:${name}`;
  let makeModule = consumerFactories.get(cacheKey);
  if (!makeModule) {
    const source =
      variant === 'old'
        ? execFileSync('git', ['show', `${base}:${rel}`], {
            cwd: ROOT,
            encoding: 'utf8',
          })
        : fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (variant === 'old')
      assert.equal(
        crypto.createHash('sha256').update(source).digest('hex'),
        base === WRITER_BASE ? WRITER_SHA[rel] : CONSUMERS[rel],
      );
    makeModule = new Function(
      'module',
      'getPageConfig',
      'readPageConfig',
      'getPageThemeColor',
      'themes',
      'pageConfigs',
      'Fragment',
      'QiniuUpload',
      'UploadBtn',
      'Icon',
      'cx',
      '_l',
      'coverurls',
      'require',
      '_',
      'readPageProperty',
      'safeParse',
      'changePageConfig',
      'removePageConfig',
      'appendPageConfig',
      'update',
      'handleUpdateExpandDatas',
      'onDelete',
      'dialogSelectColor',
      'localStorage',
      'ThemeColorWrapper',
      'Tooltip',
      'TinyColor',
      'React',
      compile(`module.exports = function() { return (${memberSource(source, name)}); };`, path.join(ROOT, rel)),
    );
    consumerFactories.set(cacheKey, makeModule);
  }
  const mod = { exports: {} };
  makeModule(
    mod,
    variant === 'old' ? a.getPageConfig : b.getPageConfig,
    viewOf,
    themeOf,
    enumModule.exports.themes,
    pageConfigs,
    realReact.Fragment,
    CountDownLeaf,
    CountDownLeaf,
    CountDownLeaf,
    require('classnames'),
    translate,
    enumModule.exports.coverurls,
    require,
    realLodash,
    pageConfigModule.exports.readPageProperty,
    context.safeParse || host.safeParse,
    writeModule.exports.changePageConfig,
    writeModule.exports.removePageConfig,
    writeModule.exports.appendPageConfig,
    require('immutability-helper'),
    context.handleUpdateExpandDatas,
    context.onDelete,
    context.dialogSelectColor,
    context.localStorage,
    CountDownLeaf,
    CountDownLeaf,
    require('@ctrl/tinycolor').TinyColor,
    realReact,
  );
  const factory = mod.exports as () => (...args: any[]) => any;
  return function (this: unknown, ...args: any[]) {
    return Reflect.apply(Reflect.apply(factory, this, []), this, args);
  };
}

check('all three actual theme consumers preserve preset, source, inherited-key and custom-color behavior', () => {
  const [form, source, , publicForm] = Object.keys(CONSUMERS);
  for (const index of [undefined, null, 0, 4, -1, 99, '4', true, 'constructor', 'toString', '__proto__'])
    for (const custom of [undefined, null, '', '#fedcba']) {
      const page = { themeColor: index, themeBgColor: custom };
      const json = JSON.stringify([page, { ...page, key: 'source' }]);
      const formHost = { props: { worksheetSettings: { extendDatas: { pageConfigs: json } } } };
      assert.deepEqual(
        consumer(form, 'getThemeBgColor', 'current', json).call(formHost),
        consumer(form, 'getThemeBgColor', 'old', json).call(formHost),
      );
      assert.deepEqual(
        consumer(source, 'getThemeBgColor', 'current', json)('source'),
        consumer(source, 'getThemeBgColor', 'old', json)('source'),
      );
      assert.deepEqual(
        consumer(publicForm, 'getThemeBgColor', 'current', json)(page),
        consumer(publicForm, 'getThemeBgColor', 'old', json)(page),
      );
    }
});

function elementTree(value: any): any {
  if (typeof value === 'function') return '[callback not invoked]';
  if (Array.isArray(value)) return value.map(elementTree);
  if (realReact.isValidElement(value))
    return {
      type: typeof value.type === 'string' ? value.type : value.type === realReact.Fragment ? 'Fragment' : 'leaf',
      props: elementTree(value.props),
    };
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, elementTree(v)]));
  return value;
}
check('actual upload rendering keeps native URL behavior and cover properties without mounting or uploading', () => {
  const rel = 'src/pages/FormExtend/PublicWorksheetConfig/AppearanceConfig.tsx';
  for (const cover of [undefined, null, '', 'https://example.com/a.png?x=1', '/relative']) {
    const json = JSON.stringify([{ cover }]);
    const host = {
      props: { pageConfigs: json },
      state: { isUploading: false },
      handleUploaded() {},
      handleChangePageConfig() {},
    };
    const run = (variant: 'old' | 'current') =>
      outcome(() => elementTree(consumer(rel, 'renderUpload', variant, json).call(host)));
    assert.deepEqual(run('current'), run('old'));
  }
});

check('the palette library retains its native undefined fallback for inherited preset keys', () => {
  const theme = themeOf(viewOf({ themeColor: 'constructor' }));
  assert.equal(theme, undefined);
  const generate = require('@ant-design/colors').generate;
  assert.deepEqual(generate(theme), generate(undefined));
  assert.equal(generate(theme).length, 10);
});

const APPEARANCE = 'src/pages/FormExtend/PublicWorksheetConfig/AppearanceConfig.tsx';
const SOURCES = 'src/pages/FormExtend/PublicWorksheetConfig/components/SourceKeys.tsx';
const PUBLIC_CONFIG = 'src/pages/FormExtend/PublicWorksheetConfig/PublicConfig/index.tsx';
function writer(
  rel: string,
  method: string,
  variant: 'old' | 'current',
  data: unknown,
  context: Record<string, any> = {},
) {
  return consumer(rel, method, variant, data, context, WRITER_BASE);
}
function caught(fn: () => void): string[] | undefined {
  try {
    fn();
    return undefined;
  } catch (e) {
    const error = e as Error;
    return [error.name, error.message];
  }
}

check(
  'actual appearance edit preserves opaque fields, first-entry fallback, forced key and native spread order',
  () => {
    for (const key of ['', 'a', 'new', '__proto__']) {
      const run = (variant: 'old' | 'current') => {
        const trace: unknown[] = [];
        let assigned: any;
        const entry = JSON.parse('{"key":"a","layout":2,"extension":{"keep":true},"__proto__":{"owned":true}}');
        Object.defineProperty(entry, 'cover', {
          enumerable: true,
          get() {
            trace.push('old-cover');
            return 'old';
          },
        });
        const raw: any[] = [entry];
        const collection = new Proxy(raw, {
          get(target, name, receiver) {
            if (name === 'length' || name === '0') trace.push('get:' + String(name));
            return Reflect.get(target, name, receiver);
          },
          set(target, name, value, receiver) {
            trace.push('set:' + String(name));
            assigned = value;
            return Reflect.set(target, name, value, receiver);
          },
        });
        const patch = {
          get cover() {
            trace.push('patch-cover');
            return 'new';
          },
          get key() {
            trace.push('patch-key');
            return 'ignored';
          },
        };
        const context = {
          safeParse(value: unknown) {
            trace.push('parse');
            return host.safeParse!(value);
          },
        };
        const edit = writer(APPEARANCE, 'handleChangePageConfig', variant, collection, context);
        const h = {
          props: {
            pageConfigs: collection,
            pageConfigKey: key,
            saveExtendDatas: function (this: unknown, update: unknown) {
              'use strict';
              assert.equal(this, undefined);
              trace.push(['save', update]);
            },
          },
        };
        const error = caught(() => edit.call(h, patch));
        const payload = trace.find(x => Array.isArray(x) && x[0] === 'save') as any;
        return {
          trace,
          error,
          plain: assigned ? Object.getPrototypeOf(assigned) === Object.prototype : undefined,
          payload: payload?.[1],
        };
      };
      const old = run('old'),
        next = run('current');
      assert.deepEqual(next, old);
      const parsed = JSON.parse(next.payload.pageConfigs);
      const changed = parsed.find((x: any) => x.key === key);
      assert.ok(changed.extension.keep);
      assert.ok(Object.hasOwn(changed, '__proto__'));
    }
  },
);

check('actual edits preserve custom array serialization and native frozen/cyclic/empty-slot failures', () => {
  for (const scenario of ['serializer', 'frozen', 'cycle', 'null-entry', 'hole']) {
    const run = (variant: 'old' | 'current') => {
      const trace: unknown[] = [];
      const raw: any[] = [{ key: 'a', extension: 'keep' }];
      if (scenario === 'serializer')
        Object.defineProperty(raw, 'toJSON', {
          value: function () {
            trace.push('toJSON');
            return [this[0]];
          },
        });
      if (scenario === 'frozen') Object.freeze(raw);
      if (scenario === 'cycle') raw[0].cycle = raw[0];
      if (scenario === 'null-entry') raw[0] = null;
      if (scenario === 'hole') delete raw[0];
      const edit = writer(APPEARANCE, 'handleChangePageConfig', variant, raw);
      const h = {
        props: {
          pageConfigs: raw,
          pageConfigKey: 'a',
          saveExtendDatas: (value: unknown) => trace.push(['save', value]),
        },
      };
      const error = caught(() => edit.call(h, { showQrcode: true }));
      return { trace, error };
    };
    assert.deepEqual(run('current'), run('old'), scenario);
  }
});

check('actual delete filters in order, preserves the source array and saves before the index callback', () => {
  for (const key of ['a', 'missing', '']) {
    const run = (variant: 'old' | 'current') => {
      const raw: any[] = [
        { key: 'a', extension: 1 },
        { key: 'b', extension: 2 },
        { key: 'a', extension: 3 },
      ];
      const trace: unknown[] = [];
      const context = {
        handleUpdateExpandDatas: (value: unknown) => trace.push(['save', value]),
        onDelete: (index: number) => trace.push(['delete', index]),
      };
      writer(SOURCES, 'handleDelete', variant, raw, context)(key, 7);
      return { trace, raw };
    };
    const next = run('current');
    assert.deepEqual(next, run('old'));
    assert.equal((next.trace[0] as any)[0], 'save');
    assert.deepEqual(next.trace[1], ['delete', 7]);
  }
  for (const key of ['a', 'missing']) {
    const context = {
      handleUpdateExpandDatas() {
        throw Error('save-error');
      },
      onDelete() {
        throw Error('callback should not run');
      },
    };
    assert.deepEqual(
      caught(() => writer(SOURCES, 'handleDelete', 'current', '[]', context)(key, 0)),
      caught(() => writer(SOURCES, 'handleDelete', 'old', '[]', context)(key, 0)),
    );
  }
});

check('actual source-key creation retains synchronous and batched state/save/input-reset order', () => {
  for (const batched of [false, true])
    for (const value of ['source', '  ', '__proto__']) {
      const run = (variant: 'old' | 'current') => {
        const trace: unknown[] = [];
        const pending: Array<{ value: object; cb?: () => void }> = [];
        const context = {
          safeParse(value: unknown) {
            trace.push('parse');
            return host.safeParse!(value);
          },
        };
        const json = JSON.stringify([{ key: '', layout: 2, extension: { keep: true }, showQrcode: 'false' }]);
        let input = value;
        const h: any = {
          state: { sourceKeys: ['existing'], extendDatas: { pageConfigs: json, opaque: 'untouched' } },
          keyinput: {
            get value() {
              trace.push('input:get');
              return input;
            },
            set value(v: string) {
              trace.push(['input:set', v]);
              input = v;
            },
          },
          setState(update: object, cb?: () => void) {
            trace.push(['setState', update]);
            if (batched) pending.push({ value: update, cb });
            else {
              Object.assign(this.state, update);
              cb?.();
            }
          },
          saveSetting() {
            trace.push(['save', this.state.sourceKeys.slice(), this.state.extendDatas.pageConfigs]);
          },
        };
        h.handleChange = writer(PUBLIC_CONFIG, 'handleChange', variant, json, context).bind(h);
        h.handleUpdateExpandDatas = writer(PUBLIC_CONFIG, 'handleUpdateExpandDatas', variant, json, context).bind(h);
        // alert is a controlled host callback; no API or DOM is involved.
        const saved = Reflect.get(globalThis, 'alert');
        Reflect.set(globalThis, 'alert', (text: string, type: number) => trace.push(['alert', text, type]));
        try {
          writer(PUBLIC_CONFIG, 'handleGenUrl', variant, json, context).call(h);
        } finally {
          if (saved === undefined) Reflect.deleteProperty(globalThis, 'alert');
          else Reflect.set(globalThis, 'alert', saved);
        }
        if (batched) {
          for (const task of pending) Object.assign(h.state, task.value);
          for (const task of pending) task.cb?.();
        }
        return { trace, state: h.state, input };
      };
      assert.deepEqual(run('current'), run('old'));
    }
});

check('actual upload callback retains state, URL getter, save and disable order', () => {
  const run = (variant: 'old' | 'current') => {
    const trace: unknown[] = [];
    const raw = [{ key: '', extension: { keep: true } }];
    const context = {
      safeParse(value: unknown) {
        trace.push('parse');
        return host.safeParse!(value);
      },
    };
    const h: any = {
      props: { pageConfigs: raw, pageConfigKey: '', saveExtendDatas: (data: unknown) => trace.push(['save', data]) },
      setState(value: unknown) {
        trace.push(['state', value]);
      },
    };
    h.handleChangePageConfig = writer(APPEARANCE, 'handleChangePageConfig', variant, raw, context).bind(h);
    const file = {
      get url() {
        trace.push('url');
        return 'https://example.com/cover.png';
      },
    };
    const up = {
      disableBrowse(value: boolean) {
        assert.equal(this, up);
        trace.push(['disable', value]);
      },
    };
    writer(APPEARANCE, 'handleUploaded', variant, raw, context).call(h, up, file);
    return trace;
  };
  const next = run('current');
  assert.deepEqual(next, run('old'));
  assert.deepEqual((next[0] as any)[0], 'state');
  assert.deepEqual(next[next.length - 1], ['disable', false]);
});

check('actual color-picker save keeps sparse colors, DOMString storage and persistence order', () => {
  const run = (variant: 'old' | 'current') => {
    const trace: unknown[] = [];
    let saveColor: ((value: string) => void) | undefined;
    const context = {
      dialogSelectColor(options: { onSave: (color: string) => void }) {
        saveColor = options.onSave;
      },
      localStorage: {
        setItem(key: unknown, value: unknown) {
          trace.push(['storage', String(key), String(value)]);
        },
      },
    };
    const custom: string[] = ['#111111', '#222222'];
    delete custom[0];
    const h: any = {
      props: {
        pageConfigs: '[{"key":"source","extension":1}]',
        pageConfigKey: 'source',
        saveExtendDatas: (value: unknown) => trace.push(['save', value]),
      },
      state: { customColors: custom, isUploading: false },
      setState(value: object) {
        trace.push(['state', value]);
        Object.assign(this.state, value);
      },
    };
    h.handleChangePageConfig = writer(APPEARANCE, 'handleChangePageConfig', variant, h.props.pageConfigs, context).bind(
      h,
    );
    const tree = writer(APPEARANCE, 'renderCustomColor', variant, h.props.pageConfigs, context).call(h, '#222222');
    let click: (() => void) | undefined;
    const walk = (value: any) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (realReact.isValidElement(value)) {
        if (value.props.icon === 'task-add-member-circle') click = value.props.onClick;
        walk(value.props.children);
      }
    };
    walk(tree);
    assert.ok(click);
    click!();
    assert.ok(saveColor);
    saveColor!('#abcdef');
    return { trace, colors: h.state.customColors };
  };
  const next = run('current');
  assert.deepEqual(next, run('old'));
  assert.deepEqual(
    (next.trace as any[]).map(x => x[0]),
    ['state', 'storage', 'save'],
  );
});

check('source-key state/update prefix still occurs before invalid-list rejection', () => {
  const run = (variant: 'old' | 'current') => {
    const trace: unknown[] = [];
    const h: any = {
      state: { sourceKeys: [], extendDatas: { pageConfigs: '{}' } },
      keyinput: { value: 'new' },
      handleChange(...args: unknown[]) {
        trace.push(['change', args[0], args[1]]);
      },
      handleUpdateExpandDatas(value: unknown) {
        trace.push(['update', value]);
      },
    };
    const error = caught(() => writer(PUBLIC_CONFIG, 'handleGenUrl', variant, '{}').call(h));
    return { trace, error };
  };
  const old = run('old'),
    next = run('current');
  assert.deepEqual(next.trace, old.trace);
  assert.equal(next.error?.[0], 'TypeError');
  assert.equal(old.error?.[0], 'TypeError');
  assert.deepEqual(next.trace, [['change', 'sourceKeys', ['new']]]);
});

check('malformed lists, invalid patches and scalar root serializers are rejected before save', () => {
  for (const raw of [{}, null, 'primitive']) {
    assert.throws(
      () => writeModule.exports.changePageConfig(raw, 'a', { cover: 'ok' }),
      /Invalid public page configuration list/,
    );
    assert.throws(() => writeModule.exports.removePageConfig(raw, 'a'), /Invalid public page configuration list/);
    assert.throws(() => writeModule.exports.appendPageConfig(raw, 'a'), /Invalid public page configuration list/);
  }
  for (const patch of [{ cover: 5 }, { themeBgColor: {} }, { showQrcode: 'false' }, { layout: '2' }]) {
    const raw = [{ key: 'a', extension: 'keep' }];
    assert.throws(
      () => writeModule.exports.changePageConfig(raw, 'a', patch),
      /Invalid public page configuration write field/,
    );
    assert.deepEqual(raw, [{ key: 'a', extension: 'keep' }]);
  }
  for (const result of [undefined, {}, 'scalar']) {
    const raw = [{ key: 'a' }];
    Object.defineProperty(raw, 'toJSON', { value: () => result });
    assert.throws(
      () => writeModule.exports.changePageConfig(raw, 'a', {}),
      /Invalid public page configuration serialization/,
    );
  }
  const trace: unknown[] = [];
  const h: any = {
    props: {
      pageConfigs: '[]',
      pageConfigKey: '',
      saveExtendDatas() {
        trace.push('save');
      },
    },
    setState() {
      trace.push('state');
    },
  };
  h.handleChangePageConfig = writer(APPEARANCE, 'handleChangePageConfig', 'current', '[]').bind(h);
  assert.throws(
    () =>
      writer(APPEARANCE, 'handleUploaded', 'current', '[]').call(
        h,
        {
          disableBrowse() {
            trace.push('disable');
          },
        },
        { url: 7 },
      ),
    TypeError,
  );
  assert.deepEqual(trace, ['state']);
});

assert.ok(realReact.Fragment);
console.log(`FormExtend helper historical A/B passed: ${checks} groups; real modules, isolated host, no render mount.`);
