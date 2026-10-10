const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parser, transformSync, transformFileSync } = require('../../scripts/spec-harness.ts');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const lodash = require('lodash');
const ROOT = path.resolve(__dirname, '../..');
type Consumer = (...args: unknown[]) => unknown;
interface Boundary {
  decodeFileTokens(value: unknown): unknown;
  requireFileToken(value: unknown): unknown;
  requireBase64FileToken(value: unknown): unknown;
  requireServerFileToken(value: unknown): unknown;
  decodeImportPreview(value: unknown): unknown;
}
const moduleLike: { exports: unknown } = { exports: {} };
const boundaryCode = transformFileSync(path.join(__dirname, 'commonRequestBoundary.ts'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
new Function('module', 'exports', boundaryCode)(moduleLike, moduleLike.exports);
const boundary = moduleLike.exports as Boundary;

// Run the verbatim production callback/method AST, with only external APIs replaced.
// Selecting a closure keeps unrelated React rendering and private dependency debt out of this Node test.
function loadClosure(file: string, name: string, dependencies: Record<string, unknown>, receiver?: unknown): Consumer {
  const tree = parser.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  let expression: string | undefined;
  traverse(tree, {
    VariableDeclarator(entry) {
      if (entry.node.id.name === name) expression = generate(entry.node.init).code;
    },
    ClassProperty(entry) {
      if (entry.node.key.name === name) expression = generate(entry.node.value).code;
    },
    ClassMethod(entry) {
      if (entry.node.key.name === name) {
        expression = `(class Subject { ${generate(entry.node).code} }).prototype.${name}`;
      }
    },
    JSXAttribute(entry) {
      const source = generate(entry.node).code;
      if (
        (name === 'fileUploaded' && entry.node.name.name === name) ||
        (name === 'changeSheet' && source.includes('setTableLoading(true)')) ||
        (name === 'importRows' && source.includes('setIsConverting(true)'))
      )
        expression = generate(entry.node.value.expression).code;
    },
    CallExpression(entry) {
      if (name === 'privatePdf' && entry.node.callee.property?.name === 'catch') {
        const source = generate(entry.node).code;
        if (source.includes('requireServerFileToken')) expression = `() => ${source}`;
      }
    },
  });
  assert.ok(expression, `${file}: missing ${name}`);
  const code = transformSync(`const closure = ${expression};`, { filename: 'consumer.ts', sourceType: 'script' }).code;
  const closure = new Function(...Object.keys(dependencies), `${code}\nreturn closure;`).apply(
    receiver,
    Object.values(dependencies),
  ) as Consumer;
  return receiver ? closure.bind(receiver) : closure;
}

const alerts: unknown[] = [],
  uploads: unknown[] = [],
  callbacks: unknown[] = [],
  changes: unknown[] = [];
const loading: boolean[] = [],
  tableLoading: boolean[] = [],
  converting: boolean[] = [];
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);
process.on('unhandledRejection', onUnhandled);
let tokenResponse: unknown = [{ key: 'upload/key.png', uptoken: 'token', url: 'https://files/key.png?token=read' }];
let tokenFailure: unknown;
let uploadFailure: unknown;
let previewResponse: unknown;
let convertFailure: unknown;
let fileRequests = 0;
const dependencies: Record<string, unknown> = {
  ...boundary,
  md: {
    global: {
      FileStoreConfig: { uploadHost: 'https://upload', pubHost: 'https://public', pictureHost: 'https://pictures' },
      Config: { WorksheetDownUrl: 'https://preview' },
    },
  },
  window: { isPublicWorksheet: true },
  _: lodash,
  get: lodash.get,
  console: { log() {}, error() {} },
  _l: (text: string) => text,
  alert: (...args: unknown[]) => alerts.push(args),
  getToken: () =>
    tokenFailure ? Promise.reject(tokenFailure) : Promise.resolve(tokenResponse).then(boundary.decodeFileTokens),
  axios: {
    post: (...args: unknown[]) => {
      uploads.push(args);
      return uploadFailure ? Promise.reject(uploadFailure) : Promise.resolve({ data: { key: 'uploaded.png' } });
    },
  },
  accountSettingAjax: { editSign: () => Promise.resolve(true) },
  accountAjax: { editAccountAvatar: () => Promise.resolve() },
  btoa: (text: string) => Buffer.from(text).toString('base64'),
  stripFileUrlSignature: (url: string) => url.replace(/\?.+/, ''),
  ensurePngSignatureUrl: (url: string) => Promise.resolve(url),
  signaturePadRef: { current: { toDataURL: () => 'data:image/png;base64,png' } },
  signaturePad: { current: { isEmpty: () => false } },
  signatureDataUrlRef: { current: '' },
  cacheCurrentSignature: () => 'data:image/png;base64,png',
  lastInfo: '',
  projectId: 'project',
  appId: 'app',
  worksheetId: 'sheet',
  controlId: 'control',
  bucket: 4,
  tokenArgs: {},
  setPopupVisible: (...args: unknown[]) => changes.push(args),
  resetSignaturePopupState: () => changes.push('reset'),
  onChange: (...args: unknown[]) => callbacks.push(args),
  props: { onChange: (...args: unknown[]) => callbacks.push(args) },
  RegExpValidator: { getExtOfFileName: () => 'png', fileIsPicture: () => true },
  FormData: class {
    append() {}
  },
  XMLHttpRequest: class {
    open() {
      uploads.push('xhr');
    }
    setRequestHeader() {}
    send() {}
  },
  vditorInstance: { current: { insertValue: (...args: unknown[]) => callbacks.push(args) } },
  bulletinBoards: [],
  getAdvancedThemeBulletinPicExt: () => 'png',
  urlToBase64: () => Promise.resolve('data:image/png;base64,png'),
  getUrlWithRandomQuery: (url: string) => url,
  getImageBase64UploadData: (value: string) => value,
  updatePlatformSetting: (...args: unknown[]) => callbacks.push(args),
  moment: () => ({ format: () => '2026-10-10' }),
  path: 'https://files/a.pdf',
  fileAjax: {
    getChatFileUrl: () => {
      fileRequests++;
      return Promise.resolve('private');
    },
  },
  attachment: { sourceNode: {} },
  attachmentPromise: {},
  getWithToken: () => Promise.resolve(previewResponse).then(boundary.decodeImportPreview),
  excelUrl: 'https://file.xlsx?token=read',
  onParseExcel: (...args: unknown[]) => callbacks.push(args),
  setLoading: (value: boolean) => loading.push(value),
  setTableLoading: (value: boolean) => tableLoading.push(value),
  setIsConverting: (value: boolean) => converting.push(value),
  setCellsData: (...args: unknown[]) => changes.push(args),
  setSheetIndex: (...args: unknown[]) => changes.push(args),
  mapConfig: {},
  controls: [],
  needImportCellData: [],
  convert: () => (convertFailure ? Promise.reject(convertFailure) : Promise.resolve(['converted'])),
  onClose: (...args: unknown[]) => callbacks.push(args),
};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const reset = () => {
  alerts.length = uploads.length = callbacks.length = changes.length = 0;
  tokenFailure = uploadFailure = undefined;
};

(async () => {
  const signature = {
    state: { signature: '', key: '' },
    isComplete: true,
    signaturePad: { toDataURL: () => 'data:image/png;base64,png' },
  };
  const save = loadClosure('src/ming-ui/components/Signature.tsx', 'saveSignature', dependencies, signature);
  const callback = (...args: unknown[]) => callbacks.push(args);
  for (const failure of ['network', 'malformed', 'missing', 'upload']) {
    reset();
    tokenResponse = [{ key: 'key', uptoken: 'token', url: 'https://files/a.png' }];
    if (failure === 'network') tokenFailure = new Error('Token unavailable');
    if (failure === 'malformed') tokenResponse = [{ key: 5 }];
    if (failure === 'missing') tokenResponse = [{ key: 'only-key' }];
    if (failure === 'upload') uploadFailure = new Error('Upload failed');
    save(callback);
    assert.equal(signature.isComplete, false);
    await tick();
    assert.equal(signature.isComplete, true);
    assert.equal(callbacks.length, 0);
    assert.equal(uploads.length, failure === 'upload' ? 1 : 0);
    assert.equal(alerts.length, 1);
  }
  reset();
  tokenResponse = [{ key: 'key', uptoken: 'token', url: 'https://files/a.png' }];
  save(callback);
  await tick();
  assert.equal(signature.isComplete, true);
  assert.deepEqual(callbacks, [[{ bucket: 4, key: 'uploaded.png', url: 'https://files/a.png' }]]);

  // Every directly changed background token consumer catches both transport rejection
  // and a successful response that lacks the fields it actually reads.
  const background: [string, string, unknown, unknown[]][] = [
    ['src/components/Form/DesktopForm/widgets/Signature/index.tsx', 'saveSignature', undefined, [undefined]],
    ['src/components/Form/MobileForm/widgets/Signature/index.tsx', 'saveSignature', undefined, [undefined]],
    [
      'src/pages/Personal/personalInfo/modules/AvatorInfo.tsx',
      'onSave',
      { state: { preview: 'data:image/png;base64,png' }, props: {} },
      [],
    ],
    [
      'src/pages/task/containers/taskGantt/component/ganttDialog/index.tsx',
      'putb64',
      { state: { name: 'Gantt' }, setState: (...args: unknown[]) => changes.push(args) },
      ['data:image/png;base64,png'],
    ],
    [
      'src/pages/AppHomepage/Dashboard/index.tsx',
      'onSetAdvancedTheme',
      undefined,
      [{ themeKey: 'new', bulletinPic: 'https://image' }],
    ],
    ['src/pages/kc/common/AttachmentsPreview/actions/action.ts', 'privatePdf', undefined, []],
  ];
  for (const [file, name, receiver, args] of background) {
    const fn = loadClosure(file, name, dependencies, receiver);
    for (const failure of ['network', 'missing']) {
      reset();
      tokenFailure = failure === 'network' ? new Error('Token unavailable') : undefined;
      tokenResponse = [{}];
      fn(...args);
      await tick();
      assert.equal(uploads.length, 0, `${name}: no upload after ${failure}`);
      assert.equal(callbacks.length, 0, `${name}: no successful callback`);
      assert.equal(changes.length, 0, `${name}: retain current UI/data`);
      if (name !== 'privatePdf') assert.equal(alerts.length, 1, `${name}: failure alert`);
    }
  }
  assert.equal(fileRequests, 0);

  for (const [file, name, args] of [
    ['src/ming-ui/components/Markdown.tsx', 'handleImageUpload', { name: 'a.png' }],
    ['src/ming-ui/components/MdMarkdown/index.tsx', 'customUpload', [{ name: 'a.png' }]],
  ] as const) {
    const fn = loadClosure(file, name, dependencies);
    for (const value of [undefined, [{}]]) {
      reset();
      tokenFailure = value === undefined ? new Error('Token unavailable') : undefined;
      tokenResponse = value;
      await assert.rejects(fn(args), /Token unavailable|Missing upload token fields/);
      assert.equal(uploads.length, 0);
      assert.equal(callbacks.length, 0);
    }
  }
  const rich = {
    options: {},
    tokenArgs: {},
    url: 'old',
    loader: { file: Promise.resolve({ name: 'a.png' }) },
    xhr: { send: (...args: unknown[]) => uploads.push(args), addEventListener() {} },
  };
  const send = loadClosure('src/ming-ui/components/RichText.tsx', '_sendRequest', dependencies, rich);
  for (const value of [undefined, [{}]]) {
    reset();
    tokenFailure = value === undefined ? new Error('Token unavailable') : undefined;
    tokenResponse = value;
    await assert.rejects(
      new Promise((resolve, reject) => send(resolve, reject)),
      /Token unavailable|Missing upload token fields/,
    );
    assert.equal(uploads.length, 0);
  }

  const uploaded = loadClosure(
    'src/pages/worksheet/components/ImportFileToChildTable/ImportData.tsx',
    'fileUploaded',
    dependencies,
  );
  const changeSheet = loadClosure(
    'src/pages/worksheet/components/ImportFileToChildTable/PreviewData.tsx',
    'changeSheet',
    dependencies,
  );
  const importRows = loadClosure(
    'src/pages/worksheet/components/ImportFileToChildTable/PreviewData.tsx',
    'importRows',
    dependencies,
  );
  reset();
  previewResponse = { rows: [{ cells: 'malformed' }] };
  await uploaded({ serverName: 'https://files/', key: 'a.xlsx' });
  assert.deepEqual(loading, [false]);
  assert.equal(callbacks.length, 0);
  assert.equal(alerts.length, 1);
  reset();
  await changeSheet(2);
  assert.deepEqual(tableLoading, [true, false]);
  assert.equal(changes.length, 0);
  assert.equal(alerts.length, 1);
  reset();
  convertFailure = new Error('Invalid converted response');
  await importRows();
  assert.deepEqual(converting, [true, false]);
  assert.equal(callbacks.length, 0);
  assert.equal(alerts.length, 1);
  reset();
  previewResponse = { rows: [{ cells: ['valid'] }], metadata: { keep: true } };
  await uploaded({ serverName: 'https://files/', key: 'a.xlsx' });
  assert.equal((callbacks[0] as unknown[])[0], previewResponse);
  reset();
  await changeSheet(3);
  assert.deepEqual(changes, [[[['valid']]], [3]]);
  reset();
  convertFailure = undefined;
  await importRows();
  assert.deepEqual(callbacks, [[['converted']]]);
  await tick();
  assert.deepEqual(unhandled, []);
  process.removeListener('unhandledRejection', onUnhandled);
  console.log(
    'Actual token consumer failure/retry, required-field subsets, editor rejection, import spinner/data preservation passed',
  );
})().catch(error => {
  process.removeListener('unhandledRejection', onUnhandled);
  console.error(error);
  process.exitCode = 1;
});
