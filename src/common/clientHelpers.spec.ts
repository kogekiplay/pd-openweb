const assert = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const vm: typeof import('node:vm') = require('node:vm');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const generate = require('@babel/generator').default;
const { transformFileSync, transformSync } = require('../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
const moment: typeof import('moment') = require('moment');

function load(file: string, imports: Record<string, unknown>): unknown {
  const moduleLike: { exports: unknown } = { exports: {} };
  const code = transformFileSync(file, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (name: string) => {
    if (!(name in imports)) throw new Error('Unstubbed import: ' + name);
    return imports[name];
  });
  return moduleLike.exports;
}

const boundary = load(path.join(__dirname, 'globalClientTypes.ts'), {}) as {
  translationText(value: unknown): string;
};
const source = fs.readFileSync(path.join(__dirname, 'global.ts'), 'utf8');
const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const names = new Set(['_l', 'createTimeSpan']);
const assignments = ast.program.body.filter(node => {
  const expression = node.type === 'ExpressionStatement' ? node.expression : undefined;
  return (
    expression?.type === 'AssignmentExpression' &&
    expression.left.type === 'MemberExpression' &&
    expression.left.object.type === 'Identifier' &&
    expression.left.object.name === 'window' &&
    expression.left.property.type === 'Identifier' &&
    names.has(expression.left.property.name)
  );
});
assert.equal(assignments.length, 2, 'Execute both actual global helper assignments');
const code = transformSync(assignments.map(node => generate(node).code).join('\n'), {
  filename: path.join(__dirname, 'global.ts'),
}).code;
interface ClientHelpers {
  _l(key: string, ...args: Array<string | number>): string;
  createTimeSpan(date: unknown, showType?: number): string;
}
function boot(translations?: Record<string, unknown>): ClientHelpers {
  const target = {} as ClientHelpers;
  vm.runInNewContext(code, {
    window: target,
    translations,
    translationText: boundary.translationText,
    moment,
    _l: (key: string, ...args: Array<string | number>) => target._l(key, ...args),
  });
  return target;
}
const helpers = boot({ 'Hello %0': '欢迎 %0', Empty: '', Zero: 0, Bad: 7 });
assert.equal(helpers._l('Hello %0', '王'), '欢迎 王');
assert.equal(helpers._l('Hello %0', '$&'), '欢迎 %0', 'Preserve native replacement dollar tokens');
assert.equal(helpers._l('Missing %0', 3), 'Missing 3');
assert.equal(helpers._l('Empty'), 'Empty');
assert.equal(helpers._l('Zero'), 'Zero', 'Falsy translation values retain the original key fallback');
assert.equal(helpers._l('Context%12345'), 'Context');
assert.equal(helpers._l('A\\B'), 'AB');
assert.equal(boot()._l('No dictionary'), 'No dictionary');
assert.throws(() => helpers._l('Bad'), TypeError, 'Truthy malformed translations do not become successful text');

const originalNow = moment.now;
moment.now = () => Date.UTC(2026, 9, 10, 12, 34, 56);
try {
  const date = (year: number, month: number, day: number, hour = 12, minute = 34, second = 56) =>
    moment.utc([year, month - 1, day, hour, minute, second]);
  assert.equal(helpers.createTimeSpan(date(2026, 10, 10, 12, 34, 26)), '刚刚');
  assert.equal(helpers.createTimeSpan(date(2026, 10, 10, 12, 24, 56)), '10分钟前');
  assert.equal(helpers.createTimeSpan(date(2026, 10, 10, 12, 24, 56), 2), '12:24');
  assert.equal(helpers.createTimeSpan(date(2026, 10, 10, 13, 0, 0)), '13:00');
  assert.equal(helpers.createTimeSpan(date(2026, 10, 10, 9, 34, 56)), '今天 09:34');
  assert.equal(helpers.createTimeSpan(date(2026, 10, 10, 9, 34, 56), 2), ' 09:34');
  assert.equal(helpers.createTimeSpan(date(2026, 10, 9)), '昨天 12:34');
  assert.equal(helpers.createTimeSpan(date(2026, 10, 9), 5), '昨天');
  assert.equal(helpers.createTimeSpan(date(2026, 9, 10)), '9月10日 12:34');
  assert.equal(helpers.createTimeSpan(date(2026, 9, 10), 5), '9月10日');
  assert.equal(helpers.createTimeSpan(date(2025, 9, 10)), '2025年9月10日 12:34');
  assert.equal(helpers.createTimeSpan(date(2025, 9, 10), 2), '2025年');
  assert.equal(helpers.createTimeSpan(date(2025, 9, 10), 3), '2025年09月10日 12:34:56');
  assert.equal(helpers.createTimeSpan(date(2025, 9, 10), 4), '2025年09月10日');
  assert.equal(helpers.createTimeSpan(undefined), '刚刚');
  assert.match(helpers.createTimeSpan(new Date(NaN)), /Invalid date/);
} finally {
  moment.now = originalNow;
}

let mobile = false;
const observed: Array<[string, unknown]> = [];
const controller = { close() {} };
const message = Object.fromEntries(
  ['success', 'error', 'warning', 'info', 'loading'].map(kind => [
    kind,
    (value: unknown) => observed.push([kind, value]),
  ]),
);
message['destroy'] = (key: unknown) => observed.push(['destroy', key]);
const alerts = load(path.join(__dirname, '../ming-ui/functions/alert/index.tsx'), {
  react: React,
  'react/jsx-runtime': require('react/jsx-runtime'),
  antd: { message },
  'antd-mobile': {
    Toast: {
      show: (value: unknown) => {
        observed.push(['mobile', value]);
        return controller;
      },
      clear: () => observed.push(['clear', undefined]),
    },
  },
  'src/utils/common': { browserIsMobile: () => mobile },
}) as { antAlert(content?: unknown, type?: number): unknown; destroyAlert(key?: string | number | bigint): void };
const last = (): Record<string, unknown> => {
  const value = observed.at(-1)?.[1];
  assert.ok(value && typeof value === 'object');
  return value as Record<string, unknown>;
};
assert.equal(alerts.antAlert('<b>Saved</b>'), undefined);
assert.equal(observed.at(-1)?.[0], 'success');
assert.equal(last()['content'], 'Saved');
assert.equal(last()['duration'], 3);
for (const [type, name] of [
  [1, 'success'],
  [2, 'error'],
  [3, 'warning'],
  [4, 'info'],
  [5, 'loading'],
  [0, 'success'],
  [8, 'success'],
]) {
  alerts.antAlert('Text', Number(type));
  assert.equal(observed.at(-1)?.[0], name);
}
const node = React.createElement('strong', null, 'Node');
alerts.antAlert(node);
assert.equal(last()['content'], node, 'Top-level React elements retain their original identity');
const onClose = () => observed.push(['closed', undefined]);
const style = { width: 100 };
alerts.antAlert({ msg: '<i>Configured</i>', type: 2, duration: 5000, key: 12, onClose, style });
assert.equal(last()['content'], 'Configured');
assert.equal(last()['duration'], 5);
assert.equal(last()['onClose'], onClose);
assert.equal(last()['style'], style);
assert.equal(last()['key'], 12);
alerts.antAlert({ msg: node });
assert.equal(last()['content'], '[object Object]', 'Configured elements retain the old text conversion');
alerts.antAlert({ type: undefined, duration: undefined });
assert.equal(observed.at(-1)?.[0], 'success');
assert.ok(Number.isNaN(last()['duration']), 'An explicit undefined duration must not become the default');
alerts.antAlert(null);
assert.equal(last()['content'], '');
alerts.destroyAlert('same-key');
assert.deepEqual(observed.at(-1), ['destroy', 'same-key']);
mobile = true;
assert.equal(alerts.antAlert({ msg: 'Mobile', duration: 700, onClose }), controller);
assert.equal(last()['duration'], 700);
assert.equal(last()['afterClose'], onClose);
alerts.antAlert({ msg: 'PC on mobile', isPcAlert: true });
assert.equal(observed.at(-1)?.[0], 'success');
alerts.destroyAlert('ignored-mobile-key');
assert.deepEqual(observed.at(-1), ['clear', undefined]);
console.log('Actual global translation/time and alert message/controller protocols passed');
