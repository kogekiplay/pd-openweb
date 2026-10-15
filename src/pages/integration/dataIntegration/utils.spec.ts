const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const { transformSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../../../..');
const target = 'src/pages/integration/dataIntegration/utils.ts';
let randomCalls = 0;
const deterministicMath: Math = Object.create(Math);
deterministicMath.random = () => [0.1234, 0.5678, 0.9012][randomCalls++ % 3] || 0;
function load(
  source: string,
  imports: Record<string, unknown> = {},
  env: Record<string, unknown> = {},
): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const globals = { _l: (text: string) => text, Math: deterministicMath, _: lodash, ...env };
  const { code } = transformSync(source, { filename: target, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    output,
    output.exports,
    (name: string) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error('Unexpected import: ' + name);
    },
    ...Object.values(globals),
  );
  return output.exports;
}

function selected(relative: string, names: string[]): string {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  return names
    .map(name => {
      const item = ast.program.body.find(statement => {
        const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
        return node?.type === 'FunctionDeclaration'
          ? node.id?.name === name
          : node?.type === 'VariableDeclaration' &&
              node.declarations.some(d => d.id.type === 'Identifier' && d.id.name === name);
      });
      assert.ok(item?.start != null && item?.end != null, name);
      const raw = source.slice(item.start, item.end);
      return raw.startsWith('export ') ? raw : 'export ' + raw;
    })
    .join('\n');
}

const constants = load(
  selected('src/pages/integration/dataIntegration/constant.ts', [
    'DATABASE_TYPE',
    'DEPT_FIELDS',
    'PERSONNEL_FIELDS',
    'RELATED_RECORD_FIELDS',
    'SYSTEM_FIELD_IDS',
    'namePattern',
    'isValidName',
    'isPostgresqlDestinationType',
    'lowercaseIfString',
  ]),
);
const score = load(selected('src/pages/widgetConfig/config/score.ts', ['NUM_5_SETTINGS']));
const drag = load(fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/Drag.ts'), 'utf8'));
const widget = load(
  selected('src/pages/widgetConfig/config/widget.ts', [
    'getDefaultOptions',
    'genDefaultOptionsAndChecked',
    'WIDGETS_TO_API_TYPE_ENUM',
    'DEFAULT_DATA',
  ]),
  {},
  { ...score, ...drag, uuidv4: () => 'fixture-option' },
);
const titleConfig = load(selected('src/pages/widgetConfig/config/index.ts', ['NOT_AS_TITLE_CONTROL']));
const widgetUtil = load(
  selected('src/pages/widgetConfig/util/index.ts', ['enumObj', 'enumWidgetType', 'canSetAsTitle']),
  {},
  { ...widget, ...titleConfig, keys: lodash.keys, includes: lodash.includes },
);
const imports = {
  lodash,
  'src/pages/integration/dataIntegration/constant.js': constants,
  'src/pages/widgetConfig/config/widget.js': widget,
  'src/pages/widgetConfig/util': widgetUtil,
};
const current = load(fs.readFileSync(path.join(root, target), 'utf8'), imports);
const before = process.env['INTEGRATION_UTILS_BEFORE_REV'];
const historical = before
  ? load(cp.execFileSync('git', ['show', before + ':' + target], { cwd: root, encoding: 'utf8' }), imports)
  : undefined;

function invoke(module: Record<string, unknown>, name: string, args: unknown[]): unknown {
  const fn = module[name];
  if (typeof fn !== 'function') throw new Error(name);
  return Reflect.apply(fn, undefined, args);
}

function freeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  Object.values(value).forEach(freeze);
  Object.freeze(value);
}

let checks = 0;

function compare(name: string, args: unknown[], expected?: unknown, mutates = false): unknown {
  const run = (module: Record<string, unknown>) => {
    const inputs = structuredClone(args);
    if (!mutates) freeze(inputs);
    randomCalls = 0;
    const value = invoke(module, name, inputs);
    if (!mutates) assert.deepEqual(inputs, args, name + ' source preservation');
    return { value, inputs };
  };

  const result = run(current);
  if (expected !== undefined) assert.deepEqual(result.value, expected, name);
  if (historical) assert.deepEqual(result, run(historical), 'Historical ' + name + ' values and mutations');
  checks++;
  return result.value;
}

