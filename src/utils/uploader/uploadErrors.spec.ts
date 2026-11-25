const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const { test }: typeof import('node:test') = require('node:test');
const {
  transformFileSync,
}: import('../../../scripts/spec-harness').SpecHarness = require('../../../scripts/spec-harness.ts');

interface TestError {
  code?: number;
  status?: number;
  response?: unknown;
  file?: { id: string; name: string };
  uploadErrorHandled?: boolean;
  uploadErrorMessage?: string;
}

type Events = {
  Error: [TestUploader, TestError, string];
  UploadComplete: [TestUploader];
  FileUploaded: [TestUploader];
  StateChanged: [TestUploader];
  Destroy: [TestUploader];
};
type Handlers = { [E in keyof Events]?: (...args: Events[E]) => void };
interface TestUploader {
  files: Array<NonNullable<TestError['file']> & { status: number }>;
  state: number;
  addFile(input: File | File[]): void;
  bind<E extends keyof Events>(event: E, handler: (...args: Events[E]) => void): void;
  unbind(event: keyof Events): void;
  stop(): void;
  destroy(): void;
}

type GetUploadError = (
  response: unknown,
  fileName?: string,
) => {
  code: number;
  message: string;
  isSecurityError: boolean;
} | null;

function setup({ blockedStorage = false } = {}) {
  const alerts: Array<[string, number]> = [];
  const storage = new Map<string, string>();
  const requests: FakeXhr[] = [];

  class FakeXhr {
    status = 0;
    statusText = '';
    responseText = '';
    url = '';
    upload = {};
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    open(_method: string, url: string) {
      this.url = url;
    }
    setRequestHeader() {}
    send() {
      requests.push(this);
    }
    abort() {
      this.onabort?.();
    }
    reply(status: number, responseText: string) {
      this.status = status;
      this.responseText = responseText;
      this.onload?.();
    }
  }

  const globals = {
    md: {
      global: { FileStoreConfig: { uploadHost: '/file/mingdao/upload' }, SysSettings: { fileUploadLimitSize: 100 } },
    },
    alert(message: string, severity: number) {
      alerts.push([message, severity]);
    },
    _l: (message: string, ...args: unknown[]) => message.replace(/%(\d+)/g, (_, i: string) => String(args[Number(i)])),
    safeParse(value: string): unknown {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    },
    XMLHttpRequest: FakeXhr,
    localStorage: {
      getItem(name: string) {
        if (blockedStorage) throw new Error('Storage unavailable');
        return storage.get(name) ?? null;
      },
      removeItem(name: string) {
        if (blockedStorage) throw new Error('Storage unavailable');
        storage.delete(name);
      },
    },
    safeLocalStorageSetItem(name: string, value: string) {
      if (blockedStorage) throw new Error('Storage unavailable');
      storage.set(name, value);
    },
  };
  const cache = new Map<string, Record<string, unknown>>();
  function load(filename: string): Record<string, unknown> {
    const cached = cache.get(filename);
    if (cached) return cached;
    const mod: { exports: Record<string, unknown> } = { exports: {} };
    const result = transformFileSync(filename, { plugins: ['@babel/plugin-transform-modules-commonjs'] });
    if (!result?.code) throw new Error(`Could not compile ${filename}`);
    const { code } = result;
    function localRequire(request: string): unknown {
      if (request.startsWith('.')) return load(path.resolve(path.dirname(filename), `${request}.ts`));
      if (request === 'src/utils/commonRequestBoundary')
        return load(path.resolve(__dirname, '../commonRequestBoundary.ts'));
      if (request === 'src/utils/common') return {};
      if (request === 'src/utils/expression') {
        return {
          getExtOfFileName: (name: string) => path.extname(name).slice(1),
          getNameOfFileName: (name: string) => path.parse(name).name,
          fileIsPicture: () => false,
        };
      }
      return require(request);
    }
    new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
      mod,
      mod.exports,
      localRequire,
      ...Object.values(globals),
    );
    cache.set(filename, mod.exports);
    return mod.exports;
  }

  const getUploadError = load(path.resolve(__dirname, '../services/file/uploadError.ts'))
    ['getUploadError'] as GetUploadError;
  const bindUploadErrors = load(path.resolve(__dirname, 'uploadErrors.ts'))['default'] as (up: { state: number }) => {
    handleError(error: TestError): void;
    handleStateChanged(): void;
    flush(): void;
  };
  const mod = load(path.resolve(__dirname, '../createUploader.ts')) as {
    default: (opts: {
      init: Handlers;
      getToken: (files: Array<{ ext: string }>) => Promise<Array<{ uptoken: string; key: string }>>;
    }) => TestUploader;
    UploaderState: { STARTED: number; STOPPED: number };
    FileStatus: { FAILED: number };
    UploadError: { HTTP_ERROR: number };
  };
  function createUploader(init: Handlers = {}) {
    return mod.default({
      init,
      getToken: async files =>
        files.map((_, index) => ({
          uptoken: `test-token-${index}`,
          key: `test/key-${index}`,
          serverName: '/file',
          fileName: `key-${index}`,
        })),
    });
  }
  return { alerts, requests, storage, getUploadError, bindUploadErrors, createUploader, ...mod };
}

