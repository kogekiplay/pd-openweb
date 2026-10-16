import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const crypto: typeof import('node:crypto') = require('node:crypto');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
const target = 'src/pages/worksheet/common/PrintQrBarCode/vectorLabel.ts';
const beforeRev = process.env['VECTOR_LABEL_BEFORE_REV'];
const RealPdf: unknown = require(path.join(root, 'staticfiles/pdf/pdfkit.standalone.min.js'));
const makeStream: unknown = require(path.join(root, 'staticfiles/pdf/blob-stream.js'));
if (typeof RealPdf !== 'function' || typeof makeStream !== 'function')
  throw new TypeError('Missing actual PDFKit resources');
Object.assign(globalThis, { window: {} });
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function read(value: unknown, key: string): unknown {
  if (!record(value)) throw new TypeError('Invalid fixture receiver');
  return value[key];
}

function call(value: unknown, key: string, args: unknown[] = []): unknown {
  const fn = read(value, key);
  if (typeof fn !== 'function') throw new TypeError(key);
  return Reflect.apply(fn, value, args);
}

function construct(value: unknown, args: unknown[]): unknown {
  if (typeof value !== 'function') throw new TypeError('Missing constructor');
  return Reflect.construct(value, args);
}

function bytes(value: unknown): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    const copy = new ArrayBuffer(value.byteLength);
    new Uint8Array(copy).set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    return copy;
  }

  throw new TypeError('Invalid font bytes');
}

function load(text: string, imports: Record<string, unknown> = {}, env: Record<string, unknown> = {}) {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const code = harness.transformSync(text, {
    filename: target,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const globals = { _l: (s: string) => s, ...env };
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (['lodash', 'jsbarcode', '@mdfe/qrcode-base'].includes(name) || name.startsWith('@babel/runtime/'))
        return require(name);
      throw new Error('Unexpected dependency ' + name);
    },
    ...Object.values(globals),
  );
  return module.exports;
}

const enums = load(fs.readFileSync(path.join(root, 'src/pages/worksheet/common/PrintQrBarCode/enum.ts'), 'utf8'));
const regular = bytes(fs.readFileSync(path.join(root, 'staticfiles/fonts/regular.ttf')));
const bold = bytes(fs.readFileSync(path.join(root, 'staticfiles/fonts/bold.ttf')));
interface Outcome {
  trace: unknown[][];
  progress: unknown[];
  scripts: string[];
  fonts: string[];
  pdf: unknown;
  stream: unknown;
  module: Record<string, unknown>;
}
function engine(
  historical = false,
  settings: { scriptError?: boolean; fontError?: boolean; missingConstructor?: boolean; cached?: boolean } = {},
): Outcome {
  const trace: unknown[][] = [];
  const scripts: string[] = [];
  const fonts: string[] = [];
  const progress: unknown[] = [];
  let actualPdf: unknown;
  let actualStream: unknown;

  function PDF(config: unknown) {
    trace.push(['document', config]);
    const doc = construct(RealPdf, [config]);
    actualPdf = doc;
    const facade: Record<string, unknown> = {};

    for (const key of [
      'on',
      'pipe',
      'end',
      'registerFont',
      'addPage',
      'font',
      'fontSize',
      'text',
      'widthOfString',
      'rect',
      'fill',
      'fillColor',
      'stroke',
      'strokeColor',
      'lineWidth',
      'moveTo',
      'lineTo',
    ]) {
      const original = read(doc, key);
      if (typeof original !== 'function') throw new TypeError(key);
      facade[key] = (...args: unknown[]) => {
        if (!['on', 'pipe', 'end', 'registerFont'].includes(key)) trace.push([key, ...args]);
        const result: unknown = Reflect.apply(original, doc, args);
        return result === doc ? facade : result;
      };
    }

    return facade;
  }

  const pdfWindow = { PDFDocument: settings.missingConstructor ? null : PDF };
  const imports = {
    'worksheet/common/PrintQrBarCode/enum': enums,
    'load-script': (src: string, _options: unknown, done: (error: Error | null) => void) => {
      scripts.push(src);
      done(settings.scriptError ? new Error('script failure') : null);
    },
    localforage: {
      getItem: async (key: string) => (settings.cached === false ? null : key === 'regular_font' ? regular : bold),
      setItem: async () => undefined,
    },
  };
  const module = load(
    historical && beforeRev
      ? cp.execFileSync('git', ['show', beforeRev + ':' + target], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, target), 'utf8'),
    imports,
    {
      window: pdfWindow,
      blobStream: () => {
        actualStream = construct(makeStream, []);
        return actualStream;
      },
      fetch: async (url: string) => {
        fonts.push(url);
        return {
          ok: !settings.fontError,
          status: settings.fontError ? 404 : 200,
          arrayBuffer: async () => (url.includes('bold') ? bold : regular),
        };
      },
    },
  );
  return {
    trace,
    progress,
    scripts,
    fonts,
    module,
    get pdf() {
      return actualPdf;
    },
    get stream() {
      return actualStream;
    },
  };
}

