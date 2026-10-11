import type { ReactNode } from 'react';
import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
const directory = 'src/components/pay/paySuccess';
const root = path.resolve(__dirname, '../../../..');
const before = process.env['PAY_SUCCESS_BEFORE_REV'];

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture object');
  return value[key];
}
function call(value: unknown, ...args: unknown[]): unknown {
  if (typeof value !== 'function') throw new TypeError('Invalid fixture function');
  return Reflect.apply(value, undefined, args);
}
function renderNode(value: unknown): ReactNode {
  if (value === undefined || value === null) return value as ReactNode;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (React.isValidElement(value)) return value;
  throw new TypeError('Invalid page React element');
}
function normalizeHtml(value: string): string {
  return value.replace(/sc-[A-Za-z0-9_-]+ [A-Za-z0-9_-]+/g, 'styled-class');
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function flush() {
  // Drain the actual Promise chain; no wall-clock delay or fixed timeout is involved.
  for (let i = 0; i < 6; i++) await Promise.resolve();
}
function fixture(old = false, payType = '', missingApp = false) {
  const states: unknown[] = [];
  const writes: unknown[] = [];
  const effects: Array<() => unknown> = [];
  const requests: Array<{ args: unknown; pending: ReturnType<typeof deferred> }> = [];
  const alerts: unknown[] = [];
  let cursor = 0;
  let component: unknown;
  let mountCount = 0;
  const hooks = {
    ...React,
    useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (value: unknown) => {
          states[index] = value;
          writes.push(value);
        },
      ];
    },
    useEffect: (effect: () => unknown) => {
      effects.push(effect);
    },
  };
  const cache = new Map<string, unknown>();
  const globals = {
    md: {
      global: {
        Account: { projects: [{ projectId: 'project', companyName: 'Company' }] },
        Config: { ServiceTel: 'service' },
      },
    },
    document: { querySelector: () => (missingApp ? null : {}) },
    _l: (text: string, ...args: unknown[]) =>
      args.reduce<string>((result, item, i) => result.replace(new RegExp('%' + i, 'g'), String(item)), text),
    alert: (value: unknown) => alerts.push(value),
  };
  function load(file: string): unknown {
    if (cache.has(file)) return cache.get(file);
    const source =
      old && before && file === directory + '/index.tsx'
        ? execFileSync('git', ['show', before + ':' + file], { cwd: root, encoding: 'utf8' })
        : fs.readFileSync(path.join(root, file), 'utf8');
    const compiled = harness.transformSync(source, {
      filename: path.join(root, file),
      presets: [['@babel/preset-env', { targets: { chrome: '103' } }]],
    });
    if (!compiled?.code) throw new TypeError('Missing actual Babel output');
    const moduleLike: { exports: unknown } = { exports: {} };
    new Function('module', 'exports', 'require', ...Object.keys(globals), compiled.code)(
      moduleLike,
      moduleLike.exports,
      (name: string): unknown => {
        if (name === 'react') return hooks;
        if (name === 'react-dom/client')
          return {
            createRoot: () => ({
              render: () => {
                mountCount++;
              },
            }),
          };
        if (name === 'styled-components' || name === 'src/utils/typedStyled') return require('styled-components');
        if (name === 'ming-ui/components/DocumentTitle')
          return {
            __esModule: true,
            default: (props: { title: string }) => React.createElement('title', {}, props.title),
          };
        if (name === '../payHeader')
          return {
            __esModule: true,
            default: (props: { title?: string; projectId?: string }) =>
              React.createElement('header', { 'data-project': props.projectId }, props.title),
          };
        if (name === 'src/common/preall')
          return {
            __esModule: true,
            default: (Comp: unknown) => {
              component = Comp;
              return Comp;
            },
          };
        if (name === 'src/utils/common')
          return {
            getRequest: () => ({ orderId: 'order', payType }),
            pathCompletion: (url: string) => '/prefix' + url,
          };
        if (name === 'src/api/order')
          return {
            __esModule: true,
            default: {
              getProjectPayResult: (args: unknown) => {
                const pending = deferred();
                requests.push({ args, pending });
                return pending.promise;
              },
            },
          };
        if (name === './paySuccessBoundary') return load(directory + '/paySuccessBoundary.ts');
        if (
          name === 'lodash' ||
          name === 'moment' ||
          name === 'react/jsx-runtime' ||
          name.startsWith('@babel/runtime/')
        )
          return require(name);
        throw new Error('Unstubbed payment success dependency ' + name);
      },
      ...Object.values(globals),
    );
    cache.set(file, moduleLike.exports);
    return moduleLike.exports;
  }
  load(directory + '/index.tsx');
  const render = () => {
    cursor = 0;
    effects.length = 0;
    return ReactDOM.renderToStaticMarkup(renderNode(call(component)));
  };
  const effect = () => call(effects[0]);
  const settle = (value: unknown, index = 0) => {
    const request = requests[index];
    if (!request) throw new TypeError('Missing actual request');
    request.pending.resolve(value);
  };
  const fail = (value: unknown) => {
    const request = requests[0];
    if (!request) throw new TypeError('Missing actual request');
    request.pending.reject(value);
  };
  return { render, effect, settle, fail, requests, alerts, writes, states, mountCount, load };
}