const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const virus = '发现病毒或恶意内容';
const policy = '文件不符合安全扫描策略';
const scanAlert = (name: string, message: string): [string, number] => [`「${name}」检测到安全风险：${message}`, 2];
const file = (name: string, size = 1) => new File([Buffer.alloc(size)], name, { type: 'application/zip' });

test('解析字符串和对象，覆盖上传业务码、本地化、安全错误与默认文案', () => {
  const { getUploadError } = setup();
  const messages: Record<number, string> = {
    40001: '上传凭证无效或已过期，请重新上传',
    40002: '不支持此文件格式，请转换后重试。',
    40003: '上传文件数据无效，请重新上传',
    40004: '文件大小错误，请检查后重新上传',
    40005: 'provider message',
    40006: scanAlert('file.zip', virus)[0],
    40007: scanAlert('file.zip', policy)[0],
    50001: '文件处理或存储失败，请稍后重试',
    50002: '文件元数据处理失败，请稍后重试',
    50003: '文件哈希初始化失败，请稍后重试',
    50004: '上传选项处理失败，请稍后重试',
    50005: '安全扫描服务暂不可用，请稍后重试',
    50006: '安全扫描繁忙或超时，请稍后重试',
    49999: 'provider message',
  };
  for (const [codeText, message] of Object.entries(messages)) {
    const code = Number(codeText);
    const response = Object.freeze({ code, message: 'provider message' });
    const expected = { code, message, isSecurityError: code === 40006 || code === 40007 };
    assert.deepEqual(getUploadError(response, 'file.zip'), expected);
    assert.deepEqual(getUploadError(JSON.stringify(response), 'file.zip'), expected);
  }
  for (const response of [
    undefined,
    null,
    '',
    'null',
    '[]',
    '<html>502</html>',
    {},
    { code: '40006' },
    { code: NaN },
    { code: Infinity },
    { key: 'test/key' },
  ]) {
    assert.equal(getUploadError(response), null);
  }
  for (const message of [undefined, ' ', [], {}]) {
    assert.equal(getUploadError({ code: 40005, message })?.message, '上传失败，请稍后再试。');
  }
  assert.equal(getUploadError({ code: 40006 })?.message, `检测到安全风险：${virus}`);
});

test('汇总去重、区分安全错误和普通业务失败，停止后立即提示', () => {
  const { alerts, bindUploadErrors, UploaderState } = setup();
  const state = { state: UploaderState.STARTED };
  const errors = bindUploadErrors(state);
  const first = { id: 'first', name: 'first.zip' };
  const firstError: TestError = { response: { code: 40006 }, file: first };
  errors.handleError(firstError);
  errors.handleError({ ...firstError });
  errors.handleError({ response: { code: 40007 }, file: { id: 'second', name: 'second.zip' } });
  errors.handleError({ response: { code: 50005 }, file: { id: 'third', name: 'third.zip' } });
  assert.equal(firstError.uploadErrorHandled, true);
  assert.equal(firstError.uploadErrorMessage, scanAlert(first.name, virus)[0]);
  assert.deepEqual(alerts, [['安全扫描服务暂不可用，请稍后重试', 2]]);
  state.state = UploaderState.STOPPED;
  errors.handleStateChanged();
  errors.flush();
  assert.deepEqual(alerts[1], ['2 个文件检测到安全风险，无法上传', 2]);
  errors.handleError(firstError);
  assert.deepEqual(alerts[2], scanAlert(first.name, virus));
});

