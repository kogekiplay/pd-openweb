/** Execute real panel, Inbox, lookups, action creators and Redux; only host/network/UI leaves are controlled. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const fs: typeof import('node:fs') = require('node:fs');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
const lodash: typeof import('lodash') = require('lodash');
type Data = Record<string, unknown>;
interface Element { type: unknown; props: Data; }
interface Subject {
  props: Data; state: Data; ajax?: unknown;
  setState(patch: Data, callback?: () => void): void;
  render(): Element; renderInbox(item: Data): Element; renderHeader(): Element; renderDropDown(): Element;
  renderMenu(): Element | null;
  inboxSessionItem(item: Data): void; chatSessionItem(item: Data): void;
}
type Constructor = new (props: Data) => Subject;
interface Call { controller: string; action: string; args: Data; options: Data; }
const cache = new Map<string, Data>();
const calls: Call[] = [], dispatched: Data[] = [], trace: string[] = [];
const storage = { getItem: () => null };
const md = { global: { Account: { accountId: 'self', isPortal: false, messageListShowType: 0 } } };
Reflect.set(globalThis, 'md', md); Reflect.set(globalThis, 'localStorage', storage);
Reflect.set(globalThis, '_l', (text: string) => text);
Reflect.set(globalThis, 'alert', (text: string, level?: number) => trace.push(`alert:${text}:${level}`));
Reflect.set(globalThis, 'window', { innerHeight: 900, md, localStorage: storage, getCookie: () => null });
const fixture = require('../../../../../scripts/spec-fixtures/chatReduxFixture.ts') as { loadRealUtils(): Data };
const realUtils = fixture.loadRealUtils();
const Icon = () => null, Leaf = () => null;
let response: unknown, state: Data;
const sdk = (controller: string, action: string, args: Data, options: Data) => {
  calls.push({ controller, action, args, options }); return response;
};
const socket = { Contact: { recordAction: (value: unknown) => trace.push('record:' + JSON.stringify(value)) } };
function load(file: string): Data {
  if (cache.has(file)) return cache.get(file)!;
  const transformed = harness.transformFileSync(path.join(harness.ROOT, file));
  if (!transformed?.code) throw new Error('Missing compiled module ' + file);
  const module = { exports: {} as Data }; cache.set(file, module.exports);
  const localRequire = (name: string): unknown => {
    if (name.endsWith('.less') || name.endsWith('.css')) return {};
    if (name === 'ming-ui') return { Icon, Dropdown: Leaf };
    if (name === 'ming-ui/antd-components') return { Tooltip: Leaf };
    if (name.startsWith('ming-ui/')) return Leaf;
    if (name === 'antd') return { Dropdown: Leaf };
    if (name === '@rc-component/trigger') return Leaf;
    if (name === 'src/common/preall') return (Type: unknown) => Type;
    if (name === 'src/utils/common') return { browserIsMobile: () => false, pathCompletion: (x: unknown) => x };
    if (name === 'src/utils/project') return { dateConvertToUserZone: (x: unknown) => x };
    if (name === 'src/utils/pssId') return { getPssId: () => 'fixture' };
    if (name === 'src/pages/chat/utils/socket' || /(?:^|\/)utils\/socket$/.test(name)) return socket;
    if (name === 'src/pages/chat/utils/config') return load('src/pages/chat/utils/config.ts');
    if (name.startsWith('src/api/')) return load(name + '.ts');
    if (name === '../../utils' || name === '../../utils/' || name === '../utils' || name === '../utils/') return realUtils;
    if (name === '../ChatPanelSession') return Leaf;
    if (name === './inboxList' || name === './baseComponent/inboxFilter') return Leaf;
    if (name === 'react-dom/client') return { createRoot: () => { throw new Error('Unexpected real mount'); } };
    if (name.startsWith('.')) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
      const found = ['.ts', '.tsx', '/index.ts', '/index.tsx', ''].map(ext => base + ext).find(p => fs.existsSync(path.join(harness.ROOT, p)));
      if (found) return load(found);
    }
    return require(name);
  };
  new Function('module', 'exports', 'require', 'mdyAPI', transformed.code)(module, module.exports, localRequire, sdk);
  return module.exports;
}
const prefix = 'src/pages/chat/components/Inbox/';
const constants = load(prefix + 'constants.ts');
const ids = Object.values(constants['INBOXTYPES'] as Data) as string[];
const Inbox = load(prefix + 'components/Inbox.tsx')['default'] as Constructor;
const Panel = (load('src/pages/chat/containers/ChatPanel/index.tsx')['default'] as { WrappedComponent: Constructor }).WrappedComponent;
const Header = (load(prefix + 'components/inboxHeader.tsx')['default'] as { WrappedComponent: Constructor }).WrappedComponent;
const actions = load('src/pages/chat/redux/actions.ts') as Record<string, (...args: unknown[]) => unknown>;
const reducer = load('src/pages/chat/redux/reducers.ts')['default'] as (state: Data | undefined, action: Data) => Data;
function dispatch(value: unknown): unknown {
  if (typeof value === 'function') return value(dispatch, () => ({ chat: state }));
  const action = value as Data; dispatched.push(action); state = reducer(state, action); return action;
}
function subject(Type: Constructor, props: Data): Subject {
  const instance = new Type(props);
  instance.setState = (patch, callback) => { trace.push('state:' + Object.keys(patch).join(',')); Object.assign(instance.state, patch); callback?.call(instance); };
  return instance;
}
function panel() { return subject(Panel, { ...state, dispatch }); }
function nodes(value: unknown): Element[] {
  if (!value || typeof value !== 'object') return [];
  const e = value as Element; if (!e.props) return [];
  const kids = e.props['children']; return [e, ...(Array.isArray(kids) ? kids.flat() : [kids]).flatMap(nodes)];
}
function pending() {
  let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
  const children: Promise<unknown>[] = [];
  const request = Object.assign(new Promise<unknown>((yes, no) => { resolve = yes; reject = no; }), { abort() { assert.equal(this, request); trace.push('abort'); } });
  const then = request.then;
  Object.defineProperty(request, 'then', { value: function(this: typeof request, ...args: unknown[]) {
    const child: Promise<unknown> = Reflect.apply(then, this, args); children.push(child); void child.catch(() => {}); return child;
  } });
  return { request, resolve, reject, children };
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function realMembership(): (value: unknown) => boolean {
  const file = 'src/pages/chat/utils/index.ts', source = harness.readSource(file);
  const ast = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript'] });
  const statement = ast.program.body.find(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration' && n.declaration.declarations.some(d => d.id.type === 'Identifier' && d.id.name === 'getIsInbox'));
  if (!statement || statement.start == null || statement.end == null) throw new Error('Missing actual getIsInbox');
  const transformed = harness.transformSync(source.slice(statement.start, statement.end), { filename: path.join(harness.ROOT, file) });
  if (!transformed?.code) throw new Error('Missing compiled membership');
  const module = { exports: {} as Data };
  new Function('module', 'exports', '_', 'INBOXTYPES', transformed.code)(module, module.exports, lodash, constants['INBOXTYPES']);
  return module.exports['getIsInbox'] as (value: unknown) => boolean;
}
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  calls.length = 0; dispatched.length = 0; trace.length = 0;
  state = reducer(undefined, { type: '@@fixture' });
  await run(); passed++; console.log('  ✓ ' + name);
}
async function main() {
  await check('actual getIsInbox accepts exactly the eight declared values, without coercing unknown inputs', () => {
    const membership = realMembership(); for (const id of ids) assert.equal(membership(id), true);
    let conversions = 0;
    for (const id of [undefined, null, '', 0, 3, 'toString', 'constructor', '__proto__', ['post'], { toString() { conversions++; return 'post'; } }]) assert.equal(membership(id), false);
    assert.equal(conversions, 0);
  });
  await check('all eight real Inbox tables render their exact own dropdown values and labels', () => {
    const groups = constants['DROPDOWN_GROUPLIST'] as Record<string, string[]>;
    const labels = constants['TYPE_GROUP'] as Record<string, Record<string, string>>;
    for (const inboxType of ids) {
      const inbox = subject(Inbox, { inboxType }); assert.equal(inbox.state['type'], groups[inboxType]![0]);
      const child = inbox.renderHeader(); const header = subject(Header, { ...child.props, currentSession: {}, sessionList: [], dispatch });
      const tree = header.renderDropDown(); const dropdown = nodes(tree).find(n => n.type === Leaf && n.props['data']);
      if (groups[inboxType]!.length > 1) assert.deepEqual(dropdown!.props['data'], groups[inboxType]!.map(value => ({ value, text: labels[inboxType]![value] })));
      else assert.equal(tree.props['children'], labels[inboxType]![groups[inboxType]![0]!]);
    }
  });
  await check('inherited IDs are rejected with the existing unknown-type error, while historical mode records the old defect', () => {
    for (const inboxType of ['toString', 'constructor', '__proto__']) {
      if (process.env['INBOX_IDENTITY_BEFORE'] === '1') {
        const inbox = subject(Inbox, { inboxType }); assert.equal(inbox.state['type'], undefined);
        assert.equal(Object.hasOwn(inbox.state, 'type'), true);
      } else {
        assert.throws(() => subject(Inbox, { inboxType }), { name: 'Error', message: 'type in options not recognized!' });
        assert.throws(() => panel().renderInbox({ id: inboxType, iconType: 'system' }), { name: 'Error', message: 'type in options not recognized!' });
      }
    }
    for (const inboxType of [undefined, 'unknown']) assert.throws(() => subject(Inbox, { inboxType }), { name: 'Error', message: 'type in options not recognized!' });
  });
  await check('real addCurrentInbox/action/reducer/view preserve clone boundaries, source getters and the exact supported ID', () => {
    const metadata = {};
    const item = { id: 'post', value: 'post', iconType: 'post', get extension() { trace.push('extension:get'); return metadata; } };
    const p = panel(); p.inboxSessionItem(item);
    const stored = (state['currentInboxList'] as Data[])[0]!;
    assert.notEqual(stored, item); assert.equal(stored['extension'], metadata); assert.deepEqual(trace.slice(0, 2), ['state:isError', 'extension:get']);
    assert.equal(Object.hasOwn(item, 'requestNow'), false); assert.equal(typeof stored['requestNow'], 'number');
    const idsRead: string[] = [], current = { get value() { idsRead.push('current'); return 'post'; }, count: 2, weak_count: 1 };
    const sequence = ['post', 'post', 'post', 'post', 'post', 'post']; let reads = 0;
    const raw = { get id() { idsRead.push('item'); return sequence[reads++]; }, requestNow: 7 };
    p.props = { ...p.props, currentSession: current };
    const tree = p.renderInbox(raw); const inbox = nodes(tree).find(n => n.type === Inbox)!;
    assert.equal(inbox.props['inboxType'], 'post'); assert.equal(inbox.props['requestNow'], 7);
    assert.deepEqual(idsRead, ['current', 'item', 'item', 'current', 'item', 'current', 'item', 'current', 'item', 'item']);
  });
  await check('normal user lookup uses the actual SDK wrapper, same abortable request and real Redux session insertion', async () => {
    const p = pending(); response = p.request; const view = panel(); const source = { type: '1', value: 'file-transfer' };
    view.chatSessionItem(source); assert.equal(view.ajax, p.request);
    assert.deepEqual(calls[0], { controller: 'User', action: 'GetAccountBaseInfo', args: { accountId: 'file-transfer' }, options: { ajaxOptions: { timeout: 3000 }, silent: true } });
    const returned = { accountId: 'file-transfer', fullname: 'Transfer', extension: {} };
    p.resolve(returned); await flush(); assert.equal(returned['isContact' as keyof typeof returned], true);
    const session = (state['currentSessionList'] as Data[])[0]!; assert.equal(session['id'], 'file-transfer'); assert.equal(session['isContact'], true);
    assert.notEqual(session, returned); assert.equal(session['extension'], returned.extension); assert.equal(view.state['loading'], false);
  });
  await check('group lookup retains group/member/status branches and the empty-branch request absence', async () => {
    for (const [body, added] of [[{ groupId: 'g', isMember: true, status: 1 }, true], [{ groupId: 'g', isMember: false, status: 1 }, false], [{ groupId: 'g', isMember: true, status: 2 }, false]] as const) {
      state = reducer(undefined, { type: '@@fixture' }); const p = pending(); response = p.request;
      const view = panel(); view.chatSessionItem({ type: 2, value: 'g' }); p.resolve(body); await flush();
      assert.equal((state['currentSessionList'] as unknown[]).length, added ? 1 : 0); assert.equal(view.state['loading'], false);
    }
    calls.length = 0; const view = panel(); view.chatSessionItem({ type: 99, value: 'x' }); assert.equal(calls.length, 0); assert.equal(view.state['loading'], false);
  });
  await check('null successful bodies keep native failures and SDK rejection keeps the original error/loading state', async () => {
    for (const body of [null, undefined]) {
      const p = pending(); response = p.request; const view = panel(); view.chatSessionItem({ type: 2, value: 'g' }); p.resolve(body);
      await assert.rejects(p.children[0]!, TypeError); await flush(); assert.equal(view.state['isError'], true); assert.equal(view.state['error'], undefined); assert.equal(view.state['loading'], false);
    }
    const p = pending(); response = p.request; const view = panel(); view.chatSessionItem({ type: 1, value: 'u' });
    p.reject({ errorMessage: 'failed' }); await flush(); assert.equal(view.state['error'], 'failed'); assert.equal(view.state['loading'], true);
  });
  await check('notification logic really reads numeric currentSession.type; the previous always-false claim is incorrect', () => {
    const numeric = subject(Header, { currentSession: { type: 2, isPush: false, isSilent: false }, dispatch });
    const text = nodes(numeric.renderMenu()).flatMap(n => typeof n.props['children'] === 'string' ? [n.props['children']] : []);
    assert.equal(text.includes('允许提醒'), true);
    const uncheckedText = subject(Header, { currentSession: { type: '2', isPush: false, isSilent: false }, dispatch });
    const legacy = nodes(uncheckedText.renderMenu()).flatMap(n => typeof n.props['children'] === 'string' ? [n.props['children']] : []);
    assert.equal(legacy.includes('消息免打扰'), true);
  });
  await check('own group text getters are read once; inherited dropdown keys no longer supply prototype objects', () => {
    const groups = constants['TYPE_GROUP'] as Record<string, Data>;
    const descriptor = Object.getOwnPropertyDescriptor(groups['post']!, '2')!; let reads = 0;
    Object.defineProperty(groups['post']!, '2', { configurable: true, enumerable: true, get() { reads++; return 'own text'; } });
    try {
      const header = subject(Header, { inboxType: 'post', type: '2', dropdownData: ['2', 'constructor'], currentSession: {}, dispatch });
      const dropdown = nodes(header.renderDropDown()).find(n => n.type === Leaf && n.props['data'])!;
      const data = dropdown.props['data'] as Data[];
      assert.equal(data[0]!['text'], 'own text'); assert.equal(reads, 1);
      assert.equal(typeof data[1]!['text'], process.env['INBOX_IDENTITY_BEFORE'] === '1' ? 'function' : 'undefined');
    } finally { Object.defineProperty(groups['post']!, '2', descriptor); }
    const empty = subject(Header, { inboxType: 'post', dropdownData: [], currentSession: {}, dispatch });
    assert.throws(() => empty.renderDropDown(), TypeError);
  });
  await check('the actual group endpoint preserves callable metadata, SDK modes, options and raw response identity', () => {
    const endpoint = (load('src/api/chat.ts')['default'] as Record<string, (args: Data, options?: Data) => unknown>)['getGroupInfo']!;
    assert.equal(endpoint.name, 'getGroupInfo'); assert.equal(endpoint.length, 1);
    const args = { groupId: 'g' };
    for (const options of [{ silent: true }, { ajaxOptions: { sync: true } }, { customParseResponse: true }, { agent: true }]) {
      response = { opaque: {} }; assert.equal(endpoint(args, options), response);
      assert.equal(calls.at(-1)!.args, args); assert.equal(calls.at(-1)!.options, options);
    }
  });
  await check('request replacement aborts the same request receiver and retains the original stale-response insertion', async () => {
    const older = pending(); response = older.request; const view = panel(); view.chatSessionItem({ type: 1, value: 'old' });
    const newer = pending(); response = newer.request; view.chatSessionItem({ type: 1, value: 'new' });
    assert.equal(trace.filter(x => x === 'abort').length, 1); assert.equal(view.ajax, newer.request);
    newer.resolve({ accountId: 'new', isContact: true }); await flush();
    older.resolve({ accountId: 'old', isContact: true }); await flush();
    assert.deepEqual((state['currentSessionList'] as Data[]).map(x => x['id']), ['new', 'old']);
  });
  await check('own undefined lookup fields and missing request IDs remain visible through actual lookup consumption', async () => {
    const p = pending(); response = p.request; const view = panel();
    view.chatSessionItem({ type: 1, value: undefined });
    const returned = { accountId: 'u', isContact: undefined, groupId: undefined, isMember: undefined };
    p.resolve(returned); await flush();
    assert.equal(Object.hasOwn(returned, 'isContact'), true); assert.equal(returned.isContact, undefined);
    assert.equal(calls[0]!.args['accountId'], undefined); assert.equal(Object.hasOwn(calls[0]!.args, 'accountId'), true);
    assert.equal(view.state['isError'], false); assert.equal(view.state['loading'], false);
  });
  console.log('Inbox identity and actual session lookup pipeline passed: ' + passed + ' checks');
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
