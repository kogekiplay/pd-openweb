/** Real home-app wrapper → AppFilter → InboxFilter → Inbox/Header → InboxList → inbox API. */
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const fs: typeof import('node:fs') = require('node:fs');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const React: typeof import('react') = require('react');
type Data = Record<string, unknown>;
interface Node { type: unknown; props: Data; }
interface Subject {
  props: Data; state: Data;
  setState(patch: Data, callback?: () => void): void;
  componentDidMount(): void; componentDidUpdate(previous: Data): void;
  render(): Node; renderHeader(): Node; renderList(): Node; renderOverlay(): Node;
  renderProjectList(): Node; renderAppList(apps: unknown): Node;
  handleSelection(app: unknown): void; handleSearch(): void; handleSave(): void;
  handleChangeUser(users: unknown[]): void; handleEmptyUser(): void; handleChangeTime(time?: unknown): void;
  changeInboxFilter(filter: unknown): void; fetchInboxList(): void;
}
type Constructor = new (props: Data) => Subject;
interface Call { controller: string; action: string; args: Data | undefined; options: Data; }
const calls: Call[] = [];
const trace: string[] = [];
const jobs: Array<() => void> = [];
const pickerCalls: Array<{ target: unknown; options: Data }> = [];
const cache = new Map<string, Data>();
const Icon = () => null, DatePicker = () => null, Dropdown = () => null, Leaf = () => null;
let response: unknown;
let focused = 0;
Reflect.set(globalThis, '_l', (text: string) => text);
Reflect.set(globalThis, 'md', { global: { Account: { accountId: 'self', isPortal: false } } });
Reflect.set(globalThis, 'location', { href: 'https://fixture.test/app' });
const container = {};
Reflect.set(globalThis, '$', () => container);
Reflect.set(globalThis, 'window', { innerHeight: 680 });
const documentFixture = { querySelector: (selector: string) => { assert.equal(selector, '.inboxAppFilterWrapper .searchWrapper input'); return { focus() { focused++; } }; } };
function load(file: string): Data {
  if (cache.has(file)) return cache.get(file)!;
  const transformed = harness.transformFileSync(path.join(harness.ROOT, file));
  if (!transformed?.code) throw new Error('Missing compiled module ' + file);
  const module = { exports: {} as Data }; cache.set(file, module.exports);
  const localRequire = (name: string): unknown => {
    if (name.endsWith('.less') || name.endsWith('.css')) return {};
    if (name === 'api/homeApp') return load('src/api/homeApp.ts');
    if (name.startsWith('src/api/')) return load(name + '.ts');
    if (name === 'ming-ui') return { Icon, SvgIcon: Leaf, MdAntDateRangePicker: DatePicker, Dropdown, ScrollView: Leaf };
    if (name === 'antd') return { Dropdown, Divider: Leaf };
    if (name === 'ming-ui/functions') return { quickSelectUser: (target: unknown, options: Data) => { pickerCalls.push({ target, options }); } };
    if (name.startsWith('ming-ui/')) return Leaf;
    if (name === 'src/utils/common') return { browserIsMobile: () => false, pathCompletion: (x: unknown) => x };
    if (name === 'src/pages/chat/utils/config') return { builtinPlacements: {} };
    if (name === 'src/pages/chat/utils/socket') return {};
    if (name === '../../../redux/actions') return {};
    if (name === './inboxMessage') return Leaf;
    if (name.startsWith('.')) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), name));
      const target = ['.ts', '.tsx', ''].map(ext => base + ext).find(p => fs.existsSync(path.join(harness.ROOT, p)));
      if (target) return load(target);
    }
    return require(name);
  };
  const sdk = (controller: string, action: string, args: Data | undefined, options: Data) => {
    calls.push({ controller, action, args, options }); trace.push('request:' + action); return response;
  };
  new Function('module', 'exports', 'require', 'mdyAPI', 'document', 'setTimeout', transformed.code)(
    module, module.exports, localRequire, sdk, documentFixture, (callback: () => void, delay: number) => { assert.equal(delay, 200); jobs.push(callback); },
  );
  return module.exports;
}
const root = 'src/pages/chat/components/Inbox/components/';
const App = load(root + 'baseComponent/appFilter.tsx')['default'] as Constructor;
const Filter = load(root + 'baseComponent/inboxFilter.tsx')['default'] as Constructor;
const Inbox = load(root + 'Inbox.tsx')['default'] as Constructor;
const Header = (load(root + 'inboxHeader.tsx')['default'] as { WrappedComponent: Constructor }).WrappedComponent;
const List = (load(root + 'inboxList.tsx')['default'] as { WrappedComponent: Constructor }).WrappedComponent;
function subject(Type: Constructor, props: Data): Subject {
  const instance = new Type(props);
  instance.setState = (patch, callback) => { trace.push('state:' + Object.keys(patch).join(',')); Object.assign(instance.state, patch); callback?.call(instance); };
  return instance;
}
function nodes(value: unknown): Node[] {
  if (!value || typeof value !== 'object') return [];
  const n = value as Node;
  if (!n.props) return [];
  const children = n.props['children'];
  return [n, ...(Array.isArray(children) ? children.flat() : [children]).flatMap(nodes)];
}
function pending() {
  let resolve!: (value: unknown) => void;
  const children: Promise<unknown>[] = [];
  const request = Object.assign(new Promise<unknown>(yes => { resolve = yes; }), { abort() {} });
  const then = request.then;
  Object.defineProperty(request, 'then', { value: function(this: typeof request, ...args: unknown[]) {
    const child: Promise<unknown> = Reflect.apply(then, this, args); children.push(child); void child.catch(() => {}); return child;
  } });
  return { request, resolve, children };
}
let passed = 0;
async function check(name: string, run: () => Promise<void> | void) {
  calls.length = 0; trace.length = 0; pickerCalls.length = 0; jobs.length = 0;
  await run(); passed++; console.log('  ✓ ' + name);
}
async function main() {
  await check('actual home-app wrapper preserves source array mutation, external-app references and original getter sequence', async () => {
    const p = pending(); response = p.request;
    const groups: Data[] = [{ projectId: 'p', projectApps: [] }], external = [{ id: 'e', name: 'External' }];
    const reads: string[] = [];
    const result = { get validProject() { reads.push('validProject'); return groups; }, get externalApps() { reads.push('externalApps'); return external; } };
    const value = subject(App, { onChange: () => {} });
    assert.equal(Object.hasOwn(value.state, 'dataSource'), false); value.componentDidMount();
    assert.deepEqual(calls[0], { controller: 'HomeApp', action: 'GetAllHomeApp', args: undefined, options: {} });
    p.resolve(result); await Promise.all(p.children);
    assert.deepEqual(reads, ['validProject', 'externalApps', 'externalApps', 'validProject', 'validProject']);
    assert.equal(value.state['apps'], groups); assert.equal(value.state['dataSource'], groups);
    assert.equal(groups.length, 2); assert.equal(groups[1]!['projectApps'], external); assert.equal(groups[1]!['hasApps'], true);
  });
  await check('actual app clear emits undefined through Filter → Inbox/Header/List → typed inbox API with an own appId key', () => {
    const parent = subject(Inbox, { inboxType: 'worksheet' });
    const onChange = (filter: unknown) => parent.changeInboxFilter(filter);
    const filter = subject(Filter, { inboxType: 'worksheet', onChange });
    const appElement = nodes(filter.render()).find(n => n.type === App)!; assert.ok(appElement);
    const app = subject(App, appElement.props);
    const selected = { id: 'app', name: 'App', metadata: {} };
    app.handleSelection(selected); assert.equal(app.state['app'], selected);
    assert.equal((parent.state['filter'] as Data)['appId'], 'app');
    const user = { accountId: 'u', fullname: 'User' }; filter.handleChangeUser([user]);
    app.handleSelection({});
    const payload = parent.state['filter'] as Data;
    assert.equal(payload['appId'], undefined); assert.equal(Object.hasOwn(payload, 'appId'), true); assert.equal(payload['user'], user);
    const headerElement = parent.renderHeader(); const header = subject(Header, { ...headerElement.props, currentSession: {}, sessionList: [], dispatch: () => {} });
    const overlay = header.renderOverlay(); assert.equal(overlay.type, Filter); assert.equal(overlay.props['filter'], payload);
    const listElement = parent.renderList(); assert.equal(listElement.props['filter'], payload);
    response = pending().request; subject(List, { ...listElement.props, dispatch: () => {} }).fetchInboxList();
    assert.equal(calls.at(-1)!.action, 'GetInboxMessage'); assert.equal(calls.at(-1)!.args!['creatorId'], 'u');
    assert.equal(calls.at(-1)!.args!['appId'], undefined); assert.equal(Object.hasOwn(calls.at(-1)!.args!, 'appId'), true);
  });
  await check('clearing the only app filter emits null; selecting an id getter happens in the original state callback', () => {
    const changes: unknown[] = [];
    const filter = subject(Filter, { inboxType: 'workflow', onChange: (x: unknown) => changes.push(x) });
    const app = subject(App, nodes(filter.render()).find(n => n.type === App)!.props);
    const selected = { get id() { trace.push('id:get'); return 'app'; } };
    app.handleSelection(selected); assert.deepEqual(trace.slice(0, 2), ['state:app,menuVisible', 'id:get']);
    app.handleSelection({}); assert.equal(changes.at(-1), null);
  });
  await check('search clones actual app metadata, filters names and leaves the original groups untouched', () => {
    const metadata = { nested: [1] }, first = { id: 'a', name: 'Alpha', metadata }, second = { id: 'b', name: 'Beta' };
    const groups = [{ projectId: 'p', projectApps: [first, second] }, { projectId: 'missing' }];
    const value = subject(App, { onChange: () => {} }); value.state['dataSource'] = groups; value.state['searchValue'] = 'AL';
    value.handleSearch(); const filtered = value.state['apps'] as Data[];
    assert.equal(filtered.length, 1); const apps = filtered[0]!['projectApps'] as Data[];
    assert.equal(apps.length, 1); assert.equal(apps[0]!['id'], 'a'); assert.notEqual(apps[0], first);
    assert.notEqual(apps[0]!['metadata'], metadata); assert.deepEqual(groups[0]!.projectApps, [first, second]);
    value.state['searchValue'] = ''; value.handleSearch(); assert.equal((value.state['apps'] as Data[]).length, 1);
  });
  await check('missing source lists and app names retain their native failure sites rather than successful empty arrays', async () => {
    const value = subject(App, { onChange: () => {} }); assert.throws(() => value.handleSearch(), TypeError);
    for (const validProject of [undefined, null]) {
      const p = pending(); response = p.request; const app = subject(App, { onChange: () => {} });
      app.componentDidMount(); p.resolve({ validProject }); await Promise.all(p.children);
      assert.equal(app.state['apps'], validProject); assert.equal(Object.hasOwn(app.state, 'dataSource'), true);
      assert.throws(() => app.renderProjectList(), TypeError);
    }
    value.state['dataSource'] = [{ projectApps: [{}] }]; assert.throws(() => value.handleSearch(), TypeError);
    value.state['apps'] = [{ projectId: 'p' }]; assert.throws(() => value.renderProjectList(), TypeError);
    assert.throws(() => value.renderAppList(undefined), TypeError);
  });
  await check('real quick-selector options and empty/selected user callbacks preserve element references and own undefined state', () => {
    const changes: unknown[] = []; const filter = subject(Filter, { onChange: (x: unknown) => changes.push(x) });
    const trigger = nodes(filter.render()).find(n => n.type === Icon && n.props['icon'] === 'plus')!;
    const target = {}; (trigger.props['onClick'] as (e: unknown) => void)({ target });
    const options = pickerCalls[0]!.options; assert.equal(pickerCalls[0]!.target, target); assert.equal(options['container'], container);
    assert.deepEqual(options['filterAccountIds'], ['self']);
    const selected = { accountId: 'u', avatar: 'a', fullname: 'User' };
    (options['selectCb'] as (users: unknown[]) => void)([selected]); assert.equal((changes.at(-1) as Data)['user'], selected);
    (options['selectCb'] as (users: unknown[]) => void)([]); assert.equal((changes.at(-1) as Data)['user'], undefined);
    assert.equal(Object.hasOwn(changes.at(-1) as Data, 'user'), true);
  });
  await check('real custom-date callback keeps format receiver/order and exclusive end date, including original invalid input failures', () => {
    const changes: Data[] = []; const filter = subject(Filter, { onChange: (x: Data) => changes.push(x) }); filter.state['timeLevel'] = 8;
    const picker = nodes(filter.render()).find(n => n.type === DatePicker)!; assert.ok(picker);
    const start = { format(this: unknown, pattern: string) { assert.equal(this, start); assert.equal(pattern, 'YYYY-MM-DD'); trace.push('start'); return '2026-10-20'; } };
    const end = { format(this: unknown, pattern: string) { assert.equal(this, end); assert.equal(pattern, 'YYYY-MM-DD'); trace.push('end'); return '2026-10-22'; } };
    (picker.props['onChange'] as (dates: unknown) => void)([start, end]);
    assert.deepEqual(trace.slice(0, 2), ['start', 'end']); assert.equal(changes.at(-1)!['startTime'], '2026-10-20'); assert.equal(changes.at(-1)!['endTime'], '2026-10-23');
    for (const invalid of [null, [], [start], [null, end]]) assert.throws(() => (picker.props['onChange'] as (dates: unknown) => void)(invalid), TypeError);
    filter.state['timeLevel'] = 999; assert.throws(() => filter.handleChangeTime(), TypeError); assert.throws(() => filter.handleSave(), TypeError);
  });
  await check('app popup delayed focus and empty selection stay in the original callbacks', () => {
    const app = subject(App, { apkId: 'a', onChange: () => {} });
    const dropdown = nodes(app.render()).find(n => n.type === Dropdown)!;
    (dropdown.props['onOpenChange'] as (open: boolean) => void)(true); assert.equal(app.state['menuVisible'], true); assert.equal(jobs.length, 1);
    jobs.shift()!(); assert.equal(focused, 1);
    (dropdown.props['onOpenChange'] as (open: boolean) => void)(false); assert.equal(jobs.length, 0);
  });
  await check('actual date shortcut toggles, user retention and external clear reset preserve the filter state sequence', () => {
    const moment: typeof import('moment') = require('moment'); const originalNow = moment.now;
    moment.now = () => new Date(2026, 9, 22, 12).getTime();
    try {
      const changes: unknown[] = [];
      const filter = subject(Filter, { filter: { appId: 'old' }, onChange: (x: unknown) => changes.push(x) });
      const clickToday = () => {
        const today = nodes(filter.render()).find(n => n.props['children'] === '今天')!; assert.ok(today);
        (today.props['onClick'] as () => void)();
      };
      clickToday();
      assert.equal((changes.at(-1) as Data)['timeName'], '今天');
      assert.equal((changes.at(-1) as Data)['startTime'], '2026-10-22');
      assert.equal((changes.at(-1) as Data)['endTime'], '2026-10-23');
      clickToday(); assert.equal(changes.at(-1), null);
      const user = { accountId: 'u' }; filter.handleChangeUser([user]);
      clickToday(); clickToday(); assert.equal((changes.at(-1) as Data)['user'], user);
      assert.equal((changes.at(-1) as Data)['startTime'], null);
      const previous = filter.props; filter.props = { ...previous, filter: null }; filter.componentDidUpdate(previous);
      assert.deepEqual(filter.state, { userValue: null, timeLevel: null, time: null, appId: null });
    } finally { moment.now = originalNow; }
  });
  console.log('Actual Inbox filter pipeline passed: ' + passed + ' checks');
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
