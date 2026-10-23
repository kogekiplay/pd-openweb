/** Actual draft migration, using real current mention builders rather than a copied conversion algorithm. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const syntax: Record<string, unknown> = require('../../../../../scripts/spec-message-syntax.ts').loadMessageSyntaxSpec();
const compiled = harness.transformFileSync(path.join(__dirname, 'draft.ts'), { plugins: ['@babel/plugin-transform-modules-commonjs'] });
assert.ok(compiled?.code);
const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
new Function('module', 'exports', 'require', compiled.code)(moduleLike, moduleLike.exports, (name: string): unknown => {
  if (name === 'lodash') return require('lodash');
  if (name === 'src/components/comment/utils/markdownMessageSyntax') return syntax;
  throw new Error('Unexpected draft dependency ' + name);
});
function restore(value?: unknown): unknown {
  const method = moduleLike.exports['getDraftMarkdown']; if (typeof method !== 'function') throw new TypeError('Missing actual migration');
  return Reflect.apply(method, undefined, [value]);
}
assert.equal(restore(), '');
assert.equal(restore({ markdownValue: '', text: 'legacy' }), '');
assert.equal(restore({ markdownValue: '## Source\n\n[@Name](/user_u1)', text: 'legacy' }), '## Source\n\n[@Name](/user_u1)');
const draft = { text: '@张三 @张三 @Team', mentionsCollection: [{ id: 'u1', fullname: '张三' }, { id: 'u2', fullname: '张三' }, { id: 'g1', value: 'Team', type: 'group' }] };
const before = JSON.stringify(draft);
assert.equal(restore(draft), '[@张三](/hap/user_u1) [@张三](/hap/user_u2) [@Team](/hap/group/groupValidate?gID=g1)');
assert.equal(JSON.stringify(draft), before);
assert.equal(restore({ text: '@Name', mentionsCollection: [null, undefined, { id: 'u1', fullname: 'Name' }] }), '[@Name](/hap/user_u1)');
const trace: string[] = [];
const mention = Object.defineProperties({}, {
  fullname: { get() { trace.push('name'); return 'Name'; } },
  id: { get() { trace.push('id'); return 'u1'; } },
  type: { get() { trace.push('type'); return 'user'; } },
});
restore({ text: '@Name', mentionsCollection: [mention] });
assert.deepEqual(trace, ['name', 'id', 'type', 'id']);
const failure = new Error('native draft getter');
assert.throws(() => restore(Object.defineProperty({}, 'markdownValue', { get() { throw failure; } })), (error: unknown) => error === failure);
assert.throws(() => restore(null), TypeError);
assert.throws(() => restore({ text: 'x', mentionsCollection: {} }), TypeError);
console.log('Actual draft migration: Markdown source, repeated-name identities, groups, nullable legacy rows, immutable input, getter order and native failures');
