/** Actual parent/Info/search row/announcement/actions/reducer/MessageView; SDK, DOM host and sibling UI leaves controlled. */
import type { ChatWindowFixture } from '../../../../../scripts/spec-fixtures/chatWindowLoader';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { makeFixture } = require('../../../../../scripts/spec-fixtures/chatWindowLoader.ts') as { makeFixture(options: { uiLeaves: string[] }): ChatWindowFixture };
type Data = Record<string, unknown>;
interface Element { type: unknown; props: Data; key?: unknown; }
interface Subject {
 props: Data; state: Data; first: boolean; scrollView?: unknown;
 render(): Element; setState(patch: Data): void; componentDidUpdate(prev: Data): void;
 handleSetPanelVisible(type: string, visible: boolean): void; handleGotoMessage(message: Data): void;
 handleOpenSession(user: Data): void; handleSearchText(text: string): void; handleOpenFile(open: boolean): void;
 handleBlur(event: { target: { value: string } }): void; renderMessage(message: Data): Element;
}
type Constructor = new (props: Data) => Subject;
const prefix = 'src/pages/chat/';
const uiLeaves = ['components/CardToolbar', 'components/MessageSendText', 'components/SendToolbar', 'components/Textarea', 'containers/ChatPanelHeader', 'containers/Message', 'components/DiscussionAnnouncement', 'components/Feeds', 'components/Feeds/Panel', 'components/Files/Panel', 'components/Members', 'components/Members/Panel', 'components/SearchPanel'].map(p => prefix + p);
function make() {
 const f = makeFixture({ uiLeaves });
 const Info = (f.load(prefix + 'containers/ChatPanelSessionInfo/index.tsx')['default'] as { WrappedComponent: Constructor }).WrappedComponent;
 const updates: Data[] = [];
 function subject(Type: Constructor, props: Data): Subject {
  const instance = new Type(props); instance.setState = patch => { updates.push(patch); Object.assign(instance.state, patch); }; return instance;
 }
 function info(props: Data = {}) { return subject(Info, { ...f.getState(), dispatch: f.dispatch, session: {}, infoVisible: false, isOpenFile: false, searchText: '', ...props }); }
 function node(instance: Subject, suffix: string): Element {
  const result = f.nodes(instance.render()).find(item => typeof item.type === 'function' && Reflect.get(item.type, 'fixturePath') === prefix + suffix);
  assert.ok(result, suffix); return result;
 }
 return { ...f, subject, info, updates, node };
}
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) { await run(); passed++; console.log('  ✓ ' + name); }
async function main() {
 await check('actual owner passes the same session and changes search/files visibility through real handlers', () => {
  const f = make(), Wrapper = (f.load(prefix + 'containers/ChatPanelSession/index.tsx')['default'] as { WrappedComponent: Constructor }).WrappedComponent;
  const session = { id: 'g', isGroup: true, isContact: true };
  const wrapper = f.subject(Wrapper, { ...f.getState(), session, dispatch: f.dispatch });
  const connected = f.nodes(wrapper.render()).find(item => item.props['session'] === session)!;
  const Parent = (connected.type as { WrappedComponent: Constructor }).WrappedComponent;
  const parent = f.subject(Parent, { ...f.getState(), ...connected.props, dispatch: f.dispatch });
  const child = () => f.nodes(parent.render()).find(item => item.type === f.load(prefix + 'containers/ChatPanelSessionInfo/index.tsx')['default'] && item.props['session'] === session && 'infoVisible' in item.props)!.props;
  assert.equal(child()['session'], session); assert.equal(child()['infoVisible'], true);
  parent.handleSearchText('term'); assert.deepEqual([child()['searchText'], child()['isOpenFile'], child()['infoVisible']], ['term', false, true]);
  parent.handleOpenFile(true); assert.deepEqual([child()['searchText'], child()['isOpenFile'], child()['infoVisible']], ['', true, true]);
 });
 await check('complete Info update preserves shallow-equal skip, sticky first flag and ordered search/files precedence', () => {
  const f = make(), instance = f.info();
  instance.componentDidUpdate({ ...instance.props }); assert.deepEqual(f.updates, []); assert.equal(instance.first, false);
  const prev = instance.props; instance.props = { ...prev, infoVisible: true }; instance.componentDidUpdate(prev); assert.equal(instance.first, true);
  instance.state = { panelType: 'members', panelVisible: true }; f.updates.length = 0;
  instance.setState = patch => { f.updates.push(patch); };
  const before = instance.props; instance.props = { ...before, infoVisible: false, searchText: 'term', isOpenFile: true };
  instance.componentDidUpdate(before);
  assert.deepEqual(f.updates, [{ panelType: '', panelVisible: false }, { panelVisible: true, panelType: 'search' }, { panelVisible: true, panelType: 'files' }]);
  Object.assign(instance.state, ...f.updates);
  assert.deepEqual(instance.state, { panelType: 'files', panelVisible: true }); assert.equal(instance.first, true);
  instance.state = { panelType: 'search', panelVisible: true }; f.updates.length = 0;
  const opened = instance.props; instance.props = { ...opened, searchText: '', isOpenFile: false };
  instance.componentDidUpdate(opened);
  assert.deepEqual(f.updates, [{ panelType: '', panelVisible: false }, { panelVisible: false, panelType: '' }]);
 });
 await check('actual rendered bound child callbacks preserve panel identities and reset on false', () => {
  const f = make(), instance = f.info({ infoVisible: true, session: { isGroup: true, isPost: true } });
  for (const [child, panel] of [['components/Members', 'members'], ['components/Feeds', 'feeds']]) {
   const callback = f.node(instance, child!) .props['onSetPanelVisible'] as (open: boolean, event?: unknown) => void;
   callback(true, { ignored: 'event' }); assert.deepEqual(instance.state, { panelType: panel, panelVisible: true });
   callback(false); assert.deepEqual(instance.state, { panelType: '', panelVisible: false });
  }
  instance.handleSetPanelVisible('search', true);
  const callback = f.node(instance, 'components/SearchPanel').props['onSetPanelVisible'] as (open: boolean) => void;
  callback(false); assert.deepEqual(instance.state, { panelType: '', panelVisible: false });
 });
 await check('real search row retains message reference and forwards numeric/string/missing IDs into Redux without conversion', () => {
  for (const id of ['m', 42, 0, undefined]) {
   const f = make(), instance = f.info();
   instance.handleSetPanelVisible('search', true);
   const callback = f.node(instance, 'components/SearchPanel').props['onGotoMessage'] as (message: Data) => void;
   const Messages = f.load(prefix + 'components/SearchPanel/Messages.tsx')['default'] as Constructor;
   let received: Data | undefined;
   const row = f.subject(Messages, { onGotoMessage: (value: Data) => { received = value; callback(value); } });
   const message = { id, fromAccount: { logo: '/a', name: 'User' }, time: 'now', content: 'text' };
   const rendered = row.renderMessage(message); (rendered.props['onClick'] as (event: unknown) => void)({ ignored: true });
   assert.equal(received, message); assert.deepEqual(f.dispatched.at(-1), { type: 'SET_GOTO_MESSAGE', id: undefined, messageId: id });
   const table = f.getState()['gotoMessage'] as Data; assert.equal(Object.hasOwn(table, 'undefined'), true); assert.equal(table['undefined'], id);
  }
 });
 await check('getter order and original synchronous getter/native failures stay at actual Info/action boundaries', () => {
  const f = make(), trace: string[] = [], instance = f.info();
  const session = Object.defineProperty({}, 'id', { get() { trace.push('id'); return undefined; } });
  Object.defineProperty(instance.props, 'session', { get() { trace.push('session'); return session; } });
  Object.defineProperty(instance.props, 'dispatch', { get() { trace.push('dispatch'); return f.dispatch; } });
  instance.handleGotoMessage(Object.defineProperty({}, 'id', { get() { trace.push('message'); return 42; } }));
  assert.deepEqual(trace, ['message', 'session', 'dispatch', 'id']);
  const failure = new Error('ID getter');
  assert.throws(() => instance.handleGotoMessage(Object.defineProperty({}, 'id', { get() { throw failure; } })), error => error === failure);
  assert.throws(() => instance.handleGotoMessage(undefined as unknown as Data), TypeError);
  assert.throws(() => instance.handleOpenSession(undefined as unknown as Data), TypeError);
 });
 await check('legacy primitive/object Symbol keys retain native ToPropertyKey without forcing String conversion', () => {
  for (const exotic of [false, true]) {
   const f = make(), key = Symbol('legacy'), hints: string[] = [];
   const raw = exotic ? { [Symbol.toPrimitive](hint: string) { hints.push(hint); return key; } } : key;
   f.info({ session: { id: raw } }).handleGotoMessage({ id: 42 });
   const table = f.getState()['gotoMessage'] as Data;
   assert.equal(Reflect.get(table, key), 42); assert.deepEqual(Reflect.ownKeys(table), [key]);
   assert.deepEqual(hints, exotic ? ['string'] : []);
   const remove = f.load(prefix + 'redux/actions.ts')['removeGotoMessage'] as (id: unknown) => unknown;
   f.dispatch(remove(raw)); assert.equal(Reflect.has(table, key), false);
  }
 });
 await check('actual MessageView consumes numeric target for a missing session ID and retains original delete-then-clone', () => {
  const f = make(), instance = f.info(); instance.handleGotoMessage({ id: 42 });
  const table = f.getState()['gotoMessage'] as Data;
  const View = (f.load(prefix + 'containers/MessageView/index.tsx')['default'] as { WrappedComponent: Constructor }).WrappedComponent;
  const message = { id: 42 }, messages = { undefined: [message] }, selectors: string[] = [], scroll: unknown[] = [];
  Reflect.set(globalThis, '$', (selector: string) => { selectors.push(selector); return { position: () => ({ top: 100 }), height: () => 20, find: () => ({ addClass: () => ({ on: () => {} }) }) }; });
  const view = f.subject(View, { ...f.getState(), session: {}, messages, dispatch: f.dispatch });
  view.scrollView = { scrollTo: (options: unknown) => { scroll.push(options); }, getScrollInfo: () => ({ clientHeight: 200, scrollTop: 50 }) };
  view.componentDidUpdate({ ...view.props, gotoMessage: {} });
  assert.deepEqual(scroll, [{ top: 60 }]); assert.equal(selectors[0], '#Message-42');
  assert.equal(f.dispatched.at(-1)!['type'], 'REMOVE_GOTO_MESSAGE'); assert.equal(f.dispatched.at(-1)!['id'], undefined);
  assert.equal(Object.hasOwn(table, 'undefined'), false); assert.notEqual(f.getState()['gotoMessage'], table);
 });
 await check('the original falsy numeric-zero target remains stored and does not start a message lookup', () => {
  const f = make(), instance = f.info(); instance.handleGotoMessage({ id: 0 });
  const View = (f.load(prefix + 'containers/MessageView/index.tsx')['default'] as { WrappedComponent: Constructor }).WrappedComponent;
  const view = f.subject(View, { ...f.getState(), session: {}, messages: { undefined: [] }, dispatch: f.dispatch });
  view.componentDidUpdate({ ...view.props, gotoMessage: {} });
  assert.equal((f.getState()['gotoMessage'] as Data)['undefined'], 0); assert.equal(f.calls.length, 0);
 });
 await check('actual announcement callback and group conversion preserve missing groupId and existing store object references', async () => {
  const f = make(); const actions = f.load(prefix + 'redux/actions.ts') as Record<string, (...args: unknown[]) => unknown>;
  f.dispatch(actions['addCurrentSession']!({ groupId: undefined, accountId: undefined, about: 'old' }));
  const session = (f.getState()['currentSessionList'] as Data[])[0]!;
  const instance = f.info({ infoVisible: true, session: { ...session, isPost: true } });
  const Announcement = f.load(prefix + 'components/Announcement/index.tsx')['default'] as Constructor;
  const element = f.nodes(instance.render()).find(node => node.type === Announcement)!;
  const announcement = f.subject(Announcement, element.props); announcement.handleBlur({ target: { value: 'new text' } });
  assert.deepEqual(f.calls[0]!['args'], { groupId: undefined, groupAbout: 'new text' });
  f.resolve(true); await Promise.all(f.children); assert.equal(session['about'], 'new text');
  assert.equal((f.getState()['currentSessionList'] as Data[])[0], session);
  instance.props['session'] = session;
  const discussion = f.node(instance, 'components/DiscussionAnnouncement');
  const project = { projectId: 'p', companyName: 'Company' };
  const host = Reflect.get(globalThis, 'md') as { global: { Account: { projects: Data[] } } }; host.global.Account.projects = [project];
  (discussion.props['onChangeIsPost'] as (id: string) => void)('p');
  assert.equal(session['project'], project); assert.equal(session['isPost'], true);
 });
 await check('real open-session callback preserves optional account fields and encoded standalone opener', async () => {
  const f = make(), instance = f.info({ isWindow: true });
  instance.handleOpenSession({ accountId: undefined, fullname: 'R&D', avatar: undefined });
  assert.equal(f.opened[0]![0], '/chat_window?id=undefined&name=R%26D&type=1');
  const requested = make(), embedded = requested.info({ isWindow: false });
  embedded.handleOpenSession({ accountId: undefined, fullname: undefined, avatar: undefined });
  assert.deepEqual(requested.calls[0]!['args'], { accountId: undefined });
  requested.resolve({ accountId: 'u', fullname: undefined, avatar: undefined }); await Promise.all(requested.children);
  assert.equal((requested.getState()['sessionList'] as Data[])[0]!['value'], undefined);
 });
 console.log(`chat/SessionInfo complete boundary: ${passed} checks passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