test('HTTP 401 的安全错误先于逐文件回调，批次提示先于完成回调', async () => {
  const ctx = setup();
  const errors: TestError[] = [];
  const order: string[] = [];
  const up = ctx.createUploader({
    Error(_up, error, tip) {
      assert.equal(tip, error.uploadErrorMessage);
      order.push('init error');
      errors.push(error);
    },
    UploadComplete(uploader) {
      assert.deepEqual(ctx.alerts, [['2 个文件检测到安全风险，无法上传', 2]]);
      order.push('init complete');
      uploader.destroy();
    },
    FileUploaded() {
      assert.fail('安全错误不应触发成功回调');
    },
  });
  up.bind('Error', (_up, error, tip) => {
    assert.equal(error.uploadErrorHandled, true);
    assert.equal(tip, error.uploadErrorMessage);
    assert.equal(ctx.alerts.length, 0);
    order.push('bound error');
  });
  up.bind('UploadComplete', () => {
    assert.deepEqual(ctx.alerts, [['2 个文件检测到安全风险，无法上传', 2]]);
    order.push('bound complete');
  });
  up.addFile([file('a.zip'), file('b.zip')]);
  await settle();
  const a = { code: 40006, message: 'scan failed' };
  const b = { code: 40007, message: 'policy failed' };
  ctx.requests[0]!.reply(401, JSON.stringify(a));
  ctx.requests[1]!.reply(401, JSON.stringify(b));
  await settle();
  assert.deepEqual(order, [
    'bound error',
    'init error',
    'bound error',
    'init error',
    'bound complete',
    'init complete',
  ]);
  assert.deepEqual(
    errors.map(error => [error.code, error.status, error.response]),
    [
      [ctx.UploadError.HTTP_ERROR, 401, a],
      [ctx.UploadError.HTTP_ERROR, 401, b],
    ],
  );
  assert.ok(up.files.every(item => item.status === ctx.FileStatus.FAILED));
  assert.equal(ctx.alerts.length, 1);
});

test('停止或销毁时在调用方收到事件前提示且不重复提示', async () => {
  for (const action of ['stop', 'destroy'] as const) {
    const ctx = setup();
    const order: string[] = [];
    const up = ctx.createUploader({
      Error(_up, error) {
        assert.equal(error.uploadErrorHandled, true);
        up[action]();
      },
      StateChanged(uploader) {
        if (uploader.state !== ctx.UploaderState.STOPPED) return;
        assert.deepEqual(ctx.alerts, [scanAlert('security.zip', virus)]);
        order.push('state');
      },
      Destroy() {
        assert.deepEqual(ctx.alerts, [scanAlert('security.zip', virus)]);
        order.push('destroy');
      },
    });
    up.addFile([file('security.zip'), file('pending.zip')]);
    await settle();
    ctx.requests[0]!.reply(401, '{"code":40006}');
    await settle();
    if (action === 'stop') up.destroy();
    assert.deepEqual(order, action === 'stop' ? ['state', 'state', 'destroy'] : ['state', 'destroy']);
    assert.equal(ctx.alerts.length, 1);
  }
});

test('直传和分片将 2xx 错误体、空响应、合并拒绝及网络错误交给失败回调', async () => {
  const cases = [
    { phase: 'direct', status: 200, body: '{"code":49999,"message":"unknown error"}', expected: 'unknown error' },
    {
      phase: 'direct',
      status: 500,
      body: '{"code":50006,"message":"scan timeout"}',
      expected: '安全扫描繁忙或超时，请稍后重试',
    },
    { phase: 'direct', status: 200, body: 'null' },
    { phase: 'block', status: 200, body: '{"code":40007}', expected: scanAlert('file.zip', policy)[0] },
    { phase: 'block', status: 200, body: '{}' },
    { phase: 'merge', status: 400, body: '{"code":40007}', expected: scanAlert('file.zip', policy)[0] },
    { phase: 'merge', status: 0, body: '', blockedStorage: true },
    { phase: 'merge', status: 200, body: '' },
  ];
  for (const scenario of cases) {
    const ctx = setup({ blockedStorage: scenario.blockedStorage ?? false });
    const order: string[] = [];
    let received: TestError | undefined;
    const up = ctx.createUploader({
      Error(_up, error, tip) {
        order.push('error');
        received = error;
        if (scenario.expected) assert.equal(tip, scenario.expected);
      },
      FileUploaded() {
        assert.fail('错误响应不应触发成功回调');
      },
      UploadComplete() {
        order.push('complete');
      },
    });
    const isDirect = scenario.phase === 'direct';
    up.addFile(file('file.zip', isDirect ? 1 : 4 * 1024 * 1024 + 1));
    await settle();
    if (scenario.phase === 'merge') {
      ctx.requests[0]!.reply(200, '{"ctx":"first"}');
      await settle();
      ctx.requests[1]!.reply(200, '{"ctx":"second"}');
      await settle();
      assert.ok(ctx.requests[2]!.url.includes('/mkfile/'));
    }
    const request = ctx.requests.at(-1)!;
    if (scenario.status === 0) request.onerror?.();
    else request.reply(scenario.status, scenario.body);
    await settle();
    assert.deepEqual(order, ['error', 'complete']);
    assert.equal(received?.status, scenario.status);
    assert.equal(received?.uploadErrorHandled, scenario.expected ? true : undefined);
    assert.deepEqual(ctx.alerts, scenario.expected ? [[scenario.expected, 2]] : []);
    assert.equal(ctx.storage.size, 0);
  }
});
