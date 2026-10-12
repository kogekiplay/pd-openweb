const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');
const harness: import('../../../../../scripts/spec-harness').SpecHarness = require('../../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../../..');
const before = process.env['BUILDER_PANELS_BEFORE_REV'];
Reflect.set(globalThis, '_l', (text: string, ...values: unknown[]) =>
  text.replace(/%([0-9]+)/g, (_, n: string) => String(values[Number(n)] ?? '')),
);

interface FixtureProps {
  children?: import('react').ReactNode;
  [key: string]: unknown;
}
function fixtureElement(base: string | import('react').ComponentType<FixtureProps>) {
  return function Fixture(props: FixtureProps) {
    const attrs: Record<string, string> = {};
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== 'string') continue;
      if (key.startsWith('$')) attrs['data-' + key.slice(1).toLowerCase()] = value;
      else if (['title', 'icon', 'url', 'fill'].includes(key)) attrs[key] = value;
    }
    return React.createElement(base, attrs, props.children);
  };
}
const styledFactory =
  (base: string | import('react').ComponentType<FixtureProps>) =>
  (_strings: TemplateStringsArray, ..._expressions: unknown[]) =>
    fixtureElement(base);
const styled = new Proxy(styledFactory, { get: (_target, key) => styledFactory(String(key)) });
const icon = (props: FixtureProps) => React.createElement('i', { 'data-icon': props['icon'] });
const svg = (props: FixtureProps) =>
  React.createElement('span', { 'data-svg': props['url'], 'data-fill': props['fill'] });
