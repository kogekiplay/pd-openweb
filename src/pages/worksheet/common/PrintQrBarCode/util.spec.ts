import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const lodash: typeof import('lodash') = require('lodash');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
const directory = 'src/pages/worksheet/common/PrintQrBarCode/';
const beforeRev = process.env['LABEL_BEFORE_REV'];

function source(name: string, before = false) {
  return before && beforeRev
    ? cp.execFileSync('git', ['show', beforeRev + ':' + directory + name], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, directory, name), 'utf8');
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture receiver');
  return value[key];
}

function invoke(value: unknown, name: string, args: unknown[] = []): unknown {
  const method = read(value, name);
  if (typeof method !== 'function') throw new TypeError('Missing actual method ' + name);
  return Reflect.apply(method, value, args);
}

let missingContext = false;
class Canvas {
  width = 300;
  height = 150;
  style: Record<string, unknown> = {};
  operations: unknown[][] = [];
  attributes: Record<string, string> = {};
  context: object;
  constructor() {
    const canvas = this;
    const state: Record<string, unknown> = { font: '10px sans-serif' };
    this.context = new Proxy(state, {
      set(target, key, value: unknown) {
        target[String(key)] = value;
        canvas.operations.push(['set', String(key), value]);
        return true;
      },
      get(target, key) {
        if (key === 'canvas') return canvas;
        if (key === 'measureText')
          return (value: unknown) => {
            const text = String(value);
            const font = parseFloat(String(target['font']).replace(/^bold /, ''));
            return { width: [...text].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 255 ? 1 : 0.6) * font, 0) };
          };

        if (Object.hasOwn(target, key)) return target[String(key)];
        return (...args: unknown[]) =>
          canvas.operations.push([
            String(key),
            ...args.map(a => (a instanceof ImageFixture ? { src: a.src, width: a.width, height: a.height } : a)),
          ]);
      },
    });
  }
  getContext() {
    return missingContext ? null : this.context;
  }
  setAttribute(name: string, value: unknown) {
    this.attributes[name] = String(value);
    if (name === 'width' || name === 'height') this[name] = Number(value);
  }
  hasAttribute(name: string) {
    return Object.hasOwn(this.attributes, name);
  }
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  snapshot() {
    return { width: this.width, height: this.height, style: this.style, operations: this.operations };
  }
  toDataURL() {
    return 'data:image/png;base64,' + Buffer.from(JSON.stringify(this.snapshot())).toString('base64');
  }
}
class ImageFixture {
  width = 0;
  height = 0;
  onload?: () => void;
  onerror?: () => void;
  private value = '';
  get src() {
    return this.value;
  }
  set src(value: string) {
    this.value = value;
    if (value.startsWith('fail:')) {
      queueMicrotask(() => this.onerror?.());
      return;
    }

    const parsed: unknown = JSON.parse(Buffer.from(value.split(',')[1] || '', 'base64').toString());
    this.width = Number(read(parsed, 'width'));
    this.height = Number(read(parsed, 'height'));
    queueMicrotask(() => this.onload?.());
  }
}
Object.assign(globalThis, {
  HTMLCanvasElement: Canvas,
  HTMLImageElement: ImageFixture,
  window: {},
  document: { createElement: () => new Canvas() },
});
let formatter: (control: unknown) => unknown = control => read(control, 'value') ?? '';

function load(text: string, imports: Record<string, unknown> = {}) {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const env = {
    _l: (value: string) => value,
    window: {},
    document: { createElement: () => new Canvas() },
    Image: ImageFixture,
  };
  const code = harness.transformSync(text, {
    filename: path.join(root, directory, 'util.ts'),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', ...Object.keys(env), code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (['lodash', 'jsbarcode', '@mdfe/qrcode-base'].includes(name) || name.startsWith('@babel/runtime/'))
        return require(name);
      throw new Error('Unexpected dependency ' + name);
    },
    ...Object.values(env),
  );
  return module.exports;
}

function engine(before = false) {
  const enums = load(source('enum.ts', before));
  const qr = load(source('genQrDataurl.ts', before));
  return load(source('util.ts', before), {
    './enum': enums,
    'src/pages/worksheet/common/PrintQrBarCode/genQrDataurl': qr,
    'src/utils/control': { renderText: (control: unknown) => formatter(control) },
  });
}

