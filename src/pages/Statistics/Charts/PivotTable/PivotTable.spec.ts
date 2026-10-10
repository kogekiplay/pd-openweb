const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generateCode = require('@babel/generator').default;
const lodash = require('lodash');
const { generate } = require('@ant-design/colors');
const { transformSync } = require('../../../../../scripts/spec-harness.ts');

interface StyleMap {
  [key: string]: string | number | boolean | undefined;
}

interface ReplaceColorOptions {
  pivotTableStyle: StyleMap;
  customPageConfig?: StyleMap;
  themeColor?: string;
  sourceType?: number;
}

interface PivotHelpers {
  replaceColor(options: ReplaceColorOptions): StyleMap;
}

const sourcePath = path.join(__dirname, 'index.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
let declaration: unknown;
traverse(ast, {
  ExportNamedDeclaration(path) {
    const node = path.node.declaration;
    if (
      node?.type === 'VariableDeclaration' &&
      node.declarations.some(item => item.id.type === 'Identifier' && item.id.name === 'replaceColor')
    ) {
      declaration = node;
    }
  },
});
assert.ok(declaration, 'the spec loads the actual replaceColor declaration');

const moduleLike: { exports: unknown } = { exports: {} };
const compiled = transformSync(`${generateCode(declaration as never).code}\nmodule.exports = { replaceColor };`, {
  filename: sourcePath,
}).code;
new Function('module', 'exports', '_', 'generate', 'isLightColor', compiled)(
  moduleLike,
  moduleLike.exports,
  lodash,
  generate,
  (color: string) => ['#fff', '#ffffff', '#fafafa'].includes(color.toLowerCase()),
);
const helpers = moduleLike.exports as PivotHelpers;

const base: StyleMap = {
  columnBgColor: 'themeColor',
  lineBgColor: 'LIGHT_COLOR',
  columnTextColor: 'DARK_COLOR',
  lineTextColor: 'LIGHT_COLOR',
  pivoTableColorIndex: 0,
};
const before = { ...base };
const themed = helpers.replaceColor({ pivotTableStyle: base, themeColor: '#1677ff', sourceType: 1 });
assert.equal(themed.columnBgColor, '#1677ff');
assert.equal(typeof themed.lineBgColor, 'string');
assert.equal(themed.columnTextColor, '#1677ff');
assert.deepEqual(base, before, 'color replacement clones style input');

const dark = helpers.replaceColor({
  pivotTableStyle: { columnBgColor: '#111', lineBgColor: '#222' },
  customPageConfig: {
    pivoTableColor: '#fff',
    pivoTableColorIndex: 2,
    pageStyleType: 'dark',
    widgetBgColor: '#000',
  },
  themeColor: '#1677ff',
});
assert.equal(dark.columnBgColor, '#fff');
assert.equal(dark.lineBgColor, '#fff');
assert.equal(dark.evenBgColor, '#000');
assert.equal(dark.evenTextColor, '#ffffffcc');

const sourceTypeTheme = helpers.replaceColor({
  pivotTableStyle: { columnBgColor: 'themeColor', lineBgColor: 'themeColor' },
  sourceType: 2,
});
assert.equal(sourceTypeTheme.columnBgColor, '#ffffffcc');
assert.equal(sourceTypeTheme.lineBgColor, 'themeColor');

assert.doesNotThrow(() =>
  helpers.replaceColor({
    pivotTableStyle: { columnBgColor: 3, lineBgColor: false },
    customPageConfig: { pivoTableColorIndex: 'invalid' },
  }),
);
console.log('PivotTable replaceColor behavior and finite style boundary passed');