async function run() {
  let observations = 0;
  for (const orderType of [0, 1, 2, 3, 4, 6, 9, 10, 11, 999])
    for (const unLimited of [false, true])
      for (const totalPrice of [0, '123.45']) {
        const result = {
          orderType,
          unLimited,
          totalPrice,
          totalUserCount: 8,
          projectId: 'project',
          version: { name: 'Version' },
          startDate: '2026-10-11',
          endDate: '2027-10-11',
        };
        const current = fixture(false, '1');
        const initial = current.render();
        current.effect();
        assert.deepEqual(current.requests[0]?.args, { orderId: 'order' });
        current.settle(result);
        await flush();
        assert.strictEqual(current.states[0], result, 'Validated responses retain the exact source object');
        assert.equal(current.alerts.length, 0);
        const html = current.render();
        assert.ok(html.includes('123.45元') || html.includes('0元'));
        assert.ok(
          html.includes(
            orderType === 4 ? '/prefix/admin/expansionservice/project/portalupgrade' : '/prefix/admin/home/project',
          ),
        );
        assert.equal(current.mountCount, 1);
        if (before) {
          const previous = fixture(true, '1');
          assert.equal(normalizeHtml(initial), normalizeHtml(previous.render()));
          previous.effect();
          previous.settle(result);
          await flush();
          assert.equal(
            normalizeHtml(html),
            normalizeHtml(previous.render()),
            'Complete page HTML matches historical production source',
          );
        }
        observations++;
      }
  for (const result of [
    {},
    { orderType: 1 },
    { orderType: 9, version: {} },
    { orderType: 4, totalPrice: 0, totalUserCount: 0 },
  ]) {
    const current = fixture();
    current.render();
    current.effect();
    current.settle(result);
    await flush();
    const html = current.render();
    assert.strictEqual(current.states[0], result);
    if (before) {
      const previous = fixture(true);
      previous.render();
      previous.effect();
      previous.settle(result);
      await flush();
      assert.equal(
        normalizeHtml(html),
        normalizeHtml(previous.render()),
        'Missing optional fields preserve legacy formatting',
      );
    }
    observations++;
  }
  const invalid: unknown[] = [
    null,
    false,
    '',
    'success',
    [],
    { orderType: '1' },
    { unLimited: 1 },
    { totalUserCount: '5' },
    { totalPrice: {} },
    { totalPrice: NaN },
    { projectId: 2 },
    { startDate: [] },
    { endDate: {} },
    { version: [] },
    { version: { name: 1 } },
  ];
  for (const value of invalid) {
    const current = fixture();
    current.render();
    current.effect();
    current.settle(value);
    await flush();
    assert.equal(current.writes.length, 0, 'Invalid responses never enter payment state');
    assert.deepEqual(current.alerts, [{ msg: '加载失败', type: 2, duration: 0 }]);
  }
  for (const reject of [false, true]) {
    const current = fixture();
    current.render();
    const cleanup = current.effect();
    call(cleanup);
    if (reject) current.fail(new Error('Transport error'));
    else current.settle({ totalPrice: 10 });
    await flush();
    assert.equal(current.writes.length, 0);
    assert.equal(current.alerts.length, 0);
  }
  const failed = fixture();
  failed.render();
  failed.effect();
  failed.fail(new Error('Transport error'));
  await flush();
  assert.equal(failed.alerts.length, 1);
  assert.equal(failed.writes.length, 0);
  const replay = fixture();
  replay.render();
  call(replay.effect());
  replay.effect();
  replay.settle({ totalPrice: 10 }, 1);
  await flush();
  replay.settle({ totalPrice: 20 }, 0);
  await flush();
  assert.equal(read(replay.states[0], 'totalPrice'), 10, 'A stale StrictMode effect cannot overwrite the new request');
  assert.equal(replay.writes.length, 1);
  const boundary = replay.load(directory + '/paySuccessBoundary.ts');
  assert.equal(call(read(boundary, 'decodePaySuccessResult'), { totalPrice: undefined }) !== undefined, true);
  assert.throws(() => fixture(false, '', true), /Missing payment success mount node/);
  console.log(
    JSON.stringify({
      pageObservations: observations,
      invalidResponses: invalid.length,
      lifecycleAndFailureCases: 5,
      historicalAB: Boolean(before),
    }),
  );
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
