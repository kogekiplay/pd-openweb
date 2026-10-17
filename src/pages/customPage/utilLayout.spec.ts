const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { createHash }: typeof import('node:crypto') = require('node:crypto');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const { parser, transformSync, ROOT } = require('../../../scripts/spec-harness.ts');
const lodash = require('lodash');

const filename = path.join(__dirname, 'util.ts');
const original = execFileSync('git', ['show', 'fc6676e67:src/pages/customPage/util.ts'], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.equal(
  createHash('sha256').update(original).digest('hex'),
  '9a2abc15c867d7e953dc6b1c187d2164bdbf4511893d1136f85b9c1513edca1c',
);

interface Helpers {
  enumWidgetType: Record<string, unknown>;
  getEnumType: (type: unknown) => unknown;
  getIndexById: (options: unknown) => unknown;
  getDefaultLayout: (options: unknown) => unknown;
  getIconByType: (type: unknown) => unknown;
  syncThemeConfig: (config: unknown, mode?: unknown) => unknown;
  defaultConfig: Record<string, unknown>;
}

// Extract the real declarations, keeping their bodies verbatim and using real lodash.
// Unrelated UI, aliases and assets are never imported, and no helper is reimplemented.
function load(source: string): Helpers {
  function extract(text: string, names: string[]): string[] {
    const ast = parser.parse(text, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    return names.map(name => {
      const statement = ast.program.body.find(item => {
        const value = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
        return (
          (value?.type === 'VariableDeclaration' && value.declarations.some(entry => entry.id.name === name)) ||
          (value?.type === 'FunctionDeclaration' && value.id?.name === name && value.body)
        );
      });
      assert.ok(statement && statement.start != null && statement.end != null, 'Missing actual declaration: ' + name);
      return text.slice(statement.start, statement.end).replace(/^export /, '');
    });
  }

  function sibling(relative: string): string {
    return source === original
      ? execFileSync('git', ['show', `fc6676e67:src/pages/customPage/${relative}`], { cwd: ROOT, encoding: 'utf8' })
      : fs.readFileSync(path.join(__dirname, relative), 'utf8');
  }

  const declarations = [
    ...extract(sibling('enum.ts'), ['widgets', 'containerWidgets']),
    ...extract(sibling('components/ConfigSideWrap/util.ts'), ['defaultTitleStyles']),
    ...extract(sibling('components/ConfigSideWrap/defaultConfig.ts'), ['defaultConfig']),
    ...extract(source, [
      'enumObj',
      'enumWidgetType',
      'getEnumType',
      'getIndexById',
      'getDefaultLayout',
      'getIconByType',
      'syncThemeConfig',
    ]),
  ];
  const exports = {} as Helpers;
  const code = transformSync(
    declarations.join('\n') +
      '\nObject.assign(exports, { enumWidgetType, getEnumType, getIndexById, getDefaultLayout, getIconByType, syncThemeConfig, defaultConfig });',
    { filename },
  ).code;
  new Function('exports', '_', 'maxBy', 'get', 'window', 'Date', '_l', code)(
    exports,
    lodash,
    require('lodash/maxBy'),
    lodash.get,
    {},
    { now: () => 314159 },
    (text: string) => text,
  );
  return exports;
}

const old = load(original);
const current = load(fs.readFileSync(filename, 'utf8'));
assert.deepEqual(current.enumWidgetType, old.enumWidgetType);
for (const [name, value] of Object.entries(current.enumWidgetType)) {
  if (typeof value === 'number') assert.equal(current.enumWidgetType[String(value)], name);
}

const kinds = [undefined, null, '', 'unknown', 0, 99, ...Object.values(old.enumWidgetType)];
for (const kind of kinds) assert.deepEqual(current.getEnumType(kind), old.getEnumType(kind));
for (const kind of kinds) assert.deepEqual(current.getIconByType(kind), old.getIconByType(kind));
assert.deepEqual(current.defaultConfig, old.defaultConfig);

const populations = [
  [],
  [
    { id: 'a', type: 'button', mobile: { layout: { y: 8, h: 2 } } },
    { id: 'b', type: 5, mobile: { layout: { y: 10, h: 3 } } },
  ],
  [
    { uuid: 'a', type: 'button', y: 100, h: 2, mobile: { layout: { y: 8, h: 99 } } },
    { uuid: 'b', type: 5, y: 20, h: 3, mobile: { layout: { y: 10, h: 99 } } },
  ],
];

let layoutsCompared = 0;

for (const components of populations) {
  for (const type of kinds) {
    for (const layoutType of [undefined, 'web', 'mobile', 'tablet']) {
      for (const index of [undefined, 0, 1, 4]) {
        for (const titleVisible of [undefined, false, true]) {
          const options = { components, type, layoutType, index, titleVisible };
          assert.deepEqual(current.getDefaultLayout(options), old.getDefaultLayout(options), JSON.stringify(options));
          layoutsCompared += 1;
        }
      }
    }
  }
}

assert.deepEqual(current.getDefaultLayout({ type: 'view' }), { x: 0, y: Infinity, w: 48, h: 10, minW: 2, minH: 6 });
assert.equal(
  Reflect.get(Object(current.getDefaultLayout({ components: populations[2], index: 0, layoutType: 'mobile' })), 'y'),
  23,
  'Historical mobile placement reads top-level y/h from the widget selected by mobile.layout.y',
);
assert.equal(current.getDefaultLayout({ layoutType: 'tablet' }), undefined);

let lookupsCompared = 0;

for (const components of [undefined, ...populations]) {
  for (const component of [{}, { id: 'a' }, { uuid: 'b' }, { id: '', uuid: 'a' }, { id: 'absent', uuid: 'b' }]) {
    assert.deepEqual(current.getIndexById({ components, component }), old.getIndexById({ components, component }));
    lookupsCompared += 1;
  }
}

let themesCompared = 0;

for (const config of [
  {},
  current.defaultConfig,
  { pageStyleType: 'dark' },
  { pageStyleType: 'light', lightPageBgColor: '', darkPageBgColor: '#123456', pivoTableColorIndex: 0 },
  { titleStyles: { fontSize: 20, color: '#000', fontBold: false }, pivoTableColorIndex: undefined },
  { titleStyles: null, pivoTableColorIndex: null },
  JSON.parse('{"__proto__":{"metadata":true},"extra":{"preserved":true}}'),
]) {
  for (const mode of [undefined, 'light', 'dark', 'sepia']) {
    const before = structuredClone(config);
    const expected = old.syncThemeConfig(config, mode);
    const actual = current.syncThemeConfig(config, mode);
    assert.deepEqual(actual, expected);
    assert.equal(actual === config, expected === config, 'Preserve no-op config identity');
    assert.deepEqual(config, before, 'Theme synchronization does not mutate input');
    themesCompared += 1;
  }
}

console.log(
  `custom page actual helpers: ${layoutsCompared} layouts, ${lookupsCompared} lookups, ${themesCompared} themes, defaults/icons and bidirectional enums match history`,
);

// Compare the actual changed call expressions in the UI consumers as well.
function membershipCalls(source: string, variant: 'old' | 'current'): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.property.name === 'includes'
    ) {
      const array = variant === 'old' ? node.callee.object : node.arguments[0];
      const target = variant === 'old' ? node.arguments[0] : node.arguments[1];

      if (array?.type === 'ArrayExpression' && target?.start != null && target.end != null) {
        const name = source.slice(target.start, target.end);

        if (['widgetType', 'componentType', 'c.type'].includes(name)) {
          const key = name + '|' + source.slice(array.start, array.end).replace(/\s/g, '');
          result.set(key, [...(result.get(key) || []), source.slice(node.start, node.end)]);
        }
      }
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }

  visit(tree.program);
  return result;
}