const fixtures: Array<{ name: string; options: Record<string, unknown> }> = [];
const texts = [
  { text: '设备 A-123 中文标题', forceInLine: true },
  { text: 'Unicode 混排 test 1234567890 abc\n第二行' },
  { text: '' },
];

for (const printType of [1, 3])
  for (const layout of [1, 2])
    for (const labelSize of [1, 2, 4])
      for (const codeSize of printType === 1 ? [1, 2, 3, 4] : [1, 2, 3])
        for (const position of layout === 1 ? [1, 2] : [3, 4]) {
          fixtures.push({
            name: [printType, layout, labelSize, codeSize, position].join('-'),
            options: {
              printType,
              layout,
              labelSize,
              codeSize,
              position,
              firstIsBold: codeSize % 2 === 0,
              showBarValue: codeSize !== 2,
              fontSize: codeSize % 2 ? 1 : 1.2,
              codeFaultTolerance: codeSize - 1,
              printData: [{ value: printType === 1 ? 'https://example.test/vector/123' : 'ABC-1234567', texts }],
            },
          });
        }

for (const [width, height] of [
  [70, 25],
  [20, 50],
])
  for (const printType of [1, 3])
    fixtures.push({
      name: 'custom-' + printType + '-' + width,
      options: {
        printType,
        labelSize: 100,
        labelCustomWidth: width,
        labelCustomHeight: height,
        codeSize: 2,
        position: 1,
        printData: [
          { value: 'ABC123', texts },
          { value: 'SECOND456', texts: [{ text: '第二张' }] },
        ],
      },
    });
async function render(test: { name: string; options: Record<string, unknown> }, historical = false) {
  const e = engine(historical);
  const config = structuredClone(test.options);
  const promise = call(e.module, 'generateLabelPdf', [config]);
  const url = await promise;
  assert.equal(typeof url, 'string');
  assert.deepEqual(config, test.options, 'preserve input');
  const blob = call(e.stream, 'toBlob', ['application/pdf']);
  assert.ok(blob instanceof Blob);
  const data = Buffer.from(await blob.arrayBuffer());
  assert.equal(data.subarray(0, 5).toString(), '%PDF-');
  const objects = Array.from(data.toString('latin1').matchAll(/\d+ 0 obj\n([\s\S]*?)\nendobj/g), m => m[1]).map(value =>
    value?.replace(/D:\d{14}Z/g, 'D:fixture-clock'),
  );
  if (typeof url === 'string') URL.revokeObjectURL(url);
  return { trace: e.trace, scripts: e.scripts, objects, bytes: data };
}

