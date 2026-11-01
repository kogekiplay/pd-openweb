/** Exercise actual caller expressions followed by the real dropdown search filter. */
import type { Node } from '@babel/types';
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const t: typeof import('@babel/types') = require('@babel/types');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const lodash: typeof import('lodash') = require('lodash');
function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const key of t.VISITOR_KEYS[node.type] || []) {
    const value: unknown = Reflect.get(node, key);
    if (Array.isArray(value)) {
      for (const item of value) if (t.isNode(item)) walk(item, visit);
    } else if (t.isNode(value)) walk(value, visit);
  }
}
function slice(source: string, node: Node): string {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') throw new TypeError('missing source bounds');
  return source.slice(node.start, node.end);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function rows(value: unknown): Record<string, unknown>[] {
  assert.ok(Array.isArray(value));
  const result: Record<string, unknown>[] = [];
  for (const item of value) { assert.ok(record(item)); result.push(item); }
  return result;
}
function evaluate(code: string, names: string[], values: unknown[]): unknown {
  const compiled = harness.transformSync(code, { filename: 'public-control-fragment.ts', sourceType: 'script' }).code;
  const factory = new Function(...names, compiled + '\nreturn result;');
  return Reflect.apply(factory, undefined, values);
}
const child = fs.readFileSync(path.join(__dirname, 'CommonFieldDropdown.tsx'), 'utf8');
const childAst = harness.parser.parse(child, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const helper: Node[] = [];
const filters: Node[] = [];
walk(childAst, node => {
  if (t.isVariableDeclarator(node) && t.isIdentifier(node.id) &&
      ['hasControlName', 'toCommonFieldDropdownControl'].includes(node.id.name)) helper.push(node);
  if (t.isVariableDeclarator(node) && t.isIdentifier(node.id, { name: 'filterControls' }) && node.init) filters.push(node.init);
});
assert.ok(helper.length === 0 || helper.length === 2, 'base has no adapter; candidate contains both real declarations');
assert.equal(filters.length, 1);
const filter = filters[0];
assert.ok(filter);
const helperCode = helper.map(node => 'const ' + slice(child, node) + ';').join('\n');
function produce(file: string, originalControls: object[], controls: object[]): Record<string, unknown>[] {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const expressions: Node[] = [];
  walk(ast, node => {
    if (!t.isJSXOpeningElement(node) || !t.isJSXIdentifier(node.name, { name: 'CommonFieldDropdown' })) return;
    for (const attr of node.attributes) {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'controls' }) &&
          t.isJSXExpressionContainer(attr.value) && !t.isJSXEmptyExpression(attr.value.expression)) expressions.push(attr.value.expression);
    }
  });
  assert.equal(expressions.length, 1);
  const expression = expressions[0]; assert.ok(expression);
  return rows(evaluate(helperCode + '\nconst result=(' + slice(source, expression) + ');', ['_', 'originalControls', 'controls'], [lodash, originalControls, controls]));
}
function search(controls: object[], keyword = ''): Record<string, unknown>[] {
  return rows(evaluate('const result=(' + slice(child, filter) + ');',
    ['_', 'controls', 'fieldSearchKeyWords', 'extendSourceId', 'weChatSetting'],
    [lodash, controls, keyword, 'source-id', { fieldMaps: { openId: 'wx' } }]));
}
const callers = ['AbilityExpandSettings.tsx', 'FillSettings.tsx'];
const nullish: Record<string, unknown>[] = [{ controlId: 'c', type: 2 }, { controlId: 'c', type: 2, controlName: undefined }, { controlId: 'c', type: 2, controlName: null }];
let repairedCases = 0;
for (const file of callers) for (const control of nullish) {
  const original = { ...control }; const produced = produce(file, [control], [{ controlId: 'c' }]);
  const visible = search(produced);
  assert.equal(produced.length, 1);
  assert.equal(produced[0]?.['controlName'], '', 'only absent/nullish labels normalize');
  assert.equal(visible.length, 1, 'keep the otherwise valid control rather than dropping it');
  assert.deepEqual(control, original, 'do not mutate source control');
  repairedCases++;
}
for (const file of callers) {
  const base = [
    { controlId: 'alpha', controlName: 'Alpha', type: 2, metadata: 'drop' },
    { controlId: 'empty', controlName: '', type: 3 },
    { controlId: 'relation', controlName: 'Relation', type: 29 },
    { controlId: 'forbidden', controlName: 'Forbidden', type: 26 },
    { controlId: 'wx', controlName: 'WeChat', type: 2 },
    { controlId: 'outside', controlName: 'Outside', type: 2 },
  ];
  const available = base.filter(item => item.controlId !== 'outside');
  const snapshot = JSON.stringify(base);
  const produced = produce(file, base, available);
  const expected = base.filter(item => item.controlId !== 'outside' && (file !== 'FillSettings.tsx' || item.type !== 29))
    .map(item => lodash.pick(item, ['controlId', 'controlName', 'type']));
  assert.deepEqual(produced, expected, 'valid labels preserve projections, order and cache relation exclusion');
  assert.equal(JSON.stringify(base), snapshot);
  assert.deepEqual(search(produced, 'ALP').map(item => item['controlId']), ['alpha'], 'keep case-insensitive search');
  assert.deepEqual(search(produced).map(item => item['controlId']), file === 'FillSettings.tsx' ? ['alpha', 'empty'] : ['alpha', 'empty', 'relation']);
  const noId = { controlName: 'Without ID' };
  const projected = produce(file, [noId], [{}]);
  assert.equal(projected.length, 1);
  assert.equal(Object.hasOwn(projected[0] || {}, 'controlId'), false);
  assert.equal(Object.hasOwn(projected[0] || {}, 'type'), false, 'do not manufacture unrelated own undefined keys');
  const invalid = produce(file, [{ controlId: 'c', controlName: 7, type: 2 }], [{ controlId: 'c' }]);
  assert.throws(() => search(invalid), TypeError, 'out-of-domain non-string labels are not silently coerced');
}
const normalize: unknown = evaluate(helperCode + '\nconst result=toCommonFieldDropdownControl;', [], []);
assert.equal(typeof normalize, 'function');
function adapt(input: object): Record<string, unknown> {
  if (typeof normalize !== 'function') throw new TypeError('missing actual adapter');
  const value: unknown = Reflect.apply(normalize, undefined, [input]);
  assert.ok(record(value));
  return value;
}
for (const name of ['Alpha', '']) {
  const picked = lodash.pick({ controlId: 'c', controlName: name, type: 2, extra: 'drop' }, ['controlId', 'controlName', 'type']);
  assert.equal(adapt(picked), picked, 'normal and empty labels preserve the actual picked object identity');
}
for (const input of [{ controlId: 'c', type: 2 }, { controlId: 'c', controlName: undefined, type: 2 }, { controlId: 'c', controlName: null, type: 2 }, {}]) {
  const before = { ...input };
  const normalized = adapt(input);
  assert.notEqual(normalized, input);
  assert.equal(normalized['controlName'], '');
  assert.deepEqual(Object.keys(normalized).filter(key => key !== 'controlName'), Object.keys(input).filter(key => key !== 'controlName'));
  assert.deepEqual(input, before, 'normalization never mutates the picked input');
  assert.equal(Object.hasOwn(normalized, 'controlId'), Object.hasOwn(input, 'controlId'));
  assert.equal(Object.hasOwn(normalized, 'type'), Object.hasOwn(input, 'type'));
}
console.log('CommonFieldDropdown producer regression passed: ' + repairedCases + ' nullish-name paths; real callers, identity, key presence, membership and search');
