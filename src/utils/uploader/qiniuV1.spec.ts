/**
 * 七牛 v1 上传协议的【线缆格式】spec —— 断言我们到底往网络上发了什么。
 *
 * 【与 createUploader.spec.ts 的分工】那一份把本模块整个替身掉，验的是上一层的
 * 队列 / 校验 / 事件 / 参数映射。这一份反过来：加载【真实的 qiniuV1】，只把
 * XMLHttpRequest / FormData 换成能记录的替身，于是能逐字节看清请求的
 * 方法、URL、请求头、表单字段、body。
 *
 * 【为什么非要有这一层】此前写过一个「真实浏览器 + 假七牛端点」的验证台，
 * 它全绿，但线上照样传不上去 —— 因为那个假端点是照着 qiniu-js 的假设
 * （v2 协议、挂在域名根下）搭的，而这台文件服务是【v1 协议 + 同源路径前缀】。
 * 验证台等于拿自己的错误假设验自己，必然误绿。教训是：基准要取自真实系统。
 * 所以下面每条断言的期望值都直接抄自 2026-09-16 在生产上抓到的真实报文，
 * 关键几条把原始响应也贴在注释里。
 *
 * 【最要紧的一条是 base 原样使用】uploadHost 在这套私有化部署里是
 * `/file/mingdao/upload`（同源相对路径，不是域名）。任何"解析主机再拼协议"的
 * 写法都会变成 `https:///file/...`，浏览器直接 ERR_CONNECTION_CLOSED。
 * 下面第 1、4 条就是钉死这件事的。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');

// ── 记录一次 XHR ─────────────────────────────────────────────────────────
type Sent = {
  method: string;
  url: string;
  headers: Record<string, string>;
  /** FormData 替身记下的字段名（按 append 顺序）；非表单请求为 undefined */
  formKeys?: string[];
  formValues?: Record<string, any>;
  body: any;
};

/** 按 URL 决定回什么。返回 null 表示「这条 URL 没安排响应」，spec 会当失败处理。 */
type Responder = (sent: Sent) => { status: number; text: string } | null;

function makeEnv(responder: Responder) {
  const sent: Sent[] = [];
  const store = new Map<string, string>();

  class FakeFormData {
    keys: string[] = [];
    values: Record<string, any> = {};
    append(k: string, v: any, filename?: string) {
      this.keys.push(k);
      this.values[k] = filename === undefined ? v : { file: v, filename };
    }
  }

  class FakeXhr {
    method = '';
    url = '';
    headers: Record<string, string> = {};
    upload: any = {};
    status = 0;
    statusText = '';
    responseText = '';
    onload: any = null;
    onerror: any = null;
    onabort: any = null;
    private done = false;

    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(k: string, v: string) {
      this.headers[k] = v;
    }
    send(body: any) {
      const rec: Sent = { method: this.method, url: this.url, headers: this.headers, body };
      if (body instanceof FakeFormData) {
        rec.formKeys = body.keys;
        rec.formValues = body.values;
      }
      sent.push(rec);
      setTimeout(() => {
        if (this.done) return;
        const res = responder(rec);
        if (!res) {
          // 【故意不静默】没安排响应说明 spec 与实现对不上，要当场看见
          throw new Error(`spec 没有为 ${rec.method} ${rec.url} 安排响应`);
        }
        this.done = true;
        this.status = res.status;
        this.responseText = res.text;
        this.onload && this.onload();
      }, 0);
    }
    abort() {
      if (this.done) return;
      this.done = true;
      this.onabort && this.onabort();
    }
  }

  const g = globalThis as any;
  const saved = {
    XMLHttpRequest: g.XMLHttpRequest,
    FormData: g.FormData,
    localStorage: g.localStorage,
    safeLocalStorageSetItem: g.safeLocalStorageSetItem,
  };
  g.XMLHttpRequest = FakeXhr;
  g.FormData = FakeFormData;
  g.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k) : null),
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
  g.safeLocalStorageSetItem = (k: string, v: string) => store.set(k, v);

  return {
    sent,
    store,
    restore() {
      Object.assign(g, saved);
    },
  };
}