const field = {
  id: 'text',
  oid: 'sheet_text',
  name: 'Title',
  alias: 'Alias',
  jdbcTypeId: 12,
  dataType: 'varchar',
  mdType: 2,
  isPk: false,
  isCheck: true,
  isNotNull: false,
  controlSetting: { remark: 'remark' },
  metadata: { future: ['keep'] },
};
const numbers = {
  ...field,
  id: 'number',
  name: 'Number',
  alias: 'Number',
  jdbcTypeId: 4,
  dataType: 'integer',
  mdType: 6,
};
const rowId = {
  ...field,
  id: 'rowid',
  oid: 'sheet_rowid',
  name: 'rowid',
  alias: 'rowid',
  isPk: true,
  isUniquePk: true,
};
const mapping = [field, numbers, rowId].map(sourceField => ({
  sourceField,
  destField: { ...sourceField, id: null, isTitle: false },
}));
const choices = {
  text: [{ typeName: 'VARCHAR', mdType: 2, dataType: 12, maxLength: 200, defaultScale: 0 }],
  number: [
    { typeName: 'VARCHAR', mdType: 2, dataType: 12, maxLength: 200, defaultScale: 0 },
    { typeName: 'INTEGER', mdType: 6, dataType: 4, maxLength: 12, defaultScale: 0 },
  ],
  rowid: [{ typeName: 'VARCHAR', mdType: 2, dataType: 12, maxLength: 200, defaultScale: 0 }],
};

for (const dest of ['MYSQL', 'POSTGRESQL', 'ALIYUN_POSTGRES', 'TENCENT_POSTGRES', 'MING_DAO_YUN', 'MONGODB']) {
  for (const isSourceAppType of [false, true])
    compare('getInitFieldsMapping', [[field, numbers, rowId], isSourceAppType, dest]);
}

compare('getInitFieldsMapping', [[{ ...field, name: 'a-b c', alias: 'UpperCase' }], false, 'POSTGRESQL']);
compare('getInitFieldsMapping', [[{ ...field, isPk: true }], false, 'MONGODB']);
compare(
  'getDuplicateFieldsRenamedList',
  [
    [
      { destField: { name: 'duplicate' }, keep: 1 },
      { destField: { name: 'duplicate' }, keep: 2 },
      { destField: { name: 'duplicate' }, keep: 3 },
    ],
  ],
  undefined,
  true,
);
const controls = [
  { controlId: 'rowid', type: 2 },
  { controlId: 'text', controlName: 'Title', alias: 'Alias', type: 2, advancedSetting: {}, required: true },
  { controlId: 'person', controlName: 'People', type: 26, advancedSetting: { usertype: '1' } },
  { controlId: 'external', controlName: 'External', type: 26, advancedSetting: { usertype: '2' } },
  { controlId: 'department', controlName: 'Department', type: 27, advancedSetting: {} },
  { controlId: 'relate', controlName: 'Related', type: 29, advancedSetting: {} },
  { controlId: 'ctime', controlName: 'Created', type: 16 },
];

for (const isGetDest of [false, true])
  for (const isSourceAppType of [false, true])
    for (const isDestAppType of [false, true]) {
      for (const withRowId of [false, true])
        for (const withSys of [false, true])
          compare('getInitWorkSheetFields', [
            controls,
            isGetDest,
            isSourceAppType,
            isDestAppType,
            'sheet',
            withRowId,
            withSys,
          ]);
    }

for (const isSourceAppType of [undefined, false, true])
  for (const isDestAppType of [undefined, false, true]) {
    compare('getMatchedFieldsOptions', [choices, field, [field, numbers], isSourceAppType, isDestAppType]);
    for (const isSetDefaultFields of [undefined, false, true])
      for (const notCanvas of [undefined, false, true]) {
        for (const types of [choices, {}, null, undefined])
          compare('getDefaultData', [
            mapping,
            types,
            isSetDefaultFields,
            [field, numbers],
            isSourceAppType,
            isDestAppType,
            notCanvas,
          ]);
      }
  }

