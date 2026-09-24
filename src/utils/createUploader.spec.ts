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

// ── 被测模块的契约，【在本文件里重新声明一遍】────────────────────────────
//
// 【为什么不 `import('./createUploader')` 把真类型引过来】试过，撞在门禁的分工上：
// src 下的 spec 由 tsconfig.tools.json 检查，那份配置【故意不带 DOM lib】、
// 也不认 src/* 的 webpack alias（理由写在它自己的注释里：一旦开 DOM，
// spec-globals.d.ts 那套部分浏览器全局会炸出 19 条假错误）。createUploader.ts
// 引 src/utils/common、用 alert / _l / File，整条依赖链都要那套环境。
//
// 更要紧的是：**这本来就该重写一遍**。spec 的职责是从外部钉住契约 ——
// 直接复用实现的类型，实现改了形状 spec 就跟着改，那不是「守」是「跟」。
// 下面每个类型只列本 spec 真正读到的字段，字段名与 uploader/types.ts 逐字对齐。

/** 喂给 addFile 的东西。真实签名收的是原生 File，这里造一个只带必要字段的替身。 */
type FakeFile = { name: string; size: number; type: string; __native: boolean };

/** 队列里的一个文件 */
type UploaderFile = {
  id: string;
  name: string;
  size: number;
  percent: number;
  loaded: number;
  status: number;
  token?: string;
  key?: string;
  serverName?: string;
  fileName?: string;
  /** 校验不通过的原因分类 */
  mdUploadErrorType?: number;
};

/** 取凭证时提交的一项：【不传文件本身】，只按 bucket + 扩展名要一份凭证 */
type UploadTokenRequest = { bucket: number; ext: string };
/** 取凭证接口为每个文件返回的一项 */
type UploadTokenInfo = { uptoken?: string; key?: string; url?: string; serverName?: string; fileName?: string };

/** FileUploaded 里带的上传结果 */
type UploadedFileResponse = {
  key?: string;
  fileExt?: string;
  fileName?: string;
  filePath?: string;
  originalFileName?: string;
  serverName?: string;
};

type UploadErrorInfo = { code?: number; status?: number; message?: string; file?: UploaderFile };

type Uploader = {
  /** 【调用方会直接改它】，用例 6 钉的就是「在 BeforeUpload 里写它能生效」这条契约 */
  settings: { multipart_params: Record<string, string>; [key: string]: unknown };
  files: UploaderFile[];
  start(): void;
  addFile(files: FakeFile[]): void;
  removeFile(file: UploaderFile | string): void;
  bind<E extends UploaderEvent>(event: E, handler: (...args: UploaderEventArgs[E]) => void): void;
};

/** 事件名 -> 该事件回调的参数列表。与 uploader/types.ts 的 UploaderEventArgs 对齐。 */
type UploaderEventArgs = {
  FilesAdded: [up: Uploader, files: UploaderFile[], start?: () => void];
  FilesRemoved: [up: Uploader, files: UploaderFile[]];
  BeforeUpload: [up: Uploader, file: UploaderFile];
  UploadProgress: [up: Uploader, file: UploaderFile];
  FileUploaded: [up: Uploader, file: UploaderFile, info: { response: UploadedFileResponse }];
  UploadComplete: [up: Uploader, files: UploaderFile[]];
  /** errTip 是已经本地化好的提示串 */
  Error: [up: Uploader, err: UploadErrorInfo, errTip: string];
};
type UploaderEvent = keyof UploaderEventArgs;

/**
 * createUploader 的入参。【只列本 spec 真正传过的开关】——
 * 不写 `[key: string]: any` 兜底，是为了「用例里传了个拼错的选项名」当场报错，
 * 而不是被索引签名默默吃掉。要加新开关就往这里补一行。
 */
type UploaderOption = {
  getToken?: (files: UploadTokenRequest[]) => Promise<UploadTokenInfo[]>;
  auto_start?: boolean;
  max_file_count?: number;
  max_file_size?: string | number;
  filters?:
    | { title?: string; extensions: string }[]
    | { mime_types?: { title?: string; extensions: string }[]; max_file_size?: string; prevent_duplicates?: boolean };
  x_vars?: unknown;
  error_callback?: (type: number, files: UploaderFile[]) => void;
  init?: { [E in UploaderEvent]?: (...args: UploaderEventArgs[E]) => void };
};

