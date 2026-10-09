const assert = require('node:assert/strict');
const path = require('node:path');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const boundary = require('./worksheetConfigCache.ts');

interface WorksheetCache {
  saveLRUWorksheetConfig(key: string, id: string | undefined, value: unknown): void;
  clearLRUWorksheetConfig(key: string, id: string | undefined): void;
  getLRUWorksheetConfig(key: string, id: string | undefined): unknown;
}
const values = new Map<string, string>();
const logs: unknown[] = [];
const wanted = new Set(['saveLRUWorksheetConfig', 'clearLRUWorksheetConfig', 'getLRUWorksheetConfig']);
const code = transformFileSync(path.join(__dirname, 'common.ts'))
  .code.replaceAll('(0, _worksheetConfigCache.decodeWorksheetConfigCache)', 'decodeWorksheetConfigCache')
  .replaceAll('(0, _worksheetConfigCache.validateWorksheetConfigValue)', 'validateWorksheetConfigValue');
const ast = parser.parse(code, { sourceType: 'script' });
const declarations = ast.program.body.filter(node => node.type === 'FunctionDeclaration' && wanted.has(node.id.name));
assert.equal(declarations.length, wanted.size, 'Exercise the real common cache entry points');
const cache: WorksheetCache = new Function(
  'decodeWorksheetConfigCache',
  'validateWorksheetConfigValue',
  'localStorage',
  'safeLocalStorageSetItem',
  'console',
  declarations.map(node => generate(node).code).join('\n') +
    '\nreturn {saveLRUWorksheetConfig,clearLRUWorksheetConfig,getLRUWorksheetConfig};',
)(
  boundary.decodeWorksheetConfigCache,
  boundary.validateWorksheetConfigValue,
  { getItem: (key: string) => values.get(key) ?? null },
  (key: string, value: string) => values.set(key, value),
  { error: (...args: unknown[]) => logs.push(args) },
);

cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'worksheet', 50);
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_FROZON', 'view', '2');
cache.saveLRUWorksheetConfig('SHEET_LAYOUT_UPDATE_TIME', 'view', 1234);
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', 'view', '{"time":1234,"styles":[]}');
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'worksheet'), 50);
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_FROZON', 'view'), '2');
assert.equal(cache.getLRUWorksheetConfig('SHEET_LAYOUT_UPDATE_TIME', 'view'), 1234);
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', 'view'), '{"time":1234,"styles":[]}');
cache.clearLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'worksheet');
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'worksheet'), undefined);

values.set('WORKSHEET_VIEW_COLUMN_STYLES', JSON.stringify({ valid: '{}', invalid: {}, other: 1 }));
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', 'valid'), '{}');
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', 'invalid'), undefined);
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', 'new', '{"styles":[]}');
assert.deepEqual(JSON.parse(values.get('WORKSHEET_VIEW_COLUMN_STYLES') || '{}'), { valid: '{}', new: '{"styles":[]}' });
assert.throws(
  () => cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', 'view', {}),
  /Invalid worksheet configuration cache value/,
);
assert.throws(
  () => cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'view', Infinity),
  /Invalid worksheet configuration cache value/,
);
values.set('WORKSHEET_VIEW_COLUMN_STYLES', 'malformed JSON');
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', 'view'), undefined);
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_COLUMN_STYLES', 'view', '{}');
assert.deepEqual(JSON.parse(values.get('WORKSHEET_VIEW_COLUMN_STYLES') || '{}'), { view: '{}' });
assert.equal(logs.length, 2);

values.clear();
for (let index = 0; index < 30; index++)
  cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', `view-${index}`, index);
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'view-0', 100);
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'view-30', 30);
assert.equal(
  cache.getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'view-0'),
  100,
  'Updating a preference refreshes its write order',
);
assert.equal(
  cache.getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'view-1'),
  undefined,
  'Adding the 31st preference evicts the oldest write',
);
assert.equal(Object.keys(JSON.parse(values.get('WORKSHEET_VIEW_PAGESIZE') || '{}')).length, 30);
values.set(
  'WORKSHEET_VIEW_PAGESIZE',
  JSON.stringify(Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`old-${index}`, index]))),
);
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'latest', 200);
assert.equal(
  Object.keys(JSON.parse(values.get('WORKSHEET_VIEW_PAGESIZE') || '{}')).length,
  30,
  'Existing oversized caches shrink to the actual limit',
);
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'latest'), 200);

values.set(
  'WORKSHEET_VIEW_PAGESIZE',
  JSON.stringify(Object.fromEntries(Array.from({ length: 30 }, (_, index) => [String(index + 1), index]))),
);
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', '0', 200);
assert.equal(
  cache.getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', '0'),
  200,
  'The current write survives numeric-key enumeration',
);
assert.equal(Object.keys(JSON.parse(values.get('WORKSHEET_VIEW_PAGESIZE') || '{}')).length, 30);

cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', '__proto__', 7);
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'constructor', 8);
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', '__proto__'), 7);
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', 'constructor'), 8);
const validated = boundary.decodeWorksheetConfigCache('WORKSHEET_VIEW_PAGESIZE', values.get('WORKSHEET_VIEW_PAGESIZE'));
assert.equal(Object.getPrototypeOf(validated), Object.prototype);
const beforeMissingId = values.get('WORKSHEET_VIEW_PAGESIZE');
cache.saveLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', undefined, 3);
cache.clearLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', undefined);
assert.equal(cache.getLRUWorksheetConfig('WORKSHEET_VIEW_PAGESIZE', undefined), undefined);
assert.equal(
  values.get('WORKSHEET_VIEW_PAGESIZE'),
  beforeMissingId,
  'Absent IDs do not create or delete an undefined-key preference',
);
console.log(
  'Real worksheet preference cache validates wire values, preserves numeric/text data and enforces bounded write order.',
);
