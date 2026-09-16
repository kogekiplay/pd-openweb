/**
 * createUploader 的行为 spec —— 守住「换掉 plupload 之后对外契约不变」这件事。
 *
 * 【为什么这个 spec 值得存在】上传路径是全公司 OA 的核心（表单、任务、知识中心、
 * 动态的附件都走它），而真实上传要七牛凭证与后端、本地验不了。
 * 能验的是【队列 / 校验 / 事件 / 参数映射】这一层 —— 也正是换掉 plupload 时
 * 自己重写的那一层。
 *
 * 【uploader/qiniuV1 被替身掉】不是为了图省事：这一份要验的是「我们喂给上传层的
 * 参数对不对、它回调之后我们组装的结果对不对」，替身能把这两头都看清楚。
 * 上传层【自己发到网络上的东西】由 src/utils/uploader/qiniuV1.spec.ts 守，
 * 那一份加载真实实现、只替身 XHR，期望值抄自生产实测报文。两份合起来才完整。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');

/** 记录每次调用上传层（uploader/qiniuV1）的入参，以及拿到的回调句柄 */
type QiniuCall = { params: any; handlers: any };

function loadCreateUploader(qiniuCalls: QiniuCall[]) {
  const moduleLike: { exports: Record<string, any> } = { exports: {} };
  const compiled = new Map<string, any>();

  function loadLocal(absPath: string): any {
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
      makeRequire(path.dirname(absPath)),
      path.dirname(absPath),
    );
    compiled.set(absPath, mod.exports);
    return mod.exports;
  }

  function makeRequire(dir: string) {
    return function localRequire(request: string) {
      // 被测代码自己的模块：真的编译加载
      if (request.startsWith('./uploader/') || request.startsWith('./')) {
        if (request === './uploader/qiniuV1') {
          // 【替身】不发网络请求，把入参与回调句柄记下来给断言用
          return {
            uploadToQiniu(params: any, handlers: any) {
              qiniuCalls.push({ params, handlers });
              return { abort() {} };
            },
          };
        }
        return loadLocal(path.join(dir, request + '.ts'));
      }

      if (request === 'src/utils/common') {
        // 默认的取凭证实现；spec 里一律通过 option.getToken 覆盖，这里只要能引到
        return { getToken: () => Promise.resolve([]) };
      }
      if (request === 'src/utils/expression') {
        return {
          // 【必须带 __esModule】babel 的 _interopRequireDefault 见到没有这个标记的对象
          // 会再包一层 default，于是 _expression.default.getExtOfFileName 变成 undefined。
          __esModule: true,
          default: {
            getExtOfFileName: (n: string) => (n.indexOf('.') > -1 ? n.split('.').pop() : ''),
            getNameOfFileName: (n: string) => (n.indexOf('.') > -1 ? n.split('.').slice(0, -1).join('.') : n),
            fileIsPicture: (ext: string) => /\.(png|jpg|jpeg|gif)$/i.test(ext),
          },
        };
      }
      return require(request);
    };
  }

  const { code } = transformFileSync(path.join(__dirname, 'createUploader.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', '__dirname', code)(
    moduleLike,
    moduleLike.exports,
    makeRequire(__dirname),
    __dirname,
  );
  return moduleLike.exports;
}

// ── 环境替身 ──────────────────────────────────────────────────────────────
const alerts: Array<[string, number]> = [];
global.md = { global: { FileStoreConfig: { uploadHost: 'https://up.example.com/' }, SysSettings: { fileUploadLimitSize: 100 } } };
global._l = (s: string, ...args: any[]) => args.reduce((acc, v, i) => acc.replace(`%${i}`, String(v)), s);
global.alert = (msg: string, type: number) => alerts.push([msg, type]);

/** 造一个假的 File —— 只要 name/size/type 就够，被测代码不读内容 */
function fakeFile(name: string, size = 10): any {
  return { name, size, type: '', __native: true };
}

