/** Source-bound finite-key guard regression; dynamic status payload remains opaque. */
import type { Node } from '@babel/types';
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const t: typeof import('@babel/types') = require('@babel/types');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const sourcePath = path.join(harness.ROOT, 'src/pages/chat/components/MyStatus/config.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const key of t.VISITOR_KEYS[node.type] || []) {
    const value: unknown = Reflect.get(node, key);
    if (Array.isArray(value)) {
      for (const item of value) if (t.isNode(item)) walk(item, visit);
    } else if (t.isNode(value)) {
      walk(value, visit);
    }
  }
}
const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript'] });
const nodes: Node[] = []; walk(ast, node => nodes.push(node));
const table = nodes.find(node => t.isVariableDeclarator(node) && t.isIdentifier(node.id, { name: 'defaultStatusInfo' }));
const guard = nodes.find(node => t.isVariableDeclarator(node) && t.isIdentifier(node.id, { name: 'isDefaultStatusId' }));
assert.ok(table && guard);
const slice = (node: Node): string => {
  if (typeof node.start !== 'number' || typeof node.end !== 'number') throw new TypeError('missing source bounds');
  return source.slice(node.start, node.end);
};
const tableInit = t.isVariableDeclarator(table) ? table.init : undefined;
const guardInit = t.isVariableDeclarator(guard) ? guard.init : undefined;
assert.ok(tableInit && guardInit);
const code = harness.transformSync(
  'const defaultStatusInfo = ' + slice(tableInit!) + ';\n' +
    'const isDefaultStatusId = ' + slice(guardInit!) + ';\n' +
    'const result = { defaultStatusInfo, isDefaultStatusId };',
  { filename: 'default-status-fragment.ts', sourceType: 'script' },
).code;
const factory = new Function('_l', code + '\nreturn result;');
const { defaultStatusInfo, isDefaultStatusId } = factory((value: string) => value) as {
  defaultStatusInfo: Record<string, unknown>;
  isDefaultStatusId: (id: string | undefined) => boolean;
};
const defaultIds = Object.keys(defaultStatusInfo);
assert.equal(defaultIds.length, 4);
for (const id of defaultIds) assert.equal(isDefaultStatusId(id), true);
for (const id of [undefined, '', 'unknown', 'toString', 'constructor']) assert.equal(isDefaultStatusId(id), false);
assert.equal(isDefaultStatusId(3 as unknown as string), false);
assert.deepEqual(Object.keys(defaultStatusInfo), defaultIds);
console.log('default-status finite-key regression passed: 4 canonical IDs accepted; undefined, unknown and prototype keys rejected');
