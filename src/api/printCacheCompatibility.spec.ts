/** Real five print writers and cache reader; only transport/window/UI hosts are controlled. */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const t: typeof import('@babel/types') = require('@babel/types');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const { ROOT, transformSync } = require('../../scripts/spec-harness.ts');
const { v4: uuidv4 } = require('uuid');
const old = process.env['HAP_PRINT_CACHE_BEFORE'] === '1';
const base = 'f3e6cb41850c63f441ab65631f873fea980ef82e';
const recordFile = 'src/pages/worksheet/common/recordInfo/RecordForm/PrintList.tsx';
const batchFile = 'src/pages/worksheet/common/BatchOperate/PrintList.tsx';
const flowFile = 'src/pages/workflow/components/ExecDialog/components/PrintList/index.tsx';
const mobileFile = 'src/pages/Mobile/components/RecordInfo/MobilePrintList/index.tsx';
function source(file: string): string {
  return old || (process.env['HAP_PRINT_CACHE_READER_BEFORE'] === '1' && file === 'src/pages/Print/index.tsx')
    ? cp.execFileSync('git', ['show', `${base}:${file}`], { cwd: ROOT, encoding: 'utf8' })
    : fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function nodes(file: string): { text: string; all: import('@babel/types').Node[] } {
  const text = source(file);
  const ast = parser.parse(text, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const all: import('@babel/types').Node[] = [];
  t.traverseFast(ast, node => { all.push(node); });
  return { text, all };
}
function expression(file: string, name: string): string {
  const { text, all } = nodes(file);
  const declaration = all.find(
    node =>
      (t.isFunctionDeclaration(node) && node.id?.name === name) ||
      (t.isVariableDeclarator(node) && t.isIdentifier(node.id, { name })),
  );
  assert.ok(declaration, `${file}:${name}`);
  const node = t.isVariableDeclarator(declaration) ? declaration.init : declaration;
  assert.ok(node && node.start != null && node.end != null);
  return text.slice(node.start, node.end);
}
function factory(code: string, scope: object) {
  const compiled = transformSync(`const target = (${code});`, { filename: 'print-cache-fragment.tsx' }).code;
  return new Function(...Object.keys(scope), compiled + ';return target;')(...Object.values(scope));
}
async function main() {
  const writes: { key: string; value: string; moduleType: number }[] = [];
  const reads: { key: string; moduleType?: number }[] = [];
  const opened: string[] = [];
  let rejectWrite = false;
  const payload = { worksheetId: '0123456789abcdef01234567', rowIds: ['r1'] };
  const transport = (controller: string, action: string, args: { key: string; value: string; moduleType: number }) => {
    assert.equal(controller, 'WebCache');
    // This policy comes from the actual production WebCacheAccessPolicy assembly.
    assert.match(args.key, /^[A-Za-z0-9_-]{16,256}$/, 'production handoff key contract');
    assert.equal(args.moduleType, 1, 'print cache namespace is required on both sides');
    if (action === 'Add') {
      if (rejectWrite) return Promise.reject(new Error('controlled cache failure'));
      writes.push(args);
      return Promise.resolve(true);
    }
    assert.equal(action, 'Get');
    reads.push(args);
    return Promise.resolve({ data: JSON.stringify(payload) });
  };
  const api: { exports: { default?: { add(args: unknown): Promise<unknown>; get(args: unknown): Promise<unknown> } } } =
    { exports: {} };
  const apiCode = transformSync(fs.readFileSync(path.join(ROOT, 'src/api/webCache.ts'), 'utf8'), {
    filename: 'webCache.ts',
  }).code;
  new Function('module', 'exports', 'mdyAPI', apiCode)(api, api.exports, transport);
  const win = { open: (url: string) => opened.push(url), location: { href: '' } };
  const scope = {
    uuidv4,
    webCacheAjax: api.exports.default,
    window: win,
    _: require('lodash'),
    md: { global: { Account: { fullname: 'Test' } } },
    pathCompletion: (url: string) => url,
    browserIsMobile: () => false,
    precheckTemplatePrint: async () => true,
    getFeatureStatus: () => '1',
    VersionProductType: { wordPrintTemplate: 1 },
    PRINT_TYPE: { CLOUD_PRINT: 7 },
    buriedUpgradeVersionDialog: () => assert.fail('unexpected upgrade'),
  };
  const system = factory(expression(recordFile, 'handleSystemPrintRecord'), scope);
  const template = factory(expression(recordFile, 'handleTemplateRecordPrint'), scope);
  const flow = factory(expression(flowFile, 'templatePrint'), scope);
  const mobile = factory(expression(mobileFile, 'createPrintKey'), scope);
  const args = {
    worksheetId: payload.worksheetId,
    viewId: 'view',
    appId: 'app',
    projectId: 'project',
    recordId: 'r1',
    rowIds: payload.rowIds,
  };
  await system(args);
  await template({ ...args, template: { id: 'template', type: 2, name: 'Word' } });
  await flow(
    { ...args, data: { app: { id: 'app' } }, rowId: 'r1', onClose: () => {} },
    { id: 'template', describe: '2', name: 'Word', entityName: '1' },
  );
  const mobileKey = await mobile(payload);
  assert.equal(mobileKey, writes[3]!.key);
  assert.deepEqual(JSON.parse(writes[3]!.value), payload);
  const batch = nodes(batchFile);
  const handler = batch.all.find(
    node =>
      t.isJSXAttribute(node) &&
      t.isJSXIdentifier(node.name, { name: 'onClick' }) &&
      node.start != null &&
      node.end != null &&
      batch.text.slice(node.start, node.end).includes('webCacheAjax.add'),
  );
  assert.ok(handler && t.isJSXAttribute(handler) && t.isJSXExpressionContainer(handler.value));
  const click = handler.value.expression;
  assert.ok(click.start != null && click.end != null);
  const batchClick = factory(batch.text.slice(click.start, click.end), {
    ...scope,
    ...args,
    rowIds: payload.rowIds,
    selectedRows: [{ rowid: 'r1' }],
    selectedLength: 1,
    MAX_SYSTEM_PRINT_COUNT: 50,
    allowLoadMore: false,
    count: 1,
    template: { id: 'template', type: 2, name: 'Word' },
    featureType: '1',
    precheckPrint: async () => ({ successRows: [{ rowId: 'r1' }], failedRows: [] }),
    setMenuVisible: () => {},
    setPrecheckError: () => {},
  });
  await batchClick();
  assert.equal(writes.length, 5, 'all five producers reached the actual API adapter');
  assert.equal(new Set(writes.map(item => item.key)).size, 5);
  assert.equal(opened.length, 4);
  for (const [index, url] of opened.entries()) {
    const request = writes[index < 3 ? index : 4]!;
    assert.equal(url.split('/').at(-1), request.key, 'writer key reaches print URL unchanged');
    assert.deepEqual(JSON.parse(request.value).rowIds, payload.rowIds);
  }
  const readerSource = nodes('src/pages/Print/index.tsx');
  const property = readerSource.all.find(
    node => t.isClassProperty(node) && t.isIdentifier(node.key, { name: 'getParamFn' }),
  );
  assert.ok(
    property &&
      t.isClassProperty(property) &&
      property.value &&
      property.value.start != null &&
      property.value.end != null,
  );
  let done = false;
  const context = {
    state: { params: { key: mobileKey }, printData: {} },
    setState(patch, callback) {
      Object.assign(this.state, patch);
      callback();
    },
    getWorksheet() {
      done = true;
    },
  };
  // Bind the actual class-field arrow to its instance before executing it.
  const readerCode = transformSync(
    `return (function(){return ${readerSource.text.slice(property.value.start, property.value.end)};}).call(context);`,
    { filename: 'reader.ts', parserOpts: { allowReturnOutsideFunction: true } },
  ).code;
  const reader = new Function(
    'context',
    'webCacheAjax',
    'location',
    'safeParse',
    'browserIsMobile',
    'typeForCon',
    readerCode,
  )(
    context,
    api.exports.default,
    { href: '/printForm/app/worksheet/preview/print/' + mobileKey },
    JSON.parse,
    () => false,
    { PREVIEW: 'preview' },
  );
  reader();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads.length, 1);
  assert.equal(reads[0]!.key, mobileKey);
  assert.equal(done, true, 'successful cache read advances to worksheet loading');
  assert.equal(context.state.params['worksheetId'], payload.worksheetId);
  const beforeFailure = opened.length;
  rejectWrite = true;
  await system(args);
  assert.equal(opened.length, beforeFailure, 'failed cache write never opens an unusable print page');
  console.log('print cache compatibility passed: five real writers, route keys, typed namespace reader, cache failure');
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
