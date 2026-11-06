import type { SpecHarness } from '../../../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const React: typeof import('react') = require('react');
const harness: SpecHarness = require('../../../../../../../scripts/spec-harness.ts');
const actualXss: typeof import('xss') = require('xss');
type Data = Record<string, unknown>;
const Leaf = () => null;
Reflect.set(globalThis, '_l', (value: string) => value);
Reflect.set(globalThis, 'md', { global: { Account: { isPortal: false }, Config: { WebUrl: 'https://example.test' } } });
const types = { WorkFlowMessage: 44, WorkFlowTaskMessage: 45, WorkFlowUserTaskMessage: 46,
  WorkFlowSendTaskMessage: 47, WorkFlowSendMessage: 49, SystemMessage: 0 };
const sanitizerFile = path.join(harness.ROOT, 'src/utils/core/sanitizeHtml.ts');
const realSanitizer = { exports: {} as Data };
const sanitizerCode = harness.transformFileSync(sanitizerFile, {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
assert.ok(sanitizerCode?.code);
new Function('require', 'module', 'exports', sanitizerCode.code)(
  (name: string) => { if (name === 'xss') return actualXss; throw new Error(name); },
  realSanitizer, realSanitizer.exports,
);
const file = path.join(harness.ROOT, 'src/pages/chat/components/Inbox/components/wrappedComp/systemMessage.tsx');
const compiled = harness.transformFileSync(file, { parserOpts: { createImportExpressions: false },
  plugins: ['@babel/plugin-transform-modules-commonjs', 'babel-plugin-dynamic-import-node'],
});
assert.ok(compiled?.code);
const moduleLike = { exports: {} as Data };
const dependencies = (name: string): unknown => {
  if (name === 'react' || name === 'react/jsx-runtime') return require(name);
  if (name === 'styled-components') return { span: () => Leaf };
  if (name === 'xss') return actualXss;
  if (name === 'path-to-regexp') return require(name);
  if (name === 'src/utils/core/sanitizeHtml') return realSanitizer.exports;
  if (name === 'src/components/emotion/emotion') return { parse: (html: string) => html };
  if (name === '../../constants') return { MSG_DONE_TEXT: {}, MSGTYPES: types };
  if (name === '../../util') return { formatInboxItem: () => ({ typeName: '', inboxId: 'probe', isFavorite: '0' }),
    linkifySanitizedHtml: (html: string) => html };
  if (name === 'src/pages/chat/utils') return { formatMsgDate: () => '' };
  if (name === 'src/utils/project') return { dateConvertToUserZone: (value: unknown) => value, addBehaviorLog: () => {} };
  if (name === 'src/utils/common') return { getRequest: () => ({}), pathCompletion: (value: string) => value };
  if (name === 'ming-ui') return { Icon: Leaf, SvgIcon: Leaf };
  if (name === 'ming-ui/antd-components') return { Tooltip: Leaf };
  if (name === 'react-dom/client') return { createRoot: () => { throw new Error('No real mount'); } };
  if (name.startsWith('src/') || name.startsWith('../')) return Leaf;
  return require(name);
};
new Function('require', 'module', 'exports', compiled.code)(dependencies, moduleLike, moduleLike.exports);
interface Renderable { render(): unknown; }
const Type = moduleLike.exports['default'] as new (props: Data) => Renderable;
interface Body { type: unknown; props: Data; }
function htmlBody(value: unknown): Body[] {
  if (Array.isArray(value)) return value.flatMap(htmlBody);
  if (!React.isValidElement<Data>(value)) return [];
  const result: Body[] = value.props['dangerouslySetInnerHTML'] ? [{ type: value.type, props: value.props }] : [];
  return result.concat(htmlBody(value.props['children']));
}
function render(content: string, inboxType = types.WorkFlowSendMessage) {
  const nodes = htmlBody(new Type({ Message: { content }, inboxType, createTime: '2026-11-06T10:27:00' }).render());
  const body = nodes.at(-1); assert.ok(body);
  const value = body.props['dangerouslySetInnerHTML'];
  assert.ok(value && typeof value === 'object' && '__html' in value);
  assert.equal(typeof value.__html, 'string');
  return { body, html: String(value.__html) };
}
// Real complete SystemMessage and real sanitizer/xss. URL linkifier, emotion and UI leaves are controlled;
// this spec does not claim browser layout or exercise any workflow sending API.
let count = 0;
const rich = render('<p style="text-align:center"><span style="color:#f00;font-size:20px">入库通知</span></p>');
assert.match(rich.html, /text-align:center/); assert.match(rich.html, /color:#f00/);
assert.match(rich.html, /font-size:20px/); assert.equal(rich.body.type, 'div'); count++;
const plain = render('【MOM】成品入库单' + String.fromCharCode(10) + '无需处理业务单据。');
assert.equal(plain.html, '【MOM】成品入库单<br />无需处理业务单据。'); assert.equal(plain.body.type, 'span'); count++;
const legacy = render('<p style="color:red">系统提示</p>', types.SystemMessage);
assert.equal(legacy.html, '<p>系统提示</p>'); count++;
const link = render('<p>审批：<a href="/workflowinstance/p/n/i" optype="workflow" opvalue="n" taskid="t" opuser="u" t="x">前往审批</a></p>');
for (const name of ['href', 'optype', 'opvalue', 'taskid', 'opuser', 't']) assert.ok(link.html.includes(name + '=')); count++;
const layout = render('<p class="ql-align-center ql-size-large Absolute" style="position:fixed;z-index:9999;color:red">通知</p>');
assert.match(layout.html, /workflow-ql-align-center/); assert.match(layout.html, /workflow-ql-size-large/);
assert.ok(!layout.html.includes('Absolute')); assert.ok(!layout.html.includes('position')); assert.ok(!layout.html.includes('z-index')); count++;
const unsafe = render('<p onclick="alert(1)">正文<script>alert(1)</script><a href="javascript:alert(1)">链接</a><img src="x" onerror="alert(1)"></p>');
assert.ok(!unsafe.html.includes('onclick')); assert.ok(!unsafe.html.includes('onerror'));
assert.ok(!unsafe.html.includes('javascript:')); assert.ok(!unsafe.html.includes('alert(1)')); count++;
const imageTable = render('<figure class="table"><table><tbody><tr><td colspan="2">数量</td></tr></tbody></table></figure><img src="https://example.test/a.png" alt="附件">');
assert.ok(imageTable.html.includes('<table>')); assert.ok(imageTable.html.includes('colspan="2"'));
assert.ok(imageTable.html.includes('https://example.test/a.png')); count++;
const encoded = render('&lt;p&gt;原文&lt;/p&gt;'); assert.equal(encoded.html, '&lt;p&gt;原文&lt;/p&gt;'); count++;
console.log('Actual workflow notice rich text: ' + count + ' cases passed');