const modules = new Map<string, Record<string, unknown>>();
function source(relative: string, revision?: string): string {
  return revision
    ? cp.execFileSync('git', ['show', revision + ':' + relative], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, relative), 'utf8');
}
function load(relative: string, revision?: string, override?: string): Record<string, unknown> {
  const key = relative + ':' + (revision || '') + ':' + (override || '');
  const previous = modules.get(key);
  if (previous) return previous;
  const file = path.join(root, relative);
  const result: { exports: unknown } = { exports: {} };
  const transformed = harness.transformSync(override || source(relative, revision), { filename: file });
  assert.ok(transformed?.code);
  new Function('module', 'exports', 'require', '__filename', '__dirname', transformed.code)(
    result,
    result.exports,
    (name: string): unknown => {
      if (name === 'styled-components') return { __esModule: true, default: styled };
      if (name === 'ming-ui') return { Icon: icon, SvgIcon: svg };
      if (name === './_shared')
        return {
          PanelWrap: fixtureElement('section'),
          CardEditButton: (props: FixtureProps) =>
            React.createElement('button', { 'data-module': props['moduleLabel'], 'data-card': props['cardName'] }),
          ...load('src/components/Agent/AppBuilder/panels/compactValue.ts'),
        };
      if (name.startsWith('.')) {
        const candidate = path.resolve(path.dirname(file), name);
        const actual = ['.ts', '.tsx', ''].map(ext => candidate + ext).find(p => fs.existsSync(p));
        if (!actual) throw new Error('Missing fixture dependency: ' + name);
        return load(path.relative(root, actual));
      }
      return require(name);
    },
    file,
    path.dirname(file),
  );
  assert.ok(result.exports && typeof result.exports === 'object');
  const exports = result.exports;
  const values = Object.fromEntries(Object.entries(exports));
  modules.set(key, values);
  return values;
}
function invoke(module: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
  const fn = module[name];
  if (typeof fn !== 'function') throw new TypeError('Missing actual function ' + name);
  return Reflect.apply(fn, undefined, args);
}
function render(name: string, props: FixtureProps, revision?: string): string {
  const tree = invoke(load('src/components/Agent/AppBuilder/panels/' + name + '.tsx', revision), 'default', props);
  assert.ok(React.isValidElement(tree));
  return renderToStaticMarkup(tree);
}
const cases: Array<[string, FixtureProps]> = [
  [
    'RolesPanel',
    {
      roles: [
        {
          name: '员工',
          roleId: 'r1',
          roleScope: 'externalPortal',
          description: '提交工单',
          permissions: ['客户(worksheet)', '概览(customPage)', '助手(aiAssistant)', '其它'],
        },
      ],
    },
  ],
  ['RolesPanel', { roles: [{ roleName: '经理', roleId: 7 }] }],
  [
    'CustomActionsPanel',
    {
      customActions: [
        {
          worksheet: '客户',
          actions: [
            { name: '更新', type: 'updateCurrentRecord', targetWorksheet: '客户', description: '更新当前记录' },
            { name: '审批', type: 'triggerWorkflow', intentHints: [{ label: '校验' }, { label: '通知' }] },
          ],
        },
      ],
    },
  ],
  ['CustomActionsPanel', { customActions: [{ actions: [{ type: 'futureAction', name: '未来动作' }] }] }],
  ['CustomActionsPanel', { customActions: [] }],
  [
    'WorkflowsPanel',
    {
      workflows: [
        {
          name: '客户同步',
          trigger: { type: 'worksheet_event', source: '客户', label: '新增' },
          intentHints: [{ label: '推送' }],
        },
        { name: '定时任务', trigger: { type: 'schedule', label: '每天' } },
      ],
    },
  ],
  [
    'WorkflowsPanel',
    {
      workflows: [
        { name: '到期', trigger: { type: 'date_field', source: '订单', label: '到期时间' } },
        { name: '点击', trigger: { type: 'custom_action' } },
        { name: '未来', trigger: { type: 'futureTrigger' } },
      ],
    },
  ],
  [
    '_appItemRenderer',
    {
      items: [
        {
          type: 'worksheet',
          name: '客户',
          groupName: '业务',
          fields: ['名称(Text)', '分类(Relation:分类)'],
          views: '全部(List), 按状态(Board)',
        },
        { type: 'worksheet', title: '分类', group: '业务', fields: '状态(SingleSelect), 金额(Formula(a,b))' },
      ],
    },
  ],
  [
    '_appItemRenderer',
    {
      items: [
        { type: 'dashboard', dashboardName: '经营', charts: '总量(NumberChart), 趋势(LineChart)' },
        {
          type: 'workspace',
          name: '工作台',
          components: ['筛选(Filter)', '地图(WorldMap)', '按钮(Button)', '未来(Future)'],
        },
      ],
      fallbackType: 'dashboard',
    },
  ],
  [
    '_appItemRenderer',
    {
      items: [{ type: 'aiAssistant', assistantName: '问答', icon: 'sys_01', color: '#123456', description: '助手' }],
      fallbackType: 'aiAssistant',
    },
  ],
  [
    '_appItemRenderer',
    { items: [{}, { name: '部分内容' }, { type: 'futureItem', name: '未知类型' }], fallbackType: 'dashboard' },
  ],
];
for (const [name, props] of cases) {
  const snapshot = JSON.stringify(props);
  const actual = render(name, props);
  if (before) assert.equal(actual, render(name, props, before), name);
  assert.equal(JSON.stringify(props), snapshot, 'Rendering must not mutate input');
}
for (const [name, prop] of [
  ['RolesPanel', 'roles'],
  ['CustomActionsPanel', 'customActions'],
  ['WorkflowsPanel', 'workflows'],
  ['_appItemRenderer', 'items'],
]) {
  assert.ok(name && prop);
  assert.doesNotThrow(() =>
    render(name, {
      [prop]: [
        null,
        [],
        1,
        {
          name: { wrong: true },
          permissions: [{ toString: 0 }],
          actions: [null],
          trigger: null,
          fields: [{ toString: 0 }],
        },
      ],
    }),
  );
}
assert.match(
  render('WorkflowsPanel', { workflows: [{ name: '未知触发', trigger: { type: '__proto__' } }] }),
  /__proto__/,
);
assert.match(
  render('_appItemRenderer', { items: [{ name: '原型字段', type: 'worksheet', fields: '字段(constructor)' }] }),
  /字段/,
);
const models = load('src/components/Agent/AppBuilder/panels/panelModels.ts');
assert.equal(invoke(models, 'panelConfig', { valid: 1 }, 'constructor'), undefined);
assert.equal(invoke(models, 'panelConfig', { valid: 1 }, 'valid'), 1);
const markdown = load('src/components/Agent/AppBuilder/planExport.ts');
const normalExport = {
  files: {
    '/plan.md': { content: '# 应用\n\n说明' },
    '/jsons/roles.json': { parsed: cases[0]?.[1]['roles'] },
    '/jsons/worksheets.json': { parsed: cases[7]?.[1]['items'] },
    '/jsons/custom-pages.json': { parsed: cases[8]?.[1]['items'] },
    '/jsons/custom-actions.json': { parsed: cases[2]?.[1]['customActions'] },
    '/jsons/workflows.json': { parsed: cases[5]?.[1]['workflows'] },
    '/jsons/ai-assistants.json': { parsed: cases[9]?.[1]['items'] },
  },
  now: new Date('2026-10-13T00:00:00Z'),
};
if (before)
  assert.equal(
    invoke(markdown, 'buildPlanMarkdown', normalExport),
    invoke(load('src/components/Agent/AppBuilder/planExport.ts', before), 'buildPlanMarkdown', normalExport),
    'Normal Markdown export keeps historical output',
  );
const exportArgs = {
  files: {
    '/plan.md': { content: '# 应用\n\n说明' },
    '/jsons/worksheets.json': {
      parsed: [
        { name: 'constructor', type: 'worksheet', fields: '名称(Text)' },
        { name: '__proto__', type: 'worksheet' },
      ],
    },
    '/jsons/custom-actions.json': {
      parsed: [{ worksheet: '__proto__', actions: [{ name: '更新', type: 'updateCurrentRecord' }] }],
    },
  },
  now: new Date('2026-10-13T00:00:00Z'),
};
const exported = invoke(markdown, 'buildPlanMarkdown', exportArgs);
assert.equal(typeof exported, 'string');
assert.ok(String(exported).includes('constructor') && String(exported).includes('更新'));
if (before) {
  assert.throws(
    () => render('RolesPanel', { roles: [null] }, before),
    TypeError,
    'Old renderer crashed on null list items',
  );
  assert.throws(
    () => invoke(load('src/components/Agent/AppBuilder/planExport.ts', before), 'buildPlanMarkdown', exportArgs),
    TypeError,
    'Old action lookup resolved inherited constructor',
  );
}
console.log(
  JSON.stringify({
    historicalRenderCases: cases.length,
    historicalAB: !!before,
    malformedLists: true,
    immutableInputs: true,
    prototypeNamesAndExport: true,
  }),
);