const current = engine();
const previous = beforeRev ? engine(true) : undefined;
interface RenderCase {
  name: string;
  kind: 'qr' | 'bar';
  config: Record<string, unknown>;
  texts: Array<Record<string, unknown>>;
  options: Record<string, unknown>;
}
function renderingCases(): RenderCase[] {
  const cases: RenderCase[] = [];
  const texts = [
    { text: '设备 标签 ABC-123', forceInLine: true },
    { text: 'Name: 铜陵杨铜电气有限公司' },
    { text: '' },
    { text: '说明：多行文字和 mixed words 1234567890' },
  ];
  for (const labelSize of [1, 2, 3, 4, 5, 6, 7])
    for (const layout of [1, 2])
      for (const codeSize of [1, 2, 3, 4])
        for (const position of layout === 1 ? [1, 2] : [3, 4])
          cases.push({
            name: `QR-${labelSize}-${layout}-${codeSize}-${position}`,
            kind: 'qr',
            config: {
              labelSize,
              layout,
              codeSize,
              position,
              fontSize: codeSize % 2 ? 1 : 1.3,
              firstIsBold: codeSize % 2 === 0,
              codeFaultTolerance: codeSize - 1,
            },
            texts,
            options: { isPreview: labelSize === 1, pixelRadio: 1.5 },
          });
  for (const labelSize of [1, 2, 3, 4, 5, 6, 7])
    for (const layout of [1, 2])
      for (const codeSize of [1, 2, 3])
        for (const position of [1, 2])
          cases.push({
            name: `BAR-${labelSize}-${layout}-${codeSize}-${position}`,
            kind: 'bar',
            config: {
              labelSize,
              layout,
              codeSize,
              position,
              fontSize: 1.2,
              firstIsBold: codeSize !== 2,
              showBarValue: codeSize !== 3,
            },
            texts,
            options: { isPreview: labelSize === 2, pixelRadio: 1.5 },
          });
  for (const [width, height] of [
    [20, 50],
    [70, 25],
  ])
    for (const kind of ['qr', 'bar'] as const)
      cases.push({
        name: `CUSTOM-${kind}-${width}`,
        kind,
        config: {
          labelSize: 100,
          labelCustomWidth: width,
          labelCustomHeight: height,
          layout: width > height ? 2 : 1,
          position: width > height ? 3 : 1,
          codeSize: 2,
          firstIsBold: true,
        },
        texts,
        options: {},
      });
  return cases;
}

const renderCases = renderingCases();
if (process.env['LABEL_NATIVE_CASES']) fs.writeFileSync(process.env['LABEL_NATIVE_CASES'], JSON.stringify(renderCases));
let comparisons = 0;

function compare(name: string, args: unknown[], expected?: unknown) {
  const result = invoke(current, name, lodash.cloneDeep(args));
  if (previous) assert.deepEqual(result, invoke(previous, name, lodash.cloneDeep(args)), name);
  if (arguments.length > 2) assert.deepEqual(result, expected, name);
  comparisons++;
  return result;
}

const controls = [
  { controlId: 'title', controlName: '标题', attribute: 1, type: 2 },
  { controlId: 'code', controlName: '设备编码', type: 2 },
];
for (const printType of [1, 2, 3])
  for (const sourceType of [1, 2, undefined])
    for (const sourceControlId of ['code', 'missing', undefined])
      compare('getDefaultText', [{ printType, sourceType, sourceControlId, controls }]);
for (const firstIsBold of [false, true])
  for (const showControlName of [false, true]) {
    compare('getCodeTexts', [
      {
        showTexts: [
          { type: 1, value: 'title' },
          { type: 2, value: '固定文案' },
          { type: 1, value: 'code' },
          { type: 1, value: 'missing' },
          { type: 2, value: '' },
        ],
        controls,
        firstIsBold,
        showControlName,
      },
      { title: '样例标题', code: '设备-123' },
    ]);
  }

compare(
  'getCodeTexts',
  [{ showTexts: [undefined, { type: 2, value: '末行' }], controls }],
  [undefined, { forceInLine: undefined, text: '末行' }],
);
const entries = Array.from({ length: 110 }, (_, i) => ({ type: 2, value: String(i) }));
const cappedTexts = compare('getCodeTexts', [{ showTexts: entries }]);
assert.ok(Array.isArray(cappedTexts));
assert.equal(cappedTexts.length, 100);
for (const printType of [1, 3])
  for (const text of [
    'ABC-123',
    '123中文\nABC',
    '😊'.repeat(100),
    '汉'.repeat(200),
    'a'.repeat(451),
    'a'.repeat(449) + '界',
  ]) {
    compare('getCodeContent', [{ printType, sourceType: 2, sourceControlId: 'code', controls, row: { code: text } }]);
    compare('getCodeContent', [{ printType, sourceType: 1, urls: { row: text }, row: { rowid: 'row' }, index: 0 }]);
    compare('getCodeContent', [{ printType, sourceType: 1, urls: [text], row: {}, index: 0 }]);
  }

compare('getCodeContent', [{ printType: 1, sourceType: 1, urls: {}, row: {} }], '');
compare('getCodeContent', [{ printType: 3, sourceType: 2, sourceControlId: 'code', row: { code: '' }, controls }], '');
for (const width of [10, 20, 80, 300])
  for (const value of ['ABC', '很长的中文文本', 'mixed 123'])
    compare('getCompressedFontSize', [value, width, { minFontSize: 2, maxFontSize: 40, precision: 0.1 }]);
function create(module: unknown, test: RenderCase) {
  return invoke(module, test.kind === 'qr' ? 'createQrLabeObjectFromConfig' : 'createBarLabeObjectFromConfig', [
    test.config,
    test.kind === 'qr' ? 'https://example.test/record/123' : 'ABC-1234567',
    test.texts,
    test.options,
  ]);
}