/** 默认的取凭证替身：按顺序回一组可用凭证 */
function tokenStub(files: any[]) {
  return Promise.resolve(
    files.map((_f, i) => ({
      uptoken: `token-${i}`,
      key: `dir/serverfile-${i}.png`,
      serverName: 'https://cdn.example.com/',
      fileName: `serverfile-${i}.png`,
      url: 'https://cdn.example.com/dir/serverfile-0.png',
    })),
  );
}

function makeUploader(extra: any = {}, qiniuCalls: QiniuCall[] = []) {
  const mod = loadCreateUploader(qiniuCalls);
  const createUploader = mod.default || mod;
  const events: Array<[string, any[]]> = [];
  const uploader = createUploader({
    getToken: tokenStub,
    auto_start: true,
    init: {
      FilesAdded: (...a: any[]) => events.push(['FilesAdded', a]),
      BeforeUpload: (...a: any[]) => events.push(['BeforeUpload', a]),
      UploadProgress: (...a: any[]) => events.push(['UploadProgress', a]),
      FileUploaded: (...a: any[]) => events.push(['FileUploaded', a]),
      UploadComplete: (...a: any[]) => events.push(['UploadComplete', a]),
      Error: (...a: any[]) => events.push(['Error', a]),
    },
    ...extra,
  });
  return { uploader, events, qiniuCalls, mod };
}

const tick = () => new Promise(r => setTimeout(r, 0));

// 用例收集 + 执行。
// 【这个 runner 是必须的】scripts/run-specs.ts 把每个 spec 当独立 Node 脚本跑、
// 只看退出码 —— 断言必须【真的被执行】。第一版写成 `exports['名'] = async () => {}`，
// 只定义不调用，结果故意改错断言也照样 73/73 通过（负对照抓到的）。
const cases: Array<[string, () => Promise<void>]> = [];
function test(name: string, fn: () => Promise<void>) {
  cases.push([name, fn]);
}


// ── 1. 文件名里的非法字符会被替换 ────────────────────────────────────────
test('文件名非法字符替换成下划线', async () => {
  const { uploader } = makeUploader();
  uploader.addFile([fakeFile('a/b:c*d.txt')]);
  assert.strictEqual(uploader.files[0].name, 'a_b_c_d.txt');
});

// ── 2. 后缀黑名单 ────────────────────────────────────────────────────────
test('黑名单后缀被拒，并带上 INVALID_FILES 分类', async () => {
  const rejected: any[] = [];
  const { uploader, mod } = makeUploader({
    error_callback: (type: number, files: any[]) => rejected.push([type, files]),
  });
  uploader.addFile([fakeFile('virus.exe'), fakeFile('ok.txt')]);
  assert.strictEqual(rejected.length, 1);
  assert.strictEqual(rejected[0][0], mod.UPLOAD_ERROR.INVALID_FILES);
  assert.strictEqual(rejected[0][1][0].name, 'virus.exe');
  assert.strictEqual(rejected[0][1][0].mdUploadErrorType, mod.UPLOAD_ERROR.INVALID_FILES);
  // 合法的那个仍进队列
  assert.deepStrictEqual(uploader.files.map((f: any) => f.name), ['ok.txt']);
});

// ── 3. 数量上限 ──────────────────────────────────────────────────────────
test('超过 max_file_count 时整批拒绝，队列不变', async () => {
  const rejected: any[] = [];
  const { uploader, mod } = makeUploader({
    max_file_count: 2,
    error_callback: (type: number, files: any[]) => rejected.push([type, files]),
  });
  uploader.addFile([fakeFile('a.txt'), fakeFile('b.txt'), fakeFile('c.txt')]);
  assert.strictEqual(rejected[0][0], mod.UPLOAD_ERROR.TOO_MANY_FILES);
  assert.strictEqual(uploader.files.length, 0);
});

