import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const moment: typeof import('moment') = require('moment');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
const prefix = 'src/pages/chat/components/MyStatus/';
const before = process.env['STATUS_DATES_BEFORE_REV'];
function source(file: string): string {
  return before
    ? cp.execFileSync('git', ['show', before + ':' + file], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  assert.ok(record(value));
  return value[key];
}
function invoke(fn: unknown, args: unknown[]): unknown {
  assert.equal(typeof fn, 'function');
  if (typeof fn !== 'function') throw new TypeError('Expected callable fixture');
  return Reflect.apply(fn, undefined, args);
}
function load(text: string, file: string, imports: Record<string, unknown> = {}, env: Record<string, unknown> = {}) {
  const module: { exports: unknown } = { exports: {} };
  const code = harness.transformSync(text, { filename: path.join(root, file) }).code;
  const globals = {
    _l: (text: string, ...args: unknown[]) => text.replace(/%(\d+)/g, (_, i: string) => String(args[Number(i)])),
    ...env,
  };
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (['react', 'react/jsx-runtime', 'moment', 'lodash'].includes(name) || name.startsWith('@babel/runtime/')) {
        return require(name);
      }
      throw new Error('Unexpected dependency ' + name);
    },
    ...Object.values(globals),
  );
  return module.exports;
}
const config = load(source(prefix + 'config.ts'), prefix + 'config.ts');
const util = load(source(prefix + 'util.ts'), prefix + 'util.ts');
const Select = Object.assign(() => null, { Option: () => null });
const RangePicker = () => null;
const Trigger = () => null;
const styled = Object.assign((base: unknown) => () => Object.assign(() => null, { base }), {
  div: () => () => null,
});
const locales = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
function find(
  node: unknown,
  predicate: (element: import('react').ReactElement<Record<string, unknown>>) => boolean,
): import('react').ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate);
      if (found) return found;
    }
    return undefined;
  }
  if (!React.isValidElement<Record<string, unknown>>(node)) return undefined;
  if (predicate(node)) return node;
  return find(node.props.children, predicate) || find(node.props.popup, predicate);
}
function host(props: Record<string, unknown> = {}, language?: number) {
  const values: unknown[] = [];
  const emitted: unknown[] = [];
  let cursor = 0;
  const hooks = {
    ...React,
    useState(initial: unknown) {
      const index = cursor++;
      if (!Object.hasOwn(values, index)) values[index] = initial;
      return [
        values[index],
        (update: unknown) => {
          values[index] = typeof update === 'function' ? invoke(update, [values[index]]) : update;
        },
      ];
    },
    useRef(initial: unknown) {
      const index = cursor++;
      if (!Object.hasOwn(values, index)) values[index] = { current: initial };
      return values[index];
    },
  };
  const module = load(
    source(prefix + 'CustomDatePicker.tsx'),
    prefix + 'CustomDatePicker.tsx',
    {
      react: hooks,
      antd: { Select },
      'styled-components': styled,
      '@rc-component/trigger': Trigger,
      'ming-ui': { Icon: () => null },
      'src/ming-ui/components/mdAntPickers': { DatePicker: { RangePicker } },
      'antd/es/date-picker/locale/zh_CN': locales[0],
      'antd/es/date-picker/locale/en_US': locales[1],
      'antd/es/date-picker/locale/ja_JP': locales[2],
      'antd/es/date-picker/locale/zh_TW': locales[3],
      './config': config,
      './util': util,
    },
    { getCurrentLangCode: () => language },
  );
  const render = () => {
    cursor = 0;
    return invoke(read(module, 'default'), [{ ...props, changeDate: (value: unknown) => emitted.push(value) }]);
  };
  const select = () => {
    const node = find(render(), n => n.type === Select);
    assert.ok(node);
    return node.props;
  };
  const picker = () => {
    const node = find(render(), n => record(n.type) && n.type['base'] === RangePicker);
    assert.ok(node);
    return node.props;
  };
  const open = () => {
    invoke(select().onSelect, [1000]);
    return picker();
  };
  return { render, select, picker, open, emitted };
}
let checks = 0;
const failures: string[] = [];
function test(name: string, run: () => void) {
  try {
    run();
    checks++;
  } catch (error) {
    failures.push(name + ': ' + String(error));
  }
}
const start = moment('2026-10-26 10:00:00');
const end = moment('2026-10-27 11:00:00');

