const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;
const _ = require('lodash');

const file = path.join(__dirname, 'global.ts');
const source = transformFileSync(file, { plugins: [] }).code;
const ast = parser.parse(source, { sourceType: 'module' });
const wanted = new Set([
  'disposeRequestParams',
  'generateLocalizationParams',
  'getLocalizationKey',
  'canUseLocalizationCache',
  'insertLocalData',
]);
const nodes = ast.program.body.filter(
  node => node.type === 'VariableDeclaration' && node.declarations.some(declaration => wanted.has(declaration.id.name)),
);
assert.equal(nodes.length, wanted.size);
const selected = nodes.map(node => generate(node).code).join('\n');
const windowStub = { shareState: {}, isWeiXin: false, isWxWork: false };
const mdStub = { global: { Account: { accountId: 'user', lang: 'zh-Hans' } } };
let writes = 0;
const cache = {
  setItem: () => {
    writes++;
  },
};
const factory = new Function(
  'window',
  'md',
  '_',
  '__api_server__',
  'getPssId',
  'sessionStorage',
  'location',
  'getPathWithoutSubPath',
  'browserIsMobile',
  'localForage',
  'versionApi',
  'moment',
  selected + '\nreturn {disposeRequestParams, getLocalizationKey, insertLocalData};',
);
const functions = factory(
  windowStub,
  mdStub,
  _,
  { main: '/wwwapi/' },
  () => '',
  { getItem: () => null },
  { pathname: '/app/my', href: 'https://example.com/app/my' },
  (value: string) => value,
  () => false,
  cache,
  { getVersion: () => Promise.resolve({ version: '1' }) },
  require('moment'),
);

const original = { nested: { a: 1 }, values: [1, 2] };
const get = functions.disposeRequestParams('Worksheet', 'Other', original, { type: 'GET' });
assert.deepEqual(original, { nested: { a: 1 }, values: [1, 2] }, 'GET 序列化不能污染调用方的对象');
assert.deepEqual(get.data, { nested: '{"a":1}', values: '[1,2]' });
const worksheet = functions.disposeRequestParams('Worksheet', 'GetWorksheetById', { worksheetId: 'sheet' }, {});
assert.equal(worksheet.data.getTemplate, true);
assert.equal(worksheet.data.getViews, true);
assert.equal(worksheet.data.getSwitchPermit, true);
assert.equal(worksheet.data.getRules, true);
assert.equal(functions.getLocalizationKey('Worksheet', 'GetWorksheetById', { worksheetId: 'sheet' }).moduleType, 5);
const entry = { key: 'Worksheet_GetWorksheetById', sourceId: 'sheet', version: '1', data: { views: [{}] } };
functions.insertLocalData(entry);
assert.equal(writes, 1);
windowStub.isWeiXin = true;
functions.insertLocalData(entry);
assert.equal(writes, 1, '微信缓存不得污染登录态缓存');
windowStub.isWeiXin = false;
windowStub.isWxWork = true;
functions.insertLocalData(entry);
assert.equal(writes, 1, '企业微信缓存不得写入');
windowStub.isWxWork = false;
windowStub.shareState = { shareId: 'public-share' };
functions.insertLocalData(entry);
assert.equal(writes, 1, '分享页缓存不得写入登录态缓存');
console.log('GET 对象不变、工作表缓存完整形状及分享/微信隔离测试通过。');