let consumerExpressions = 0;

for (const relative of [
  'components/WidgetContent/Tools/index.tsx',
  'components/WidgetContent/WidgetDisplay.tsx',
  'components/editWidget/view/Setting.tsx',
]) {
  const oldSource = execFileSync('git', ['show', `fc6676e67:src/pages/customPage/${relative}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const currentSource = fs.readFileSync(path.join(__dirname, relative), 'utf8');
  const before = membershipCalls(oldSource, 'old');
  const after = membershipCalls(currentSource, 'current');

  for (const [key, expressions] of after) {
    if (!before.has(key)) continue;
    for (const expression of expressions) {
      const oldCall = new Function(
        '_',
        'enumWidgetType',
        'widgetType',
        'componentType',
        'c',
        'return ' + before.get(key)?.[0],
      );
      const currentCall = new Function(
        '_',
        'enumWidgetType',
        'widgetType',
        'componentType',
        'c',
        'return ' + expression,
      );

      for (const value of [...kinds, NaN, Infinity, {}]) {
        const args = [lodash, current.enumWidgetType, value, value, { type: value }];
        assert.deepEqual(currentCall(...args), oldCall(...args), relative + ': ' + key);
      }

      consumerExpressions += 1;
    }
  }
}

assert.equal(consumerExpressions, 9, 'Every changed membership expression is compared with its historical source');
console.log(`custom page actual consumer expressions: ${consumerExpressions} membership expressions match history`);
