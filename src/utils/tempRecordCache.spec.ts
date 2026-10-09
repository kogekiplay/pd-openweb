const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;
const { transformFileSync, transformSync } = require('../../scripts/spec-harness.ts');
const lodash = require('lodash');
const moment = require('moment');
const root = path.resolve(__dirname, '../..');
function load(file: string, imports: Record<string, unknown> = {}) {
  const loaded: { exports: Record<string, unknown> } = { exports: {} };
  new Function(
    'module',
    'exports',
    'require',
    transformFileSync(file, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code,
  )(loaded, loaded.exports, (name: string) => {
    if (!(name in imports)) throw new Error('Unstubbed ' + name);
    return imports[name];
  });
  return loaded.exports;
}
const cacheTypes = load(path.join(__dirname, 'tempRecordCache.ts'));
type Snapshot = { create_at?: string | number; value: Record<string, unknown> };
const decode = cacheTypes.decodeTempRecordSnapshot as (value: string) => Snapshot | undefined;
const kvValue = cacheTypes.decodeKVValue as (value: unknown) => string;
assert.equal(kvValue(null), '');
assert.equal(kvValue({ data: null }), '');
assert.equal(kvValue({ data: '' }), '');
assert.equal(kvValue({ data: '{"field":1}' }), '{"field":1}');
assert.throws(() => kvValue({ data: { unvalidated: true } }), /serialized text/);
assert.deepEqual(
  decode('{"create_at":1700000000000,"value":{"field":0,"flag":false,"rows":[{"rowid":"row","field":"text"}]}}'),
  { create_at: 1700000000000, value: { field: 0, flag: false, rows: [{ rowid: 'row', field: 'text' }] } },
);
assert.deepEqual(decode('{"field":"legacy"}'), { create_at: undefined, value: { field: 'legacy' } });
assert.deepEqual(decode('{"value":{"json":{"rowid":5},"array":[{"rowid":9}]}}')?.value, {
  json: { rowid: 5 },
  array: [{ rowid: 9 }],
});
assert.equal(decode('{}'), undefined);
for (const serialized of [
  '{bad json',
  '[]',
  'null',
  '{"create_at":{},"value":{}}',
  '{"create_at":"bad timestamp","value":{}}',
  '{"value":[1]}',
  '{"value":0}',
  '{"value":false}',
])
  assert.throws(() => decode(serialized));

function loadFunctions(file: string, names: string[], globals: Record<string, unknown> = {}) {
  const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const declarations = ast.program.body
    .map(node => (node.type === 'ExportNamedDeclaration' ? node.declaration : node))
    .filter(
      node =>
        node &&
        ((node.type === 'FunctionDeclaration' && names.includes(node.id.name)) ||
          (node.type === 'VariableDeclaration' && node.declarations.some(d => names.includes(d.id.name)))),
    );
  assert.equal(declarations.length, names.length);
  const source =
    declarations.map(node => generate(node).code).join('\n') + '\nmodule.exports = {' + names.join(',') + '};';
  const target: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', ...Object.keys(globals), transformSync(source, { filename: file }).code)(
    target,
    target.exports,
    ...Object.values(globals),
  );
  return target.exports;
}
const enums = loadFunctions(path.join(root, 'src/pages/worksheet/constants/enum.ts'), [
  'RELATE_RECORD_SHOW_TYPE',
  'RELATION_SEARCH_SHOW_TYPE',
]);
const controlHelpers = loadFunctions(
  path.join(__dirname, 'control.ts'),
  ['checkCellIsEmpty', 'isRelateRecordTableControl'],
  {
    _: lodash,
    ...enums,
  },
);
const widgetEnum = loadFunctions(path.join(root, 'src/pages/widgetConfig/config/widget.ts'), [
  'WIDGETS_TO_API_TYPE_ENUM',
]);
const recordBoundary = load(path.join(__dirname, 'recordValueBoundary.ts'));
interface DraftControl {
  controlId: string;
  type: number;
  value?: unknown;
  enumDefault?: number;
  advancedSetting?: Record<string, string>;
}
interface DraftHelpers {
  getRecordTempValue(controls: DraftControl[], related?: Record<string, DraftControl>): Record<string, unknown>;
  parseRecordTempValue(
    data: Record<string, unknown>,
    controls: DraftControl[],
  ): { formdata: DraftControl[]; relateRecordData: Record<string, unknown> };
}
const drafts = loadFunctions(
  path.join(__dirname, 'record.ts'),
  ['getRecordTempValue', 'parseRecordTempValue', 'filterEmptyChildTableRows'],
  { _: lodash, ...recordBoundary, ...controlHelpers, ...widgetEnum },
) as unknown as DraftHelpers;
const recordObject = recordBoundary.recordObject as (value: unknown) => unknown;
const recordArray = recordBoundary.recordArray as (value: unknown) => unknown[];
assert.equal(recordObject({ rowid: 5 }), undefined, 'actual record row IDs remain strings');
assert.deepEqual(recordObject({ rowid: 'row', payload: { rowid: 5 } }), { rowid: 'row', payload: { rowid: 5 } });
assert.deepEqual(recordArray([{ rowid: 5 }, { rowid: 'row', payload: { rowid: 5 } }]), [
  { rowid: 'row', payload: { rowid: 5 } },
]);

