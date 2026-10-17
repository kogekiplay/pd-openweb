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
const consumerFactories = new Map<string, Function>();
function consumer(rel: string, name: string, variant: 'old' | 'current', pageConfigs: string): (...args: any[]) => any {
  const cacheKey = `${variant}:${rel}:${name}`;
  let makeModule = consumerFactories.get(cacheKey);
  if (!makeModule) {
    const source =
      variant === 'old'
        ? execFileSync('git', ['show', `2e66bd4fab699ec43452f6a4d881ff588df1cfe3:${rel}`], {
            cwd: ROOT,
            encoding: 'utf8',
          })
        : fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (variant === 'old') assert.equal(crypto.createHash('sha256').update(source).digest('hex'), CONSUMERS[rel]);
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

assert.ok(realReact.Fragment);
console.log(`FormExtend helper historical A/B passed: ${checks} groups; real modules, isolated host, no render mount.`);
