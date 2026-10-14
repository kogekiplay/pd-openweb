const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const { transformSync } = require('../../../../scripts/spec-harness.ts');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../../../..');
const relative = 'src/pages/widgetConfig/util/widgets.ts';

function load(source: string, imports: Record<string, unknown>): Record<string, unknown> {
  const output: { exports: Record<string, unknown> } = { exports: {} };
  const code = transformSync(source, {
    filename: path.join(root, relative),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', code)(output, output.exports, (name: string) => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error('Unexpected dependency: ' + name);
  });
  return output.exports;
}

// Use the producer's actual constants and helper bodies in both current and historical modules.
const config = fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/index.ts'), 'utf8');
const drag = fs.readFileSync(path.join(root, 'src/pages/widgetConfig/config/Drag.ts'), 'utf8');
const util = fs.readFileSync(path.join(root, 'src/pages/widgetConfig/util/index.ts'), 'utf8');
function declaration(source: string, name: string): string {
  const start = source.indexOf('export const ' + name + ' =');
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n};', start);
  assert.ok(end >= 0, name);
  return source.slice(start, end + 3);
}
const helpers = load(
  'import _ from "lodash"; const { includes, get } = _;\n' +
    declaration(util, 'isSheetDisplay') +
    '\n' +
    declaration(util, 'getCurrentRowSize'),
  { lodash },
);
const fullLine = config.match(/export const FULL_LINE_CONTROL = (\[[^;]+\]);/)?.[1];
const wholeSize = drag.match(/export const WHOLE_SIZE = (\d+);/)?.[1];
assert.ok(fullLine && wholeSize);
const imports = {
  lodash,
  'immutability-helper': require('immutability-helper'),
  '../config': { FULL_LINE_CONTROL: JSON.parse(fullLine) },
  '../config/Drag': { WHOLE_SIZE: Number(wholeSize) },
  './index': helpers,
};
const current = load(fs.readFileSync(path.join(root, relative), 'utf8'), imports);
const before = process.env['WIDGETS_BEFORE_REV'];
const historical = before
  ? load(cp.execFileSync('git', ['show', before + ':' + relative], { cwd: root, encoding: 'utf8' }), imports)
  : undefined;
function invoke(module: Record<string, unknown>, name: string, ...args: unknown[]): unknown {
  const fn = module[name];
  if (typeof fn !== 'function') throw new Error('Missing function: ' + name);
  return Reflect.apply(fn, undefined, args);
}
function check(name: string, args: unknown[], expected: unknown): void {
  assert.deepEqual(invoke(current, name, ...args), expected, name);
  if (historical) assert.deepEqual(invoke(historical, name, ...args), expected, 'Historical ' + name);
}

check('isHaveGap', [undefined, { size: 12 }], true);
check('isHaveGap', [null, { size: 12 }], true);
check('isHaveGap', [[], { size: 12 }], true);
check('isHaveGap', [[{ size: 8 }], { size: 4 }], true);
check('isHaveGap', [[{ size: 8 }], { size: 5 }], false);
check('isHaveGap', [[{ size: 8 }], {}], false);
const duplicate = [[{ controlId: 'a' }, { controlId: 'a' }], [{ controlId: 'a' }]];
check('getPathById', [duplicate, 'a'], [0, 0]);
check('getPathById', [duplicate, 'missing'], []);
check('getPathById', [[[{ size: 6 }]], undefined], [0, 0]);
check('getRowById', [duplicate, 'missing'], { row: undefined, rowIndex: undefined });
for (const [control, expected] of [
  [undefined, false],
  [{ type: 21 }, true],
  [{ type: 26 }, false],
  [{ type: 45, enumDefault: 3 }, true],
  [{ type: 29, advancedSetting: { showtype: '2' } }, true],
  [{ type: 29, advancedSetting: { showtype: '1' } }, false],
  [{ type: 30, sourceControl: { type: 30, sourceControl: { type: 34 } } }, true],
] as const)
  check('isFullLineControl', [control], expected);

for (let count = 1; count <= 4; count++) {
  const widgets = [
    Array.from({ length: count }, (_, i) => ({ controlId: String(i), size: 12 / count, title: 'Field ' + i })),
  ];
  const original = structuredClone(widgets);
  const result = invoke(current, 'changeWidgetSize', widgets, { controlId: '0', size: 5 });
  if (count < 4) {
    const expected = [widgets[0]?.map((item, index) => ({ ...item, size: index ? 7 / (count - 1) : 5 }))];
    assert.deepEqual(result, expected);
  } else assert.equal(result, widgets, 'Four-column rows keep their existing layout');
  assert.deepEqual(widgets, original, 'Width updates preserve the source and extra fields');
  if (historical)
    assert.deepEqual(result, invoke(historical, 'changeWidgetSize', widgets, { controlId: '0', size: 5 }));
}
const pair = [
  [
    { controlId: 'a', size: 6 },
    { controlId: 'b', size: 6 },
  ],
];
check(
  'changeWidgetSize',
  [pair, { controlId: 'a' }],
  [
    [
      { controlId: 'a', size: undefined },
      { controlId: 'b', size: Number.NaN },
    ],
  ],
);
assert.throws(() => invoke(current, 'changeWidgetSize', pair, { controlId: 'missing', size: 6 }), TypeError);
if (historical)
  assert.throws(() => invoke(historical, 'changeWidgetSize', pair, { controlId: 'missing', size: 6 }), TypeError);
const changed = invoke(current, 'updateWidgets', pair, 'a', { label: 'Updated' });
assert.deepEqual(changed, [
  [
    { controlId: 'a', size: 6, label: 'Updated' },
    { controlId: 'b', size: 6 },
  ],
]);
assert.deepEqual(pair, [
  [
    { controlId: 'a', size: 6 },
    { controlId: 'b', size: 6 },
  ],
]);
console.log(
  'Layout gaps, first matches, full-line recursion, width distribution, legacy undefined widths and immutability passed',
);