compare('getDefaultData', [
  [{ sourceField: { ...field, name: 'invalid name' }, destField: field }],
  choices,
  true,
  [field],
  undefined,
  false,
]);
const scoreField = { ...field, id: 'score', mdType: 28 };
compare('getDefaultData', [
  [{ sourceField: scoreField, destField: scoreField }],
  { score: [{ typeName: 'INTEGER', mdType: 28, dataType: 4, defaultScale: 0 }] },
  false,
  [],
  true,
  true,
]);
const date = { ...field, id: 'date', mdType: 16, dataType: 'timestamp' };
compare('getDefaultData', [
  [{ sourceField: date, destField: date }],
  { date: [{ typeName: 'TIMESTAMP', mdType: 16, dataType: 93, defaultScale: 0 }] },
  false,
  [],
  true,
  true,
]);
for (const source of [
  field,
  { ...field, mdType: 30, controlSetting: { strDefault: '10' } },
  { ...field, mdType: 30, controlSetting: { sourceControlType: 21 } },
  { ...field, mdType: 29, controlSetting: { enumDefault: 2 } },
])
  for (const types of [choices, {}]) compare('isNotSupportField', [source, types]);
for (const serviceType of ['["ServiceName"]', '["SID"]', '[]', '"ServiceName"'])
  compare('getExtraParams', ['ORACLE', { serviceType, serviceName: 'db' }]);
for (const isSrvProtocol of [true, false, '1', '0', undefined, null])
  compare('getExtraParams', ['MONGODB', { isSrvProtocol }]);
for (const authType of ['["PLAINTEXT"]', '["SASL_PLAINTEXT"]', '[]'])
  for (const saslMechanism of ['["PLAIN"]', '["SCRAM-SHA-256"]', '', undefined]) {
    compare('getExtraParams', ['KAFKA', { authType, saslMechanism }]);
  }

compare('getExtraParams', ['MYSQL', {}], {});
for (const selection of ['[null]', '[42]', '[true]', '[{"future":true}]', '{}', '{"0":"legacy"}', '0', 'true']) {
  compare('getExtraParams', ['KAFKA', { authType: selection }]);
  compare('getExtraParams', ['ORACLE', { serviceType: selection, serviceName: 'db' }]);
}

// The duplicate counter must treat valid names that collide with Object.prototype as ordinary strings.
randomCalls = 0;
const reserved = [{ destField: { name: 'constructor' } }, { destField: { name: 'constructor' } }];
assert.equal(invoke(current, 'getDuplicateFieldsRenamedList', [reserved]), reserved);
assert.equal(reserved[1]?.destField.name, 'constructor1234');
const original = [{ sourceField: field, destField: field }];
const result = invoke(current, 'getDefaultData', [original, choices, false, [], false, false]);
assert.ok(Array.isArray(result));
assert.equal(result[0].sourceField.metadata, field.metadata, 'Opaque source metadata identity');
assert.deepEqual(original, [{ sourceField: field, destField: field }]);
assert.throws(
  () => invoke(current, 'getInitWorkSheetFields', [[{ controlId: 'bad', type: 2 }], false, false, true, 'sheet']),
  TypeError,
);
for (const raw of ['{', 'not JSON']) {
  assert.throws(() => invoke(current, 'getExtraParams', ['KAFKA', { authType: raw }]), SyntaxError);
  if (historical) assert.throws(() => invoke(historical, 'getExtraParams', ['KAFKA', { authType: raw }]), SyntaxError);
}

const previousConstants = before
  ? load(
      cp.execFileSync('git', ['show', before + ':src/pages/integration/dataIntegration/constant.ts'], {
        cwd: root,
        encoding: 'utf8',
      }),
    )
  : undefined;

for (const value of [
  'POSTGRESQL',
  'ALIYUN_POSTGRES',
  'TENCENT_POSTGRES',
  'MYSQL',
  '',
  null,
  undefined,
  1,
  true,
  {},
  ['POSTGRESQL'],
]) {
  const result = invoke(constants, 'isPostgresqlDestinationType', [value]);
  if (previousConstants) assert.equal(result, invoke(previousConstants, 'isPostgresqlDestinationType', [value]));
  checks++;
}

for (const value of ['MixedCase', '', null, undefined, 0, false, { keep: true }, ['A']]) {
  const result = invoke(constants, 'lowercaseIfString', [value]);
  assert.equal(result, typeof value === 'string' ? value.toLowerCase() : value);
  if (previousConstants) assert.equal(result, invoke(previousConstants, 'lowercaseIfString', [value]));
  checks++;
}

console.log(
  `Integration field defaults, primary keys, worksheet splitting and connection selections passed (${checks} cases${historical ? ' with historical comparison' : ''})`,
);