async function run() {
  for (const test of renderCases) {
    const label = create(current, test);
    await invoke(label, 'render');
    if (previous) {
      const before = create(previous, test);
      await invoke(before, 'render');
      assert.deepEqual(
        invoke(read(label, 'canvas'), 'snapshot'),
        invoke(read(before, 'canvas'), 'snapshot'),
        test.name,
      );
      assert.deepEqual(read(label, 'options'), read(before, 'options'), test.name + ' options');
    }
  }

  const construct = (name: string, args: unknown[]) => {
    const ctor = read(current, name);
    if (typeof ctor !== 'function') throw new Error(name);
    return Reflect.construct(ctor, args);
  };

  const label = construct('BarLabel', [{ value: '123', size: 'm', texts: [undefined, { text: '' }, { text: 'X' }] }]);
  await invoke(label, 'render');
  await assert.rejects(
    Promise.resolve(invoke(label, 'drawImageUrl', ['fail:image', { x: 0, y: 0, width: 20, height: 20 }])),
    /could not be loaded/,
  );
  const qr = construct('QrLabel', [{ size: 'm', url: 'x' }]);
  await assert.rejects(
    Promise.resolve(invoke(qr, 'drawImageUrl', ['fail:image', { x: 0, y: 0, width: 20, height: 20 }])),
    /could not be loaded/,
  );
  assert.throws(() => construct('QrLabel', [{ size: 'invalid' }]), TypeError);
  assert.throws(() => invoke(current, 'createQrLabeObjectFromConfig', [{ labelSize: 100 }, 'x']), TypeError);
  assert.throws(
    () => invoke(current, 'getCodeContent', [{ printType: 1, sourceType: 1, urls: { id: {} }, row: { rowid: 'id' } }]),
    TypeError,
  );
  formatter = () => ({ invalid: 'text' });
  assert.throws(
    () => invoke(current, 'getCodeContent', [{ sourceType: 2, sourceControlId: 'code', controls, row: { code: 'x' } }]),
    TypeError,
  );
  formatter = control => read(control, 'value') ?? '';
  missingContext = true;
  assert.throws(() => construct('BarLabel', [{ value: 'x' }]), /context is unavailable/);
  missingContext = false;
  console.log(
    `Label helpers passed (${comparisons} cases${previous ? ' with historical comparison' : ''}); ${renderCases.length} actual CODE128/QR drawing traces and malformed/context/image failures passed`,
  );
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function checkPreviewFailures() {
  const file = source('Preview.tsx');
  const tree = harness.parser.parse(file, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let closure: string | undefined;

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!object(value)) return;
    if (value['type'] === 'CallExpression' && object(value['callee']) && value['callee']['name'] === 'useEffect') {
      const args = value['arguments'];
      if (
        Array.isArray(args) &&
        object(args[0]) &&
        typeof args[0]['start'] === 'number' &&
        typeof args[0]['end'] === 'number'
      )
        closure = file.slice(args[0]['start'], args[0]['end']);
    }

    Object.values(value).forEach(visit);
  }

  visit(tree.program);
  assert.ok(closure);
  function effect(render: () => Promise<void>, present = true) {
    const messages: string[] = [];
    const appended: unknown[] = [];
    const element = { innerHTML: 'old canvas', appendChild: (canvas: unknown) => appended.push(canvas) };
    const code = harness.transformSync('export const effect = ' + closure, {
      filename: directory + 'Preview.tsx',
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code;
    const module: { exports: Record<string, unknown> } = { exports: {} };
    new Function('module', 'exports', 'labelObject', 'con', 'setError', '_l', code)(
      module,
      module.exports,
      { canvas: 'new canvas', render },
      { current: present ? element : null },
      (value: string) => messages.push(value),
      (text: string) => text,
    );
    const cleanup = invoke(module.exports, 'effect');
    return { cleanup, messages, appended };
  }

  const failed = effect(() => Promise.reject(new Error('render failed')));
  await Promise.resolve();
  assert.deepEqual(failed.messages, ['', '加载失败']);
  const sync = effect(() => {
    throw new Error('sync failure');
  });
  assert.deepEqual(sync.messages, ['', '加载失败']);
  let reject: (error: Error) => void = () => {};

  const pending = new Promise<void>((_, no) => {
    reject = no;
  });
  const stale = effect(() => pending);
  assert.equal(typeof stale.cleanup, 'function');
  if (typeof stale.cleanup === 'function') stale.cleanup();
  reject(new Error('outdated render'));
  await Promise.resolve();
  assert.deepEqual(stale.messages, ['']);
  const recovered = effect(() => Promise.resolve());
  await Promise.resolve();
  assert.deepEqual(recovered.messages, ['']);
  assert.deepEqual(recovered.appended, ['new canvas']);
  assert.equal(effect(() => Promise.reject(new Error('must not run')), false).appended.length, 0);
  console.log('Actual preview effect handles sync/async failure, stale completion and recovery');
}

checkPreviewFailures().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
