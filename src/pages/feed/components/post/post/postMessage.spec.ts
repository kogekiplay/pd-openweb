/** Actual empty-body lifecycle: the official Markdown upgrade must not query code blocks on an absent ref. */
import type { SpecHarness } from '../../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');
const react: typeof import('react') = require('react');
const filename = 'src/pages/feed/components/post/post/postMessage.tsx';
const before = process.env['POST_MESSAGE_BEFORE'] === 'upstream';
const source = before
  ? cp.execFileSync('git', ['show', 'dd43ffb7759dc0baae9bee475aad2cd6c1eab150:src/pages/feed/components/post/post/postMessage.jsx'], { cwd: harness.ROOT, encoding: 'utf8' })
  : fs.readFileSync(path.join(harness.ROOT, filename), 'utf8');
const compiled = harness.transformSync(source, { filename: path.join(harness.ROOT, filename), plugins: ['@babel/plugin-transform-modules-commonjs'] });
assert.ok(compiled?.code);
const unreachable = () => { throw new Error('Empty message unexpectedly crossed a rendering or request boundary'); };
const stubs: Record<string, unknown> = {
  react,
  'react/jsx-runtime': require('react/jsx-runtime'),
  'react-dom/client': { createRoot: unreachable },
  classnames: require('classnames'),
  'prop-types': require('prop-types'),
  'query-string': require('query-string'),
  'ming-ui': { UserCard: unreachable },
  'ming-ui/components/MdMarkdown': { renderCodeHighlight: (element: unknown) => assert.equal(element, undefined) },
  'src/common/theme/createRootWithAntdConfig': unreachable,
  'src/utils/createLinksForMessage': unreachable,
  'src/components/comment/utils/createLinksForMessage': unreachable,
  'src/components/comment/utils/highlightKeywords': unreachable,
  'src/components/comment/utils/renderPostMarkdown': { __esModule: true, default: unreachable, ensureMarkdownEngine: unreachable, isMarkdownEngineReady: () => true },
  'src/pages/Group/createGroup/load': unreachable,
  'src/utils/core/sanitizeHtml': { sanitizePostMessageHtml: unreachable },
  'src/utils/platform/browser/clipboard': { copyTextToClipboard: unreachable },
  'src/utils/platform/navigation/path': { pathCompletion: unreachable },
  './postMarkdown.less': {},
};
interface EmptyQuery { find(): EmptyQuery; each(): EmptyQuery; end(): EmptyQuery; on(): EmptyQuery; }
const empty: EmptyQuery = { find: () => empty, each: () => empty, end: () => empty, on: () => empty };
const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
new Function('module', 'exports', 'require', '$', compiled.code)(moduleLike, moduleLike.exports, (name: string): unknown => {
  if (!Object.hasOwn(stubs, name)) throw new Error('Unexpected PostMessage dependency ' + name);
  return stubs[name];
}, (input: unknown) => { assert.deepEqual(input, []); return empty; });
const Constructor = moduleLike.exports['default'];
assert.equal(typeof Constructor, 'function');
if (typeof Constructor !== 'function') throw new TypeError('Missing actual PostMessage');
const component: object = Reflect.construct(Constructor, [{ postItem: { message: '' } }]);
function invoke(name: string): unknown {
  const method: unknown = Reflect.get(component, name);
  if (typeof method !== 'function') throw new TypeError('Missing actual lifecycle method ' + name);
  return Reflect.apply(method, component, []);
}
assert.equal(invoke('render'), false);
assert.doesNotThrow(() => invoke('componentDidMount'));
assert.equal(Reflect.get(component, '_isMounted'), true);
assert.doesNotThrow(() => invoke('componentDidUpdate'));
invoke('componentWillUnmount');
assert.equal(Reflect.get(component, '_isMounted'), false);
console.log('Actual PostMessage empty Markdown body mounts, updates and unmounts without DOM ref, SDK fetch or API work');