const wanted = new Set([
  'KVSet',
  'KVGet',
  'KVClear',
  'debouncedKVSet',
  'saveTempRecordValueToLocal',
  'removeTempRecordValueFromLocal',
]);
const product = fs.readFileSync(path.join(__dirname, 'common.ts'), 'utf8');
const tree = parser.parse(product, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const declarations = tree.program.body
  .map(node => (node.type === 'ExportNamedDeclaration' ? node.declaration : node))
  .filter(
    node =>
      node &&
      ((node.type === 'FunctionDeclaration' && wanted.has(node.id.name)) ||
        (node.type === 'VariableDeclaration' && node.declarations.some(d => wanted.has(d.id.name)))),
  );
assert.equal(declarations.length, wanted.size);
const source =
  declarations.map(node => generate(node).code).join('\n') +
  '\nmodule.exports = { KVSet, KVGet, KVClear, debouncedKVSet, saveTempRecordValueToLocal, removeTempRecordValueFromLocal };';
const writes: Array<{ key: string; value: string; moduleType: number; expireTime: string }> = [],
  clears: unknown[] = [],
  reads: unknown[] = [];
const storage = new Map<string, string>(),
  errors: unknown[] = [];
let nextReply: unknown = { data: 'serialized' },
  failWriteOnce = false;
const window = { isWxWork: false },
  md = { global: { Account: { accountId: 'account' } } };
const localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  removeItem: (key: string) => storage.delete(key),
};
const request = () => Object.assign(Promise.resolve({ opaque: true }), { abort() {} });
const webCache = {
  add: (params: (typeof writes)[number]) => {
    writes.push(params);
    return request();
  },
  clear: (params: unknown) => {
    clears.push(params);
    return request();
  },
  get: (params: unknown) => {
    reads.push(params);
    return Promise.resolve(nextReply);
  },
};
const globals = {
  _: lodash,
  moment,
  webCache,
  window,
  md,
  localStorage,
  ...cacheTypes,
  safeParse: (text: string, fallback: unknown) => {
    try {
      return JSON.parse(text);
    } catch {
      return fallback === 'array' ? [] : fallback;
    }
  },
  safeLocalStorageSetItem: (key: string, value: string) => {
    if (failWriteOnce) {
      failWriteOnce = false;
      throw new Error('quota');
    }
    storage.set(key, value);
  },
  console: { error: (error: unknown) => errors.push(error) },
};
const loaded: { exports: unknown } = { exports: {} };
new Function(
  'module',
  'exports',
  ...Object.keys(globals),
  transformSync(source, { filename: path.join(__dirname, 'common.ts') }).code,
)(loaded, loaded.exports, ...Object.values(globals));
type Handle = { cancel(): void; flush(): Promise<unknown> | undefined };
const common = loaded.exports as {
  KVSet(key: string, value: string, options?: { expireTime?: string }): Promise<unknown>;
  KVGet(key: string): Promise<string>;
  KVClear(key: string): Promise<unknown>;
  debouncedKVSet: Handle;
  saveTempRecordValueToLocal(key: string, id: string | undefined, value: string, max?: number): Handle | undefined;
  removeTempRecordValueFromLocal(key: string, id: string | undefined): void;
};
common.saveTempRecordValueToLocal('draft', 'a', 'one', 2);
common.saveTempRecordValueToLocal('draft', 'b', 'two', 2);
common.saveTempRecordValueToLocal('draft', 'a', 'updated', 2);
assert.equal(storage.get('draft'), '["b","a"]');
common.saveTempRecordValueToLocal('draft', 'c', 'three', 2);
assert.equal(storage.get('draft'), '["a","c"]');
assert.equal(storage.has('draft_b'), false);
common.removeTempRecordValueFromLocal('draft', 'a');
assert.equal(storage.get('draft'), '["c"]');
common.removeTempRecordValueFromLocal('draft', 'c');
assert.equal(storage.has('draft'), false);
storage.set('draft', '{bad index');
common.saveTempRecordValueToLocal('draft', 'd', 'four');
assert.equal(storage.get('draft'), '["d"]');
storage.set('draft', '{}');
common.saveTempRecordValueToLocal('draft', 'e', 'five');
assert.equal(storage.get('draft'), '["e"]');
common.saveTempRecordValueToLocal('draft', undefined, 'no identity');
assert.equal(storage.has('draft_undefined'), false);
common.removeTempRecordValueFromLocal('draft', undefined);
assert.equal(storage.get('draft_e'), 'five');
Object.assign(localStorage, { draft_old: true });
storage.set('draft_old', 'obsolete');
failWriteOnce = true;
common.saveTempRecordValueToLocal('draft', 'f', 'six');
assert.equal(storage.has('draft_old'), false);
assert.equal(storage.get('draft_f'), 'six');
window.isWxWork = true;
const first = common.saveTempRecordValueToLocal('recordInfo', 'row-a', 'a');
const last = common.saveTempRecordValueToLocal('recordInfo', 'row-b', 'b');
assert.equal(first, last);
assert.equal(last, common.debouncedKVSet, 'Wx saves retain the existing shared debounce instance');
last.flush();
assert.equal(writes.length, 1);
assert.equal(writes[0].key, 'accountrow-b-recordInfo');
assert.equal(writes[0].value, 'b');
common.saveTempRecordValueToLocal('recordInfo', 'row-c', 'c').cancel();
common.debouncedKVSet.flush();
assert.equal(writes.length, 1, 'cancel prevents a pending save');
common.removeTempRecordValueFromLocal('recordInfo', 'row-b');
assert.deepEqual(clears[0], { key: 'accountrow-b-recordInfo', moduleType: 2 });
(async () => {
  const now = Date.now();
  await common.KVSet('explicit', 'value', { expireTime: '2030-01-01 00:00:00' });
  assert.equal(writes[1].expireTime, '2030-01-01 00:00:00');
  const defaultExpiry = moment(new Date(now + 3 * 24 * 60 * 60 * 1000)).format('YYYY-MM-DD HH:mm:ss');
  assert.equal(writes[0].moduleType, 2);
  assert.ok(
    Math.abs(moment(writes[0].expireTime).valueOf() - moment(defaultExpiry).valueOf()) <= 1000,
    'default expiration is three days from the write',
  );
  assert.equal(await common.KVGet('read'), 'serialized');
  assert.deepEqual(reads[0], { key: 'read', moduleType: 2 });
  nextReply = { data: { malformed: true } };
  await assert.rejects(common.KVGet('bad'), /serialized text/);
  // Execute the actual new-record restoration closure from its product component.
  const componentSource: string = fs.readFileSync(
    path.join(root, 'src/pages/worksheet/common/newRecord/NewRecordContent.tsx'),
    'utf8',
  );
  const componentAst = parser.parse(componentSource, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let fillSource = '';
  require('@babel/traverse').default(componentAst, {
    VariableDeclarator(p) {
      if (p.node.id.name === 'fillTempRecordValue')
        fillSource = componentSource.slice(p.node.init.start, p.node.init.end);
    },
  });
  assert.ok(fillSource);
  const flags: boolean[] = [],
    formUpdates: unknown[] = [],
    relatedUpdates: unknown[] = [];
  const cache: { current: { tempRecordCreateTime?: string | number } } = { current: {} };
  const consumerGlobals = {
    setIsSettingTempData: (value: boolean) => flags.push(value),
    decodeTempRecordSnapshot: decode,
    cache,
    parseRecordTempValue: (value: unknown, controls: unknown) => {
      assert.deepEqual(controls, ['original']);
      return { formdata: value, relateRecordData: { valid: true } };
    },
    defaultRelatedSheet: {},
    clearTimeout() {},
    setFormdata: (value: unknown) => formUpdates.push(value),
    setRelateRecordData: (value: unknown) => relatedUpdates.push(value),
    setRandom() {},
    setRestoreVisible() {},
    isMingoCreate: false,
    console: { error: (value: unknown) => errors.push(value) },
  };
  const consumerModule: { exports: unknown } = { exports: {} };
  new Function(
    'module',
    'exports',
    ...Object.keys(consumerGlobals),
    transformSync('module.exports = ' + fillSource, {
      filename: path.join(root, 'src/pages/worksheet/common/newRecord/NewRecordContent.tsx'),
    }).code,
  )(consumerModule, consumerModule.exports, ...Object.values(consumerGlobals));
  const fill = consumerModule.exports as (serialized: string, controls: unknown[]) => void;
  fill('{"create_at":1700000000000,"value":{"field":"current"}}', ['original']);
  assert.deepEqual(formUpdates.pop(), { field: 'current' });
  assert.deepEqual(relatedUpdates.pop(), { valid: true });
  assert.equal(cache.current.tempRecordCreateTime, 1700000000000);
  fill('{"field":"legacy"}', ['original']);
  assert.deepEqual(formUpdates.pop(), { field: 'legacy' });
  const updateCount = formUpdates.length;
  for (const bad of ['{bad json', '{}', '{"value":[]}']) {
    fill(bad, ['original']);
    assert.equal(flags[flags.length - 1], false, 'invalid/empty restore releases the loading flag');
  }
  assert.equal(formUpdates.length, updateCount, 'invalid drafts never update the form');
  // Keep the complete real writer -> serialized cache -> actual restoration path.
  // Numeric rowid keys below a cell belong to generic JSON, not the enclosing row.
  const subId = 's'.repeat(24),
    childId = 'c'.repeat(24),
    textId = 't'.repeat(24),
    relatedId = 'r'.repeat(24);
  const childRows = [
    {
      rowid: 'row-guid',
      [childId]: { rowid: 5, nested: [{ rowid: 9, flag: false, score: 0 }] },
      blank: '',
    },
  ];
  const controls: DraftControl[] = [
    { controlId: subId, type: 34, value: { rows: childRows } },
    { controlId: textId, type: 6, value: 0 },
    { controlId: relatedId, type: 29, enumDefault: 2 },
  ];
  const produced = drafts.getRecordTempValue(controls, {
    [relatedId]: { controlId: relatedId, type: 29, value: [{ rowid: 7, custom: 'JSON metadata' }] },
  });
  assert.deepEqual(produced[subId], [{ rowid: 'row-guid', [childId]: childRows[0]?.[childId] }]);
  assert.equal(produced[textId], 0);
  const actualRowGuard = drafts.getRecordTempValue([
    { controlId: subId, type: 34, value: { rows: [{ rowid: 5, [childId]: 'invalid row' }, ...childRows] } },
  ]);
  assert.deepEqual(actualRowGuard[subId], produced[subId], 'the writer rejects numeric IDs only on actual rows');
  const actualGlobals = { ...consumerGlobals, parseRecordTempValue: drafts.parseRecordTempValue };
  const actualModule: { exports: unknown } = { exports: {} };
  new Function(
    'module',
    'exports',
    ...Object.keys(actualGlobals),
    transformSync('module.exports = ' + fillSource, {
      filename: path.join(root, 'src/pages/worksheet/common/newRecord/NewRecordContent.tsx'),
    }).code,
  )(actualModule, actualModule.exports, ...Object.values(actualGlobals));
  const actualFill = actualModule.exports as (serialized: string, controls: DraftControl[]) => void;
  const expected = drafts.parseRecordTempValue(produced, controls);
  for (const serialized of [JSON.stringify({ create_at: 1700000000000, value: produced }), JSON.stringify(produced)]) {
    actualFill(serialized, controls);
    assert.deepEqual(formUpdates.pop(), expected.formdata);
    assert.deepEqual(relatedUpdates.pop(), expected.relateRecordData);
    assert.equal(flags[flags.length - 1], false);
  }
  console.log('temporary record cache, remote serialized payload and shared debounce tests passed');
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
