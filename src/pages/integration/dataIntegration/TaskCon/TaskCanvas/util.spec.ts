const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const { transformSync } = require('../../../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const moment = require('moment');
const root = path.resolve(__dirname, '../../../../../..');
const target = 'src/pages/integration/dataIntegration/TaskCon/TaskCanvas/util.ts';
const translate = (text: string) => text;
const globals: Record<string, unknown> = { _l: translate };

function load(
  source: string,
  imports: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const env = { ...globals, ...extra };
  const { code } = transformSync(source, { filename: target, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', ...Object.keys(env), code)(
    output,
    output.exports,
    (name: string) => {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error('Unexpected import: ' + name);
    },
    ...Object.values(env),
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
    'PERSONNEL_FIELDS',
    'DEPT_FIELDS',
    'RELATED_RECORD_FIELDS',
    'SYSTEM_FIELD_IDS',
    'isValidName',
    'isPostgresqlDestinationType',
    'lowercaseIfString',
    'namePattern',
  ]),
);
const drag = load(fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/Drag.ts'), 'utf8'));
const score = load(selected('src/pages/widgetConfig/config/score.ts', ['NUM_5_SETTINGS']));
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
const helpers = load(
  selected('src/pages/integration/dataIntegration/utils.ts', [
    'getInitFieldsMapping',
    'getDuplicateFieldsRenamedList',
    'getInitWorkSheetFields',
    'getMatchedFieldsOptions',
    'getDefaultData',
  ]),
  {},
  { _: lodash, ...constants, ...widget, ...widgetUtil },
);
const filterRelation = load(selected('src/pages/worksheet/common/WorkSheetFilter/enum.ts', ['FILTER_RELATION_TYPE']));
const config = load(fs.readFileSync(path.join(__dirname, 'config.ts'), 'utf8'), {
  moment,
  'src/pages/worksheet/common/WorkSheetFilter/enum': filterRelation,
});
const connectorBoundary = load(
  fs.readFileSync(
    path.join(root, 'src/pages/integration/dataIntegration/connector/components/OnlySyncStep/connectorBoundary.ts'),
    'utf8',
  ),
  { react: require('react') },
);
const source = fs.readFileSync(path.join(root, target), 'utf8');
const before = process.env['CANVAS_BEFORE_REV'];
const historical = before
  ? cp.execFileSync('git', ['show', before + ':' + target], { cwd: root, encoding: 'utf8' })
  : undefined;
type Request = { controller: string; method: string; args: unknown };
function runtime(old = false) {
  const requests: Request[] = [];
  const responses = new Map<string, unknown>();
  const env = {
    ...globals,
    $: { extend: lodash.assign },
    __api_server__: { datapipeline: 'https://fixture.invalid' },
    mdyAPI: (controller: string, method: string, args: unknown) => {
      requests.push({ controller, method, args: typeof args === 'string' ? JSON.parse(args) : structuredClone(args) });
      assert.ok(responses.has(method), 'Expected API response fixture: ' + method);
      return Promise.resolve(responses.get(method));
    },
  };
  const base = load(fs.readFileSync(path.join(root, 'src/pages/integration/api/base.ts'), 'utf8'), { lodash }, env);
  const apiImports = { './base': base };
  const dataSource = load(
    fs.readFileSync(path.join(root, 'src/pages/integration/api/datasource.ts'), 'utf8'),
    apiImports,
    env,
  )['default'];
  const taskFlow = load(
    fs.readFileSync(path.join(root, 'src/pages/integration/api/taskFlow.ts'), 'utf8'),
    apiImports,
    env,
  )['default'];
  const worksheet = load(fs.readFileSync(path.join(root, 'src/api/worksheet.ts'), 'utf8'), {}, env)['default'];
  const module = load(
    old && historical ? historical : source,
    {
      lodash,
      'src/api/worksheet': worksheet,
      'src/pages/integration/api/datasource.js': dataSource,
      'src/pages/integration/api/taskFlow.js': taskFlow,
      'src/pages/integration/dataIntegration/constant.js': constants,
      'src/pages/integration/dataIntegration/TaskCon/TaskCanvas/config.js': config,
      '../../utils': helpers,
      '../../connector/components/OnlySyncStep/connectorBoundary': connectorBoundary,
    },
    env,
  );
  return { module, requests, responses };
}

const current = runtime();
const previous = historical ? runtime(true) : undefined;

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

function compare(name: string, args: unknown[], expected?: unknown): unknown {
  const inputs = structuredClone(args);
  freeze(inputs);
  const result = invoke(current.module, name, inputs);
  if (expected !== undefined) assert.deepEqual(result, expected, name);
  if (previous) assert.deepEqual(result, invoke(previous.module, name, structuredClone(args)), 'Historical ' + name);
  assert.deepEqual(inputs, args, name + ' preserves inputs and metadata');
  checks++;
  return result;
}

function node(id: string, prevIds: string[] = [], nextIds: string[] = [], nodeType = 'FILTER', config: object = {}) {
  return { nodeId: id, nodeType, prevIds, nextIds, nodeConfig: { config }, metadata: { keep: ['x'] }, x: 99, y: 99 };
}

const baseField = {
  id: 'f',
  oid: 'sheet_f',
  name: 'Field',
  alias: 'Field',
  jdbcTypeId: 12,
  dataType: 'varchar',
  mdType: 2,
  isPk: false,
  isCheck: true,
  controlSetting: {},
  metadata: { keep: ['x'] },
};

async function compareAsync(name: string, args: unknown[], responses: Record<string, unknown>, expected?: unknown) {
  const run = async (old: boolean) => {
    const r = runtime(old);
    for (const [key, value] of Object.entries(responses)) r.responses.set(key, structuredClone(value));
    const inputs = structuredClone(args);
    const original = structuredClone(inputs);
    const value = await invoke(r.module, name, inputs);
    assert.deepEqual(inputs, original, name + ' async input preservation');
    return { value, requests: r.requests };
  };

  const result = await run(false);
  if (expected !== undefined) assert.deepEqual(result.value, expected, name);
  if (historical) assert.deepEqual(result, await run(true), 'Historical async ' + name);
  checks++;
  return result;
}

async function main() {
  compare('formatTaskNodeData', [[], undefined], []);
  for (let count = 1; count <= 7; count++) {
    const graph = Array.from({ length: count }, (_, i) =>
      node(
        'n' + i,
        i ? ['n' + (i - 1)] : [],
        i < count - 1 ? ['n' + (i + 1)] : [],
        i === 0 ? 'SOURCE_TABLE' : 'FILTER',
      ),
    );
    compare('formatTaskNodeData', [graph, 'n0']);
    compare('formatDataWithLine', [graph]);
    const laidOut = compare('formatTaskNodeData', [[...graph].reverse(), 'n0']);
    assert.ok(Array.isArray(laidOut));
    assert.ok(laidOut.every(item => Number.isFinite(item.x) && Number.isFinite(item.y)));
  }

  for (const kind of ['JOIN', 'UNION'])
    for (const reversed of [false, true]) {
      const graph = [
        node('a', [], ['j'], 'SOURCE_TABLE'),
        node('b', [], ['j'], 'SOURCE_TABLE'),
        node('j', reversed ? ['b', 'a'] : ['a', 'b'], ['z'], kind, { leftTableId: 'a', rightTableId: 'b' }),
        node('z', ['j'], [], 'DEST_TABLE'),
      ];
      compare('formatTaskNodeData', [graph, 'a']);
      compare('formatDataWithLine', [graph]);
    }

  compare('formatTaskNodeData', [
    [node('a', [], ['b', 'c']), node('b', ['a'], ['d']), node('c', ['a'], ['d']), node('d', ['b', 'c'])],
    'a',
  ]);
  const lines = compare('formatDataWithLine', [[node('a', [], ['b']), node('b', ['a'])]]);
  assert.ok(Array.isArray(lines));
  assert.equal(lines[0].pathIds.length, 2, 'Keep historical duplicate edge ordering');
  const raw = [node('a')];
  const laidOut = invoke(current.module, 'formatTaskNodeData', [raw, 'a']);
  assert.ok(Array.isArray(laidOut));
  assert.equal(laidOut[0].metadata, raw[0]?.metadata, 'Opaque metadata identity');
  for (const jdbcTypeId of [
    -7,
    -6,
    -5,
    -1,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    12,
    16,
    91,
    92,
    93,
    2013,
    2014,
    999,
    null,
    undefined,
  ]) {
    compare('formatControls', [[{ ...baseField, jdbcTypeId }]]);
    compare('isTimeTypes', [{ jdbcTypeId }]);
    compare('getDefaultAggregate', [jdbcTypeId]);
    compare('getTimeGroupDropData', [jdbcTypeId]);
    for (const count of [false, true]) compare('getAggregateData', [jdbcTypeId, count]);
  }

  for (const aggFuncType of ['COUNT', 'CUR_HOUR', 'HOUR_FOR_TIME', 'missing', undefined])
    compare('getAggData', [{ aggFuncType }]);
  for (const mdType of [2, 26, 27, 29])
    for (const usertype of ['1', '2']) {
      compare('formatFieldsByType', [[{ ...baseField, mdType, controlSetting: { advancedSetting: { usertype } } }]]);
    }

  compare('formatFieldsByType', [[{ ...baseField, mdType: 26, oid: 'sheet_f_pName' }]]);
  compare('setFeildAlias', [[baseField, { ...baseField, id: 'other' }, { ...baseField, id: 'last', alias: 'Other' }]]);
  compare('setFeildAlias', [
    [
      { ...baseField, alias: undefined },
      { ...baseField, alias: undefined, id: 'other' },
    ],
  ]);
  const fieldPairs = [
    { leftField: baseField, resultField: baseField },
    { rightField: { ...baseField, id: 'other' }, resultField: { ...baseField, id: 'other', isCheck: true } },
  ];
  for (const checked of [false, true]) compare('setAllUnionFieldsCheck', [fieldPairs, checked]);
  const left = {
    ...node('left'),
    nodeConfig: { fields: [baseField, { ...baseField, id: 'left-number', alias: 'Number', jdbcTypeId: 4 }] },
  };
  const right = {
    ...node('right'),
    nodeConfig: {
      fields: [
        { ...baseField, id: 'right' },
        { ...baseField, id: 'right-number', alias: 'Number', jdbcTypeId: 12 },
      ],
    },
  };
  compare('getUnionFeids', [
    [{ ...baseField, isCheck: true }],
    [left, right],
    node('union', [], [], 'UNION', { leftTableId: 'left', rightTableId: 'right' }),
  ]);
  for (const dsType of ['MYSQL', 'MING_DAO_YUN'])
    compare('hsMorePkControl', [
      {
        ...left,
        nodeConfig: {
          fields: [
            { ...baseField, isPk: true },
            { ...baseField, id: 'p2', isPk: true },
          ],
        },
      },
      [node('s', [], [], 'SOURCE_TABLE'), node('d', [], [], 'DEST_TABLE', { dsType })],
    ]);
  for (const kind of ['SOURCE_TABLE', 'DEST_TABLE', 'JOIN', 'UNION', 'FILTER', 'AGGREGATE']) {
    compare('getNodeName', [
      { datasources: [{ id: 'source', name: 'Database' }] },
      { ...node('n', [], [], kind, { datasourceId: 'source', dsType: 'MYSQL' }), name: 'Node' },
    ]);
  }

  const mapping = [{ sourceField: baseField, destField: { ...baseField, id: null } }];
  const matched = { f: [{ typeName: 'VARCHAR', mdType: 2, dataType: 12, maxLength: 255, defaultScale: 0 }] };

  for (const cached of [true, false])
    for (const isDestAppType of [false, true])
      for (const isSetDefaultFields of [false, true]) {
        await compareAsync(
          'setFieldsMappingDefaultData',
          [
            {
              initMapping: mapping,
              sourceFields: [baseField],
              destFields: [baseField],
              dataDestType: 'MYSQL',
              isSourceAppType: false,
              isDestAppType,
              isSetDefaultFields,
              ...(cached ? { matchedTypes: matched } : {}),
            },
          ],
          { datasourcefieldsDataTypeMatch: { matchedTypes: matched } },
        );
      }

  for (const matchedTypes of [undefined, null, {}])
    await compareAsync(
      'setFieldsMappingDefaultData',
      [{ initMapping: mapping, sourceFields: [baseField], isDestAppType: false }],
      { datasourcefieldsDataTypeMatch: { matchedTypes } },
    );
  for (const dsType of ['MYSQL', 'HANA'])
    for (const response of [[baseField], null, {}])
      await compareAsync(
        'getFields',
        [
          {
            node: node('n', [], [], 'SOURCE_TABLE', {
              dsType,
              tableName: 'table',
              dbName: 'db',
              schema: 'schema',
              dataDestId: 'source',
            }),
            projectId: 'project',
            destType: 'MYSQL',
          },
        ],
        { datasourcegetTableFields: response },
      );
  for (const isGetDest of [false, true])
    for (const isDestAppType of [false, true])
      await compareAsync(
        'getFields',
        [
          {
            node: node('n', [], [], 'SOURCE_TABLE', { dsType: 'MING_DAO_YUN', workSheetId: 'sheet' }),
            isGetDest,
            isDestAppType,
            isSourceAppType: true,
            withRowId: true,
          },
        ],
        {
          GetWorksheetInfo: {
            template: {
              controls: [
                { controlId: 'rowid', controlName: 'ID', type: 2 },
                { controlId: 'text', controlName: 'Title', type: 2, advancedSetting: {} },
              ],
            },
          },
          datasourcefillJdbcType: [baseField],
        },
      );
  await compareAsync(
    'getFields',
    [{ node: node('n', [], [], 'SOURCE_TABLE', { dsType: 'MING_DAO_YUN', workSheetId: 'sheet' }) }],
    { GetWorksheetInfo: undefined },
    [],
  );
  await compareAsync(
    'getNodeInfo',
    ['project', 'flow', 'node'],
    { taskFlowgetNodeInfo: { metadata: 'preserve' } },
    { metadata: 'preserve' },
  );
  // Malformed graph edges terminate without deleting fields or creating invalid coordinates.
  for (const graph of [
    [node('a', [], ['a'])],
    [node('a', ['b'], ['b']), node('b', ['a'], ['a'])],
    [node('a', [], ['missing'])],
  ]) {
    const output = invoke(current.module, 'formatTaskNodeData', [graph, 'a']);
    assert.ok(Array.isArray(output));
    assert.equal(output.length, graph.length);
    assert.ok(output.every(n => n.x === undefined || Number.isFinite(n.x)));
  }

  const missing = invoke(current.module, 'formatTaskNodeData', [[node('a')], 'missing']);
  assert.ok(Array.isArray(missing));
  assert.equal(missing[0].x, undefined);
  assert.throws(() => invoke(connectorBoundary, 'syncFields', [[{ name: 2 }]]), TypeError);
  console.log(
    `Task canvas graphs, fields, aliases, unions and actual API producers passed (${checks} cases${historical ? ' with historical comparison' : ''})`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