/** 加载真实的 qiniuV1（只把它自己的相对依赖按真文件编译进来） */
function loadQiniuV1(): any {
  const compiled = new Map<string, any>();

  function load(absPath: string): any {
    if (compiled.has(absPath)) return compiled.get(absPath);
    const mod: { exports: Record<string, any> } = { exports: {} };
    compiled.set(absPath, mod.exports);
    const { code } = transformFileSync(absPath, {
      babelrc: false,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', 'require', '__dirname', code)(
      mod,
      mod.exports,
      (request: string) =>
        request.startsWith('.') ? load(path.join(path.dirname(absPath), request + '.ts')) : require(request),
      path.dirname(absPath),
    );
    compiled.set(absPath, mod.exports);
    return mod.exports;
  }

  return load(path.join(__dirname, 'qiniuV1.ts'));
}

/** 造一个不依赖 Blob/File 的假文件：只要 size / name / slice */
function fakeFile(name: string, size: number) {
  return {
    name,
    size,
    slice(a: number, b: number) {
      return { __slice: [a, b], size: b - a };
    },
  } as any;
}

function run(qiniu: any, params: any, env: { sent: Sent[] }) {
  return new Promise<{ ok: boolean; res?: any; err?: any; progress: number[] }>(resolve => {
    const progress: number[] = [];
    const task = qiniu.uploadToQiniu(params, {
      onProgress: (_l: number, _t: number, p: number) => progress.push(p),
      onComplete: (res: any) => resolve({ ok: true, res, progress }),
      onError: (err: any) => resolve({ ok: false, err, progress }),
    });
    (resolve as any).__task = task;
    void env;
  });
}

const cases: Array<[string, () => Promise<void> | void]> = [];
const test = (name: string, fn: () => Promise<void> | void) => cases.push([name, fn]);

const TOKEN = 'mdstorage:xfUjfFRyi3fWvONRVia9ArTh2p0=:eyJzY29wZSI6Im1kb2M6S2MvZGYwLmJpbiJ9';
const KEY = 'Kc/df0F498d0xcg3r3L2Edu1JeteEcfb0fQ0N9u3g3Odd5Uam9Saf9k5K19171xfOcW.bin';
const BASE = '/file/mingdao/upload';

/** 2026-09-16 生产直传的真实响应，逐字段照抄 */
const DIRECT_RES = JSON.stringify({
  bucket: 'mdoc',
  etag: 'a3315225eb9050936eae275cbe72e05f',
  fileExt: '',
  fileName: '',
  filePath: '',
  fsize: '46080',
  key: KEY,
  originalFileName: '',
  serverName: '',
});

// ── 1. 直传：URL 就是 base 本身，不做任何主机解析 ─────────────────────────
test('直传把 base 原样当 URL 用（相对路径不被拼成 https:///…）', async () => {
  const qiniu = loadQiniuV1();
  const env = makeEnv(s => (s.url === BASE ? { status: 200, text: DIRECT_RES } : null));
  try {
    const out = await run(qiniu, { file: fakeFile('a.bin', 46080), key: KEY, token: TOKEN, url: BASE }, env);
    assert.ok(out.ok, '直传应当成功');
    assert.strictEqual(env.sent.length, 1, '直传只该发一个请求');
    assert.strictEqual(env.sent[0].method, 'POST');
    // 【这一条就是 qiniu-js 走不通的原因】它的 Host.getUrl() 只会拼 protocol://host
    assert.strictEqual(env.sent[0].url, BASE);
    assert.strictEqual(out.res.bucket, 'mdoc');
    assert.strictEqual(out.res.key, KEY);
  } finally {
    env.restore();
  }
});

// ── 2. 直传的表单字段 ────────────────────────────────────────────────────
test('直传表单字段是 token / key / file，顺序与生产一致', async () => {
  const qiniu = loadQiniuV1();
  const env = makeEnv(() => ({ status: 200, text: DIRECT_RES }));
  try {
    await run(qiniu, { file: fakeFile('a.bin', 46080), key: KEY, token: TOKEN, url: BASE }, env);
    // 生产抓包：FormData{token,key,file}
    assert.deepStrictEqual(env.sent[0].formKeys, ['token', 'key', 'file']);
    assert.strictEqual(env.sent[0].formValues!.token, TOKEN);
    assert.strictEqual(env.sent[0].formValues!.key, KEY);
    // 文件字段带上文件名
    assert.strictEqual(env.sent[0].formValues!.file.filename, 'a.bin');
  } finally {
    env.restore();
  }
});

// ── 3. customVars 与 save_key ────────────────────────────────────────────
test('customVars 随直传表单发出；key 为 null 时（save_key）不带 key 字段', async () => {
  const qiniu = loadQiniuV1();
  const env = makeEnv(() => ({ status: 200, text: DIRECT_RES }));
  try {
    await run(
      qiniu,
      {
        file: fakeFile('a.bin', 1024),
        key: null,
        token: TOKEN,
        url: BASE,
        customVars: { 'x:fileName': 'a', 'x:fileExt': '.bin' },
      },
      env,
    );
    assert.deepStrictEqual(env.sent[0].formKeys, ['token', 'x:fileName', 'x:fileExt', 'file']);
    assert.ok(!env.sent[0].formKeys!.includes('key'), 'save_key 场景不该自己带 key');
  } finally {
    env.restore();
  }
});

// ── 4. 分片：mkblk 的路径、鉴权头、body ──────────────────────────────────
test('分片走 {base}/mkblk/{blockSize}，带 Authorization: UpToken，body 是该片本身', async () => {
  const qiniu = loadQiniuV1();
  const size = 6 * 1024 * 1024;
  const chunk = 4 * 1024 * 1024;
  let n = 0;
  const env = makeEnv(s => {
    if (s.url.includes('/mkblk/')) {
      // 生产真实响应形如 {"ctx":"Zjg0MGFjOTQ…","offset":4194304}
      return { status: 200, text: JSON.stringify({ ctx: `ctx-${n++}`, offset: 0 }) };
    }
    return { status: 200, text: JSON.stringify({ bucket: 'mdoc', key: KEY, fsize: String(size) }) };
  });
  try {
    const out = await run(
      qiniu,
      { file: fakeFile('big.bin', size), key: KEY, token: TOKEN, url: BASE, chunkSize: chunk },
      env,
    );
    assert.ok(out.ok, '分片上传应当成功');
    const blks = env.sent.filter(s => s.url.includes('/mkblk/'));
    assert.strictEqual(blks.length, 2, '6MB 按 4MB 切应当是 2 片');
    // 末片是【余数】而不是整片 —— 生产抓包正是 4194304 + 2097152
    assert.strictEqual(blks[0].url, `${BASE}/mkblk/4194304`);
    assert.strictEqual(blks[1].url, `${BASE}/mkblk/2097152`);
    for (const b of blks) assert.strictEqual(b.headers.Authorization, `UpToken ${TOKEN}`);
    assert.deepStrictEqual(blks[0].body.__slice, [0, chunk]);
    assert.deepStrictEqual(blks[1].body.__slice, [chunk, size]);
  } finally {
    env.restore();
  }
});

// ── 5. 收尾 mkfile 的路径与 body ─────────────────────────────────────────
test('收尾走 {base}/mkfile/{size}/key/{btoa(key)}，Content-Type 是 text/plain，body 是 ctx 列表', async () => {
  const qiniu = loadQiniuV1();
  const size = 6 * 1024 * 1024;
  let n = 0;
  const env = makeEnv(s =>
    s.url.includes('/mkblk/')
      ? { status: 200, text: JSON.stringify({ ctx: `ctx-${n++}` }) }
      : { status: 200, text: JSON.stringify({ bucket: 'mdoc', key: KEY, fsize: String(size) }) },
  );
  try {
    await run(
      qiniu,
      { file: fakeFile('big.bin', size), key: KEY, token: TOKEN, url: BASE, chunkSize: 4 * 1024 * 1024 },
      env,
    );
    const done = env.sent[env.sent.length - 1];
    // 【btoa 而不是 url-safe base64】与换掉之前的实现保持一致
    assert.strictEqual(done.url, `${BASE}/mkfile/${size}/key/${btoa(KEY)}`);
    assert.strictEqual(done.headers['Content-Type'], 'text/plain;charset=UTF-8');
    assert.strictEqual(done.headers.Authorization, `UpToken ${TOKEN}`);
    assert.strictEqual(done.body, 'ctx-0,ctx-1');
  } finally {
    env.restore();
  }
});

// ── 6. 小于分片大小的文件不该走分片 ──────────────────────────────────────
test('文件不大于 chunk_size 时走直传，不发 mkblk', async () => {
  const qiniu = loadQiniuV1();
  const env = makeEnv(() => ({ status: 200, text: DIRECT_RES }));
  try {
    await run(
      qiniu,
      { file: fakeFile('a.bin', 45 * 1024), key: KEY, token: TOKEN, url: BASE, chunkSize: 4 * 1024 * 1024 },
      env,
    );
    assert.strictEqual(env.sent.length, 1);
    assert.ok(!env.sent[0].url.includes('/mkblk/'), '45KB 不该分片');
  } finally {
    env.restore();
  }
});

// ── 7. 续传缓存的形状与写入时机 ──────────────────────────────────────────
test('每片成功后按【文件名】写续传点，字段是 ctx/percent/total/offset/time', async () => {
  const qiniu = loadQiniuV1();
  const size = 6 * 1024 * 1024;
  let n = 0;
  let afterFirst: any = null;
  const env = makeEnv(s => {
    if (s.url.includes('/mkblk/')) {
      const r = { status: 200, text: JSON.stringify({ ctx: `ctx-${n++}` }) };
      return r;
    }
    afterFirst = env.store.get('big.bin');
    return { status: 200, text: JSON.stringify({ key: KEY }) };
  });
  try {
    await run(
      qiniu,
      { file: fakeFile('big.bin', size), key: KEY, token: TOKEN, url: BASE, chunkSize: 4 * 1024 * 1024 },
      env,
    );
    const cache = JSON.parse(afterFirst);
    assert.deepStrictEqual(Object.keys(cache).sort(), ['ctx', 'offset', 'percent', 'time', 'total']);
    assert.strictEqual(cache.total, size);
    assert.strictEqual(cache.offset, size);
    assert.strictEqual(cache.ctx, 'ctx-0,ctx-1');
    // 传完要清掉，否则下次会命中一个已完成的缓存
    assert.strictEqual(env.store.get('big.bin'), undefined, '收尾后应当删掉续传点');
  } finally {
    env.restore();
  }
});

// ── 8. 命中续传点时从断点继续 ────────────────────────────────────────────
test('缓存有效时从 offset 续传，且把已有 ctx 接上', async () => {
  const qiniu = loadQiniuV1();
  const size = 6 * 1024 * 1024;
  const chunk = 4 * 1024 * 1024;
  const env = makeEnv(s =>
    s.url.includes('/mkblk/')
      ? { status: 200, text: JSON.stringify({ ctx: 'ctx-new' }) }
      : { status: 200, text: JSON.stringify({ key: KEY }) },
  );
  env.store.set(
    'big.bin',
    JSON.stringify({ ctx: 'ctx-old', percent: 66, total: size, offset: chunk, time: Date.now() }),
  );
  try {
    await run(qiniu, { file: fakeFile('big.bin', size), key: KEY, token: TOKEN, url: BASE, chunkSize: chunk }, env);
    const blks = env.sent.filter(s => s.url.includes('/mkblk/'));
    assert.strictEqual(blks.length, 1, '已传 4MB，只该再传剩下的 2MB');
    assert.strictEqual(blks[0].url, `${BASE}/mkblk/2097152`);
    assert.deepStrictEqual(blks[0].body.__slice, [chunk, size]);
    assert.strictEqual(env.sent[env.sent.length - 1].body, 'ctx-old,ctx-new');
  } finally {
    env.restore();
  }
});

// ── 9. 三条作废判据 ──────────────────────────────────────────────────────
test('续传点在【过期 / 大小不符 / percent 为 100】时一律作废，从头传', async () => {
  const size = 6 * 1024 * 1024;
  const chunk = 4 * 1024 * 1024;
  const bad = {
    过期: { ctx: 'x', percent: 66, total: size, offset: chunk, time: Date.now() - 25 * 60 * 60 * 1000 },
    大小不符: { ctx: 'x', percent: 66, total: size + 1, offset: chunk, time: Date.now() },
    已完成: { ctx: 'x', percent: 100, total: size, offset: size, time: Date.now() },
  };
  for (const [why, cache] of Object.entries(bad)) {
    const qiniu = loadQiniuV1();
    const env = makeEnv(s =>
      s.url.includes('/mkblk/')
        ? { status: 200, text: JSON.stringify({ ctx: 'c' }) }
        : { status: 200, text: JSON.stringify({ key: KEY }) },
    );
    env.store.set('big.bin', JSON.stringify(cache));
    try {
      await run(qiniu, { file: fakeFile('big.bin', size), key: KEY, token: TOKEN, url: BASE, chunkSize: chunk }, env);
      const blks = env.sent.filter(s => s.url.includes('/mkblk/'));
      assert.strictEqual(blks.length, 2, `${why}：应当作废缓存、从头传 2 片`);
      assert.deepStrictEqual(blks[0].body.__slice, [0, chunk]);
    } finally {
      env.restore();
    }
  }
});

// ── 10. 非 2xx 要带出 status 与响应体 ────────────────────────────────────
test('非 2xx 时 onError 带上 status 与解析后的响应体', async () => {
  const qiniu = loadQiniuV1();
  const env = makeEnv(() => ({ status: 401, text: JSON.stringify({ error: 'bad token' }) }));
  try {
    const out = await run(qiniu, { file: fakeFile('a.bin', 1024), key: KEY, token: TOKEN, url: BASE }, env);
    assert.ok(!out.ok, '401 应当走 onError');
    assert.strictEqual(out.err.status, 401);
    assert.strictEqual(out.err.response.error, 'bad token');
  } finally {
    env.restore();
  }
});

// ── 11. 末尾斜杠不会拼出双斜杠 ───────────────────────────────────────────
test('base 带末尾斜杠时不会拼出 //mkblk', async () => {
  const qiniu = loadQiniuV1();
  const size = 6 * 1024 * 1024;
  const env = makeEnv(s =>
    s.url.includes('/mkblk/')
      ? { status: 200, text: JSON.stringify({ ctx: 'c' }) }
      : { status: 200, text: JSON.stringify({ key: KEY }) },
  );
  try {
    await run(
      qiniu,
      { file: fakeFile('big.bin', size), key: KEY, token: TOKEN, url: BASE + '/', chunkSize: 4 * 1024 * 1024 },
      env,
    );
    for (const s of env.sent) assert.ok(!s.url.includes('//'), `不该出现双斜杠：${s.url}`);
  } finally {
    env.restore();
  }
});

(async () => {
  let failed = 0;
  for (const [name, fn] of cases) {
    try {
      await fn();
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${name}`);
      console.error(`    ${(err && (err as any).message) || err}`);
    }
  }
  if (failed) {
    console.error(`qiniuV1 spec: ${failed}/${cases.length} 个用例失败`);
    process.exit(1);
  }
  console.log(`qiniuV1 spec: ${cases.length} 个用例全部通过`);
})();
