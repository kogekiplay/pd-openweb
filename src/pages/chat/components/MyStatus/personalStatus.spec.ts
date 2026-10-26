import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const server: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
const target = 'src/pages/chat/components/MyStatus/PersonalStatus.tsx';
const before = process.env['PERSONAL_STATUS_BEFORE_REV'];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function field(value: unknown, key: string): unknown {
  assert.ok(object(value));
  return value[key];
}
function call(fn: unknown, args: unknown[], receiver?: unknown): unknown {
  assert.equal(typeof fn, 'function');
  if (typeof fn !== 'function') throw new TypeError('Expected callable');
  return Reflect.apply(fn, receiver, args);
}
function element(value: unknown): value is import('react').ReactElement<Record<string, unknown>> {
  return React.isValidElement(value);
}
const self = 'status-self';
const globals = {
  md: { global: { Account: { accountId: self } } },
  _l: (text: string, ...args: unknown[]) => text.replace(/%(\d+)/g, (_, index: string) => String(args[Number(index)])),
};
function modules(state?: { value: boolean; changes: boolean[] }, api?: unknown, alerts: unknown[] = [], request?: (...args: unknown[]) => unknown) {
  const cache = new Map<string, unknown>();
  const leaf = ({ children }: { children?: import('react').ReactNode }) => children;
  const leaves: Record<string, unknown> = {
    react: state ? { ...React, useState: () => [state.value, (value: boolean) => state.changes.push(value)] } : React,
    'ming-ui': { Icon: 'i', UserHead: () => null },
    'ming-ui/antd-components': { Tooltip: leaf },
    'antd-mobile': { Button: 'button', Popup: 'section' },
    // Formatting boundary and implementation below are real. Only the unrelated
    // catalog renderer is an identity fixture for these empty/plain-string cases.
    'src/components/emotion/parseEmotion': (value: string) => value,
    'src/utils/core/string': { htmlEncodeReg: (value: string) => value },
    'src/components/comment/config': { AT_ALL_TEXT: { 0: 'all', 1: 'all', 2: 'all' } },
    'src/utils/platform/navigation/path': { pathCompletion: (value: string) => value },
    '../dialogSelectUser': () => { throw new Error('Unused dialog fixture'); },
    '../dialogSelectUser/GeneralSelect/ManageOftenUserDialog': {},
    'src/api/personalStyle': api || { cancelPersonalStatus: () => { throw new Error('Unexpected cancellation'); } },
  };
  function load(file: string): unknown {
    const absolute = path.join(root, file);
    if (cache.has(absolute)) return cache.get(absolute);
    const module: { exports: unknown } = { exports: {} };
    const text = before && (file === target || file === 'src/api/personalStyle.ts')
      ? cp.execFileSync('git', ['show', before + ':' + file], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(absolute, 'utf8');
    const code = harness.transformSync(text, { filename: absolute }).code;
    new Function('module', 'exports', 'require', 'md', '_l', 'alert', 'mdyAPI', code)(
      module, module.exports,
      (request: string): unknown => {
        if (Object.hasOwn(leaves, request)) return leaves[request];
        if (request.startsWith('src/') || request.startsWith('.')) {
          const base = request.startsWith('src/') ? path.join(root, request) : path.resolve(path.dirname(absolute), request);
          const resolved = harness.resolveFile(base);
          if (!resolved) throw new Error('Unresolved test source ' + request);
          return load(path.relative(root, resolved));
        }
        return require(request);
      }, globals.md, globals._l, (...args: unknown[]) => alerts.push(args), request || (() => { throw new Error('Unexpected SDK request'); }),
    );
    cache.set(absolute, module.exports);
    return module.exports;
  }
  return load;
}
function html(fn: unknown, props: unknown): string {
  return server.renderToStaticMarkup(React.createElement(() => {
    const value = call(fn, [props]);
    if (value === null) return null;
    assert.ok(element(value));
    return value;
  }));
}
function find(value: unknown, predicate: (item: import('react').ReactElement<Record<string, unknown>>) => boolean): import('react').ReactElement<Record<string, unknown>> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) { const found = find(item, predicate); if (found) return found; }
  } else if (element(value)) {
    if (predicate(value)) return value;
    return find(value.props['children'], predicate);
  }
  return undefined;
}
const valid = { statusId: 'status-1', durationOption: 10, beginTime: '2000-01-01 00:00:00', remark: 'working' };
const failures: string[] = [];
let checks = 0;
async function test(name: string, check: () => unknown) {
  checks++;
  try { await check(); } catch (error) { failures.push(name + ': ' + (error instanceof Error ? error.stack : String(error))); }
}
async function main() {
  const load = modules();
  const decodeUsers = field(load('src/ming-ui/functions/quickSelectUser/boundary.ts'), 'decodeUsers');
  const UserItem = field(load('src/ming-ui/functions/quickSelectUser/Comps.tsx'), 'UserItem');
  const PersonalStatus = field(load(target), 'default');
  for (const explicitUndefined of [false, true]) {
    await test('actual decodeUsers -> UserItem -> PersonalStatus renders a legal ' + (explicitUndefined ? 'undefined' : 'missing') + ' icon', () => {
      const status = explicitUndefined ? { ...valid, icon: undefined } : { ...valid };
      const user = { accountId: 'another-user', fullname: 'Another user', onStatusOption: status };
      const response = [user];
      assert.equal(call(decodeUsers, [response]), response);
      const output = html(UserItem, { user });
      assert.ok(output.includes('Another user'));
      assert.equal(user.onStatusOption, status);
      assert.equal(Object.hasOwn(status, 'icon'), explicitUndefined);
      assert.ok(output.includes('<span'));
    });
  }
  await test('full status display also supports the same missing optional icon', () => {
    const output = html(PersonalStatus, { onStatusOption: valid, accountId: 'another-user' });
    assert.ok(output.includes('working'));
  });
  await test('plain icon retains the real formatter escaping and sanitizer behavior', () => {
    const output = html(PersonalStatus, { onlyEmoji: true, onStatusOption: { ...valid, icon: '<script>x</script>' } });
    assert.ok(output.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(!output.includes('<script>'));
  });
  await test('invalid icon values still fail at the existing real decoder', () => {
    for (const icon of [null, {}, 1, false]) {
      assert.throws(() => html(PersonalStatus, { onlyEmoji: true, onStatusOption: { ...valid, icon } }), TypeError);
      assert.throws(() => call(decodeUsers, [[{ accountId: 'u', onStatusOption: { ...valid, icon } }]]), TypeError);
    }
    assert.throws(() => html(PersonalStatus, { onStatusOption: null }), TypeError);
  });
  await test('empty, disabled, expired, and other-user future statuses retain visibility guards', () => {
    for (const onStatusOption of [{}, { ...valid, durationOption: 0 }, { ...valid, endTime: '2001-01-01' }, { ...valid, beginTime: '2999-01-01' }]) {
      assert.equal(html(PersonalStatus, { accountId: 'another-user', onStatusOption }), '');
    }
  });
  await test('destructuring getter order and references remain unchanged', () => {
    const order: string[] = [];
    const status = Object.defineProperties({}, Object.fromEntries(Object.entries({ ...valid, icon: 'ok' }).map(([key, value]) => [key, { enumerable: true, get() { order.push(key); return value; } }])));
    const output = html(PersonalStatus, { accountId: self, onStatusOption: status });
    assert.ok(output.includes('working'));
    assert.deepEqual(order, ['statusId', 'icon', 'remark', 'beginTime', 'endTime', 'durationOption'].filter(key => Object.hasOwn(status, key)));
  });
  for (const success of [true, false]) {
    await test('desktop cancel preserves stop/API/callback/alert order for ' + success, async () => {
      const order: unknown[] = [];
      let returned: unknown;
      const api = { cancelPersonalStatus(args: unknown) { assert.equal(this, api); order.push(['request', args]); returned = Promise.resolve(success); return returned; } };
      const alerts: unknown[] = [];
      const state = { value: false, changes: [] };
      const fn = field(modules(state, api, alerts)(target), 'default');
      const props = { onStatusOption: { ...valid, icon: 'ok' }, showCancel: true, onCancel() { assert.equal(this, props); order.push('callback'); } };
      const tree = call(fn, [props]);
      const close = find(tree, item => item.type === 'i' && item.props['icon'] === 'closeelement-bg-circle');
      assert.ok(close);
      call(close.props['onClick'], [{ stopPropagation() { order.push('stop'); } }]);
      assert.ok(returned instanceof Promise);
      await returned;
      assert.deepEqual(order, success ? ['stop', ['request', { statusId: valid.statusId }], 'callback'] : ['stop', ['request', { statusId: valid.statusId }]]);
      assert.deepEqual(alerts, success ? [['取消成功']] : []);
    });
  }
  await test('mobile close opens confirmation before sending a request', () => {
    const state = { value: false, changes: [] as boolean[] };
    const fn = field(modules(state)(target), 'default');
    const tree = call(fn, [{ onStatusOption: { ...valid, icon: 'ok' }, showCancel: true, isMobile: true }]);
    const close = find(tree, item => item.type === 'i' && item.props['icon'] === 'close');
    assert.ok(close);
    const order: string[] = [];
    call(close.props['onClick'], [{ stopPropagation() { order.push('stop'); } }]);
    assert.deepEqual(order, ['stop']);
    assert.deepEqual(state.changes, [true]);
  });
  await test('synchronous request failure remains synchronous after propagation is stopped', () => {
    const failure = new Error('request failure');
    const order: string[] = [];
    const fn = field(modules({ value: false, changes: [] }, { cancelPersonalStatus() { order.push('request'); throw failure; } })(target), 'default');
    const tree = call(fn, [{ onStatusOption: { ...valid, icon: 'ok' }, showCancel: true }]);
    const close = find(tree, item => item.type === 'i' && item.props['icon'] === 'closeelement-bg-circle');
    assert.ok(close);
    assert.throws(() => call(close.props['onClick'], [{ stopPropagation() { order.push('stop'); } }]), error => error === failure);
    assert.deepEqual(order, ['stop', 'request']);
  });
  await test('actual cancellation endpoint preserves opaque returns, argument references and option modes', async () => {
    const calls: unknown[][] = [];
    let token: unknown;
    const sdk = field(modules(undefined, undefined, [], (...args: unknown[]) => { calls.push(args); return token; })('src/api/personalStyle.ts'), 'default');
    const fn = field(sdk, 'cancelPersonalStatus');
    assert.equal(field(fn, 'name'), 'cancelPersonalStatus');
    assert.equal(field(fn, 'length'), 1);
    assert.deepEqual(Object.keys(sdk), ['getAccountsPersonalStatus', 'getPersonalStatus', 'setPersonalStatus', 'cancelPersonalStatus', 'deletePersonalStatus', 'addOrUpdateStatus']);
    for (const options of [undefined, {}, null, { ajaxOptions: { sync: true } }, { isReadableStream: true }, { customParseResponse: true }, { agent: true }, { ajaxOptions: { responseType: 'blob' } }, { ajaxOptions: { agent: true } }]) {
      const reads: string[] = [];
      const args = Object.defineProperty({}, 'statusId', { enumerable: true, get() { reads.push('statusId'); return 's'; } });
      token = Object.freeze({ options });
      assert.equal(call(fn, [args, options], sdk), token);
      const invocation = calls.at(-1);
      assert.ok(invocation);
      assert.equal(invocation[0], 'PersonalStyle');
      assert.equal(invocation[1], 'CancelPersonalStatus');
      assert.equal(invocation[2], args);
      if (options === undefined) assert.deepEqual(invocation[3], {});
      else assert.equal(invocation[3], options);
      assert.deepEqual(reads, []);
    }
    const failure = new Error('SDK synchronous failure');
    const throwing = field(field(modules(undefined, undefined, [], () => { throw failure; })('src/api/personalStyle.ts'), 'default'), 'cancelPersonalStatus');
    assert.throws(() => call(throwing, [{}]), error => error === failure);
    const rejected = Promise.reject(failure);
    token = rejected;
    assert.equal(call(fn, [{}]), rejected);
    await assert.rejects(rejected, error => error === failure);
  });
  await test('mobile confirmation cancel and confirm retain their different request behavior', async () => {
    const changes: boolean[] = [];
    const calls: unknown[] = [];
    const fn = field(modules({ value: true, changes }, { cancelPersonalStatus(args: unknown) { calls.push(args); return Promise.resolve(false); } })(target), 'default');
    const tree = call(fn, [{ onStatusOption: { ...valid, icon: 'ok' }, showCancel: true, isMobile: true }]);
    const cancel = find(tree, item => item.type === 'button' && item.props['children'] === '取消');
    const confirm = find(tree, item => item.type === 'button' && item.props['children'] === '确认');
    assert.ok(cancel); assert.ok(confirm);
    call(cancel.props['onClick'], []);
    assert.deepEqual(changes, [false]); assert.deepEqual(calls, []);
    const event = { stopPropagation() { calls.push('stop'); } };
    call(confirm.props['onClick'], [event]);
    await Promise.resolve();
    assert.deepEqual(calls, ['stop', { statusId: valid.statusId }]);
    assert.deepEqual(changes, [false]);
  });
  await test('request rejection keeps the original unhandled derived rejection visible', async () => {
    const failure = new Error('asynchronous cancellation failure');
    const rejections: unknown[] = [];
    const listener = (error: unknown) => rejections.push(error);
    process.on('unhandledRejection', listener);
    try {
      const fn = field(modules({ value: false, changes: [] }, { cancelPersonalStatus() { return Promise.reject(failure); } })(target), 'default');
      const tree = call(fn, [{ onStatusOption: { ...valid, icon: 'ok' }, showCancel: true }]);
      const close = find(tree, item => item.type === 'i' && item.props['icon'] === 'closeelement-bg-circle');
      assert.ok(close);
      call(close.props['onClick'], [{ stopPropagation() {} }]);
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.deepEqual(rejections, [failure]);
    } finally { process.removeListener('unhandledRejection', listener); }
  });
  for (const failure of failures) console.error(failure);
  console.log(JSON.stringify({ checks, failures: failures.length, before: before || null, actualModules: ['decodeUsers', 'UserItem', 'PersonalStatus', 'createLinksForMessage', 'decodeMessageArgs', 'messageTokens', 'formatDateShow'], actualReactSsrAndStyled: true, fixtures: ['UI leaves', 'translation', 'plain-string emotion catalog', 'callback state/API only'] }));
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
