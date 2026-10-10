const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parser, transformSync, transformFileSync } = require('../../scripts/spec-harness.ts');
const generate = require('@babel/generator').default;
const lodash = require('lodash');
const queryString = require('query-string').default;
interface Args {
  [key: string]: unknown;
}
interface Abortable extends Promise<unknown> {
  abort(): void;
  metadata: Args;
}
interface Helpers {
  postWithToken(
    url: string,
    tokenArgs?: Args,
    body?: Args,
    config?: Args,
    decoder?: (value: unknown) => unknown,
  ): Promise<unknown>;
  getWithToken(url: string, tokenArgs?: Args, body?: Args, decoder?: (value: unknown) => unknown): Promise<unknown>;
  getFilledRequestParams(params: Args, defaults?: Args): Args;
  getToken(files: { bucket: number; ext: string }[], type?: number, args?: Args, options?: Args): Abortable;
  appendDataToLocalPushUniqueId(data?: Args): void;
  resetLocalPushUniqueId(): void;
  getDataFromLocalPushUniqueId(): Args;
  equalToLocalPushUniqueId(value: unknown): boolean;
  getTemporaryAttachmentFromUrl(args: Args): Args;
}
interface Boundary {
  decodeAuthToken(value: unknown): string;
  validateFileTokenRequests(value: unknown): void;
  validateTemporaryAttachment(value: unknown): void;
  decodeFileTokens(value: unknown): unknown;
  requireFileToken(value: unknown): Args;
  requireBase64FileToken(value: unknown): Args;
  requireServerFileToken(value: unknown): Args;
  decodeLocalPushData(value: unknown): Args;
  decodeDownloadBlob(value: unknown): Blob;
  decodeImportPreview(value: unknown): unknown;
  decodeHandledPreview(value: unknown): unknown;
  decodeImportPreviewEntities(value: unknown): unknown;
}
const exportedNames = [
  'postWithToken',
  'getWithToken',
  'getFilledRequestParams',
  'getToken',
  'appendDataToLocalPushUniqueId',
  'resetLocalPushUniqueId',
  'getDataFromLocalPushUniqueId',
  'equalToLocalPushUniqueId',
  'getTemporaryAttachmentFromUrl',
  'generateFileOId',
  'getRequest',
];
const sourceFile = process.env.COMMON_REQUEST_SOURCE || path.join(__dirname, 'common.ts');
const tree = parser.parse(fs.readFileSync(sourceFile, 'utf8'), {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
});
const nodes = tree.program.body.filter(node => {
  const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
  if (!declaration) return false;
  if (declaration.type === 'FunctionDeclaration') return exportedNames.includes(declaration.id?.name);
  return (
    declaration.type === 'VariableDeclaration' &&
    declaration.declarations.some(item => exportedNames.includes(item.id?.name))
  );
});
const source = generate({ type: 'File', program: { type: 'Program', sourceType: 'module', body: nodes } }).code;
const boundaryModule: { exports: unknown } = { exports: {} };
const boundaryCode = transformFileSync(path.join(__dirname, 'commonRequestBoundary.ts'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
new Function('module', 'exports', 'Blob', 'safeParse', boundaryCode)(
  boundaryModule,
  boundaryModule.exports,
  Blob,
  (value: unknown) => {
    try {
      return typeof value === 'string' ? JSON.parse(value) : Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  },
);
const boundary = boundaryModule.exports as Boundary;
const md = { global: { Account: { accountId: 'account' }, Config: { pushUniqueId: 'push-id' } } };
const location = { search: '' };
const tokenCalls: unknown[] = [],
  requestCalls: unknown[] = [],
  uploadCalls: unknown[] = [],
  errors: unknown[] = [];
let tokenResponse: unknown = 'token';
let requestResponse: unknown;
let uploadResponse: unknown;
let aborts = 0;
let latestRequest: Abortable;
let method = '';
const optionsMetadata = { preserve: true };
const requestMetadata = { preserve: { rowid: 5 } };
const window = {
  shareState: { shareId: '' },
  clientId: '',
  mdyAPI(_controller: string, _action: string, data: unknown, options: unknown) {
    requestCalls.push({ data, options });
    return Promise.resolve(requestResponse);
  },
};
const appManagementAjax = {
  getToken(args: unknown) {
    tokenCalls.push(args);
    return Promise.resolve(tokenResponse);
  },
};
function upload(name: string, args: unknown, options: unknown): Abortable {
  method = name;
  uploadCalls.push({ name, args, options });
  latestRequest = Object.assign(Promise.resolve(uploadResponse), {
    abort() {
      aborts++;
    },
    metadata: requestMetadata,
  });
  return latestRequest;
}
const qiniuAjax = {
  getUploadToken: (args: unknown, options: unknown) => upload('authenticated', args, options),
  getFileUploadToken: (args: unknown, options: unknown) => upload('public', args, options),
};
const moduleLike: { exports: Partial<Helpers> } = { exports: {} };
const code = transformSync(source, {
  filename: sourceFile,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
new Function(
  'module',
  'exports',
  'appManagementAjax',
  'qiniuAjax',
  'window',
  'md',
  'sessionStorage',
  'location',
  'qs',
  '_',
  'console',
  'decodeAuthToken',
  'decodeFileTokens',
  'decodeLocalPushData',
  'validateFileTokenRequests',
  'validateTemporaryAttachment',
  code,
)(
  moduleLike,
  moduleLike.exports,
  appManagementAjax,
  qiniuAjax,
  window,
  md,
  {
    getItem: (key: string) => {
      assert.equal(key, 'clientId');
      return 'stored-client';
    },
  },
  location,
  queryString,
  lodash,
  { error: (value: unknown) => errors.push(value) },
  boundary.decodeAuthToken,
  boundary.decodeFileTokens,
  boundary.decodeLocalPushData,
  boundary.validateFileTokenRequests,
  boundary.validateTemporaryAttachment,
);
const helpers = moduleLike.exports as Helpers;
async function run(): Promise<void> {
  const metadata = { nested: [true, { rowid: 5 }] };
  const body = {
    worksheetId: 'sheet',
    token: 'caller-token',
    accountId: 'caller-account',
    clientId: 'caller-client',
    metadata,
  };
  requestResponse = { rows: [{ cells: ['value', { unknown: true }] }], arbitrary: metadata };
  const post = await helpers.postWithToken('/export?raw=a%20b', { worksheetId: 'sheet', tokenType: 8 }, body, {
    responseType: 'blob',
  });
  assert.equal(post, requestResponse);
  assert.equal((requestCalls[0] as { data: Args }).data['metadata'], metadata);
  assert.deepEqual(requestCalls[0], {
    data: { ...body, token: 'token', accountId: 'account', clientId: 'stored-client' },
    options: { customParseResponse: true, ajaxOptions: { url: '/export?raw=a%20b', responseType: 'blob' } },
  });
  assert.deepEqual(body, {
    worksheetId: 'sheet',
    token: 'caller-token',
    accountId: 'caller-account',
    clientId: 'caller-client',
    metadata,
  });
  window.clientId = 'current-client';
  const fetched = await helpers.getWithToken('/preview?x=1', { tokenType: 7 }, body, boundary.decodeImportPreview);
  assert.equal(fetched, requestResponse);
  assert.deepEqual(requestCalls[1], {
    data: { ...body, token: 'token', accountId: 'account', clientId: 'current-client' },
    options: { ajaxOptions: { type: 'GET', url: '/preview?x=1' } },
  });
  window.shareState.shareId = 'share';
  const beforeTokenCalls = tokenCalls.length;
  await helpers.getWithToken('/shared', {}, {});
  assert.equal(tokenCalls.length, beforeTokenCalls);
  assert.equal((requestCalls.at(-1) as { data: Args }).data['token'], undefined);
  window.shareState.shareId = '';
  tokenResponse = '';
  await assert.rejects(helpers.getWithToken('/token-fail'), value => value === '获取token失败');
  tokenResponse = { token: 'not-string' };
  await assert.rejects(helpers.postWithToken('/token-malformed'), /Invalid request token/);
  tokenResponse = 'token';
  requestResponse = new Blob(['export'], { type: 'text/plain' });
  assert.equal(
    await helpers.postWithToken('/blob', {}, {}, { responseType: 'blob' }, boundary.decodeDownloadBlob),
    requestResponse,
  );
  requestResponse = { name: 'fake blob' };
  await assert.rejects(
    helpers.postWithToken('/blob', {}, {}, { responseType: 'blob' }, boundary.decodeDownloadBlob),
    /Invalid download blob/,
  );
  requestResponse = { rows: [{ cells: 4 }] };
  await assert.rejects(
    helpers.getWithToken('/preview', {}, {}, boundary.decodeImportPreview),
    /Invalid import preview/,
  );
  const unchanged = { filters: metadata, requestParams: { existing: metadata } };
  location.search = '';
  assert.equal(
    helpers.getFilledRequestParams(unchanged, { default: 1 }),
    unchanged,
    'No query keeps the original request object identity',
  );
  location.search = '?keep=first&keep=last&%20trimmed%20=value&flag&empty=&nullable&arr=x&arr=y';
  const filled = helpers.getFilledRequestParams(unchanged, { keep: 'default', other: metadata });
  assert.deepEqual(filled['requestParams'], {
    keep: 'last',
    other: metadata,
    existing: metadata,
    trimmed: 'value',
    empty: '',
    arr: 'y',
  });
  assert.equal((filled['requestParams'] as Args)['existing'], metadata);
  assert.equal(filled['filters'], metadata);
  assert.deepEqual(unchanged['requestParams'], { existing: metadata });
  location.search = '?n=one&n';
  assert.equal(
    (helpers.getFilledRequestParams({})['requestParams'] as Args)['n'],
    null,
    'Repeated query keys keep their actual last null value',
  );
  const extra = { deep: metadata };
  md.global.Config.pushUniqueId = 'push-id';
  helpers.appendDataToLocalPushUniqueId({ enableTip: true, tipText: 'A', extra });
  helpers.appendDataToLocalPushUniqueId({ triggerBtnId: 'button', tipText: 'B' });
  assert.equal(
    md.global.Config.pushUniqueId,
    'push-id__' + JSON.stringify({ enableTip: true, tipText: 'B', extra, triggerBtnId: 'button' }),
  );
  assert.deepEqual(helpers.getDataFromLocalPushUniqueId(), {
    enableTip: true,
    tipText: 'B',
    extra,
    triggerBtnId: 'button',
  });
  assert.equal(helpers.equalToLocalPushUniqueId('push-id__{"other":1}'), true);
  assert.equal(helpers.equalToLocalPushUniqueId('different'), false);
  helpers.resetLocalPushUniqueId();
  assert.equal(md.global.Config.pushUniqueId, 'push-id');
  assert.deepEqual(helpers.getDataFromLocalPushUniqueId(), {});
  md.global.Config.pushUniqueId = 'push-id__{"enableTip":"bad"}';
  assert.throws(() => helpers.getDataFromLocalPushUniqueId(), /Invalid local push metadata/);
  const beforeBadPush = md.global.Config.pushUniqueId;
  helpers.appendDataToLocalPushUniqueId({ tipText: 'new' });
  assert.equal(md.global.Config.pushUniqueId, beforeBadPush);
  assert.ok(errors.length);
  helpers.resetLocalPushUniqueId();
  assert.equal(md.global.Config.pushUniqueId, 'push-id');
  const pushMetadata = { enableTip: false, tipText: 'Text', extra };
  assert.equal(boundary.decodeLocalPushData(pushMetadata), pushMetadata);
  const tokens = [
    {
      uptoken: 'upload-token',
      key: 'bucket/a.png',
      serverName: 'https://files.example/',
      fileName: 'a.png',
      url: 'https://files.example/bucket/a.png?token=read',
      size: 10,
      metadata,
    },
  ];
  uploadResponse = tokens;
  const files = [{ bucket: 4, ext: '.png' }],
    options = { silent: true, metadata: optionsMetadata };
  const uploadRequest = helpers.getToken(files, 10, { worksheetId: 'sheet', extra }, options);
  assert.equal(method, 'authenticated');
  assert.equal(uploadRequest.metadata, requestMetadata);
  uploadRequest.abort();
  assert.equal(aborts, 1);
  assert.equal(await uploadRequest, tokens);
  assert.equal(boundary.requireFileToken(tokens), tokens[0]);
  const base64Token = { key: 'a.png', uptoken: 'token', metadata };
  assert.equal(boundary.requireBase64FileToken([base64Token]), base64Token);
  assert.throws(() => boundary.requireFileToken([base64Token]), /Missing upload token fields/);
  const serverToken = { serverName: 'https://files.example/', metadata };
  assert.equal(boundary.requireServerFileToken([serverToken]), serverToken);
  assert.throws(() => boundary.requireBase64FileToken([serverToken]), /Missing upload token fields/);
  assert.equal((uploadCalls.at(-1) as { options: unknown }).options, options);
  assert.deepEqual((uploadCalls.at(-1) as { args: Args }).args, { files, type: 10, worksheetId: 'sheet', extra });
  md.global.Account.accountId = '';
  await helpers.getToken(files);
  assert.equal(method, 'public');
  md.global.Account.accountId = 'account';
  const failure = { error: 'Denied', metadata };
  uploadResponse = failure;
  assert.equal(await helpers.getToken(files), failure);
  assert.throws(() => boundary.requireFileToken(failure), /Denied/);
  for (const bad of [[{ uptoken: 3 }], [{ size: Infinity }], null, {}, [{ key: 'missing fields' }]]) {
    if (Array.isArray(bad) && bad[0]?.key)
      assert.throws(() => boundary.requireFileToken(bad), /Missing upload token fields/);
    else {
      uploadResponse = bad;
      await assert.rejects(helpers.getToken(files), /Invalid upload token response/);
    }
  }
  assert.throws(
    () => helpers.getToken([{ bucket: 4, ext: 3 }] as unknown as { bucket: number; ext: string }[]),
    /Invalid upload token files/,
  );
  const attachment = helpers.getTemporaryAttachmentFromUrl({
    fileUrl: 'https://files.example/dir/a%20b.pdf?token=read#section',
    fileName: 'Original.name.pdf',
    fileSize: 25,
  });
  assert.match(String(attachment['fileID']), /^o_[a-z0-9]+$/);
  assert.deepEqual(
    { ...attachment, fileID: '<id>' },
    {
      fileID: '<id>',
      fileSize: 25,
      serverName: 'https://files.example/',
      filePath: 'dir/',
      fileName: 'a%20b',
      fileExt: '.pdf',
      originalFileName: 'Original.name',
      key: 'dir/a%20b.pdf',
      oldOriginalFileName: 'Original.name',
      url: 'https://files.example/dir/a%20b.pdf?token=read#section',
    },
  );
  const rootAttachment = helpers.getTemporaryAttachmentFromUrl({
    fileUrl: 'https://files.example/a',
    fileName: '',
    fileSize: 0,
    fileExt: '.custom',
  });
  assert.equal(rootAttachment['filePath'], '/');
  assert.equal(rootAttachment['fileExt'], '.custom');
  assert.equal(rootAttachment['originalFileName'], '');
  assert.throws(() => helpers.getTemporaryAttachmentFromUrl({ fileUrl: 'not-a-url' }));
  assert.throws(
    () => helpers.getTemporaryAttachmentFromUrl({ fileUrl: 'https://files.example/a', fileSize: Infinity }),
    /Invalid temporary attachment parameters/,
  );
  const handled = [{ rowIndex: 2, cells: [{ controlId: 'control', value: { rowid: 5 }, metadata }], extra }];
  assert.equal(boundary.decodeHandledPreview(handled), handled);
  assert.throws(
    () => boundary.decodeHandledPreview([{ rowIndex: 1, cells: [{ controlId: 3 }] }]),
    /Invalid handled import preview/,
  );
  assert.deepEqual(
    boundary.decodeImportPreviewEntities('[{"id":"u","name":"User","avatarUrl":"avatar","extra":{"rowid":5}}]'),
    [{ id: 'u', name: 'User', avatarUrl: 'avatar', extra: { rowid: 5 } }],
  );
  assert.throws(() => boundary.decodeImportPreviewEntities('[{"id":5}]'), /Invalid import preview entities/);
  assert.throws(() => boundary.decodeImportPreviewEntities('bad-json'), SyntaxError);
  console.log(
    'Actual common token HTTP/query/local-push/upload-token/attachment protocols, unknown decoders, abort and metadata identity passed',
  );
}
run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
