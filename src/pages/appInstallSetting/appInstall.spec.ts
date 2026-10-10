const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');
const React = require('react');
const server = require('react-dom/server');
const nativeTrigger: unknown = require('@rc-component/trigger').default;
interface InstallState {
  url?: string | undefined;
  qrCodeUrl?: string | undefined;
  downloadAppQrCodeUrl?: string | undefined;
  loadError?: boolean | undefined;
}
interface App {
  state: InstallState;
  updates: number;
  componentDidMount(): void;
  componentWillUnmount?: () => void;
  loadInfo(): Promise<void>;
  render(): unknown;
  renderHeader(): unknown;
  renderContent(): unknown;
}
interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
interface Request {
  resolve(value: unknown): void;
  reject(value: unknown): void;
  promise: Promise<unknown>;
}
const requests: Request[] = [],
  copied: unknown[] = [],
  alerts: unknown[] = [];
const environment = { platformENV: { isOverseas: false } };
class Component {
  props: Record<string, unknown>;
  state: InstallState = {};
  updates = 0;
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
  setState(patch: InstallState) {
    this.updates++;
    Object.assign(this.state, patch);
  }
}
function request() {
  let resolve: (value: unknown) => void = () => {},
    reject: (value: unknown) => void = () => {};
  const promise = new Promise<unknown>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  requests.push({ resolve, reject, promise });
  return promise;
}
const moduleLike: { exports: { default?: new (props: Record<string, unknown>) => App } } = { exports: {} };
const code = transformFileSync(path.join(__dirname, 'index.tsx'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
new Function('require', 'module', 'exports', 'window', '_l', 'alert', code)(
  (name: string) => {
    if (name === 'react') return { ...React, Component };
    if (name === 'react/jsx-runtime') return require(name);
    if (name === '@rc-component/trigger') return { __esModule: true, default: nativeTrigger };
    if (name === 'src/api/private') return { __esModule: true, default: { getAPIUrl: request } };
    if (name === 'src/utils/copyToClipboard')
      return { __esModule: true, default: (value: unknown) => copied.push(value) };
    if (name.endsWith('.png')) return { __esModule: true, default: '/assets/' + path.basename(name) };
    if (name.endsWith('.less')) return {};
    throw new Error('Unexpected app install dependency: ' + name);
  },
  moduleLike,
  moduleLike.exports,
  environment,
  (text: string) => text,
  (value: unknown) => alerts.push(value),
);
assert.ok(moduleLike.exports.default);
const AppInstall = moduleLike.exports.default;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function tree(value: unknown): value is Tree {
  return record(value) && 'type' in value && record(value['props']);
}
function walk(value: unknown): Tree[] {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!tree(value)) return [];
  return [value, ...walk(value.props['children'])];
}
function click(value: Tree) {
  const onClick = value.props['onClick'];
  if (typeof onClick !== 'function') throw new Error('Missing actual click callback');
  Reflect.apply(onClick, undefined, []);
}
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const latest = () => {
  const value = requests.at(-1);
  assert.ok(value);
  return value;
};
function imageSource(app: App): unknown {
  const wrapper = walk(app.renderContent()).find(item => item.props['className'] === 'flexColumn appewmWrapper');
  assert.ok(wrapper);
  const image = walk(wrapper).find(item => item.type === 'img');
  assert.ok(image);
  return image.props['src'];
}
const unhandled: unknown[] = [];
const handleUnhandled = (value: unknown) => unhandled.push(value);
process.on('unhandledRejection', handleUnhandled);

async function run() {
  const app = new AppInstall({ className: 'unused' });
  assert.deepEqual({ ...app.state }, { url: '', qrCodeUrl: '', downloadAppQrCodeUrl: '' });
  app.componentDidMount();
  const info = {
    url: 'https://oa.example/api/',
    qrCodeUrl: 'https://oa.example/qr.png',
    downloadAppQrCodeUrl: 'https://oa.example/download.png',
    futureMetadata: { untouched: true },
  };
  latest().resolve(info);
  await tick();
  assert.equal(app.state.url, info.url);
  assert.equal(app.state.qrCodeUrl, info.qrCodeUrl);
  assert.ok(!('futureMetadata' in app.state), 'Opaque extra API metadata must not become component state');
  const header = app.renderHeader();
  const trigger = walk(header).find(item => item.type === nativeTrigger);
  assert.ok(trigger);
  assert.deepEqual(trigger.props['action'], ['click']);
  assert.deepEqual(trigger.props['popupAlign'], {
    offset: [0, 7],
    points: ['tc', 'bc'],
    overflow: { adjustX: 1, adjustY: 2 },
  });
  const qrImage = walk(trigger.props['popup']).find(item => item.type === 'img');
  assert.ok(qrImage);
  assert.equal(qrImage.props['src'], info.qrCodeUrl);
  assert.deepEqual(qrImage.props['style'], { width: 300 });
  const copy = walk(header).find(item => item.props['className'] === 'copy');
  assert.ok(copy);
  click(copy);
  assert.equal(copied.at(-1), info.url);
  assert.equal(alerts.at(-1), '复制成功');
  // Native Trigger and React DOM render the actual complete page; image/title/style output is not a stub source assertion.
  const html = server.renderToStaticMarkup(app.render());
  assert.ok(html.includes(info.url));
  assert.ok(html.includes('/assets/mobile.png'));
  assert.ok(html.includes('/assets/pc.png'));
  for (const overseas of [false, true]) {
    environment.platformENV.isOverseas = overseas;
    assert.equal(imageSource(app), info.downloadAppQrCodeUrl, 'Remote download QR has priority in either region');
    const loading = app.loadInfo();
    latest().resolve({ url: info.url, qrCodeUrl: info.qrCodeUrl, downloadAppQrCodeUrl: '' });
    await loading;
    assert.equal(imageSource(app), overseas ? '/assets/nocoly.png' : '/assets/hap.png');
    const restoring = app.loadInfo();
    latest().resolve(info);
    await restoring;
  }
  const reads = { url: 0, qrCodeUrl: 0, downloadAppQrCodeUrl: 0 };
  const urlKeys = ['url', 'qrCodeUrl', 'downloadAppQrCodeUrl'] as const;
  const accessor = Object.defineProperties(
    {},
    Object.fromEntries(
      urlKeys.map(key => [
        key,
        {
          get() {
            reads[key]++;
            return reads[key] === 1 ? info[key] : 9;
          },
        },
      ]),
    ),
  );
  const loadingAccessor = app.loadInfo();
  latest().resolve(accessor);
  await loadingAccessor;
  assert.deepEqual(reads, { url: 1, qrCodeUrl: 1, downloadAppQrCodeUrl: 1 });
  assert.equal(app.state.url, info.url);
  assert.equal(app.state.loadError, false);
  for (const malformed of [null, [], 3, { url: 3 }, { qrCodeUrl: {} }, { downloadAppQrCodeUrl: false }]) {
    const previous: InstallState = { ...app.state };
    const loading = app.loadInfo();
    latest().resolve(malformed);
    await loading;
    assert.equal(app.state.loadError, true);
    assert.equal(app.state.url, previous.url);
    assert.equal(app.state.qrCodeUrl, previous.qrCodeUrl);
    assert.equal(app.state.downloadAppQrCodeUrl, previous.downloadAppQrCodeUrl);
    assert.ok(walk(app.render()).some(item => item.props['role'] === 'alert'));
    const retryButton = walk(app.render()).find(item => item.type === 'button' && item.props['children'] === '重试');
    assert.ok(retryButton);
    click(retryButton);
    assert.equal(app.state.loadError, false);
    latest().resolve(info);
    await tick();
    assert.equal(app.state.url, info.url);
    assert.ok(!walk(app.render()).some(item => item.props['role'] === 'alert'));
  }
  const failed = app.loadInfo();
  latest().reject(new Error('offline'));
  await failed;
  assert.equal(app.state.loadError, true);
  assert.equal(app.state.url, info.url);
  const retry = walk(app.render()).find(item => item.type === 'button');
  assert.ok(retry);
  click(retry);
  latest().resolve({});
  await tick();
  assert.deepEqual(
    { ...app.state },
    {
      url: undefined,
      qrCodeUrl: undefined,
      downloadAppQrCodeUrl: undefined,
      loadError: false,
    },
  );
  const blankCopy = walk(app.renderHeader()).find(item => item.props['className'] === 'copy');
  assert.ok(blankCopy);
  click(blankCopy);
  assert.equal(copied.at(-1), '');
  const race = new AppInstall({});
  race.componentDidMount();
  const first = latest();
  const secondLoad = race.loadInfo();
  const second = latest();
  second.resolve(info);
  await secondLoad;
  first.resolve({ url: 'older', qrCodeUrl: 'old-qr' });
  await tick();
  assert.equal(race.state.url, info.url, 'A late earlier success cannot replace the current successful request');
  assert.equal(race.state.downloadAppQrCodeUrl, info.downloadAppQrCodeUrl);
  const earlierFailure = race.loadInfo();
  const oldFail = latest();
  const currentLoad = race.loadInfo();
  latest().resolve(info);
  await currentLoad;
  oldFail.reject(new Error('superseded failure'));
  await earlierFailure;
  assert.equal(race.state.loadError, false);
  const unmountedLoad = race.loadInfo();
  const last = latest();
  race.componentWillUnmount?.();
  const updates = race.updates;
  last.resolve({ url: 'after-unmount' });
  await unmountedLoad;
  assert.equal(race.updates, updates, 'Unmount suppresses both decoding and state publication');
  race.componentDidMount();
  const remount = latest();
  remount.resolve({ url: 'remounted', qrCodeUrl: 'fresh-qr' });
  await tick();
  assert.equal(race.state.url, 'remounted', 'StrictMode replay re-enables the reused class instance');
  race.componentWillUnmount?.();
  const strictMode = new AppInstall({});
  strictMode.componentDidMount();
  const abandoned = latest();
  strictMode.componentWillUnmount?.();
  strictMode.componentDidMount();
  const live = latest();
  live.resolve(info);
  await tick();
  abandoned.reject(new Error('first effect cleanup'));
  await tick();
  assert.equal(strictMode.state.loadError, false);
  assert.equal(strictMode.state.url, info.url);
  strictMode.componentWillUnmount?.();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(unhandled, []);
  app.componentWillUnmount?.();
  console.log(
    'Actual AppInstall complete render/native Trigger, URLs, regional/remote QR priority, copy, one-read guards and failure retry passed',
  );
}
run()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.removeListener('unhandledRejection', handleUnhandled));
