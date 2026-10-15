const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const { transformSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../../../..');
const target = 'src/pages/widgetConfig/util/drag.ts';
const testGlobals = globalThis as unknown as Record<string, unknown>;
testGlobals['_l'] = (text: string) => text;

function load(source: string, imports: Record<string, unknown>): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformSync(source, { filename: target, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  new Function('module', 'exports', 'require', code)(output, output.exports, (name: string) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error('Unexpected dependency: ' + name);
  });
  return output.exports;
}

// Read exact producer declarations, so width defaults, system types and saved row positions are not mocked.
function declarations(source: string, names: string[]): string {
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const found: string[] = [];

  for (const name of names) {
    const statement = ast.program.body.find(statement => {
      const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
      return node?.type === 'FunctionDeclaration'
        ? node.id?.name === name
        : node?.type === 'VariableDeclaration' &&
            node.declarations.some(d => d.id.type === 'Identifier' && d.id.name === name);
    });
    assert.ok(statement?.start !== undefined && statement?.end !== undefined, name);
    const raw = source.slice(statement.start, statement.end);
    found.push(raw.startsWith('export ') ? raw : 'export ' + raw);
  }

  return found.join('\n');
}

const dragConfig = load(fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/Drag.ts'), 'utf8'), {});
const score = load(fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/score.ts'), 'utf8'), { lodash });
const config = load(fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/widget.ts'), 'utf8'), {
  lodash,
  uuid: { v4: () => 'fixture-option-id' },
  './Drag': dragConfig,
  './score': score,
});
const index = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf8');
const indexImports = 'import _ from "lodash"; const { get, includes, keys } = _;\n';
const helpers = load(
  indexImports +
    'import { DEFAULT_DATA, WIDGETS_TO_API_TYPE_ENUM } from "../config/widget";\n' +
    'import { WHOLE_SIZE } from "../config/Drag";\n' +
    declarations(index, [
      'enumObj',
      'enumWidgetType',
      'getDefaultSizeByType',
      'getDefaultSizeByData',
      'genWidgetRowAndCol',
      'isSheetDisplay',
      'getCurrentRowSize',
    ]),
  {
    lodash,
    '../config/widget': config,
    '../config/Drag': dragConfig,
  },
);
const configIndex = fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/index.ts'), 'utf8');
const sharedConfig = load(declarations(configIndex, ['FULL_LINE_CONTROL']), {});
const widgets = load(fs.readFileSync(path.join(__dirname, 'widgets.ts'), 'utf8'), {
  lodash,
  'immutability-helper': require('immutability-helper'),
  '../config': sharedConfig,
  '../config/Drag': dragConfig,
  './index': helpers,
});
const imports = {
  '.': helpers,
  lodash,
  'immutability-helper': require('immutability-helper'),
  '../config/Drag': dragConfig,
  './widgets': widgets,
};
const current = load(fs.readFileSync(path.join(root, target), 'utf8'), imports);
const before = process.env['DRAG_BEFORE_REV'];
const historical = before
  ? load(
      cp.execFileSync('git', ['show', before + ':' + target], {
        cwd: root,
        encoding: 'utf8',
      }),
      imports,
    )
  : undefined;

function invoke(module: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
  const fn = module[name];
  if (typeof fn !== 'function') throw new Error('Missing function: ' + name);
  return Reflect.apply(fn, undefined, args);
}

function freeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
}

let checks = 0;

function compare(name: string, args: unknown[], expected?: unknown): unknown {
  const inputs = structuredClone(args);
  freeze(inputs);
  const result = invoke(current, name, ...inputs);
  if (expected !== undefined) assert.deepEqual(result, expected, name);
  if (historical) assert.deepEqual(result, invoke(historical, name, ...structuredClone(args)), 'Historical ' + name);
  assert.deepEqual(inputs, args, name + ' preserves input');
  checks++;
  return result;
}

const a = { controlId: 'a', type: 2, size: 6, extra: 'retain' };
const b = { controlId: 'b', type: 3, size: 6 };
const c = { controlId: 'c', type: 4, size: 12 };
const grid = [[a, b], [c]];
compare('batchRemoveItems', [grid, [b]], [[a], [c]]);
compare('insertNewLine', [{ widgets: grid, srcItem: b, targetIndex: 0 }], [[b], [a], [c]]);
compare(
  'insertToRowEnd',
  [{ widgets: grid, srcPath: [1, 0], srcItem: c, targetIndex: 0 }],
  [
    [
      { ...a, size: 4 },
      { ...b, size: 4 },
      { ...c, size: 4 },
    ],
  ],
);
// The pending implementation left [] at the start and assigned saved rows 1 and 2.
compare(
  'resetDisplay',
  [{ widgets: [[a], [c]], srcPath: [0, 0], srcItem: a, targetIndex: 1 }],
  [[{ ...a, row: 0, col: 0 }], [{ ...c, row: 1, col: 0 }]],
);

for (let width = 1; width <= 4; width++) {
  const sourceRow = Array.from({ length: width }, (_, col) => ({
    controlId: 'field-' + col,
    type: col % 2 ? 14 : 2,
    size: 12 / width,
    extra: ['retain', col],
  }));
  const layout = [[{ ...a, controlId: 'top' }], sourceRow, [{ ...c, controlId: 'bottom' }]];

  for (const [sourceRowIndex, row] of layout.entries()) {
    for (const [sourceCol, item] of row.entries()) {
      for (let targetIndex = 0; targetIndex <= layout.length; targetIndex++) {
        compare('insertNewLine', [{ widgets: layout, srcItem: item, targetIndex }]);
        compare('resetDisplay', [
          { widgets: layout, srcPath: [sourceRowIndex, sourceCol], srcItem: item, targetIndex },
        ]);
      }

      for (const [targetIndex, targetRow] of layout.entries()) {
        compare('insertToRowEnd', [
          { widgets: layout, srcPath: [sourceRowIndex, sourceCol], srcItem: item, targetIndex },
        ]);
        for (let col = 0; col <= targetRow.length; col++) {
          for (const location of ['left', 'right']) {
            compare('insertToCol', [
              {
                widgets: layout,
                srcPath: [sourceRowIndex, sourceCol],
                srcItem: item,
                dropPath: [targetIndex, col],
                location,
              },
            ]);
            compare('insertControlInSameLine', [
              { widgets: layout, srcItem: { ...item, controlId: 'new' }, dropPath: [targetIndex, col], location },
            ]);
          }
        }
      }
    }
  }
}

const tab = { controlId: 'tab', type: 52, size: 12 };
const child = { ...a, controlId: 'child', sectionId: 'tab' };
const tabGrid = [[a], [tab], [child, { ...b, controlId: 'second', sectionId: 'tab' }], [c]];
for (const targetIndex of [0, 1, 3, 4]) compare('insertNewLine', [{ widgets: tabGrid, srcItem: tab, targetIndex }]);
compare('batchRemoveItems', [tabGrid, [tab, child]]);
for (const type of ['DISPLAY_ITEM', 'DISPLAY_TAB', 'DISPLAY_LIST_TAB']) {
  compare('isFullLineDragItem', [{ type, data: { type: 52 } }], true);
  compare('isFullLineDragItem', [{ type, data: a }], false);
}

for (const type of ['LIST_ITEM', 'LIST_TAB']) {
  compare('isFullLineDragItem', [{ type, enumType: 'SUB_LIST' }], true);
  compare('isFullLineDragItem', [{ type, enumType: 'TEXT' }], false);
  compare('isFullLineDragItem', [{ type }], false);
}

// Malformed paths must never default to removing the first field, or remove a source without inserting it.
for (const srcPath of [[], [0], [-1, 0], [0, 99], [99, 0]]) {
  for (const name of ['resetDisplay', 'insertToRowEnd', 'insertToCol']) {
    const input = structuredClone(grid);
    assert.equal(
      invoke(current, name, {
        widgets: input,
        srcPath,
        srcItem: a,
        targetIndex: 0,
        dropPath: [0, 0],
        location: 'left',
      }),
      input,
      name + ' invalid source',
    );
    assert.deepEqual(input, grid);
  }
}

for (const dropPath of [[], [-1, 0], [99, 0], [0, -1], [0, NaN]]) {
  const input = structuredClone(grid);
  assert.equal(
    invoke(current, 'insertToCol', { widgets: input, srcPath: [0, 0], srcItem: a, dropPath, location: 'left' }),
    input,
    'Invalid drop preserves the source field',
  );
}

console.log(
  `Widget drag layouts, widths, saved row positions and immutability passed (${checks} cases${historical ? ' with historical comparison' : ''})`,
);
