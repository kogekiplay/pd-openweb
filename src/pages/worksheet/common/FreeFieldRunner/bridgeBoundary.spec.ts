const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
interface Ref {
  current: unknown;
}
interface Wire {
  type?: string;
  tunnelId?: string;
  methodName?: string;
  messageId?: string;
  params?: unknown;
  success?: boolean;
  data?: unknown;
  error?: string;
  payload?: unknown;
}
interface Frame {
  window: Frame;
  postMessage(data: Wire, origin: string): void;
}
interface Event {
  data: unknown;
  source: Frame;
}
interface Effects {
  setup: () => unknown;
  dependencies?: unknown[];
}
interface HookRuntime {
  react: Record<string, unknown>;
  render<ComponentResult>(component: (props: unknown) => ComponentResult, props: unknown): ComponentResult;
  mount(): void;
  unmount(): void;
}
function hooks(iframe: { contentWindow: Frame }, injectIframe = true): HookRuntime {
  let index = 0;
  const values: unknown[] = [];
  const effects: Effects[] = [];
  const cleanup: (() => void)[] = [];
  let renderingEffectIndex = 0;
  const react = {
    useRef(initial: unknown): Ref {
      const current = index++;
      if (!values[current]) values[current] = { current: initial === null && injectIframe ? iframe : initial };
      return values[current] as Ref;
    },
    useState(initial: unknown) {
      return [typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useMemo(factory: () => unknown) {
      return factory();
    },
    useCallback(callback: unknown) {
      return callback;
    },
    useEffect(setup: () => unknown, dependencies?: unknown[]) {
      const current = renderingEffectIndex++;
      if (!effects[current]) effects[current] = { setup, dependencies };
    },
  };
  return {
    react,
    render(component, props) {
      index = 0;
      renderingEffectIndex = 0;
      return component(props);
    },
    mount() {
      effects.forEach(effect => {
        const result = effect.setup();
        if (typeof result === 'function') cleanup.push(result as () => void);
      });
    },
    unmount() {
      cleanup.splice(0).forEach(fn => fn());
    },
  };
}
const listeners = new Set<(event: Event) => void>();
const childMessages: Wire[] = [],
  parentMessages: Wire[] = [];
const child: Frame = {
  get window() {
    return child;
  },
  postMessage(data: Wire, origin: string) {
    assert.equal(origin, '*');
    childMessages.push(data);
  },
};
const parent: Frame = {
  get window() {
    return parent;
  },
  postMessage(data: Wire, origin: string) {
    assert.equal(origin, '*');
    parentMessages.push(data);
  },
};
const fakeWindow = {
  parent,
  __customSubPath__: '/hap/',
  addEventListener(_type: string, handler: (event: Event) => void) {
    listeners.add(handler);
  },
  removeEventListener(_type: string, handler: (event: Event) => void) {
    listeners.delete(handler);
  },
};
const timers = new Map<number, () => void>();
let timerId = 0;
const calls: { args: unknown; title?: unknown; refresh?: unknown; height?: unknown; query?: unknown }[] = [];
let useScope: Record<string, unknown> = {};
function load(relative: string, runtime?: HookRuntime): Record<string, unknown> {
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  const file =
    relative === 'src/pages/worksheet/common/FreeFieldSandbox/Runner.tsx' && process.env.FREE_FIELD_RUNNER_SOURCE
      ? process.env.FREE_FIELD_RUNNER_SOURCE
      : path.join(root, relative);
  const { code } = transformFileSync(file, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function(
    'module',
    'exports',
    'require',
    'window',
    'location',
    'md',
    'setTimeout',
    'clearTimeout',
    '_l',
    'console',
    code,
  )(
    moduleLike,
    moduleLike.exports,
    (name: string): unknown => {
      if (name === 'lodash' || name === 'events') return require(name);
      if (name === 'react') return runtime?.react;
      if (name === 'react/jsx-runtime')
        return {
          jsx: (type: unknown, props: unknown) => ({ type, props }),
          jsxs: (type: unknown, props: unknown) => ({ type, props }),
        };
      if (name === 'react-runner')
        return {
          useRunner: (options: { scope: Record<string, unknown> }) => {
            useScope = options.scope;
            return { element: null };
          },
        };
      if (name === 'lucide-react') return { RectangleVertical: () => null };
      if (name === 'prop-types') return { string: {}, func: {}, any: {}, shape: () => ({}), oneOf: () => ({}) };
      if (name === 'styled-components') return { div: () => () => null };
      if (name === 'uuid') return { v4: () => 'iframe-id' };
      if (name === 'src/utils/iframeCommunicate') return load('src/utils/iframeCommunicate.ts');
      if (name === 'src/utils/subListStoreTypes') return { isChildTableStore: () => false };
      if (name === './bridgeTypes') return load('src/pages/worksheet/common/FreeFieldRunner/bridgeTypes.ts');
      if (name === 'src/utils/control')
        return {
          getTitleTextFromControls: (controls: unknown, record: unknown) => {
            calls.push({ args: controls, title: record });
            return 'Real title';
          },
        };
      if (name === './functions')
        return {
          getRowsRelation: (context: unknown, params: unknown) => {
            calls.push({ args: context, query: params });
            return Promise.resolve({
              data: [{ rowid: 'row', metadata: { rowid: 5 } }],
              count: 1,
              unknownMetadata: true,
            });
          },
        };
      throw new Error(`Unexpected iframe caller dependency ${name}`);
    },
    fakeWindow,
    { href: 'https://sandbox.example/freefield?id=iframe-id' },
    { global: { Config: {} } },
    (callback: () => void) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    (id: number) => timers.delete(id),
    (value: string) => value,
    { log() {}, error() {} },
  );
  return moduleLike.exports;
}
function event(params: unknown, methodName: string, id: string): Event {
  return { source: child, data: { type: 'IFRAME_REQUEST', methodName, params, messageId: id, tunnelId: 'iframe-id' } };
}
async function dispatch(message: Event): Promise<void> {
  listeners.forEach(listener => listener(message));
  await new Promise(resolve => setImmediate(resolve));
}
async function run() {
  const typed = load('src/pages/worksheet/common/FreeFieldRunner/bridgeTypes.ts') as {
    relationParams(value: unknown): unknown;
    titleRecord(value: unknown): unknown;
    controlHeight(value: unknown): unknown;
  };
  const sourceParams = { pageIndex: 2, pageSize: 10, keyWords: ' query ', unknownMetadata: { rowid: 5 } };
  assert.deepEqual(typed.relationParams(sourceParams), sourceParams);
  assert.equal(typed.relationParams(undefined) instanceof Object, true);
  for (const bad of [null, [], 5, { pageIndex: '2' }, { pageSize: Infinity }, { keyWords: 5 }])
    assert.throws(() => typed.relationParams(bad), TypeError);
  const sourceRecord = { rowid: 'r', title: 'Actual', unknownCell: { rowid: 42 } };
  assert.equal(typed.titleRecord(sourceRecord), sourceRecord);
  assert.equal(typed.titleRecord(undefined), undefined);
  assert.equal(typed.titleRecord(null), undefined);
  assert.throws(() => typed.titleRecord({ rowid: 4 }), TypeError);
  assert.throws(() => typed.titleRecord({ isCopy: 'true' }), TypeError);
  assert.throws(() => typed.titleRecord({ updatedControlIds: [4] }), TypeError);
  for (const value of [100, '250', 0, '', null, undefined]) assert.equal(typed.controlHeight(value), value);
  for (const bad of [{ height: 100 }, Infinity, true]) assert.throws(() => typed.controlHeight(bad), TypeError);
  const runtime = hooks({ contentWindow: child });
  const host = load('src/pages/worksheet/common/FreeFieldRunner/FreeFieldRunner.tsx', runtime).default as (
    props: unknown,
  ) => unknown;
  const control = {
    controlId: 'c',
    dataSource: 'related',
    viewId: 'view',
    type: 29,
    relationControls: [{ controlId: 'title', attribute: 1, type: 2 }],
  };
  const props = {
    type: 'production',
    code: 'function Widget() {}',
    widgetParams: {
      currentControlId: 'c',
      formData: [control],
      recordId: 'master',
      worksheetId: 'worksheet',
      appId: 'app',
      refreshRecord: (value: unknown) => {
        calls.push({ args: 'refresh', refresh: value });
      },
      setControlHeight: (height: unknown) => {
        calls.push({ args: 'height', height });
      },
    },
  };
  runtime.render(host, props);
  runtime.mount();
  assert.equal(listeners.size, 2, 'Host installs one raw event receiver and one request bridge');
  await dispatch(event(sourceParams, 'getRowsForRelation', 'query'));
  assert.deepEqual(calls.at(-1)?.query, sourceParams);
  assert.deepEqual(calls.at(-1)?.args, {
    control,
    recordId: 'master',
    formData: [control],
    parentWorksheetId: 'worksheet',
    parentAppId: 'app',
  });
  assert.deepEqual(childMessages.at(-1), {
    type: 'IFRAME_RESPONSE',
    messageId: 'query',
    success: true,
    data: { data: [{ rowid: 'row', metadata: { rowid: 5 } }], count: 1, unknownMetadata: true },
  });
  const beforeBad = calls.length;
  await dispatch(event({ pageSize: '10' }, 'getRowsForRelation', 'bad-query'));
  assert.equal(calls.length, beforeBad);
  assert.equal(childMessages.at(-1)?.success, false);
  await dispatch(event(sourceRecord, 'getTitleOfRecord', 'title'));
  assert.equal(calls.at(-1)?.title, sourceRecord);
  assert.equal(childMessages.at(-1)?.data, 'Real title');
  await dispatch(event(undefined, 'getTitleOfRecord', 'default-title'));
  assert.equal(childMessages.at(-1)?.data, 'Real title');
  await dispatch(event({ noInterpretation: true }, 'refreshRecord', 'refresh'));
  assert.deepEqual(calls.at(-1)?.refresh, { noInterpretation: true });
  await dispatch(event(260, 'setControlHeight', 'height'));
  assert.equal(calls.at(-1)?.height, 260);
  await dispatch(event(undefined, 'setControlHeight', 'reset-height'));
  assert.equal(calls.at(-1)?.height, undefined);
  const changedControl = { ...control, dataSource: 'new-related' };
  runtime.render(host, {
    ...props,
    widgetParams: { ...props.widgetParams, formData: [changedControl], recordId: 'changed-master' },
  });
  await dispatch(event({}, 'getRowsForRelation', 'changed'));
  assert.deepEqual(calls.at(-1)?.args, {
    control: changedControl,
    recordId: 'changed-master',
    formData: [changedControl],
    parentWorksheetId: 'worksheet',
    parentAppId: 'app',
  });
  assert.equal(listeners.size, 2, 'Rerender keeps a single bridge receiver');
  runtime.unmount();
  assert.equal(listeners.size, 0, 'Host unmount removes both window message receivers');
  const sandboxRuntime = hooks({ contentWindow: child }, false);
  const sandbox = load('src/pages/worksheet/common/FreeFieldSandbox/Runner.tsx', sandboxRuntime).default as (
    props: unknown,
  ) => unknown;
  sandboxRuntime.render(sandbox, { code: '', params: {} });
  sandboxRuntime.mount();
  const beforeRerender = listeners.size;
  sandboxRuntime.render(sandbox, { code: '', params: {} });
  assert.equal(listeners.size, beforeRerender, 'Sandbox rerender does not construct an unused bridge listener');
  const getRows = useScope['getRowsForRelation'] as (params: unknown) => Promise<unknown>;
  const result = getRows(sourceParams);
  const sent = parentMessages.at(-1);
  if (!sent) throw new Error('No sandbox request');
  assert.equal(sent.methodName, 'getRowsForRelation');
  assert.equal(sent.params, sourceParams);
  assert.equal(sent.tunnelId, 'iframe-id');
  const response = { rows: ['opaque'], custom: { keep: 1 } };
  await dispatch({
    source: parent,
    data: { type: 'IFRAME_RESPONSE', messageId: sent.messageId, success: true, data: response },
  });
  assert.equal(await result, response);
  const failed = (useScope['refreshRecord'] as (params: unknown) => Promise<unknown>)({});
  const failedWire = parentMessages.at(-1);
  const failedCheck = assert.rejects(
    failed,
    /Refresh failed/,
    'Caller promise propagates failure instead of waiting forever in a resolve-only wrapper',
  );
  await dispatch({
    source: parent,
    data: { type: 'IFRAME_RESPONSE', messageId: failedWire?.messageId, success: false, error: 'Refresh failed' },
  });
  await failedCheck;
  sandboxRuntime.unmount();
  assert.equal(listeners.size, 0);
  await assert.rejects(getRows({}), /Parent bridge unavailable/);
  sandboxRuntime.mount();
  assert.equal(listeners.size, 1, 'Effect replay reattaches exactly one live parent bridge');
  const replayed = getRows({});
  const replayedWire = parentMessages.at(-1);
  await dispatch({
    source: parent,
    data: { type: 'IFRAME_RESPONSE', messageId: replayedWire?.messageId, success: true, data: 'replayed' },
  });
  assert.equal(await replayed, 'replayed');
  sandboxRuntime.unmount();
  assert.equal(listeners.size, 0);
  console.log(
    'Actual free-field sender/receiver methods, finite parameter decoders, live context, failure propagation and rerender/unmount bridge cleanup passed',
  );
}
run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
