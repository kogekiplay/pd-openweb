/** Run the full reply/star modules and their real API wrappers; only SDK transport and UI leaves are controlled. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');

type Data = Record<string, unknown>;
interface Subject {
  props: Data;
  state: Data;
  ajax?: unknown;
  setState(patch: Data, callback?: () => void): void;
  fetchReplyMsg(): false | undefined;
  clickHandler(flag: string): () => void;
  componentWillUnmount(): void;
  render(): unknown;
  fetchInboxList(): void;
  scrollEvent(): false | undefined;
  renderList(): unknown;
  renderNullDiv(): unknown;
  componentDidUpdate(props: Data): void;
}
type Constructor = new (props: Data) => Subject;
type Endpoint = (args: Data, options?: Data) => unknown;
interface Call {
  controller: string;
  action: string;
  args: Data;
  options: Data;
}
const calls: Call[] = [];
const trace: string[] = [];
let response: unknown;
let mobile = false;
let thrown: unknown;
const location = { href: 'https://fixture.test/windowChat' };
Reflect.set(globalThis, 'location', location);
const md = { global: { Account: { isPortal: false } } };
Reflect.set(globalThis, 'md', md);
Reflect.set(globalThis, '_l', (text: string) => text);
Reflect.set(globalThis, 'alert', (text: string, level?: number) => trace.push(`alert:${text}:${level}`));
const sdk = (controller: string, action: string, args: Data, options: Data): unknown => {
  calls.push({ controller, action, args, options });
  trace.push('request:' + action);
  if (thrown) throw thrown;
  return response;
};
const cache = new Map<string, Data>();
const Leaf = () => null;
const routedLeaves = {
  SystemMessage: () => null,
  PostReply: () => null,
  PostMention: () => null,
  CommonTopic: () => null,
};
function load(file: string): Data {
  if (cache.has(file)) return cache.get(file)!;
  const transformed = harness.transformFileSync(path.join(harness.ROOT, file));
  if (!transformed?.code) throw new Error('No compiled module ' + file);
  const module = { exports: {} as Data };
  cache.set(file, module.exports);
  const localRequire = (name: string): unknown => {
    if (name === 'src/utils/common') return { browserIsMobile: () => mobile };
    if (name === 'ming-ui/antd-components') return { Tooltip: Leaf };
    if (name.startsWith('ming-ui/')) return Leaf;
    if (name.startsWith('src/api/')) return load(name + '.ts');
    if (name === '../../constants' || name === '../constants')
      return load('src/pages/chat/components/Inbox/constants.ts');
    if (name === './wrappedComp') return routedLeaves;
    if (name === 'ming-ui') return { ScrollView: Leaf };
    if (name === 'antd') return { Divider: Leaf };
    if (name === './inboxMessage') return load('src/pages/chat/components/Inbox/components/inboxMessage.tsx');
    if (name === '../util') return load('src/pages/chat/components/Inbox/util.ts');
    if (name === './constants') return load('src/pages/chat/components/Inbox/constants.ts');
    if (name === '../../../redux/actions') return load('src/pages/chat/redux/actions.ts');
    if (file === 'src/pages/chat/redux/actions.ts' || file === 'src/pages/chat/redux/reducers.ts') {
      if (name.startsWith('../utils')) return { getToolbarConfig: () => ({}) };
      if (name === 'src/utils/project') return { dateConvertToUserZone: (x: unknown) => x };
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', 'mdyAPI', transformed.code)(localRequire, module, module.exports, sdk);
  return module.exports;
}
function subject(Type: Constructor, props: Data): Subject {
  const value = new Type(props);
  value.setState = (patch, callback) => {
    trace.push('state:' + Object.keys(patch).join(','));
    Object.assign(value.state, patch);
    callback?.call(value);
  };
  return value;
}
function pending() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const children: Promise<unknown>[] = [];
  const request = Object.assign(
    new Promise<unknown>((yes, no) => {
      resolve = yes;
      reject = no;
    }),
    {
      abort() {
        assert.equal(this, request);
        trace.push('abort');
      },
    },
  );
  const then = request.then;
  Object.defineProperty(request, 'then', {
    value: function (this: typeof request, ...args: unknown[]) {
      const child: Promise<unknown> = Reflect.apply(then, this, args);
      children.push(child);
      void child.catch(() => {});
      return child;
    },
  });
  return { request, resolve, reject, children };
}
const ReplyTo = load('src/pages/chat/components/Inbox/components/baseComponent/replyTo.tsx')['default'] as Constructor;
const Star = load('src/pages/chat/components/Inbox/components/baseComponent/star.tsx')['default'] as Constructor;
const constants = load('src/pages/chat/components/Inbox/constants.ts')['SOURCE_TYPE'] as Data;
const messageTypes = load('src/pages/chat/components/Inbox/constants.ts')['MSGTYPES'] as Data;
const route = load('src/pages/chat/components/Inbox/components/inboxMessage.tsx')['default'] as (props: {
  inboxItem: unknown;
}) => React.ReactElement<Data> | null;
const connectedList = load('src/pages/chat/components/Inbox/components/inboxList.tsx')['default'] as {
  WrappedComponent: Constructor;
};
const List = connectedList.WrappedComponent;
const reducer = load('src/pages/chat/redux/reducers.ts')['default'] as (state: Data | undefined, action: Data) => Data;
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  calls.length = 0;
  trace.length = 0;
  thrown = undefined;
  mobile = false;
  md.global.Account.isPortal = false;
  await run();
  passed++;
  console.log('  ✓ ' + name);
}
async function main() {
  await check(
    'full InboxMessage module uses real type constants and preserves original getter/override/reference semantics',
    () => {
      for (const [type, expected] of [
        ['SystemMessage', routedLeaves.SystemMessage],
        ['PostReply', routedLeaves.PostReply],
        ['PostMentionedUser', routedLeaves.PostMention],
        ['TaskComment', routedLeaves.CommonTopic],
      ]) {
        const sourceType = messageTypes[type as string];
        const reads: string[] = [];
        const post = { comments: [] },
          user = { accountId: 'self' },
          extension = { future: true };
        let typeReads = 0;
        const raw = Object.create(
          { inherited: extension },
          {
            inboxType: {
              enumerable: true,
              get() {
                reads.push('type');
                return typeReads++ ? 'invalid-second-read' : String(sourceType);
              },
            },
            Post: {
              enumerable: true,
              get() {
                reads.push('post');
                return post;
              },
            },
            CreateUser: { enumerable: true, value: user },
            extension: {
              enumerable: true,
              get() {
                reads.push('extension');
                return extension;
              },
            },
          },
        );
        const output = route({ inboxItem: raw });
        assert.ok(output);
        assert.equal(output.type, expected);
        assert.notEqual(output.props, raw);
        assert.equal(output.props['inboxType'], sourceType);
        assert.equal(output.props['Post'], post);
        assert.equal(output.props['CreateUser'], user);
        assert.equal(output.props['extension'], extension);
        assert.equal(output.props['inherited'], extension);
        assert.deepEqual(reads, ['type', 'type', 'post', 'extension']);
        assert.equal(Object.getOwnPropertyDescriptor(raw, 'inboxType')?.get instanceof Function, true);
      }
      assert.equal(route({ inboxItem: { inboxType: 'not-a-type' } }), null);
      assert.equal(route({ inboxItem: { inboxType: undefined } }), null);
      assert.throws(() => route({ inboxItem: null }), TypeError);
      assert.throws(() => route({ inboxItem: { inboxType: Symbol('invalid') } }), TypeError);
    },
  );
  await check(
    'actual API wrappers preserve request/args/options, fresh defaults and callable metadata in every SDK mode',
    () => {
      for (const [file, method, controller, action] of [
        ['post', 'getReplyMessage', 'Post', 'GetReplyMessage'],
        ['discussion', 'getDiscussionMsg', 'Discussion', 'GetDiscussionMsg'],
        ['inbox', 'setInboxFavorite', 'Inbox', 'SetInboxFavorite'],
        ['inbox', 'getInboxMessage', 'Inbox', 'GetInboxMessage'],
      ]) {
        const api = load(`src/api/${file}.ts`)['default'] as Record<string, Endpoint>;
        const endpoint = api[method!]!;
        assert.equal(endpoint.name, method);
        assert.equal(endpoint.length, 1);
        assert.equal(typeof endpoint.prototype, 'object');
        const args = { marker: {} };
        for (const options of [
          { silent: true },
          { ajaxOptions: { sync: true } },
          { customParseResponse: true },
          { isReadableStream: true },
          { agent: true },
        ]) {
          response = Object.freeze({ opaque: {} });
          assert.equal(endpoint(args, options), response);
          const call = calls.at(-1)!;
          assert.equal(call.controller, controller);
          assert.equal(call.action, action);
          assert.equal(call.args, args);
          assert.equal(call.options, options);
        }
        endpoint(args);
        const first = calls.at(-1)!.options;
        endpoint(args);
        assert.notEqual(calls.at(-1)!.options, first);
        assert.deepEqual(first, {});
        const failure = new Error('native transport failure');
        thrown = failure;
        assert.throws(
          () => endpoint(args),
          error => error === failure,
        );
        thrown = undefined;
      }
    },
  );
  await check(
    'ReplyTo forwards numeric/null/undefined IDs through the real wrappers and keeps the abort receiver',
    async () => {
      for (const replyId of [7, null, undefined]) {
        const p = pending();
        response = p.request;
        const value = subject(ReplyTo, { sourceType: constants['POST'], replyId, sourceId: undefined });
        assert.equal(value.fetchReplyMsg(), undefined);
        assert.equal(value.ajax, p.request);
        assert.deepEqual(calls.at(-1)!.args, { commentID: replyId, postID: undefined });
        assert.deepEqual(Object.keys(calls.at(-1)!.args), ['commentID', 'postID']);
        assert.equal(value.fetchReplyMsg(), false);
        value.componentWillUnmount();
        assert.equal(trace.at(-1), 'abort');
        let reads = 0;
        p.resolve({
          get Message() {
            reads++;
            return 'reply';
          },
        });
        await Promise.all(p.children);
        assert.equal(reads, 1);
        assert.deepEqual(value.state, { binded: false, replayMsg: 'reply', loading: false });
        assert.equal(value.fetchReplyMsg(), false);
      }
    },
  );
  await check(
    'discussion code/data getters and success with missing/explicit undefined/null bodies retain native state',
    async () => {
      for (const body of [{}, { data: undefined }, { data: null }, { data: '' }]) {
        const p = pending();
        response = p.request;
        const value = subject(ReplyTo, { sourceType: constants['TASK'], replyId: 9 });
        value.fetchReplyMsg();
        assert.equal(calls.at(-1)!.action, 'GetDiscussionMsg');
        assert.equal(calls.at(-1)!.args['discussionId'], 9);
        const reads: string[] = [];
        p.resolve({
          get code() {
            reads.push('code');
            return 1;
          },
          get data() {
            reads.push('data');
            return body.data;
          },
        });
        await Promise.all(p.children);
        assert.deepEqual(reads, ['code', 'data']);
        assert.equal(Object.hasOwn(value.state, 'replayMsg'), true);
        assert.equal(value.state['replayMsg'], body.data);
        assert.equal(value.state['loading'], false);
      }
    },
  );
  await check('post falsy body and discussion falsy code keep deletion fallback and data short circuit', async () => {
    for (const post of [true, false]) {
      const p = pending();
      response = p.request;
      const value = subject(ReplyTo, { sourceType: post ? constants['POST'] : 9 });
      value.fetchReplyMsg();
      p.resolve(
        post
          ? { Message: '' }
          : {
              code: 0,
              get data() {
                throw new Error('must not read');
              },
            },
      );
      await Promise.all(p.children);
      assert.equal(value.state['replayMsg'], '内容已删除');
    }
  });
  await check(
    'reply null responses and rejected transport retain original failures/loading; no fabricated successful body',
    async () => {
      for (const sourceType of [constants['POST'], 9]) {
        for (const invalid of [null, undefined]) {
          const p = pending();
          response = p.request;
          const value = subject(ReplyTo, { sourceType });
          value.fetchReplyMsg();
          p.resolve(invalid);
          await assert.rejects(p.children[0]!, TypeError);
          assert.equal(value.state['loading'], true);
          assert.equal(value.state['replayMsg'], null);
        }
        const p = pending();
        response = p.request;
        const value = subject(ReplyTo, { sourceType });
        value.fetchReplyMsg();
        const failure = new Error('rejected');
        p.reject(failure);
        await assert.rejects(p.children[0]!, error => error === failure);
        assert.equal(value.state['loading'], true);
      }
    },
  );
  await check(
    'Star uses the real finite endpoint without optimistic mutation and alerts only after the state callback',
    async () => {
      const p = pending();
      response = p.request;
      const value = subject(Star, { inboxId: 7, isFavorite: '0' });
      const click = value.clickHandler('1');
      assert.equal(calls.length, 0);
      click();
      assert.deepEqual(calls[0]!.args, { inboxId: 7, inboxFavorite: '1' });
      assert.equal(value.state['isFavorite'], '0');
      p.resolve(true);
      await Promise.all(p.children);
      assert.equal(value.state['isFavorite'], '1');
      assert.deepEqual(trace, ['request:SetInboxFavorite', 'state:isFavorite', 'alert:操作成功:undefined']);
      const failed = pending();
      response = failed.request;
      value.clickHandler('0')();
      failed.resolve(false);
      await Promise.all(failed.children);
      assert.equal(value.state['isFavorite'], '1');
      assert.equal(trace.at(-1), 'alert:操作失败:2');
      md.global.Account.isPortal = true;
      mobile = true;
      assert.equal(value.render(), null);
      mobile = false;
      assert(React.isValidElement(value.render()));
    },
  );
  await check(
    'actual Inbox API → list state → router preserves arrays, row references, getter reads and pagination',
    async () => {
      const p = pending();
      response = p.request;
      const row = { inboxId: 7, inboxType: messageTypes['PostReply'], Post: { comments: [] } };
      const rows = [row];
      const value = subject(List, {
        inboxType: 'post',
        type: '5',
        inboxFavorite: true,
        clearUnread: true,
        count: 1,
        filter: { user: { accountId: undefined }, startTime: null, endTime: undefined, appId: null },
        dispatch: () => {},
      });
      value.fetchInboxList();
      assert.equal(value.ajax, undefined);
      assert.equal(calls.at(-1)!.action, 'GetInboxMessage');
      assert.deepEqual(calls.at(-1)!.args, {
        pageIndex: 1,
        pageSize: 20,
        inboxFavorite: 1,
        type: '5',
        clearUnread: true,
        loadType: 2,
        creatorId: undefined,
        startTime: null,
        endTime: undefined,
        appId: null,
      });
      let reads = 0;
      p.resolve({
        get inboxList() {
          reads++;
          return rows;
        },
      });
      await Promise.all(p.children);
      assert.equal(reads, 1);
      assert.equal(value.state['list'], rows);
      assert.equal(value.state['hasMoreData'], true);
      const fragments = value.renderList() as React.ReactElement<Data>[];
      const children = fragments[0]!.props['children'] as React.ReactElement<Data>[];
      assert.equal(children[0]!.type, route);
      assert.equal(children[0]!.props['inboxItem'], row);
      assert.equal(route({ inboxItem: children[0]!.props['inboxItem'] })!.type, routedLeaves.PostReply);
      const next = pending();
      response = next.request;
      location.href = 'https://fixture.test/portal/app/app';
      assert.equal(value.scrollEvent(), undefined);
      assert.equal(calls.at(-1)!.args['pageIndex'], 2);
      assert.equal(calls.at(-1)!.args['pageSize'], 10);
      assert.equal(value.scrollEvent(), false);
      const nextRow = { inboxId: 'next', inboxType: 1 };
      next.resolve({ inboxList: [nextRow] });
      await Promise.all(next.children);
      const combined = value.state['list'] as unknown[];
      assert.notEqual(combined, rows);
      assert.equal(combined[0], row);
      assert.equal(combined[1], nextRow);
      const empty = pending();
      response = empty.request;
      value.scrollEvent();
      empty.resolve({ inboxList: [] });
      await Promise.all(empty.children);
      assert.equal(value.scrollEvent(), false);
    },
  );
  await check(
    'list retains malformed-response native failures, abort handling and the original stale-response overwrite',
    async () => {
      for (const bad of [undefined, null, {}, { inboxList: undefined }, { inboxList: null }]) {
        const p = pending();
        response = p.request;
        const value = subject(List, { dispatch: () => {} });
        value.fetchInboxList();
        p.resolve(bad);
        await assert.rejects(p.children[0]!, TypeError);
        await Promise.resolve();
        assert.equal(value.state['failed'], true);
        assert.equal(value.state['isLoading'], false);
        assert.deepEqual(value.state['list'], []);
      }
      const cancelled = pending();
      response = cancelled.request;
      const value = subject(List, { dispatch: () => {} });
      value.fetchInboxList();
      const failure = { errorCode: 1 };
      cancelled.reject(failure);
      await assert.rejects(cancelled.children[0]!, error => error === failure);
      await Promise.resolve();
      assert.equal(value.state['failed'], false);
      assert.equal(value.state['isLoading'], true);
      const older = pending();
      response = older.request;
      value.fetchInboxList();
      const newer = pending();
      response = newer.request;
      value.fetchInboxList();
      const newestRows = [{ inboxId: 'newest' }];
      newer.resolve({ inboxList: newestRows });
      await Promise.all(newer.children);
      assert.equal(value.state['list'], newestRows);
      const olderRows = [{ inboxId: 'older' }];
      older.resolve({ inboxList: olderRows });
      await Promise.all(older.children);
      assert.equal(value.state['list'], olderRows);
    },
  );
  await check(
    'real list update → real action → real Redux reducer keeps the previous dispatch receiver and missing key',
    async () => {
      for (const inboxType of ['post', undefined]) {
        const matching = { value: inboxType, id: 'matching' },
          untouched = { value: 'calendar', id: 'other' };
        let state = { ...reducer(undefined, { type: '@@fixture' }), currentInboxList: [matching, untouched] };
        let dispatched: Data | undefined;
        const oldProps: Data = {
          inboxType,
          count: 1,
          dispatch: function (this: Data, action: Data) {
            assert.equal(this, oldProps);
            dispatched = action;
            state = reducer(state, action) as typeof state;
          },
        };
        const value = subject(List, {
          ...oldProps,
          count: 2,
          dispatch: () => {
            throw new Error('wrong dispatch receiver');
          },
        });
        const p = pending();
        response = p.request;
        value.componentDidUpdate(oldProps);
        assert.equal(dispatched!['type'], 'UPDATE_INBOX_SESSION');
        assert.equal(Object.hasOwn(dispatched!, 'id'), true);
        assert.equal(dispatched!['id'], inboxType);
        const items = state.currentInboxList;
        assert.notEqual(items[0], matching);
        assert.equal(items[1], untouched);
        assert.equal(typeof (items[0] as Data)['requestNow'], 'number');
        assert.equal(Object.hasOwn(matching, 'requestNow'), false);
        p.resolve({ inboxList: [] });
        await Promise.all(p.children);
      }
    },
  );
  await check('list empty-state translation keeps unknown/prototype keys, getter receiver and evaluation order', () => {
    const names = load('src/pages/chat/components/Inbox/constants.ts')['NAMES'] as Data;
    const sentinel = {};
    Object.defineProperty(names, 'fixture', {
      configurable: true,
      get() {
        assert.equal(this, names);
        trace.push('name:get');
        return sentinel;
      },
    });
    const original = Reflect.get(globalThis, '_l');
    try {
      for (const inboxType of ['fixture', 'toString', undefined]) {
        const observed: unknown[] = [];
        trace.length = 0;
        Reflect.set(globalThis, '_l', (text: string, ...args: unknown[]) => {
          trace.push('translate:' + text);
          if (args.length) observed.push(args[0]);
          return text;
        });
        subject(List, { inboxType, dispatch: () => {} }).renderNullDiv();
        assert.deepEqual(
          trace.slice(0, 2),
          inboxType === 'fixture'
            ? ['translate:还没有消息', 'name:get']
            : ['translate:还没有消息', 'translate:在这查看所有和%0相关的消息'],
        );
        assert.equal(
          observed[0],
          inboxType === 'fixture' ? sentinel : inboxType === 'toString' ? Object.prototype.toString : undefined,
        );
      }
      trace.length = 0;
      subject(List, { inboxType: 'fixture', inboxFavorite: true, dispatch: () => {} }).renderNullDiv();
      assert.equal(trace.includes('name:get'), false);
    } finally {
      Reflect.set(globalThis, '_l', original);
      Reflect.deleteProperty(names, 'fixture');
    }
  });
  console.log('Inbox actual request/consumer pipeline passed: ' + passed + ' checks');
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