// ── 4. 单文件大小上限，错误码要与 plupload 一致 ──────────────────────────
test('超过 max_file_size 发 FILE_SIZE_ERROR（-600，与 plupload 同值）', async () => {
  const { uploader, events, mod } = makeUploader({ max_file_size: '1kb' });
  uploader.addFile([fakeFile('big.txt', 2048)]);
  const err = events.find(e => e[0] === 'Error');
  assert.ok(err, '应当发出 Error 事件');
  assert.strictEqual(err![1][1].code, mod.UploadError.FILE_SIZE_ERROR);
  assert.strictEqual(mod.UploadError.FILE_SIZE_ERROR, -600);
});

// ── 5. 取到凭证后挂到文件上 ──────────────────────────────────────────────
test('凭证字段挂到文件对象上', async () => {
  const { uploader } = makeUploader();
  uploader.addFile([fakeFile('pic.png')]);
  await tick();
  const f = uploader.files[0];
  assert.strictEqual(f.token, 'token-0');
  assert.strictEqual(f.key, 'dir/serverfile-0.png');
  assert.strictEqual(f.fileName, 'serverfile-0.png');
  assert.strictEqual(f.serverName, 'https://cdn.example.com/');
});

// ── 6. 【关键契约】调用方在 BeforeUpload 里改 multipart_params 要生效 ────
test('BeforeUpload 里改 multipart_params 会被带进上传参数', async () => {
  const calls: QiniuCall[] = [];
  const { uploader } = makeUploader(
    {
      x_vars: {},
      init: {
        BeforeUpload: (up: any) => {
          // 这是 10 个调用方普遍在用的写法
          up.settings.multipart_params['x:fileName'] = '被调用方改过';
          up.settings.multipart_params['x:extra'] = 'added';
        },
      },
    },
    calls,
  );
  uploader.addFile([fakeFile('pic.png')]);
  await tick();
  assert.strictEqual(calls.length, 1, '应当发起一次上传');
  assert.strictEqual(calls[0].params.customVars['x:fileName'], '被调用方改过');
  assert.strictEqual(calls[0].params.customVars['x:extra'], 'added');
  assert.strictEqual(calls[0].params.token, 'token-0');
});

// ── 7. x_vars 不是对象时不产出自定义变量（沿用老实现的开关语义）─────────
test('没传 x_vars 时不带 x: 自定义变量', async () => {
  const calls: QiniuCall[] = [];
  const { uploader } = makeUploader({}, calls);
  uploader.addFile([fakeFile('pic.png')]);
  await tick();
  assert.deepStrictEqual(Object.keys(calls[0].params.customVars), []);
});

// ── 8. 进度 ──────────────────────────────────────────────────────────────
test('进度回调写回 percent / loaded 并发 UploadProgress', async () => {
  const calls: QiniuCall[] = [];
  const { uploader, events } = makeUploader({}, calls);
  uploader.addFile([fakeFile('pic.png', 1000)]);
  await tick();
  calls[0].handlers.onProgress(500, 1000, 50);
  const p = events.find(e => e[0] === 'UploadProgress');
  assert.ok(p, '应当发出 UploadProgress');
  assert.strictEqual(uploader.files[0].percent, 50);
  assert.strictEqual(uploader.files[0].loaded, 500);
});

// ── 9. 完成后的 response 形状（formatResponseData 逐个读这些字段）────────
test('完成后组装出下游要的 response 字段', async () => {
  const calls: QiniuCall[] = [];
  const { uploader, events } = makeUploader({}, calls);
  uploader.addFile([fakeFile('我的图片.png')]);
  await tick();
  calls[0].handlers.onComplete({ key: 'dir/serverfile-0.png' });

  const done = events.find(e => e[0] === 'FileUploaded');
  assert.ok(done, '应当发出 FileUploaded');
  const res = done![1][2].response;
  assert.strictEqual(res.key, 'dir/serverfile-0.png');
  assert.strictEqual(res.fileExt, '.png');
  assert.strictEqual(res.fileName, 'serverfile-0');
  assert.strictEqual(res.filePath, 'dir/');
  assert.strictEqual(res.serverName, 'https://cdn.example.com/');
  // 原始文件名是 encodeURIComponent 过的（老实现就是这样，下游按这个解）
  assert.strictEqual(res.originalFileName, encodeURIComponent('我的图片'));
});

