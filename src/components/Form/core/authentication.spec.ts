const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
interface Auth {
  bindWeiXin(projectId: string): Promise<void>;
  bindWxWork(projectId: string): Promise<void>;
  bindFeishu(projectId: string): Promise<void>;
  bindDing(projectId: string): Promise<void>;
  bindWeLink(projectId: string): Promise<void>;
  handleTriggerEvent(scan: () => void, binding: Promise<void>, onError?: (error: unknown) => void): void;
}
interface SDK {
  config(config: Record<string, unknown>): void;
  ready(callback: () => void): void;
  error(callback: (error: unknown) => void): void;
}
const configs: Record<string, unknown>[] = [];
const requests: Array<{ method: string; args: Record<string, unknown> }> = [];
const alerts: string[] = [];
let onReady: (() => void) | undefined;
let onError: ((error: unknown) => void) | undefined;
const sdk: SDK = {
  config: config => {
    configs.push(config);
  },
  ready: callback => {
    onReady = callback;
  },
  error: callback => {
    onError = callback;
  },
};
const location = { href: 'https://example.test/app#fragment' };
const window: { [key: string]: unknown; configSuccess?: boolean; configLoading?: boolean; currentUrl?: string } = {
  isIphone: true,
  wx: sdk,
  dd: sdk,
  HWH5: sdk,
  h5sdk: sdk,
  nativeAlert: (value: string) => {
    alerts.push(value);
  },
};
let response: unknown;
const api = new Proxy(
  {},
  {
    get: (_target, method: string) => (args: Record<string, unknown>) => {
      requests.push({ method, args });
      return Promise.resolve(response);
    },
  },
);
const imports: Record<string, unknown> = {
  lodash: require('lodash'),
  'src/api/weixin': { __esModule: true, default: api },
  'src/api/workWeiXin': { __esModule: true, default: api },
};
function load(file: string): Record<string, unknown> {
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', 'require', 'window', 'location', 'sessionStorage', transformFileSync(file).code)(
    moduleLike,
    moduleLike.exports,
    (name: string) => {
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error('Unstubbed auth dependency ' + name);
    },
    window,
    location,
    { getItem: () => 'https://example.test/entry#initial' },
  );
  return moduleLike.exports;
}
const auth = load(path.join(__dirname, 'authentication.ts')) as unknown as Auth;
async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}
async function bind(
  method: keyof Omit<Auth, 'handleTriggerEvent'>,
  result: unknown,
  expected: Record<string, unknown>,
) {
  response = result;
  onReady = undefined;
  const pending = auth[method]('project');
  await flush();
  assert.deepEqual(configs.at(-1), expected);
  assert.equal(typeof onReady, 'function');
  onReady?.();
  await pending;
}
async function run() {
  await bind(
    'bindWeiXin',
    { code: 1, data: { appId: 'app', timestamp: 12, nonceStr: 'nonce', signature: 'signature' } },
    { debug: false, appId: 'app', timestamp: 12, nonceStr: 'nonce', signature: 'signature', jsApiList: ['scanQRCode'] },
  );
  assert.deepEqual(requests.at(-1), {
    method: 'getWeiXinConfig',
    args: { projectId: 'project', url: 'https://example.test/entry' },
  });
  await bind(
    'bindWxWork',
    { corpId: 'corp', timestamp: '12', nonceStr: 'nonce', signature: 'signature' },
    {
      beta: true,
      debug: false,
      appId: 'corp',
      timestamp: '12',
      nonceStr: 'nonce',
      signature: 'signature',
      jsApiList: ['scanQRCode'],
    },
  );
  await bind(
    'bindDing',
    { agentId: 42, corpId: 'corp', timestamp: 12, noncestr: 'nonce', signature: 'signature' },
    {
      agentId: 42,
      corpId: 'corp',
      timeStamp: 12,
      nonceStr: 'nonce',
      signature: 'signature',
      jsApiList: ['device.geolocation.get'],
    },
  );
  await bind(
    'bindWeLink',
    { appId: 'app', timestamp: 12, noncestr: 'nonce', signature: 'signature' },
    { appId: 'app', timestamp: 12, noncestr: 'nonce', signature: 'signature', jsApiList: ['getLocation'] },
  );
  response = { appId: 'app', timestamp: 12, noncestr: 'nonce', signature: 'signature' };
  const feishu = auth.bindFeishu('project');
  await flush();
  const feishuConfig = configs.at(-1);
  assert.equal(feishuConfig?.['nonceStr'], 'nonce');
  onReady?.();
  await feishu;
  for (const method of ['bindWeiXin', 'bindWxWork', 'bindFeishu', 'bindDing', 'bindWeLink'] as const) {
    const before = configs.length;
    response = { timestamp: {}, signature: 42 };
    await assert.rejects(auth[method]('project'));
    assert.equal(configs.length, before, 'Malformed signatures do not reach a native SDK');
  }
  for (const method of ['bindDing', 'bindWeLink'] as const) {
    response = { agentId: 42, corpId: 'corp', appId: 'app', timestamp: 12, noncestr: 'nonce', signature: 'signature' };
    const failed = auth[method]('project');
    await flush();
    const outcome = failed.then(
      () => 'success',
      () => 'failed',
    );
    onError?.({ message: 'SDK rejected config' });
    assert.equal(await outcome, 'failed', 'SDK config errors complete the rejected binding lifecycle');
    assert.equal(JSON.parse(alerts.at(-1) || '{}').mdurl, 'https://example.test/app');
  }
  let scans = 0;
  const errors: unknown[] = [];
  window.currentUrl = location.href;
  window.configLoading = false;
  window.configSuccess = false;
  auth.handleTriggerEvent(
    () => {
      scans++;
    },
    Promise.resolve(),
    error => errors.push(error),
  );
  await flush();
  assert.equal(scans, 1);
  assert.equal(window.configSuccess, true);
  const unhandled: unknown[] = [];
  const handleUnhandled = (error: unknown) => unhandled.push(error);
  process.on('unhandledRejection', handleUnhandled);
  try {
    auth.handleTriggerEvent(
      () => {
        scans++;
      },
      Promise.reject(new Error('Unused eager bind')),
    );
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(scans, 2, 'Already configured bindings still trigger the action immediately');
    assert.deepEqual(unhandled, []);
    window.configSuccess = false;
    auth.handleTriggerEvent(
      () => {
        scans++;
      },
      Promise.reject(1),
      error => errors.push(error),
    );
    await flush();
    assert.equal(window.configLoading, false);
    assert.deepEqual(errors, [1]);
    assert.equal(scans, 2);
  } finally {
    process.off('unhandledRejection', handleUnhandled);
  }
  console.log('Native signature bindings preserve SDK payloads and settle invalid/config failures');
}
run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