/** 传给下层上传模块的参数（uploader/qiniuV1 的 QiniuUploadParams） */
type QiniuUploadParams = { token: string; key: string | null; url: string; customVars: Record<string, string> };
type QiniuUploadHandlers = {
  onProgress: (loaded: number, total: number, percent: number) => void;
  onComplete: (res: { key?: string }) => void;
  onError: (err: UploadErrorInfo) => void;
};
type QiniuUploadTask = { abort(): void };

/** 被测模块的对外形状（default + FileStatus / UPLOAD_ERROR / UploadError） */
type CreateUploaderModule = {
  default: (option: UploaderOption) => Uploader;
  FileStatus: Record<string, number>;
  UploadError: Record<string, number>;
  UPLOAD_ERROR: Record<string, number>;
};

/** 手工 CommonJS 加载时的模块对象 —— 里面装什么由被编译的代码决定，只能按字典看 */
type ModuleExports = Record<string, unknown>;

/** 记录每次调用上传层（uploader/qiniuV1）的入参、回调句柄，以及有没有被 abort 掉 */
type QiniuCall = { params: QiniuUploadParams; handlers: QiniuUploadHandlers; aborted: boolean };

function loadCreateUploader(qiniuCalls: QiniuCall[]): CreateUploaderModule {
  const moduleLike: { exports: ModuleExports } = { exports: {} };
  const compiled = new Map<string, ModuleExports>();

  function loadLocal(absPath: string): ModuleExports {
    if (compiled.has(absPath)) return compiled.get(absPath)!;
    const mod: { exports: ModuleExports } = { exports: {} };
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
    return function localRequire(request: string): unknown {
      // 被测代码自己的模块：真的编译加载
      if (request.startsWith('./uploader/') || request.startsWith('./')) {
        if (request === './uploader/qiniuV1') {
          // 【替身】不发网络请求，把入参与回调句柄记下来给断言用；
          // abort 也记下来，用例 12 靠它验「removeFile 真的中断了在途任务」。
          return {
            uploadToQiniu(params: QiniuUploadParams, handlers: QiniuUploadHandlers): QiniuUploadTask {
              const call: QiniuCall = { params, handlers, aborted: false };
              qiniuCalls.push(call);
              return {
                abort() {
                  call.aborted = true;
                },
              };
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
  // 手工加载出来的 exports 在类型上只是个字典，这里断言成被测模块的真实形状 ——
  // 断言仅此一处，之后的用例读 mod.UploadError / mod.default 都是有类型的。
  return moduleLike.exports as unknown as CreateUploaderModule;
}

// ── 环境替身 ──────────────────────────────────────────────────────────────
const alerts: Array<[string, number]> = [];
global.md = {
  global: { FileStoreConfig: { uploadHost: 'https://up.example.com/' }, SysSettings: { fileUploadLimitSize: 100 } },
};
global._l = (s: string, ...args: unknown[]) => args.reduce<string>((acc, v, i) => acc.replace(`%${i}`, String(v)), s);
global.alert = (msg: string, type: number) => alerts.push([msg, type]);

/** 造一个假的 File —— 只要 name/size/type 就够，被测代码不读内容 */
function fakeFile(name: string, size = 10): FakeFile {
  return { name, size, type: '', __native: true };
}

/** 默认的取凭证替身：按顺序回一组可用凭证 */
function tokenStub(files: UploadTokenRequest[]): Promise<UploadTokenInfo[]> {
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

/**
 * 录下来的一次事件：事件名 + 该事件【自己那一套】实参。
 * 写成映射类型而不是 [string, any[]]，是为了 findEvent 能按事件名把实参对上号。
 */
type RecordedEvent = { [E in UploaderEvent]: [name: E, args: UploaderEventArgs[E]] }[UploaderEvent];

/** 按事件名取出最早的一次实参。找不到返回 undefined（调用点用 assert.ok 把关）。 */
function findEvent<E extends UploaderEvent>(events: RecordedEvent[], name: E): UploaderEventArgs[E] | undefined {
  const hit = events.find(e => e[0] === name);
  return hit ? (hit[1] as UploaderEventArgs[E]) : undefined;
}

function makeUploader(extra: Partial<UploaderOption> = {}, qiniuCalls: QiniuCall[] = []) {
  const mod = loadCreateUploader(qiniuCalls);
  const createUploader = mod.default;
  const events: RecordedEvent[] = [];
  const uploader = createUploader({
    getToken: tokenStub,
    auto_start: true,
    init: {
      FilesAdded: (...a) => events.push(['FilesAdded', a]),
      BeforeUpload: (...a) => events.push(['BeforeUpload', a]),
      UploadProgress: (...a) => events.push(['UploadProgress', a]),
      FileUploaded: (...a) => events.push(['FileUploaded', a]),
      UploadComplete: (...a) => events.push(['UploadComplete', a]),
      Error: (...a) => events.push(['Error', a]),
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
  const rejected: Array<[number, UploaderFile[]]> = [];
  const { uploader, mod } = makeUploader({
    error_callback: (type, files) => rejected.push([type, files]),
  });
  uploader.addFile([fakeFile('virus.exe'), fakeFile('ok.txt')]);
  assert.strictEqual(rejected.length, 1);
  assert.strictEqual(rejected[0][0], mod.UPLOAD_ERROR.INVALID_FILES);
  assert.strictEqual(rejected[0][1][0].name, 'virus.exe');
  assert.strictEqual(rejected[0][1][0].mdUploadErrorType, mod.UPLOAD_ERROR.INVALID_FILES);
  // 合法的那个仍进队列
  assert.deepStrictEqual(
    uploader.files.map(f => f.name),
    ['ok.txt'],
  );
});

// ── 3. 数量上限 ──────────────────────────────────────────────────────────
test('超过 max_file_count 时整批拒绝，队列不变', async () => {
  const rejected: Array<[number, UploaderFile[]]> = [];
  const { uploader, mod } = makeUploader({
    max_file_count: 2,
    error_callback: (type, files) => rejected.push([type, files]),
  });
  uploader.addFile([fakeFile('a.txt'), fakeFile('b.txt'), fakeFile('c.txt')]);
  assert.strictEqual(rejected[0][0], mod.UPLOAD_ERROR.TOO_MANY_FILES);
  assert.strictEqual(uploader.files.length, 0);
});

// ── 4. 单文件大小上限，错误码要与 plupload 一致 ──────────────────────────
test('超过 max_file_size 发 FILE_SIZE_ERROR（-600，与 plupload 同值）', async () => {
  const { uploader, events, mod } = makeUploader({ max_file_size: '1kb' });
  uploader.addFile([fakeFile('big.txt', 2048)]);
  const err = findEvent(events, 'Error');
  assert.ok(err, '应当发出 Error 事件');
  assert.strictEqual(err![1].code, mod.UploadError.FILE_SIZE_ERROR);
  assert.strictEqual(mod.UploadError.FILE_SIZE_ERROR, -600);
});

// ── 4b. filters.mime_types 后缀白名单（plupload 的同名选项；换实现时漏过一次）─────────
test('不在 filters.mime_types 里的后缀发 FILE_EXTENSION_ERROR（-601），不进队列', async () => {
  const { uploader, events, mod } = makeUploader({
    filters: { mime_types: [{ title: 'image', extensions: 'jpg, png' }, { extensions: 'tar.gz' }] },
  });
  uploader.addFile([fakeFile('a.PNG'), fakeFile('b.pdf'), fakeFile('c.jpg'), fakeFile('d.tar.gz'), fakeFile('epng')]);
  const errs = events.filter(e => e[0] === 'Error');
  assert.deepStrictEqual(
    errs.map(e => [e[1][1].code, e[1][1].file && e[1][1].file.name]),
    [
      [mod.UploadError.FILE_EXTENSION_ERROR, 'b.pdf'],
      [mod.UploadError.FILE_EXTENSION_ERROR, 'epng'],
    ],
  );
  assert.strictEqual(mod.UploadError.FILE_EXTENSION_ERROR, -601);
  // 大小写不敏感；多段后缀按整段比
  assert.deepStrictEqual(
    uploader.files.map(f => f.name),
    ['a.PNG', 'c.jpg', 'd.tar.gz'],
  );
});

test('filters 直接写成数组时当作 mime_types（plupload 的旧写法）', async () => {
  const { uploader, events, mod } = makeUploader({ filters: [{ title: 'File', extensions: 'xlsx,xls' }] });
  uploader.addFile([fakeFile('a.xlsx'), fakeFile('b.csv')]);
  const err = findEvent(events, 'Error');
  assert.ok(err, '应当发出 Error 事件');
  assert.strictEqual(err![1].code, mod.UploadError.FILE_EXTENSION_ERROR);
  assert.deepStrictEqual(
    uploader.files.map(f => f.name),
    ['a.xlsx'],
  );
});

test('filters.prevent_duplicates：和队列里同名同大小的发 FILE_DUPLICATE_ERROR（-602）', async () => {
  const { uploader, events, mod } = makeUploader({ filters: { prevent_duplicates: true } });
  uploader.addFile([fakeFile('a.txt', 10)]);
  uploader.addFile([fakeFile('a.txt', 10), fakeFile('a.txt', 11)]);
  const errs = events.filter(e => e[0] === 'Error');
  assert.strictEqual(errs.length, 1);
  assert.strictEqual(errs[0][1][1].code, mod.UploadError.FILE_DUPLICATE_ERROR);
  assert.strictEqual(mod.UploadError.FILE_DUPLICATE_ERROR, -602);
  assert.strictEqual(uploader.files.length, 2);
});

test('只在 filters 里写 max_file_size 时按它限制大小', async () => {
  const { uploader, events, mod } = makeUploader({ filters: { max_file_size: '1kb' } });
  uploader.addFile([fakeFile('big.txt', 2048)]);
  const err = findEvent(events, 'Error');
  assert.ok(err, '应当发出 Error 事件');
  assert.strictEqual(err![1].code, mod.UploadError.FILE_SIZE_ERROR);
});

test("filters.mime_types 里写了 '*' 就不限后缀", async () => {
  const { uploader, events } = makeUploader({ filters: { mime_types: [{ extensions: '*' }] } });
  uploader.addFile([fakeFile('b.pdf')]);
  assert.strictEqual(events.filter(e => e[0] === 'Error').length, 0);
  assert.strictEqual(uploader.files.length, 1);
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
        BeforeUpload: (up: Uploader) => {
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
  const p = findEvent(events, 'UploadProgress');
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

  const done = findEvent(events, 'FileUploaded');
  assert.ok(done, '应当发出 FileUploaded');
  const res = done![2].response;
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
  assert.ok(!findEvent(events, 'UploadComplete'), '还有一个在传，不该完成');
  calls[1].handlers.onComplete({ key: 'dir/serverfile-1.png' });
  assert.ok(findEvent(events, 'UploadComplete'), '两个都完成后应当发 UploadComplete');
});

// ── 11. 错误码翻译 ──────────────────────────────────────────────────────
test('HTTP 614 翻成同名文件的提示', async () => {
  const calls: QiniuCall[] = [];
  const { uploader, events, mod } = makeUploader({}, calls);
  uploader.addFile([fakeFile('pic.png')]);
  await tick();
  calls[0].handlers.onError({ code: mod.UploadError.HTTP_ERROR, status: 614, message: 'dup' });
  const err = findEvent(events, 'Error');
  assert.ok(err, '应当发出 Error');
  assert.ok(String(err![2]).indexOf('已存在同名文件') > -1, `实际提示: ${err![2]}`);
  assert.strictEqual(uploader.files[0].status, mod.FileStatus.FAILED);
});

// ── 12. removeFile 会中断在途任务 ───────────────────────────────────────
test('removeFile 中断在途上传并发 FilesRemoved', async () => {
  const calls: QiniuCall[] = [];
  const { uploader } = makeUploader({}, calls);
  const removed: UploaderFile[] = [];
  uploader.bind('FilesRemoved', (_up, fs) => removed.push(...fs));
  uploader.addFile([fakeFile('pic.png')]);
  await tick();
  calls[0].handlers.onProgress(1, 10, 10);
  const target = uploader.files[0];
  uploader.removeFile(target);
  assert.strictEqual(uploader.files.length, 0);
  assert.strictEqual(removed.length, 1);
  assert.strictEqual(removed[0].name, 'pic.png');
  // 【补上原先没验的那半】原来这里留了个 `let aborted = false` 和 `void aborted`，
  // 注释写着「替身返回的 abort 是空的，这里换成能观测的」但没真换，
  // 于是用例名里的「中断在途上传」其实一直没被验证。替身现在会记 abort。
  assert.strictEqual(calls[0].aborted, true, 'removeFile 应当中断在途的上传任务');
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
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (failed) {
    console.error(`createUploader spec: ${failed}/${cases.length} 个用例失败`);
    process.exit(1);
  }
  console.log(`createUploader spec: ${cases.length} 个用例全部通过`);
})();
