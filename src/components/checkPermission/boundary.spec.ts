const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');
interface ContainerProps {
  projectId: string;
  needPermission: number | string | readonly (number | string)[];
  children?: string;
}
interface PermissionModule {
  default(props: ContainerProps): unknown;
  hasPermission(ids: unknown, required: unknown): boolean;
  checkPermission(projectId: string, required: number | string | readonly (number | string)[]): boolean;
  getMyPermissions(projectId: string, sync?: true): number[];
  getMyPermissions(projectId: string, sync: false): Promise<number[]>;
  prefetchMyPermissions(projectId: string): Promise<number[]>;
}
interface PermissionBoundary {
  permissionIds(value: unknown): number[];
  permissionVersion(value: unknown): string;
  isPermissionFlag(value: unknown): boolean;
  isNumericPermissionId(value: unknown): boolean;
}
function loadFile(file: string, stubs: Record<string, unknown> = {}): unknown {
  const moduleLike: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (name: string) =>
    Object.hasOwn(stubs, name) ? stubs[name] : require(name),
  );
  return moduleLike.exports;
}
const boundary = loadFile('boundary.ts') as PermissionBoundary;
function createHarness() {
  let now = Date.parse('2026-10-09T00:00:00Z');
  let response: unknown = { permissionIds: [10110] };
  let version: unknown = { version: 'v1' };
  let permissionHandler: ((projectId: string) => Promise<unknown>) | undefined;
  const requests: string[] = [];
  let hookState: unknown;
  let hookInitialized = false;
  let deps: unknown[] | undefined;
  let effect: (() => (() => void) | undefined) | undefined;
  let cleanup: (() => void) | undefined;
  const react = {
    __esModule: true,
    default: { Fragment: 'Fragment' },
    useState: (initial: unknown) => {
      if (!hookInitialized) {
        hookState = initial;
        hookInitialized = true;
      }
      return [
        hookState,
        (value: unknown) => {
          hookState = value;
        },
      ];
    },
    useEffect: (callback: () => (() => void) | undefined, next: unknown[]) => {
      if (!deps || next.some((item, index) => item !== deps?.[index])) {
        deps = next;
        effect = callback;
      }
    },
  };
  function moment(value?: string) {
    const time = value === undefined ? now : Date.parse(value);
    return {
      time,
      format: () => new Date(time).toISOString(),
      diff: (other: { time: number }) => Math.floor((time - other.time) / 60000),
    };
  }
  const module = loadFile('index.tsx', {
    react,
    'react/jsx-runtime': {
      jsx: (type: unknown, props: unknown) => ({ type, props }),
      jsxs: (type: unknown, props: unknown) => ({ type, props }),
    },
    moment: { __esModule: true, default: moment },
    './boundary': boundary,
    'src/api/role': {
      __esModule: true,
      default: {
        getMyPermissions: ({ projectId }: { projectId: string }) => {
          requests.push(projectId);
          return permissionHandler ? permissionHandler(projectId) : Promise.resolve(response);
        },
      },
    },
    'src/api/version': { __esModule: true, default: { getVersion: () => Promise.resolve(version) } },
    'src/pages/Admin/enum': {
      PERMISSION_ENUM: { MEMBER: 10110, CREATE_APP: 15100, NOT_MEMBER: 'NOT_MEMBER' },
      ROUTE_CONFIG: { 10110: ['home'], SHOW_MANAGER: ['sysroles'] },
    },
  }) as PermissionModule;
  return {
    module,
    requests,
    setResponse(value: unknown) {
      response = value;
    },
    setVersion(value: unknown) {
      version = value;
    },
    setPermissionHandler(handler: (projectId: string) => Promise<unknown>) {
      permissionHandler = handler;
    },
    advance(minutes: number) {
      now += minutes * 60000;
    },
    render(props: ContainerProps) {
      return module.default(props);
    },
    flushEffects() {
      if (effect) {
        cleanup?.();
        cleanup = effect();
        effect = undefined;
      }
    },
    unmount() {
      cleanup?.();
      cleanup = undefined;
    },
    getState() {
      return hookState;
    },
  };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Promise unresolved');
  };
  const promise = new Promise<T>(finish => {
    resolve = finish;
  });
  return { promise, resolve };
}
const flushPromises = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};
async function run(): Promise<void> {
  assert.equal(boundary.isNumericPermissionId(10110), true);
  assert.equal(boundary.isNumericPermissionId(-1), false);
  assert.equal(boundary.isNumericPermissionId(1.2), false);
  assert.equal(boundary.isPermissionFlag('SHOW_MANAGER'), true);
  assert.equal(boundary.isPermissionFlag('10110'), false);
  assert.deepEqual(boundary.permissionIds({ permissionIds: [10110, 15100] }), [10110, 15100]);
  assert.deepEqual(boundary.permissionIds({}), []);
  assert.throws(() => boundary.permissionIds({ permissionIds: [10110, '15100'] }), /Invalid permission/);
  assert.throws(() => boundary.permissionIds({ permissionIds: null }), /Invalid permission/);
  assert.equal(boundary.permissionVersion({ version: 'v1' }), 'v1');
  assert.throws(() => boundary.permissionVersion({ version: 1 }), /Invalid permission/);
  const h = createHarness();
  assert.equal(h.module.hasPermission([10110], 10110), true);
  assert.equal(h.module.hasPermission([10110], [15100, 10110]), true);
  assert.equal(h.module.hasPermission(['SHOW_MANAGER'], 'SHOW_MANAGER'), true);
  assert.equal(h.module.hasPermission([10110], '10110'), false);
  assert.equal(h.module.hasPermission([10110, 'bad'], 10110), false);
  assert.equal(h.module.hasPermission([10110], [10110, 'bad']), false);
  assert.equal(h.module.hasPermission(null, 10110), false);
  assert.equal(h.module.hasPermission('10110', 10110), false);
  assert.deepEqual(h.module.getMyPermissions('cold'), [], 'Cold synchronous permission reads deny while fetching');
  await flushPromises();
  assert.deepEqual(h.module.getMyPermissions('cold'), [10110]);
  const first = h.module.prefetchMyPermissions('dedupe');
  const second = h.module.prefetchMyPermissions('dedupe');
  assert.equal(first, second, 'The exact same pending request is shared');
  await first;
  assert.equal(h.requests.filter(id => id === 'dedupe').length, 1);
  await h.module.prefetchMyPermissions('constructor');
  assert.deepEqual(
    h.module.getMyPermissions('constructor'),
    [10110],
    'Prototype property names cannot bypass the cache lookup',
  );
  h.setResponse({ permissionIds: [10110, 'bad'] });
  assert.deepEqual(await h.module.prefetchMyPermissions('malformed'), []);
  h.setResponse({ permissionIds: [15100] });
  assert.deepEqual(
    await h.module.getMyPermissions('malformed', false),
    [15100],
    'Malformed response must not cache even a partial grant',
  );
  h.advance(6);
  h.setResponse({ permissionIds: [] });
  assert.deepEqual(
    h.module.getMyPermissions('cold'),
    [10110],
    'A stale synchronous read returns its last validated grant while refreshing',
  );
  await flushPromises();
  assert.deepEqual(h.module.getMyPermissions('cold'), [], 'The validated refresh revokes stale grants');
  h.setVersion({ version: 1 });
  h.setResponse({ permissionIds: [15100] });
  assert.deepEqual(
    await h.module.prefetchMyPermissions('bad-version'),
    [15100],
    'A missing/invalid version falls back to fetching fresh permission IDs',
  );

  const network = createHarness();
  await network.module.prefetchMyPermissions('cached');
  network.advance(6);
  network.setPermissionHandler(() => Promise.reject(new Error('offline')));
  assert.deepEqual(
    network.module.getMyPermissions('cached'),
    [10110],
    'Failed background refresh keeps the last validated cache',
  );
  await flushPromises();
  assert.deepEqual(
    await network.module.prefetchMyPermissions('uncached-failure'),
    [],
    'An uncached failed request grants no permissions',
  );
  network.setPermissionHandler(() => Promise.resolve({ permissionIds: [15100] }));
  assert.deepEqual(
    await network.module.prefetchMyPermissions('uncached-failure'),
    [15100],
    'A failed pending request must release the deduplication slot',
  );

  const view = createHarness();
  await view.module.prefetchMyPermissions('allowed');
  const requirement = [10110];
  const props = { projectId: 'allowed', needPermission: requirement, children: 'private' };
  assert.equal(view.render(props), null, 'The first render always denies until authorization is evaluated');
  view.flushEffects();
  assert.ok(view.render(props));
  assert.ok(
    view.render({ ...props, needPermission: requirement }),
    'Rerendering the same requirement array keeps validated state',
  );
  assert.equal(
    view.render({ ...props, needPermission: [15100] }),
    null,
    'A different requirement must deny during its first render',
  );
  view.flushEffects();
  assert.equal(view.render({ ...props, needPermission: [15100] }), null);

  const pendingA = deferred<unknown>();
  const pendingB = deferred<unknown>();
  const asyncView = createHarness();
  asyncView.setPermissionHandler(projectId => (projectId === 'a' ? pendingA.promise : pendingB.promise));
  const aProps = { projectId: 'a', needPermission: 10110, children: 'a' };
  const bProps = { projectId: 'b', needPermission: 10110, children: 'b' };
  assert.equal(asyncView.render(aProps), null);
  asyncView.flushEffects();
  await flushPromises();
  assert.equal(asyncView.render(bProps), null, 'Changing project hides the previous context before effects run');
  asyncView.flushEffects();
  await flushPromises();
  pendingA.resolve({ permissionIds: [10110] });
  await flushPromises();
  assert.equal(
    asyncView.render(bProps),
    null,
    'A late response from the previous project cannot grant the new project',
  );
  pendingB.resolve({ permissionIds: [10110] });
  await flushPromises();
  assert.ok(asyncView.render(bProps));
  const pendingUnmount = deferred<unknown>();
  const unmounted = createHarness();
  unmounted.setPermissionHandler(() => pendingUnmount.promise);
  unmounted.render({ projectId: 'unmount', needPermission: 10110 });
  unmounted.flushEffects();
  await flushPromises();
  const stateBefore = unmounted.getState();
  unmounted.unmount();
  pendingUnmount.resolve({ permissionIds: [10110] });
  await flushPromises();
  assert.equal(unmounted.getState(), stateBefore, 'Unmount cleanup prevents a late callback from changing state');
  const immediate = createHarness();
  await immediate.module.prefetchMyPermissions('allowed');
  immediate.render(props);
  immediate.flushEffects();
  assert.ok(immediate.render(props));
  assert.equal(
    immediate.render({ projectId: 'denied', needPermission: requirement }),
    null,
    'A previously granted component cannot expose children for another project in its first render',
  );
  console.log(
    'Permission API validation, cold/stale cache, deduplication and actual component context/unmount guards passed',
  );
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