// ── 10. 全部完成后发 UploadComplete ─────────────────────────────────────
test('队列跑完发 UploadComplete', async () => {
  const calls: QiniuCall[] = [];
  const { uploader, events } = makeUploader({}, calls);
  uploader.addFile([fakeFile('a.png'), fakeFile('b.png')]);
  await tick();
  assert.strictEqual(calls.length, 2);
  calls[0].handlers.onComplete({ key: 'dir/serverfile-0.png' });
  assert.ok(!events.find(e => e[0] === 'UploadComplete'), '还有一个在传，不该完成');
  calls[1].handlers.onComplete({ key: 'dir/serverfile-1.png' });
  assert.ok(events.find(e => e[0] === 'UploadComplete'), '两个都完成后应当发 UploadComplete');
});

// ── 11. 错误码翻译 ──────────────────────────────────────────────────────
test('HTTP 614 翻成同名文件的提示', async () => {
  const calls: QiniuCall[] = [];
  const { uploader, events, mod } = makeUploader({}, calls);
  uploader.addFile([fakeFile('pic.png')]);
  await tick();
  calls[0].handlers.onError({ code: mod.UploadError.HTTP_ERROR, status: 614, message: 'dup' });
  const err = events.find(e => e[0] === 'Error');
  assert.ok(err, '应当发出 Error');
  assert.ok(String(err![1][2]).indexOf('已存在同名文件') > -1, `实际提示: ${err![1][2]}`);
  assert.strictEqual(uploader.files[0].status, mod.FileStatus.FAILED);
});

// ── 12. removeFile 会中断在途任务 ───────────────────────────────────────
test('removeFile 中断在途上传并发 FilesRemoved', async () => {
  const calls: QiniuCall[] = [];
  let aborted = false;
  const { uploader } = makeUploader({}, calls);
  const removed: any[] = [];
  uploader.bind('FilesRemoved', (_up: any, fs: any[]) => removed.push(...fs));
  uploader.addFile([fakeFile('pic.png')]);
  await tick();
  // 替身返回的 abort 是空的，这里换成能观测的
  (uploader as any).__noop = 0;
  calls[0].handlers.onProgress(1, 10, 10);
  const target = uploader.files[0];
  uploader.removeFile(target);
  assert.strictEqual(uploader.files.length, 0);
  assert.strictEqual(removed.length, 1);
  assert.strictEqual(removed[0].name, 'pic.png');
  void aborted;
});

// ── 13. 【时序】auto_start:false 时，start() 早于凭证返回也必须能传 ────────
test('auto_start:false 时 start() 早于凭证返回，凭证到位后仍会上传', async () => {
  const calls: QiniuCall[] = [];
  const { uploader } = makeUploader({ auto_start: false }, calls);
  uploader.addFile([fakeFile('pic.png')]);
  // 【同步就调 start】模拟 SendToolbar 只有一个文件时的情形：
  // recurShowFileConfirm 会同步走到 up.start()，此时 getToken 还没 resolve。
  uploader.start();
  assert.strictEqual(calls.length, 0, '凭证还没到，这时不该已经发起上传');
  await tick();
  assert.strictEqual(calls.length, 1, '凭证到位后应当把等着的文件接上');
  assert.strictEqual(calls[0].params.token, 'token-0');
});

// ── 14. auto_start:false 且【没有】调 start() 时，不该自己传 ──────────────
test('auto_start:false 且未调用 start() 时不会自动上传', async () => {
  const calls: QiniuCall[] = [];
  const { uploader } = makeUploader({ auto_start: false }, calls);
  uploader.addFile([fakeFile('pic.png')]);
  await tick();
  assert.strictEqual(calls.length, 0, '没请求过开始，就不该上传');
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
    console.error(`createUploader spec: ${failed}/${cases.length} 个用例失败`);
    process.exit(1);
  }
  console.log(`createUploader spec: ${cases.length} 个用例全部通过`);
})();
