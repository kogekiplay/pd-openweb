/** Real URL parser, entry, Window, SDK wrappers, socket registration, utility formatting and Redux consumption. */
import type { ChatWindowFixture } from '../../../../../scripts/spec-fixtures/chatWindowLoader';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { makeFixture } = require('../../../../../scripts/spec-fixtures/chatWindowLoader.ts') as { makeFixture(): ChatWindowFixture };
const qs: typeof import('query-string').default = require('query-string').default;
type Data = Record<string, unknown>;
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) { await run(); passed++; console.log('  ✓ ' + name); }
function sessionFrom(f: ChatWindowFixture, search: string): Data {
  const found = f.nodes(f.entryFor(search)).find(node => 'session' in node.props);
  assert.ok(found, 'Valid query must mount the connected Window'); return found.props['session'] as Data;
}
async function main() {
  await check('actual user lookup preserves SDK options, side-effect order, own undefined and Redux payload references', async () => {
    const f = makeFixture(), session = sessionFrom(f, '?id=u&type=1&name=first&name=second&extra=x&extra=y');
    assert.deepEqual(session['extra'], ['x', 'y']);
    assert.equal(f.entryFor('?id=u&type=1&name=first&name=second').props['title'], 'first,second');
    const instance = f.windowFor(session), response = { accountId: 'u', fullname: 'User', avatar: undefined, isContact: undefined };
    f.trace.length = 0; instance.componentDidMount();
    assert.deepEqual(f.calls, [{ controller: 'User', action: 'GetAccountBaseInfo', args: { accountId: 'u' }, options: { ajaxOptions: { timeout: 3000 }, silent: true } }]);
    assert.deepEqual(f.trace, ['sdk:User.GetAccountBaseInfo', 'then', 'socketInit', 'on:new message', 'on:shake shake', 'on:new withdraw usermessage', 'contact', 'store:chat_window_u', 'listen:beforeunload']);
    assert.equal(instance.state['loading'], true); assert.equal(f.storage.get('chat_window_u'), 'true');
    assert.deepEqual(f.contacts, [{ value: 'u', type: 1 }]);
    f.resolve(response); await Promise.all(f.children);
    assert.deepEqual(f.dispatched.map(item => item['type']), ['UPDATE_IS_WINDOW', 'ADD_SESSION', 'SET_CURRENT_SESSION', 'REMOVE_INBOX_SESSION', 'ADD_CURRENT_SESSION']);
    const state = f.getState(), current = (state['currentSessionList'] as Data[])[0]!;
    assert.equal(state['isWindow'], true); assert.equal((state['currentSession'] as Data)['value'], 'u');
    assert.equal(current, f.dispatched[4]!['result']); assert.notEqual(current, response);
    assert.equal(Object.hasOwn(current, 'isContact'), true); assert.equal(current['isContact'], undefined);
    assert.deepEqual(response, { accountId: 'u', fullname: 'User', avatar: undefined, isContact: undefined });
    assert.equal((state['sessionList'] as Data[])[0]!['value'], 'u'); assert.equal(instance.state['loading'], false);
    instance.props['currentSessionList'] = state['currentSessionList'];
    const rendered = f.nodes(instance.render()).find(node => 'session' in node.props)!;
    assert.equal(rendered.props['session'], current); assert.equal(rendered.key, 'u');
    f.listeners.get('beforeunload')!(); assert.equal(f.storage.has('chat_window_u'), false); assert.deepEqual(f.contacts.at(-1), {});
  });
  await check('actual group response getter order and event callbacks retain receiver and Redux consumption', async () => {
    const f = makeFixture(), instance = f.windowFor(sessionFrom(f, '?id=g&type=2'));
    const getters: string[] = [];
    const fields = { name: 'Group', groupId: 'g', from: undefined, avatar: undefined, groupMemberCount: 3 };
    const reply = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value]));
    for (const [key, value] of Object.entries(fields)) Object.defineProperty(reply, key, { enumerable: true, get() { getters.push(key); return value; } });
    instance.componentDidMount(); f.resolve(reply); await Promise.all(f.children);
    assert.deepEqual(f.calls[0], { controller: 'Chat', action: 'GetGroupInfo', args: { groupId: 'g' }, options: { ajaxOptions: { timeout: 3000 }, silent: true } });
    assert.deepEqual(getters, ['name', 'groupId', 'from', 'avatar', 'name', 'groupId', 'from', 'avatar', 'groupMemberCount']);
    const state = f.getState(), current = (state['currentSessionList'] as Data[])[0]!;
    assert.equal(current['groupId'], 'g'); assert.equal(current['id'], 'g'); assert.equal(current['isGroup'], true);
    f.handlers.get('group member added')!({ id: 'g', users: ['a', 'b'] });
    assert.equal((f.getState()['currentSessionList'] as Data[])[0]!['groupMemberCount'], 5);
    assert.equal(f.handlers.has('new message'), false);
    assert.deepEqual(f.contacts, [{ value: 'g', type: 2 }, { value: 'g', id: 'g' }]);
  });
  await check('the existing module mount latch still permits one request/socket registration only', () => {
    const f = makeFixture(); f.windowFor({ id: 'u', type: 1 }).componentDidMount();
    f.windowFor({ id: 'other', type: 2 }).componentDidMount();
    assert.equal(f.calls.length, 1); assert.equal(f.trace.filter(value => value === 'socketInit').length, 1);
  });
  await check('null or undefined lookup replies fail natively in the original asynchronous read', async () => {
    for (const value of [null, undefined]) {
      const f = makeFixture(), instance = f.windowFor({ id: 'u', type: '1' });
      instance.componentDidMount(); f.resolve(value);
      await assert.rejects(f.children[0]!, TypeError);
      assert.equal(f.dispatched.length, 0); assert.equal(instance.state['loading'], true);
    }
  });
  await check('SDK synchronous throws, invalid request handles and rejection reasons retain native failures', async () => {
    const failure = new Error('SDK failure');
    const f = makeFixture(); f.setSdkFailure(failure);
    assert.throws(() => f.windowFor({ id: 'u', type: '1' }).componentDidMount(), error => error === failure);
    assert.equal(f.trace.includes('socketInit'), false);
    const missing = makeFixture(); missing.setSdkResult(undefined);
    assert.throws(() => missing.windowFor({ id: 'u', type: '1' }).componentDidMount(), TypeError);
    const rejected = makeFixture(); rejected.windowFor({ id: 'g', type: '2' }).componentDidMount(); rejected.reject(failure);
    await assert.rejects(rejected.children[0]!, error => error === failure); assert.equal(rejected.dispatched.length, 0);
  });
  await check('malformed raw queries display feedback without consuming the mount latch or starting a request', () => {
    const f = makeFixture();
    for (const search of ['', '?id=u', '?id=u&type', '?id=u&type=9', '?id=u&type=1&type=2', '?id=u&id=v&type=1', '?type=1', '?id&type=2', '?id=&type=2']) {
      const nodes = f.nodes(f.entryFor(search));
      assert.equal(nodes.some(node => 'session' in node.props), false, search);
      const feedback = nodes.find(node => node.props['role'] === 'alert'); assert.ok(feedback, search);
      assert.equal(feedback.props['children'], '链接参数无效');
    }
    assert.equal(f.calls.length, 0); assert.equal(f.handlers.size, 0); assert.equal(f.listeners.size, 0);
    f.windowFor(sessionFrom(f, '?id=valid&type=1')).componentDidMount(); assert.equal(f.calls.length, 1);
  });
  await check('real opener encodes names and IDs, and its URL round-trips through the actual entry', () => {
    const f = makeFixture(); const opener = f.load('src/pages/chat/utils/index.ts')['windowOpen'] as (id: string, name: string, group: boolean) => void;
    for (const group of [false, true]) {
      const id = 'a&b#?=% +中文', name = 'R&D&type=2# 中文+%'; opener(id, name, group);
      const [url, target, options] = f.opened.at(-1)!;
      assert.equal(target, '_blank'); assert.equal(options, 'width=930,height=598,toolbar=no,menubar=no,location=no,status=no,top=170,left=235');
      const search = String(url).slice(String(url).indexOf('?'));
      assert.deepEqual({ ...qs.parse(search) }, { id, name, type: group ? '2' : '1' });
      const session = sessionFrom(f, search); assert.equal(session['id'], id); assert.equal(session['name'], name);
    }
  });
  await check('public input guard narrows scalar canonical identities without cloning or coercing raw objects', () => {
    const f = makeFixture(); const guard = f.load('src/pages/chat/utils/windowSession.ts')['isChatWindowSession'] as (value: unknown) => boolean;
    for (const type of [1, 2, '1', '2']) assert.equal(guard({ id: 'u', type }), true);
    let conversions = 0;
    for (const value of [null, undefined, [], {}, { id: 'u', type: ['1'] }, { id: ['u'], type: '1' }, { id: '', type: '1' }, { id: undefined, type: '1' }, { id: 'u', type: { valueOf() { conversions++; return 1; } } }]) assert.equal(guard(value), false);
    assert.equal(conversions, 0);
    const raw = qs.parse('id=u&type=1&extra=x&extra=y'), before = Object.getOwnPropertyDescriptors(raw);
    assert.equal(guard(raw), true); assert.deepEqual(Object.getOwnPropertyDescriptors(raw), before);
  });
  console.log(`chat/Window full modules: ${passed} checks passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
