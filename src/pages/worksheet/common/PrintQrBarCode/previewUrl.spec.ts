const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { transformSync } = require('../../../../../scripts/spec-harness.ts');
const source = fs.readFileSync(path.join(__dirname, 'PrintQrBarCode.tsx'), 'utf8');
const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
let closure: string | undefined;
traverse(tree, {
  FunctionDeclaration(nodePath) {
    if (nodePath.node.id.name === 'updatePreviewRowShareUrl') {
      closure = source.slice(nodePath.node.start, nodePath.node.end);
    }
  },
});
assert.ok(closure, 'Exercise the actual preview URL request closure');
const values: string[] = [];
const requests: unknown[] = [];
let response: () => Promise<unknown> = () => Promise.resolve({ record: 'https://example.test/public/record' });
const api = {
  getRowsShortUrl(args: unknown): Promise<unknown> {
    requests.push(args);
    return response();
  },
};
const { objectValue } = require('../../../../utils/recordValueBoundary.ts');
function create(viewId: string | undefined): (recordId: string) => void {
  const product = transformSync(closure + '\nreturn updatePreviewRowShareUrl;', {
    filename: path.join(__dirname, 'PrintQrBarCode.tsx'),
    parserOpts: { allowReturnOutsideFunction: true },
  }).code;
  return new Function(
    'worksheetAjax',
    'viewId',
    'appId',
    'worksheetId',
    'objectValue',
    'setPreviewRowPublicUrl',
    product,
  )(api, viewId, 'app', 'worksheet', objectValue, (value: string) => values.push(value));
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function run() {
  const load = create('view');
  load('record');
  await flush();
  assert.equal(values.at(-1), 'https://example.test/public/record');
  assert.deepEqual(requests.at(-1), { appId: 'app', viewId: 'view', worksheetId: 'worksheet', rowIds: ['record'] });
  for (const malformed of [null, {}, { record: {} }, { record: 42 }]) {
    response = () => Promise.resolve(malformed);
    load('record');
    await flush();
    assert.equal(values.at(-1), 'error', 'Bad URL payloads never become QR code contents');
  }
  response = () => Promise.reject(new Error('Request failed'));
  load('record');
  await flush();
  assert.equal(values.at(-1), 'error', 'Rejected requests finish the preview failure path');
  const count = requests.length;
  create(undefined)('record');
  assert.equal(requests.length, count);
  assert.equal(values.at(-1), 'error');
  console.log('Real QR preview URL requests preserve valid links and handle missing, malformed and failed replies');
}
run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
