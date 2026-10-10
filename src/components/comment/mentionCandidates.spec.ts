const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');

interface Candidate {
  accountId: string;
  avatar: string | null | undefined;
  fullname: string | null | undefined;
  job: string;
}
interface Helper {
  getCalendarAtData(value: unknown, current?: string): Candidate[];
  getTaskAtData(value: unknown, current?: string): Candidate[];
}
const fixtureGlobals = {
  md: { global: { Account: { accountId: 'self' }, APPInfo: { calendarAppID: 'calendar-app', taskAppID: 'task-app' } } },
  _l: (text: string) => text,
};
Object.assign(globalThis, fixtureGlobals);
const helperModule = { exports: {} };
new Function('module', 'exports', transformFileSync(path.join(__dirname, 'mentionCandidates.ts')).code)(
  helperModule,
  helperModule.exports,
);
const helper = helperModule.exports as Helper;
const member = (id: string) => ({
  accountID: id,
  head: 'https://avatar/imageView2/2/w/200/h/200/q/75?rest=1',
  memberName: id,
});
const calendar = {
  createUser: 'owner',
  members: [
    member('one'),
    member('self'),
    member('owner'),
    member('one'),
    member('owner'),
    ...Array.from({ length: 30 }, (_, index) => member('extra' + index)),
  ],
};
const calendarAt = helper.getCalendarAtData(calendar, 'self');
assert.equal(calendarAt.length, 20);
assert.deepEqual(
  calendarAt.slice(0, 2).map(item => [item.accountId, item.job]),
  [
    ['owner', '组织者'],
    ['one', '出席者'],
  ],
);
assert.equal(calendarAt[0]?.avatar, 'https://avatar/imageView2/1/w/48/h/48/q/90?rest=1');
assert.ok(!calendarAt.some(item => item.accountId === 'self'));
assert.equal(new Set(calendarAt.map(item => item.accountId)).size, 20);
assert.deepEqual(
  helper.getCalendarAtData({ createUser: 'absent', members: [{ accountID: 'one' }, { memberName: 'No ID' }] }, 'self'),
  [{ accountId: 'one', avatar: undefined, fullname: undefined, job: '出席者' }],
);
assert.deepEqual(
  helper
    .getCalendarAtData({ createUser: 'self', members: [member('self'), member('one')] }, 'self')
    .map(item => item.job),
  ['出席者'],
);
assert.deepEqual(helper.getCalendarAtData({}, 'self'), []);
const task = {
  charge: { accountID: 'owner', avatar: null, fullName: 'Owner' },
  member: [
    { type: 0, status: 1, account: { accountID: 'one', fullName: '', fullname: 'Fallback' } },
    { type: 0, status: 2, account: { accountID: 'resigned' } },
    { type: 1, account: { accountID: 'group' } },
    { type: 0, account: { accountID: 'self' } },
    { type: 0, account: { accountID: 'owner', fullName: 'Duplicate' } },
    ...Array.from({ length: 30 }, (_, index) => ({ type: 0, account: { accountID: 'extra' + index } })),
  ],
};
const taskAt = helper.getTaskAtData(task, 'self');
assert.equal(taskAt.length, 20);
assert.deepEqual(taskAt.slice(0, 2), [
  { accountId: 'owner', avatar: null, fullname: 'Owner', job: '负责人' },
  { accountId: 'one', avatar: undefined, fullname: 'Fallback', job: '参与者' },
]);
assert.ok(!taskAt.some(item => ['self', 'group', 'resigned'].includes(item.accountId)));
assert.deepEqual(helper.getTaskAtData({ member: null }, 'self'), []);
assert.deepEqual(helper.getTaskAtData({ member: [{ type: 0, account: { accountID: 'one' } }] }, 'self'), [
  { accountId: 'one', avatar: undefined, fullname: undefined, job: '参与者' },
]);
for (const value of [
  null,
  [],
  { members: Array(1) },
  { members: [{ accountID: 3 }] },
  { members: [{ head: { url: 'bad' } }] },
  { members: [{ memberName: false }] },
])
  assert.throws(() => helper.getCalendarAtData(value), TypeError);
for (const value of [
  { member: Array(1) },
  { member: [null] },
  { member: [{ type: '0' }] },
  { member: [{ type: 0, status: '2' }] },
  { member: [{ type: 0, account: { accountID: 3 } }] },
  { charge: { fullName: { text: 'bad' } } },
])
  assert.throws(() => helper.getTaskAtData(value), TypeError);

interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function walk(value: unknown): Tree[] {
  if (!object(value) || !object(value['props'])) return [];
  const node = { type: value['type'], props: value['props'] };
  const children = node.props['children'];
  return [node, ...(Array.isArray(children) ? children : [children]).flatMap(walk)];
}
class Component {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  constructor(props: Record<string, unknown>) {
    this.props = props;
  }
  setState(value: Record<string, unknown>) {
    Object.assign(this.state, value);
  }
}
const actions: unknown[][] = [];
function load(relative: string): { default: new (props: Record<string, unknown>) => { render(): Tree } } {
  const module = { exports: {} };
  new Function('module', 'exports', 'require', transformFileSync(path.join(__dirname, relative)).code)(
    module,
    module.exports,
    (name: string) => {
      if (name === 'react') return { Component, Fragment: 'Fragment' };
      if (name === 'react/jsx-runtime')
        return {
          jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
          jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
        };
      if (name === 'react-redux') return { connect: () => (component: unknown) => component };
      if (name === 'src/components/comment/mentionCandidates') return helper;
      if (name === 'src/components/comment/commenter')
        return {
          __esModule: true,
          default: Object.assign(() => {}, { TYPES: { CALENDAR: 'CALENDAR', TASK: 'TASK' } }),
        };
      if (name === 'src/components/comment/commentList')
        return {
          __esModule: true,
          default: Object.assign(() => {}, { TYPES: { CALENDAR: 'CALENDAR', TASK: 'TASK' } }),
        };
      if (name === 'src/utils/common') return { htmlDecodeReg: (value: string) => value };
      if (name === '../../../redux/actions')
        return new Proxy(
          {},
          {
            get:
              (_target, key) =>
              (...args: unknown[]) => {
                const action = [key, ...args];
                actions.push(action);
                return action;
              },
          },
        );
      if (name === 'moment' || name === 'lodash' || name === 'classnames') return require(name);
      if (name === 'ming-ui/components/Checkbox') return { __esModule: true, default: 'CheckBox' };
      if (name.endsWith('.less')) return {};
      throw new Error('Unexpected comment-list dependency ' + name);
    },
  );
  return module.exports as { default: new (props: Record<string, unknown>) => { render(): Tree } };
}
const changes: unknown[] = [];
const Calendar = load('../../pages/calendar/modules/calendarDetail/components/CommentList/index.tsx').default;
const calendarComponent = new Calendar({
  calendar: { ...calendar, title: 'Calendar', id: 'calendar-id', discussions: [], recurTime: '' },
  change: (value: unknown) => changes.push(value),
});
const calendarProducer = walk(calendarComponent.render()).find(
  item => item.props['sourceType'] === 'CALENDAR' && item.props['storageId'] === 'calendar-id',
);
assert.ok(calendarProducer);
assert.equal(calendarProducer.props['forReacordDiscussion'], true);
assert.deepEqual(calendarProducer.props['atData'], calendarAt);
assert.equal(calendarProducer.props['appId'], 'calendar-app');
const submit = calendarProducer.props['onSubmit'];
assert.equal(typeof submit, 'function');
if (typeof submit === 'function') submit({ discussionId: 'new' });
assert.deepEqual(changes, [{ discussions: [{ discussionId: 'new' }] }]);
const Task = load('../../pages/task/containers/taskDetail/taskCommentList/taskCommentList.tsx').default;
let scrolled = 0;
const taskComponent = new Task({
  taskId: 'task-id',
  taskDetails: { 'task-id': { data: { ...task, taskName: 'Task', projectID: 'project' } } },
  taskDiscussions: { 'task-id': [] },
  dispatch: () => {},
  scrollToComment: () => scrolled++,
});
const taskProducer = walk(taskComponent.render()).find(
  item => item.props['sourceType'] === 'TASK' && item.props['storageId'] === 'task-id',
);
assert.ok(taskProducer);
assert.equal(taskProducer.props['forReacordDiscussion'], true);
assert.deepEqual(taskProducer.props['atData'], taskAt);
assert.equal(taskProducer.props['projectId'], 'project');
assert.deepEqual(taskProducer.props['selectGroupOptions'], { projectId: 'project' });
const taskSubmit = taskProducer.props['onSubmit'];
if (typeof taskSubmit === 'function') taskSubmit({ newAccounts: ['new-account'] });
assert.equal(actions.length, 2);
assert.equal(scrolled, 1);
console.log('Actual task/calendar mention helpers and both Commenter producer assemblies passed');
