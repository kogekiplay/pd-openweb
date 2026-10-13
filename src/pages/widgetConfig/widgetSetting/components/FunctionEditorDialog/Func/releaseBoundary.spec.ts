const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const {
  transformSync,
}: import('../../../../../../../scripts/spec-harness.ts').SpecHarness = require('../../../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../../../..');
const dir = path.relative(root, __dirname).split(path.sep).join('/');
Reflect.set(globalThis, 'window', { isIphone: false });
Reflect.set(globalThis, '_l', (key: string, ...args: unknown[]) =>
  args.reduce<string>((text, arg, index) => text.replace(new RegExp('%' + index, 'g'), String(arg)), key),
);
function loader(revision?: string) {
  const cache = new Map<string, Record<string, unknown>>();
  function load(relative: string): Record<string, unknown> {
    if (cache.has(relative)) return cache.get(relative)!;
    const source = revision
      ? cp.execFileSync('git', ['show', revision + ':' + relative], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, relative), 'utf8');
    const code = transformSync(source, {
      filename: path.join(root, relative),
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    if (!code?.code) throw new Error('Unable to compile ' + relative);
    const module: { exports: Record<string, unknown> } = { exports: {} };
    cache.set(relative, module.exports);
    new Function('module', 'exports', 'require', 'console', code.code)(
      module,
      module.exports,
      (name: string) => {
        if (name === 'src/pages/widgetConfig/config/widget')
          return {
            WIDGETS_TO_API_TYPE_ENUM: {
              TEXT: 2,
              SWITCH: 36,
              NUMBER: 6,
              MONEY: 8,
              DATE: 15,
              DATE_TIME: 16,
              FLAT_MENU: 9,
              MULTI_SELECT: 10,
              DROP_DOWN: 11,
              TIME: 46,
              LOCATION: 40,
            },
          };
        if (name.startsWith('.') || name.startsWith('src/')) {
          const base = name.startsWith('.') ? path.posix.join(path.posix.dirname(relative), name) : name;
          const next = [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'].find(candidate =>
            fs.existsSync(path.join(root, candidate)) && fs.statSync(path.join(root, candidate)).isFile(),
          );
          if (!next) throw new Error('Missing source ' + base);
          return load(next);
        }
        return require(name);
      },
      { log() {}, error() {} },
    );
    return module.exports;
  }
  return load;
}
function invoke(module: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
  const fn = module[name];
  if (typeof fn !== 'function') throw new Error('Missing ' + name);
  return Reflect.apply(fn, undefined, args);
}
const load = loader();
const current = load(dir + '/releaseEntry.ts');
const oldRevision = process.env['FUNCTION_DELIVERY_BEFORE_REV'];
const old = oldRevision ? loader(oldRevision)(dir + '/releaseEntry.ts') : undefined;
const Base64 = require('js-base64').Base64;
const scenarios = [
  {
    control: { type: 6, expression: 'SUM($x$,2)' },
    formData: [{ type: 6, controlId: 'x', value: '3' }],
    expected: '5',
  },
  { control: { type: 6, expression: 'COMBIN(5,3)' }, formData: [], expected: '10' },
  {
    control: { type: 2, expression: 'DATEIF($start$,$end$)' },
    formData: [
      { type: 15, controlId: 'start', value: '2026-10-01' },
      { type: 15, controlId: 'end', value: '2026-10-03' },
    ],
    langCode: 'en',
    expected: '2day',
  },
  { control: { type: 6, expression: 'HOUR("11:35")' }, formData: [], expected: '11' },
  { control: { type: 2, expression: '"hello"' }, formData: [], expected: 'hello' },
  { control: { type: 36, expression: 'OR(FALSE(),TRUE())' }, formData: [], expected: 1 },
  { control: { type: 2, expression: 'SUM(' }, formData: [], expected: '' },
];
let checked = 0;
for (const row of scenarios)
  for (const kind of ['obj', 'str', 'mobile']) {
    const input = {
      control: row.control,
      formData: row.formData,
      langCode: 'langCode' in row ? row.langCode : undefined,
    };
    const create = () => {
      const text = JSON.stringify(input);
      return kind === 'obj' ? JSON.parse(text) : kind === 'str' ? text : Base64.encode(text);
    };
    const actual = invoke(current, 'run', create(), kind);
    assert.equal(actual, row.expected, String(row.control.expression) + ' ' + kind);
    if (old) assert.deepEqual(actual, invoke(old, 'run', create(), kind));
    checked++;
  }
const boundary = load(dir + '/releaseParameterBoundary.ts');
const rawControl = { type: 6, expression: 'SUM(1,2)', metadata: { kept: true } };
const rawField = { type: 6, controlId: 'x', value: '3', metadata: { kept: true } };
const request = invoke(boundary, 'readFunctionLibraryParameters', { control: rawControl, formData: [rawField] });
if (request === null || typeof request !== 'object') throw new Error('Missing request');
assert.strictEqual(Reflect.get(request, 'control'), rawControl);
assert.strictEqual(Reflect.get(request, 'formData')[0], rawField);
assert.equal(invoke(current, 'run', { control: rawControl, formData: [] }, 'obj'), '3');
assert.ok('advancedSetting' in rawControl, 'Legacy shorthand still populates the original valid descriptor');
assert.equal(
  invoke(
    current,
    'run',
    { control: { type: 6, advancedSetting: null, expression: 'SUM(1,2)' }, formData: null },
    'obj',
  ),
  '3',
);
for (const input of [
  null,
  [],
  true,
  {},
  { control: null },
  { control: { type: '6' } },
  { control: { options: [null] } },
  { control: { advancedSetting: { defaultfunc: {} } } },
  { control: { type: 6 }, formData: {} },
])
  assert.equal(invoke(current, 'run', input, 'obj'), '');
for (const kind of ['str', 'mobile'])
  for (const input of [null, {}, 'bad-json']) assert.equal(invoke(current, 'run', input, kind), '');
assert.equal(invoke(current, 'run', {}, 'unknown'), undefined);
const local = load(dir + '/local/index.ts');
const oldLocal = oldRevision ? loader(oldRevision)(dir + '/local/index.ts') : undefined;
for (const code of ['en', 'zh_hans', 'ja', 'no-such-lang', undefined, 0]) {
  invoke(local, 'initLang', code);
  if (oldLocal) invoke(oldLocal, 'initLang', code);
  for (const [key, args] of [
    ['开始日期不是日期类型', []],
    ['name %0 %1', ['A', 2]],
    ['path\\name', []],
  ] as const) {
    const got = invoke(local, 'getLang', key, ...args);
    assert.equal(typeof got, 'string');
    if (oldLocal) assert.equal(got, invoke(oldLocal, 'getLang', key, ...args));
    checked++;
  }
}
const methods: string[] = [];
const store = {
  initAndLoadRows: () => {},
  getState() {
    methods.push(this === store ? 'receiver' : 'wrong');
    return { rows: [{ rowid: 'empty-1' }, { rowid: 'row-1', value: 0 }] };
  },
};
assert.equal(
  invoke(
    current,
    'run',
    {
      control: { type: 6, expression: 'COUNTARRAY($rows$)' },
      formData: [{ controlId: 'rows', type: 34, value: '[]', store }],
    },
    'obj',
  ),
  '1',
);
assert.deepEqual(methods, ['receiver']);
console.log(
  'Function delivery and localization:',
  checked,
  'valid cases; malformed requests, nullable placeholders, identity and store receiver passed',
);