test('clearing the actual change callback resets both local dates without committing a status', () => {
  const h = host();
  invoke(h.open().onChange, [
    [start, end],
    ['', ''],
  ]);
  invoke(h.picker().onChange, [null, ['', '']]);
  assert.deepEqual(h.picker().value, [null, null]);
  assert.deepEqual(h.emitted, [{ fixedValue: 1000 }]);
});
test('confirm forwards the same Moment objects and closes custom mode', () => {
  const h = host();
  invoke(h.open().onOk, [[start, end]]);
  const payload = h.emitted[1];
  assert.equal(read(payload, 'startDate'), start);
  assert.equal(read(payload, 'endDate'), end);
  assert.deepEqual(Object.keys(record(payload) ? payload : {}), ['startDate', 'endDate']);
  assert.equal(typeof h.select().value, 'string');
});
test('reversed change keeps the original start reference and clears only end', () => {
  const h = host();
  invoke(h.open().onChange, [
    [end, start],
    ['', ''],
  ]);
  const value = h.picker().value;
  assert.ok(Array.isArray(value));
  assert.equal(value[0], end);
  assert.equal(value[1], null);
});
test('invalid confirmation does not emit or close', () => {
  const h = host();
  h.open();
  for (const value of [null, [], [start, null], [start, start], [end, start]]) invoke(h.picker().onOk, [value]);
  assert.deepEqual(h.emitted, [{ fixedValue: 1000 }]);
  assert.equal(h.picker().open, true);
});
test('unexpected undefined change retains its native failure', () => {
  const h = host();
  assert.throws(() => invoke(h.open().onChange, [undefined]), TypeError);
});
test('the pending popup container remains null until its ref is mounted', () => {
  const h = host();
  assert.equal(invoke(h.open().getPopupContainer, []), null);
});
test('display labels are not submitted as duration options', () => {
  const h = host();
  invoke(h.select().onSelect, ['今天 10:00 - 明天 11:00']);
  assert.deepEqual(h.emitted, []);
});
test('all actual numeric options preserve their payload and ordering', () => {
  const options = read(config, 'dateOptions');
  assert.ok(Array.isArray(options));
  for (const option of options) {
    const value = read(option, 'value');
    const h = host();
    invoke(h.select().onSelect, [value]);
    assert.deepEqual(h.emitted, [{ fixedValue: value }]);
    assert.equal(h.emitted.length, 1);
  }
});
test('zero duration keeps the existing default and numeric language fallback remains unchanged', () => {
  assert.equal(host({ durationOption: 0 }).select().value, 10);
  for (const lang of [0, 1, 2, 3, 99, undefined]) {
    const h = host({}, lang);
    const expected = lang === 0 ? locales[0] : lang === 2 ? locales[2] : lang === 3 ? locales[3] : locales[1];
    assert.equal(h.open().locale, expected);
  }
});

test('the actual date formatter accepts omitted, string, Date and Moment inputs without mutation', () => {
  const originalNow = moment.now;
  moment.now = () => new Date(2026, 9, 24, 12, 30).getTime();
  try {
    const format = read(util, 'formatDateShow');
    assert.equal(invoke(format, []), '今天 12:30');
    assert.equal(invoke(format, [undefined]), '今天 12:30');
    assert.equal(invoke(format, ['2026-10-24 00:00']), '今天');
    assert.equal(invoke(format, ['2026-10-24 23:59']), '今天');
    assert.equal(invoke(format, ['2026-10-25 09:15']), '明天 09:15');
    assert.equal(invoke(format, [new Date(2026, 9, 27)]), '10月27日');
    const date = moment('2027-01-01 09:15');
    const originalValue = date.valueOf();
    assert.equal(invoke(format, [date]), '2027年01月01日 09:15');
    assert.equal(date.valueOf(), originalValue);
  } finally {
    moment.now = originalNow;
  }
});

const parent = source(prefix + 'index.tsx');
const ast = harness.parser.parse(parent, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
let callbackSource: string | undefined;
function walk(value: unknown) {
  if (!record(value)) return;
  if (value['type'] === 'JSXOpeningElement' && read(value['name'], 'name') === 'CustomDatePicker') {
    const attrs = value['attributes'];
    assert.ok(Array.isArray(attrs));
    const attr = attrs.find(a => record(a) && record(a['name']) && a['name']['name'] === 'changeDate');
    const expression = read(read(attr, 'value'), 'expression');
    const start = read(expression, 'start'),
      end = read(expression, 'end');
    assert.equal(typeof start, 'number');
    assert.equal(typeof end, 'number');
    if (typeof start === 'number' && typeof end === 'number') callbackSource = parent.slice(start, end);
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(walk);
    else if (record(child)) walk(child);
  }
}
walk(ast);
assert.ok(callbackSource);
const consumer = load(
  `import _ from 'lodash'; export const make = (index, statusList, setStatusList) => (${callbackSource});`,
  prefix + 'index.tsx',
);
function apply(payload: unknown) {
  const extra = { keep: true };
  const original = Object.freeze({
    statusId: 'draft',
    durationOption: 1000,
    beginTime: '2026-10-26 10:00:00',
    endTime: '2026-10-27 11:00:00',
    extra,
  });
  const list = Object.freeze([original]);
  let updated: unknown;
  const fn = invoke(read(consumer, 'make'), [
    0,
    list,
    (value: unknown) => {
      updated = value;
    },
  ]);
  invoke(fn, [payload]);
  assert.ok(Array.isArray(updated));
  assert.notEqual(updated, list);
  assert.notEqual(updated[0], original);
  assert.equal(original.beginTime, '2026-10-26 10:00:00');
  assert.deepEqual(read(updated[0], 'extra'), extra);
  return updated[0];
}
test('the actual parent retains API beginTime and endTime when only duration changes', () => {
  const output = apply({ fixedValue: 10 });
  assert.equal(read(output, 'beginTime'), '2026-10-26 10:00:00');
  assert.equal(read(output, 'endTime'), '2026-10-27 11:00:00');
  assert.equal(read(output, 'durationOption'), 10);
});
test('the actual parent formats a confirmed date pair and preserves its duration', () => {
  const output = apply({ startDate: start, endDate: end });
  assert.equal(read(output, 'beginTime'), start.format('YYYY-MM-DD HH:mm:ss'));
  assert.equal(read(output, 'endTime'), end.format('YYYY-MM-DD HH:mm:ss'));
  assert.equal(read(output, 'durationOption'), 1000);
});
for (const failure of failures) console.error(failure);
console.log(
  JSON.stringify({
    checks,
    failures: failures.length,
    before: before || null,
    fullPickerModule: true,
    actualParentCallback: true,
    reactStateAndUILeavesAreFixtures: true,
  }),
);
if (failures.length) process.exitCode = 1;
