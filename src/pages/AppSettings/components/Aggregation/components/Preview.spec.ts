/** Run the actual Preview response and consumer expressions, without copying their logic. */
import type { Node, ObjectExpression } from '@babel/types';
import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const types: typeof import('@babel/types') = require('@babel/types');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');
const _: typeof import('lodash') = require('lodash');
const source = fs.readFileSync(path.join(__dirname, 'Preview.tsx'), 'utf8');
const table = fs.readFileSync(path.join(__dirname, 'Table.tsx'), 'utf8');
const tree = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const tableTree = harness.parser.parse(table, { sourceType: 'module', plugins: ['typescript', 'jsx'] });

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const key of types.VISITOR_KEYS[node.type] || []) {
    const value: unknown = Reflect.get(node, key);
    if (Array.isArray(value)) {
      for (const item of value) if (types.isNode(item)) walk(item, visit);
    } else if (types.isNode(value)) walk(value, visit);
  }
}
function slice(node: Node, text = source): string {
  assert.equal(typeof node.start, 'number');
  assert.equal(typeof node.end, 'number');
  if (typeof node.start !== 'number' || typeof node.end !== 'number') throw new TypeError('AST lacks source bounds');
  return text.slice(node.start, node.end);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function fields(node: ObjectExpression): string[] {
  return node.properties.flatMap(property =>
    types.isObjectProperty(property) && types.isIdentifier(property.key) ? [property.key.name] : [],
  );
}
function evaluate(code: string, names: string[], values: unknown[]): unknown {
  return Reflect.apply(new Function(...names, 'return (' + code + ');'), undefined, values);
}
function call(value: unknown, args: unknown[]): unknown {
  if (typeof value !== 'function') throw new TypeError('extracted expression is not callable');
  return Reflect.apply(value, undefined, args);
}

const bodies: Node[] = [];
walk(tree, node => {
  if (types.isVariableDeclarator(node) && types.isIdentifier(node.id, { name: 'getData' }) &&
      (types.isArrowFunctionExpression(node.init) || types.isFunctionExpression(node.init))) bodies.push(node.init.body);
});
assert.equal(bodies.length, 1);
const getDataBody = bodies[0];
assert.ok(getDataBody);
const required = ['worksheetId', 'data', 'count', 'pageSize', 'pageIndex', 'loading', 'previewRunning'].sort();
const callbacks: Node[] = [];
walk(getDataBody, node => {
  if (!types.isCallExpression(node) || !types.isMemberExpression(node.callee) ||
      !types.isIdentifier(node.callee.property, { name: 'then' })) return;
  const candidate = node.arguments[0];
  if (!types.isArrowFunctionExpression(candidate) && !types.isFunctionExpression(candidate)) return;
  walk(candidate.body, inner => {
    if (!types.isCallExpression(inner) || !types.isIdentifier(inner.callee, { name: 'setState' })) return;
    const patch = inner.arguments[0];
    if (types.isObjectExpression(patch) && JSON.stringify(fields(patch).sort()) === JSON.stringify(required)) callbacks.push(candidate);
  });
});
assert.equal(callbacks.length, 1, 'select the unique response by its seven fields, independently of its guard');
const responseCallback = callbacks[0];
assert.ok(responseCallback);

function resolve(response: Record<string, unknown>): Record<string, unknown> {
  const patches: Record<string, unknown>[] = [];
  const setter = (patch: unknown): void => {
    assert.ok(record(patch));
    patches.push(patch);
  };
  const callback = evaluate(slice(responseCallback), ['setState', '_', 'worksheetId', 'pS', 'pI'], [setter, _, 'ws-1', 100, 3]);
  call(callback, [response]);
  assert.equal(patches.length, 1);
  const patch = patches[0];
  assert.ok(patch);
  return patch;
}

const lengthExpressions: Node[] = [];
walk(tree, node => {
  if (types.isLogicalExpression(node, { operator: '&&' }) && /data\.length\s*<=\s*0/.test(slice(node)) &&
      /syncTaskStatus/.test(slice(node))) lengthExpressions.push(node);
});
assert.ok(lengthExpressions.length >= 1);
const lengthExpression = lengthExpressions[0];
assert.ok(lengthExpression);
const mapExpressions: Node[] = [];
walk(tableTree, node => {
  if (types.isMemberExpression(node) && !node.computed && types.isIdentifier(node.property, { name: 'map' }) &&
      types.isMemberExpression(node.object) && types.isIdentifier(node.object.object, { name: 'props' }) &&
      types.isIdentifier(node.object.property, { name: 'data' })) mapExpressions.push(node);
});
const mapExpression = mapExpressions[0];
assert.ok(mapExpression);

const rows = [{ rowid: 'row-1' }, { rowid: 'row-2' }];
const responses: Record<string, unknown>[] = [
  { count: 7 }, { count: 8, data: undefined }, { count: 9, data: null }, { count: 0, data: [] }, { count: 2, data: rows },
];
const patches: Record<string, unknown>[] = [];
for (const response of responses) {
  const patch = resolve(response);
  if (response['data'] === rows) assert.equal(patch['data'], rows, 'preserve the actual response array reference');
  else assert.deepEqual(patch['data'], [], 'missing/nullish data must resolve to an empty array');
  assert.equal(patch['count'], response['count'], 'forward each actual response count');
  assert.equal(patch['worksheetId'], 'ws-1');
  assert.equal(patch['pageSize'], 100);
  assert.equal(patch['pageIndex'], 3);
  assert.equal(patch['loading'], false);
  assert.equal(patch['previewRunning'], false);
  assert.doesNotThrow(() => evaluate(slice(lengthExpression), ['data', 'syncTaskStatus'], [patch['data'], 'ERROR']));
  assert.equal(typeof evaluate(slice(mapExpression, table), ['props'], [{ data: patch['data'] }]), 'function');
  patches.push(patch);
}
assert.notEqual(patches[0]?.['data'], patches[1]?.['data'], 'missing responses receive independent fallback arrays');
assert.deepEqual(rows, [{ rowid: 'row-1' }, { rowid: 'row-2' }]);

// Evaluate the real hook initializer in its real function scope, including its typed local array binding.
const previewBodies: Node[] = [];
walk(tree, node => {
  if (types.isFunctionDeclaration(node) && types.isIdentifier(node.id, { name: 'Preview' })) previewBodies.push(node.body);
});
const previewBody = previewBodies[0];
assert.ok(previewBody);
const initialObjects: ObjectExpression[] = [];
const localArrays: string[] = [];
walk(previewBody, node => {
  if (types.isVariableDeclarator(node) && types.isIdentifier(node.id, { name: 'initialData' })) localArrays.push('const ' + slice(node) + ';');
  if (types.isCallExpression(node) && types.isIdentifier(node.callee, { name: 'useSetState' }) && types.isObjectExpression(node.arguments[0])) {
    initialObjects.push(node.arguments[0]);
  }
});
assert.equal(initialObjects.length, 1);
assert.ok(localArrays.length <= 1);
const initialObject = initialObjects[0];
assert.ok(initialObject);
const compiled = harness.transformSync('const create = (props) => { ' + localArrays.join('\n') + ' return (' + slice(initialObject) + '); };', {
  filename: 'preview-initializer.ts', sourceType: 'script',
}).code;
const create: unknown = Reflect.apply(new Function(compiled + '\nreturn create;'), undefined, []);
const first = call(create, [{ flowData: {}, hasChange: false }]);
const second = call(create, [{ flowData: {}, hasChange: false }]);
assert.ok(record(first) && record(second));
assert.deepEqual(first['data'], []);
assert.deepEqual(second['data'], []);
assert.notEqual(first['data'], second['data'], 'initial arrays must remain per render, not shared across instances');
console.log('Preview regression passed: 5 response cases, actual length/map consumers, metadata and per-render array identity');