async function failures() {
  const options = {
    printType: 1,
    width: 40,
    height: 30,
    layout: 2,
    labelSize: 2,
    codeSize: 2,
    position: 3,
    printData: [],
  };

  for (const scenario of [{ scriptError: true }, { fontError: true, cached: false }, { missingConstructor: true }]) {
    const e = engine(false, scenario);
    const label = construct(e.module['default'], [options]);
    await assert.rejects(Promise.resolve(call(label, 'render')));
  }

  const cold = engine(false, { cached: false });
  const label = construct(cold.module['default'], [
    { ...options, onProgress: (value: unknown) => cold.progress.push(value) },
  ]);
  await call(label, 'render');
  assert.deepEqual(cold.fonts, ['/staticfiles/fonts/regular.ttf', '/staticfiles/fonts/bold.ttf']);
  assert.equal(cold.progress.length, 3);
  assert.equal(cold.progress.at(-1), undefined);
  assert.equal(cold.scripts.length, 2);
  const e = engine();
  const failureLabel = construct(e.module['default'], [options]);
  const handlers = new Map<string, (error?: unknown) => void>();
  if (!record(failureLabel)) throw new TypeError('Invalid label');
  failureLabel['stream'] = {
    on: (name: string, callback: (error?: unknown) => void) => handlers.set(name, callback),
    toBlobURL: () => {
      throw new Error('URL creation failure');
    },
  };
  failureLabel['doc'] = {
    on: (name: string, callback: (error?: unknown) => void) => handlers.set('doc-' + name, callback),
    end: () => handlers.get('finish')?.(),
  };
  await assert.rejects(Promise.resolve(call(failureLabel, 'getBlobUrl')), /URL creation failure/);
  failureLabel['doc'] = {
    on: (name: string, callback: (error?: unknown) => void) => handlers.set('doc-' + name, callback),
    end: () => handlers.get('error')?.(new Error('stream failure')),
  };
  await assert.rejects(Promise.resolve(call(failureLabel, 'getBlobUrl')), /stream failure/);
  failureLabel['doc'] = {
    on: (name: string, callback: (error?: unknown) => void) => handlers.set('doc-' + name, callback),
    end: () => handlers.get('doc-error')?.(new Error('document failure')),
  };
  await assert.rejects(Promise.resolve(call(failureLabel, 'getBlobUrl')), /document failure/);
  failureLabel['stream'] = {
    on: (name: string, handler: (error?: unknown) => void) => handlers.set(name, handler),
    toBlobURL: () => 'blob:fixture',
  };
  failureLabel['doc'] = { on: () => {}, end: () => handlers.get('finish')?.() };
  assert.equal(await call(failureLabel, 'getBlobUrl'), 'blob:fixture', 'Listen before ending synchronous streams');
  await assert.rejects(Promise.resolve(call(e.module, 'generateLabelPdf', [{ labelSize: 100 }])), TypeError);
}

async function run() {
  let checked = 0;
  const results = [];

  for (const fixture of fixtures) {
    const now = await render(fixture);
    const before = beforeRev ? await render(fixture, true) : undefined;

    if (before) {
      assert.deepEqual(now.trace, before.trace, fixture.name + ' actual PDFKit draw commands');
      assert.deepEqual(now.objects, before.objects, fixture.name + ' PDF objects');
    }

    results.push({
      name: fixture.name,
      sha256: crypto.createHash('sha256').update(now.bytes).digest('hex'),
      bytes: now.bytes.length,
    });
    checked++;
    if (process.env['VECTOR_LABEL_EVIDENCE'] && ['1-1-2-2-1', '3-2-2-1-3'].includes(fixture.name))
      fs.writeFileSync(path.join(process.env['VECTOR_LABEL_EVIDENCE'], fixture.name + '.pdf'), now.bytes);
  }

  await failures();
  if (process.env['VECTOR_LABEL_EVIDENCE'])
    fs.writeFileSync(
      path.join(process.env['VECTOR_LABEL_EVIDENCE'], 'pdf-cases.json'),
      JSON.stringify(results, null, 2),
    );
  console.log(
    `Vector labels passed (${checked} cases${beforeRev ? ' with historical comparison' : ''}) using actual PDFKit, embedded fonts, CODE128/QR matrices and PDF objects; script/font/stream/document failures passed`,
  );
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
