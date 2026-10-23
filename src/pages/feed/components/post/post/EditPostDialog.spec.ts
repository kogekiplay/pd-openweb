/** Actual component command and render/ref contracts. UI, API and native upload provider remain fixture boundaries. */
import type { SpecHarness } from '../../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
const path: typeof import('node:path') = require('node:path');
const syntax: Record<string, unknown> = require('../../../../../../scripts/spec-message-syntax.ts').loadMessageSyntaxSpec();
function Shell() { return null; }
function FileProvider() { return null; }
function MarkdownEditor() { return null; }
const stubs: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-dom/client': {},
  lodash: require('lodash'), 'styled-components': require('styled-components'),
  'ming-ui': { Button: Shell, Dialog: Shell },
  'ming-ui/functions/quickSelectGroup': { SelectGroupTrigger: Shell },
  'src/components/comment/PostMarkdownEditor': MarkdownEditor,
  'src/components/comment/utils/markdownMessageSyntax': syntax,
  'src/components/UploadFiles': FileProvider,
  'src/utils/expression': require(path.join(harness.ROOT, 'src/utils/expression.ts')),
  '../../../redux/postActions': {},
};
const compiled = harness.transformFileSync(path.join(__dirname, 'EditPostDialog.tsx'), { plugins: ['@babel/plugin-transform-modules-commonjs'] });
assert.ok(compiled?.code);
const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
new Function('module', 'exports', 'require', '_l', 'alert', compiled.code)(
  moduleLike, moduleLike.exports,
  (name: string): unknown => { if (!Object.hasOwn(stubs, name)) throw new Error('Unexpected edit dependency ' + name); return stubs[name]; },
  (text: string) => text, () => {},
);
const Constructor = moduleLike.exports['default'];
if (typeof Constructor !== 'function') throw new TypeError('Missing actual EditPostDialog');
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object'; }
function read(receiver: object, name: string): unknown { return Reflect.get(receiver, name); }
function call(receiver: object, name: string, ...args: unknown[]): unknown {
  const method = read(receiver, name); if (typeof method !== 'function') throw new TypeError('Missing actual ' + name);
  return Reflect.apply(method, receiver, args);
}
function state(receiver: object): Record<string, unknown> {
  const value = read(receiver, 'state'); if (!object(value)) throw new TypeError('Missing actual state'); return value;
}
interface ElementNode { type: unknown; props: Record<string, unknown>; }
function nodes(tree: unknown, result: ElementNode[] = []): ElementNode[] {
  if (Array.isArray(tree)) { tree.forEach(child => nodes(child, result)); return result; }
  if (!React.isValidElement(tree) || !object(tree.props)) return result;
  result.push({ type: tree.type, props: tree.props }); nodes(tree.props['children'], result); return result;
}
interface PendingEdit { args: unknown; success: () => void; failure: () => void; }
function fixture() {
  const pending: PendingEdit[] = [], batches: unknown[] = []; let closed = 0;
  const props = {
    postItem: { postID: 'p1', postType: 0, message: '## Header\n\n[aid]u1[/aid]', rUserList: [{ aid: 'u1', name: '张三' }], scope: { shareProjects: [], shareGroups: [{ groupId: 'g1' }] } },
    dispose: () => { closed++; },
    editPost: (args: unknown, success: () => void, failure: () => void) => pending.push({ args, success, failure }),
  };
  const currentConstructor = moduleLike.exports['default'];
  if (typeof currentConstructor !== 'function') throw new TypeError('Missing actual constructor');
  const subject: object = Reflect.construct(currentConstructor, [props]);
  const provider = { addFiles: (batch: unknown) => batches.push(batch) };
  const commitRefs = () => {
    for (const node of nodes(call(subject, 'render'))) {
      if (node.type !== FileProvider) continue;
      const manualRef = node.props['manualRef']; if (typeof manualRef === 'function') Reflect.apply(manualRef, undefined, [provider]);
    }
  };
  Reflect.set(subject, 'setState', (changes: unknown, callback?: unknown) => {
    const next: unknown = typeof changes === 'function' ? Reflect.apply(changes, subject, [state(subject), props]) : changes;
    if (!object(next)) throw new TypeError('Invalid fixture state update');
    Reflect.set(subject, 'state', { ...state(subject), ...next }); commitRefs();
    if (typeof callback === 'function') Reflect.apply(callback, subject, []);
  });
  commitRefs();
  const editorCall = (name: string, ...args: unknown[]) => {
    const editor = nodes(call(subject, 'render')).find(node => node.type === MarkdownEditor); assert.ok(editor);
    const callback = editor.props[name]; if (typeof callback !== 'function') throw new TypeError('Missing actual editor callback');
    return Reflect.apply(callback, undefined, args);
  };
  return { subject, pending, batches, editorCall, get closed() { return closed; } };
}
const keyboard = fixture(); keyboard.editorCall('onChange', '## New\n\n[@张三](/hap/user_u1)');
keyboard.editorCall('onSubmit'); keyboard.editorCall('onSubmit');
assert.equal(keyboard.pending.length, 1, 'Pending keyboard submissions must issue one command');
assert.deepEqual(keyboard.pending[0]?.args, { postType: '0', postMsg: '## New\n\nuser:u1', scope: { shareProjectIds: [], shareGroupIds: ['g1'] }, postId: 'p1', oldPostMsg: '## Header\n\n[aid]u1[/aid]', attachments: undefined, knowledgeAttach: undefined });
keyboard.pending[0]!.failure(); keyboard.editorCall('onSubmit'); assert.equal(keyboard.pending.length, 2);
keyboard.pending[1]!.success(); assert.equal(keyboard.closed, 1); assert.equal(state(keyboard.subject)['visible'], false);
const paste = fixture(), batch = [new File(['x'], 'x.png', { type: 'image/png' })];
paste.editorCall('onUploadFiles', batch); assert.equal(paste.batches[0], batch);
assert.equal(nodes(call(paste.subject, 'render')).filter(node => node.type === FileProvider).length, 1);
assert.equal(state(paste.subject)['isUploadComplete'], false);
paste.editorCall('onSubmit'); assert.equal(paste.pending.length, 0, 'Newly queued uploads must block commands');
console.log('Actual EditPostDialog: serialized Markdown, pending command guard, failure retry, success disposal, normal-post upload mount/ref and original File[] identity');
