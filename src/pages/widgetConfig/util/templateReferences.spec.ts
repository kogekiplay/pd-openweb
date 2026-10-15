const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const generate = require('@babel/generator').default;
const { transformSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../../../..');
const target = 'src/pages/widgetConfig/util/createTemplate.tsx';
const globals = globalThis as unknown as Record<string, unknown>;
globals['_l'] = (text: string) => text;
function load(source: string, imports: Record<string, unknown> = {}): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformSync(source, { filename: target, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', code)(output, output.exports, (name: string) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error('Unexpected dependency: ' + name);
  });
  return output.exports;
}

const drag = load(fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/Drag.ts'), 'utf8'));
const score = load(fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/score.ts'), 'utf8'), { lodash });
const config = load(fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/widget.ts'), 'utf8'), {
  lodash,
  uuid: { v4: () => 'fixture-option' },
  './Drag': drag,
  './score': score,
});
const advanced = fs.readFileSync(path.join(__dirname, 'advancedSettingBoundary.ts'), 'utf8');
const objectNode = parser
  .parse(advanced, { sourceType: 'module', plugins: ['typescript'] })
  .program.body.find(
    n =>
      n.type === 'ExportNamedDeclaration' &&
      n.declaration?.type === 'FunctionDeclaration' &&
      n.declaration.id?.name === 'widgetObject',
  );
assert.ok(objectNode);
const referenceBoundary = load(fs.readFileSync(path.join(__dirname, 'templateReferenceBoundary.ts'), 'utf8'), {
  './advancedSettingBoundary': load(generate(objectNode).code),
});
const permissions = require('./templatePermissionBoundary.ts');
// Execute the same parser installed by the browser, including object passthrough and its fallback.
const globalSource = fs.readFileSync(path.join(root, 'src/common/global.ts'), 'utf8');
const start = globalSource.indexOf('window.safeParse =');
const end = globalSource.indexOf('\n};', start);
assert.ok(start >= 0 && end > start);
const parserWindow: Record<string, unknown> = {};
new Function('window', 'console', transformSync(globalSource.slice(start, end + 3), { filename: target }).code)(
  parserWindow,
  { error: () => {} },
);
let roleResponse: unknown[] = [];
let calls: unknown[][] = [];

function engine(source: string): Record<string, unknown> {
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const constants = new Set([
    'NEED_CHECK_PERMISSION_CONTROL_TYPES',
    'WORKSHEET_ROLE_CONTROL_TYPES',
    'PERMISSION_WORKSHEET_ROLE_TYPES',
    'MAX_REFERENCE_DEPTH',
    'TEMPLATE_RELATION_CONTROL_TYPES',
  ]);
  const body = ast.program.body.flatMap<
    import('@babel/types').FunctionDeclaration | import('@babel/types').VariableDeclaration
  >(statement => {
    const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (node?.type === 'FunctionDeclaration' && node.id?.name !== 'CreateTemplateDialog') return [node];
    if (
      node?.type === 'VariableDeclaration' &&
      node.declarations.some(d => d.id.type === 'Identifier' && constants.has(d.id.name))
    )
      return [node];
    return [];
  });
  const environment = {
    _: lodash,
    WIDGETS_TO_API_TYPE_ENUM: config['WIDGETS_TO_API_TYPE_ENUM'],
    ALL_SYS: config['ALL_SYS'],
    safeParse: parserWindow['safeParse'],
    window: { subListSheetConfig: { blank: { mode: 'new' } } },
    worksheetAjax: {
      getWorksheetsRoleType: (...args: unknown[]) => {
        calls.push(args);
        return { data: roleResponse };
      },
    },
    decodeTemplatePermissions: permissions.decodeTemplatePermissions,
    ...referenceBoundary,
    _l: (text: string, value: unknown) => text + ' ' + value,
    alert: () => {},
  };
  const code = transformSync(body.map(node => generate(node).code).join('\n'), { filename: target }).code;
  return new Function(
    ...Object.keys(environment),
    code + '\nreturn { getAllReferencedControlInfo, getControlBySearchworksheet, supportCreateTemplate };',
  )(...Object.values(environment));
}

const current = engine(fs.readFileSync(path.join(root, target), 'utf8'));
const before = process.env['TEMPLATE_BEFORE_REV'];
const historical = before
  ? engine(cp.execFileSync('git', ['show', before + ':' + target], { cwd: root, encoding: 'utf8' }))
  : undefined;

function invoke(module: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
  const fn = module[name];
  if (typeof fn !== 'function') throw new Error('Missing function: ' + name);
  return Reflect.apply(fn, undefined, args);
}

function type(key: string): number {
  const enums = config['WIDGETS_TO_API_TYPE_ENUM'];
  assert.ok(enums && typeof enums === 'object');
  const value: unknown = Reflect.get(enums, key);
  assert.equal(typeof value, 'number', key);
  return Number(value);
}

const base = { controlId: 'base', controlName: 'Base', type: type('TEXT') };
const linked = { controlId: 'linked', controlName: 'Linked', type: type('RELATE_SHEET'), dataSource: 'sheet' };
const blank = {
  controlId: 'blank',
  controlName: 'Blank',
  type: type('SUB_LIST'),
  dataSource: 'temporary-sheet',
  advancedSetting: { detailworksheettype: '2' },
};
const mapping = [
  { cid: 'base', metadata: { retain: true } },
  { rcid: 'linked', cid: 'ignored' },
];
const filter = [{ dynamicSource: mapping }, { groupFilters: [{ dynamicSource: [{ cid: 'base' }] }] }];
const queries = [{ id: 'query', items: filter }];
const defaultRoles = [{ worksheetId: 'sheet', name: 'Source', roleType: 2 }];
let checks = 0;

function compare(selected: object[], roles: unknown[] = defaultRoles): unknown {
  const args = [[...selected, base, linked, blank], selected, queries];

  function run(module: Record<string, unknown>) {
    roleResponse = structuredClone(roles);
    calls = [];
    const inputs = structuredClone(args);
    const original = structuredClone(inputs);
    const value = invoke(module, 'getAllReferencedControlInfo', ...inputs);
    assert.deepEqual(inputs, original, 'Reference traversal preserves controls and settings');
    return { value, calls: structuredClone(calls) };
  }

  const result = run(current);
  if (historical) assert.deepEqual(result, run(historical), 'Historical reference graph and sync requests');
  checks++;
  return result.value;
}

const serialize = JSON.stringify;
const fixtures = [
  { type: 'TEXT', advancedSetting: { defsource: serialize(mapping) } },
  { type: 'TEXT', advancedSetting: { defaulttype: '1', defaultfunc: serialize({ expression: '$base$ + $linked$' }) } },
  { type: 'TEXT', advancedSetting: { defaulttype: '2', dynamicsrc: serialize({ id: 'query' }) } },
  { type: 'CUSTOM', advancedSetting: { reference: serialize(mapping) } },
  { type: 'FORMULA_FUNC', dataSource: serialize({ expression: '$base$ + $linked$' }) },
  { type: 'FORMULA_DATE', dataSource: '$base$', sourceControlId: '$linked$' },
  { type: 'FORMULA_NUMBER', dataSource: 'SUM($base$) + $linked$' },
  { type: 'MONEY_CN', dataSource: '$base$' },
  { type: 'CONCATENATE', dataSource: '$base$ $base$' },
  { type: 'BAR_CODE', dataSource: '$base$' },
  { type: 'OCR', advancedSetting: { ocrmap: serialize(mapping) } },
  { type: 'OCR', advancedSetting: { ocrcid: 'blank', ocrmap: 'retain' } },
  {
    type: 'AUTO_ID',
    advancedSetting: {
      increase: serialize([{ type: 1 }, { type: 3, controlId: 'base' }, { type: 3, rcid: 'linked' }]),
    },
  },
  { type: 'ATTACHMENT', advancedSetting: { watermarkinfo: '$base$' } },
  ...['DEPARTMENT', 'USER_PICKER', 'ORG_ROLE'].map(type => ({
    type,
    advancedSetting: { chooserange: serialize(mapping) },
  })),
  ...['DATE', 'DATE_TIME'].map(type => ({
    type,
    advancedSetting: { min: serialize(mapping), max: serialize([{ cid: 'base' }]) },
  })),
  {
    type: 'CASCADER',
    dataSource: 'sheet',
    advancedSetting: { filters: serialize(filter), topfilters: serialize(filter) },
  },
  { type: 'RELATE_SHEET', dataSource: 'sheet', advancedSetting: { filters: serialize(filter) } },
  { type: 'RELATION_SEARCH', dataSource: 'sheet', advancedSetting: { resultfilters: serialize(filter) } },
  { type: 'SHEET_FIELD', dataSource: '$linked$', sourceControlId: 'base' },
  { type: 'SUBTOTAL', dataSource: '$blank$', sourceControlId: 'base', advancedSetting: { filters: 'old' } },
];
for (const fixture of fixtures)
  compare([{ ...fixture, type: type(fixture.type), controlId: 'selected', controlName: fixture.type }]);
for (const roleType of [1, 2, 3, 4, 6, undefined])
  compare([linked], [{ worksheetId: 'sheet', name: 'Source', roleType }]);
compare([linked], []);
const deleted = compare([linked], [{ worksheetId: 'sheet', name: '', roleType: 2 }]);
assert.deepEqual(Reflect.get(Object(deleted), 'deletedWorksheetControlNames'), ['Linked']);
compare([{ ...base, advancedSetting: { defsource: serialize([{ cid: null, rcid: null }]) } }]);
compare([
  {
    type: type('TEXT'),
    controlId: 'nullable',
    advancedSetting: { defaulttype: '2', dynamicsrc: serialize({ id: 'query' }) },
  },
]);
for (const data of [[{ cid: 7 }], [null], new Array(1), { cid: 'base' }, [{ rcid: ['linked'] }]])
  assert.throws(() => invoke(referenceBoundary, 'templateMappings', data), TypeError);
for (const data of [[{ dynamicSource: 'bad' }], [{ groupFilters: [{ dynamicSource: [{ cid: 8 }] }] }]])
  assert.throws(() => invoke(referenceBoundary, 'templateFilters', data), TypeError);
const extra = { cid: 'base', future: { retained: true } };
const items = [extra];
assert.equal(invoke(referenceBoundary, 'templateMappings', items), items);
assert.equal(
  invoke(referenceBoundary, 'templateFilters', [{ groupFilters: null, dynamicSource: null }]) instanceof Array,
  true,
);
assert.throws(
  () => invoke(current, 'getControlBySearchworksheet', [base], '{"id":"missing"}', queries),
  /Missing worksheet query/,
);
if (historical)
  assert.throws(() => invoke(historical, 'getControlBySearchworksheet', [base], '{"id":"missing"}', queries));
console.log(
  `Template reference graph, permissions and metadata passed (${checks} cases${historical ? ' with historical comparison' : ''}); malformed mappings/filters and missing queries reject`,
);
