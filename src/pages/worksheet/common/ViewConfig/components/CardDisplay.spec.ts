/** Source-extracted CardDisplay response logic and actual local helpers. */
import type { Node } from '@babel/types';
import type { SpecHarness } from '../../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const types: typeof import('@babel/types') = require('@babel/types');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');
const lodash: typeof import('lodash') = require('lodash');
const source = fs.readFileSync(path.join(__dirname, 'CardDisplay.tsx'), 'utf8');
const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const key of types.VISITOR_KEYS[node.type] || []) {
    const value: unknown = Reflect.get(node, key);
    if (Array.isArray(value)) {
      for (const item of value) if (types.isNode(item)) walk(item, visit);
    } else if (types.isNode(value)) walk(value, visit);
  }
}
function slice(node: Node): string {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') throw new TypeError('missing source bounds');
  return source.slice(node.start, node.end);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function invoke(value: unknown, args: unknown[]): unknown {
  if (typeof value !== 'function') throw new TypeError('source callback is not callable');
  return Reflect.apply(value, undefined, args);
}
const helperNames = ['isVisible', 'excludeTitleControls', 'getDefaultShowControls'];
const helpers = new Map<string, string>();
const callbacks: Node[] = [];
const initializers: Node[] = [];
walk(ast, node => {
  if (types.isVariableDeclarator(node) && types.isIdentifier(node.id) && helperNames.includes(node.id.name)) {
    helpers.set(node.id.name, 'const ' + slice(node) + ';');
  }
  if (!types.isCallExpression(node)) return;
  if (types.isIdentifier(node.callee, { name: 'useState' }) && types.isObjectExpression(node.arguments[0])) initializers.push(node.arguments[0]);
  if (!types.isMemberExpression(node.callee) || !types.isIdentifier(node.callee.property, { name: 'then' })) return;
  const inner = node.callee.object;
  if (!types.isCallExpression(inner) || !types.isMemberExpression(inner.callee) ||
      !types.isIdentifier(inner.callee.property, { name: 'getWorksheetInfo' })) return;
  const cb = node.arguments[0];
  if (types.isArrowFunctionExpression(cb) || types.isFunctionExpression(cb)) callbacks.push(cb);
});
assert.equal(helpers.size, 3);
assert.equal(callbacks.length, 1);
assert.equal(initializers.length, 1);
const callbackNode = callbacks[0];
const initializer = initializers[0];
assert.ok(callbackNode && initializer);
const declarations = helperNames.map(name => helpers.get(name)).join('\n');
const callbackCode = harness.transformSync(declarations + '\nconst callback = (' + slice(callbackNode) + ');', {
  filename: 'card-response-fragment.ts', sourceType: 'script',
}).code;
function resolve(response: Record<string, unknown>): Record<string, unknown> {
  const patches: Record<string, unknown>[] = [];
  const setter = (patch: unknown): void => { assert.ok(record(patch)); patches.push(patch); };
  const factory = new Function('_', 'setInfo', callbackCode + '\nreturn callback;');
  const callback: unknown = Reflect.apply(factory, undefined, [lodash, setter]);
  invoke(callback, [response]);
  assert.equal(patches.length, 1);
  const patch = patches[0];
  assert.ok(patch);
  assert.deepEqual(Object.keys(patch).sort(), ['sheetInfo', 'controls', 'availableControls', 'showControls', 'controlsSorts', 'coverColumns'].sort());
  assert.equal(patch['sheetInfo'], response, 'preserve the actual response reference');
  return patch;
}
const missingResponses: Record<string, unknown>[] = [
  {}, { template: {} }, { template: { controls: undefined } }, { template: { controls: null } }, { template: null },
];
const emptyPatches = missingResponses.map(response => resolve(response));
for (const patch of emptyPatches) {
  for (const key of ['controls', 'availableControls', 'showControls', 'controlsSorts', 'coverColumns']) {
    assert.deepEqual(patch[key], [], key + ' must remain an array for absent/nullish controls');
  }
}
assert.notEqual(emptyPatches[0]?.['controls'], emptyPatches[1]?.['controls'], 'fallback arrays are not shared across responses');
const explicitEmpty: unknown[] = [];
const empty = resolve({ template: { controls: explicitEmpty } });
assert.equal(empty['controls'], explicitEmpty, 'preserve an explicitly supplied empty array');
const title = { controlId: 'title', attribute: 1, controlName: 'Title', fieldPermission: '111' };
const visible = { controlId: 'visible', controlName: 'Visible', fieldPermission: '111' };
const hidden = { controlId: 'hidden', controlName: 'Hidden', fieldPermission: '011' };
const unnamed = { controlId: 'unnamed', controlName: '' };
const missingId = { controlName: 'Without ID' };
const controls = [title, visible, hidden, unnamed, missingId];
const snapshot = JSON.stringify(controls);
const normal = resolve({ template: { controls } });
assert.equal(normal['controls'], controls, 'forward the source controls by reference');
assert.deepEqual(normal['availableControls'], [visible, hidden, unnamed, missingId]);
assert.deepEqual(normal['showControls'], ['visible', 'hidden'], 'keep the existing first-two selection and order');
assert.deepEqual(normal['controlsSorts'], ['visible', 'hidden', 'unnamed', undefined]);
assert.deepEqual(normal['coverColumns'], [title, visible, missingId], 'keep visibility and nonempty-name filtering');
assert.equal(JSON.stringify(controls), snapshot, 'do not mutate response controls');
const idless = resolve({ template: { controls: [missingId] } });
assert.deepEqual(idless['showControls'], [undefined], 'do not invent control IDs');
const initialCode = harness.transformSync('const initial = (' + slice(initializer) + ');', {
  filename: 'card-state-initializer.ts', sourceType: 'script',
}).code;
const create = new Function(initialCode + '\nreturn initial;');
const first: unknown = Reflect.apply(create, undefined, []);
const second: unknown = Reflect.apply(create, undefined, []);
assert.ok(record(first) && record(second));
assert.deepEqual(Object.keys(first).sort(), ['controls', 'availableControls', 'coverColumns'].sort());
for (const key of ['controls', 'availableControls', 'coverColumns']) {
  assert.deepEqual(first[key], []);
  assert.notEqual(first[key], second[key], 'initial arrays stay per component evaluation');
}
console.log('CardDisplay regression passed: 8 responses, actual helpers, identity/order/filtering and exact initial state');
