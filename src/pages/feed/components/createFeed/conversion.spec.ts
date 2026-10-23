/** Current mode conversion uses real codec/draft functions and preserves mixed same-name mention identities. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const syntax: Record<string, unknown> = require('../../../../../scripts/spec-message-syntax.ts').loadMessageSyntaxSpec();
type Exports = Record<string, unknown>;
const cache = new Map<string, Exports>();
function load(file: string): Exports {
  const current = cache.get(file); if (current) return current;
  const moduleLike: { exports: Exports } = { exports: {} }; cache.set(file, moduleLike.exports);
  const compiled = harness.transformFileSync(path.join(harness.ROOT, file), { plugins: ['@babel/plugin-transform-modules-commonjs'] }); assert.ok(compiled?.code);
  new Function('module', 'exports', 'require', compiled.code)(moduleLike, moduleLike.exports, (name: string): unknown => {
    if (name === 'lodash') return require('lodash');
    if (name === 'src/components/comment/utils/markdownMessageSyntax') return syntax;
    if (name === '../updater/draft') return load('src/pages/feed/components/updater/draft.ts');
    throw new Error('Unexpected actual mode dependency ' + name);
  }); return moduleLike.exports;
}
const api = load('src/pages/feed/components/createFeed/conversion.ts');
function invoke(name: string, ...args: unknown[]): unknown { const method = api[name]; if (typeof method !== 'function') throw new TypeError('Missing conversion'); return Reflect.apply(method, undefined, args); }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object'; }
const markdown = '[@同名](/hap/group/groupValidate?gID=g1) [@同名](/hap/user_u1)';
const plain = invoke('markdownToPlain', markdown); assert.ok(object(plain));
assert.equal(plain['text'], '@同名 @同名'); assert.equal(plain['messageText'], 'group:g1 user:u1');
assert.deepEqual(plain['mentions'], [{ type: 'group', id: 'g1', fullname: '同名' }, { type: 'user', id: 'u1', fullname: '同名' }]);
assert.equal(invoke('plainToMarkdown', plain['text'], plain['mentions']), markdown);
assert.deepEqual(invoke('markdownToPlain', ''), { text: '', messageText: '', mentions: [] });
const header = invoke('markdownToPlain', '## Heading\n\n[@张三](/hap/user_u1)'); assert.ok(object(header));
assert.equal(header['text'], 'Heading\n@张三'); assert.equal(header['messageText'], 'Heading\nuser:u1');
console.log('Actual createFeed mode codec: visible names, backend syntax, mixed same-name identity order, empty text and headings');
