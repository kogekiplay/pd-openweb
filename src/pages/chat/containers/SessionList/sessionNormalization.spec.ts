import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

interface Row {
  id?: string;
  value?: string;
  type?: string | number;
  from?: { id?: string; name?: string };
  msg?: { con?: string; files?: unknown };
  sendMsg?: string | null;
}
interface Action {
  type: string;
  result: Row[];
}
interface RealUtils {
  formatSession: (row: Row) => Row;
  sortSession: (rows: Row[], value: string, showType: number) => Row[];
}
interface Fixture {
  installHost: (options: { accountId: string; messageListShowType: number }) => void;
  loadRealUtils: () => RealUtils;
}
const fixture: Fixture = require('../../../../../scripts/spec-fixtures/chatReduxFixture.ts');

function expression(file: string, name: string): string {
  const source = harness.readSource(file);
  const tree = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });

  for (const item of tree.program.body) {
    const statement = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    if (statement?.type !== 'VariableDeclaration') continue;
    for (const declaration of statement.declarations) {
      if (declaration.id.type !== 'Identifier' || declaration.id.name !== name || !declaration.init) continue;
      return source.slice(declaration.init.start!, declaration.init.end!);
    }
  }

  throw new Error('Missing real implementation: ' + file + ':' + name);
}

function compile(source: string): string {
  const result = harness.transformSync(source, { filename: 'session-normalization.tsx' });
  if (!result?.code) throw new Error('Missing compiled session chain');
  return result.code;
}

function makeChain() {
  fixture.installHost({ accountId: 'me', messageListShowType: 2 });
  const helpers = fixture.loadRealUtils();
  const moduleObject: { exports: unknown } = { exports: undefined };
  const formatList = new Function(
    'module',
    'formatSession',
    compile('module.exports = ' + expression('src/pages/chat/utils/index.ts', 'formatSessionList') + ';') +
      '\nreturn module.exports;',
  )(moduleObject, helpers.formatSession) as (rows: Row[]) => Row[];
  const actions: { exports: unknown } = { exports: undefined };
  const setSessionList = new Function(
    'module',
    'utils',
    compile('module.exports = ' + expression('src/pages/chat/redux/actions.ts', 'setSessionList') + ';') +
      '\nreturn module.exports;',
  )(actions, { ...helpers, formatSessionList: formatList }) as (
    rows: Row[],
  ) => (
    dispatch: (action: Action) => void,
    getState: () => { chat: { toolbarConfig: { messageListShowType: number } } },
  ) => void;
  return { formatList, setSessionList };
}

function lifecycle(actions: { setSessionList: ReturnType<typeof makeChain>['setSessionList'] }) {
  const source = harness.readSource('src/pages/chat/containers/SessionList/index.tsx');
  const tree = harness.parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const component = tree.program.body.find(item => item.type === 'ClassDeclaration' && item.id?.name === 'SessionList');
  if (component?.type !== 'ClassDeclaration') throw new Error('Missing SessionList');
  const method = component.body.body.find(
    item => item.type === 'ClassMethod' && item.key.type === 'Identifier' && item.key.name === 'componentDidUpdate',
  );
  if (!method) throw new Error('Missing real lifecycle');
  const moduleObject: { exports: unknown } = { exports: undefined };
  return new Function(
    'module',
    'actions',
    'shallowEqual',
    'window',
    compile('module.exports = class Subject extends Object { ' + source.slice(method.start!, method.end!) + ' };') +
      '\nreturn module.exports;',
  )(moduleObject, { setSessionList: actions.setSessionList }, () => false, {}) as new () => {
    props: { sessionList: Row[]; currentSession: object; messageListShowType: number };
    state: { chatCount: number };
    isWindowChat: boolean;
    componentDidUpdate: (previous: {
      currentSession: object;
      messageListShowType: number;
      dispatch: (thunk: ReturnType<ReturnType<typeof makeChain>['setSessionList']>) => void;
    }) => void;
  };
}

const { formatList, setSessionList } = makeChain();
const raw: Row = { id: 's', value: 's', type: '2', from: { id: 'me', name: 'Me' }, msg: { con: 'hello' } };
const formatted = formatList([raw]);
assert.equal(formatted[0], raw);
assert.equal(raw.msg?.con, '我: hello');
assert.equal(raw.type, 2);

raw.msg!.files = 42;
const records: Action[] = [];
const Subject = lifecycle({ setSessionList });
const subject = new Subject();
subject.props = { sessionList: formatted, currentSession: {}, messageListShowType: 2 };
subject.state = { chatCount: 0 };
subject.isWindowChat = false;
subject.componentDidUpdate({
  currentSession: {},
  messageListShowType: 1,
  dispatch: thunk =>
    thunk(
      action => records.push(action),
      () => ({ chat: { toolbarConfig: { messageListShowType: 2 } } }),
    ),
});
assert.equal(records.length, 1);
assert.equal(records[0]!.type, 'SET_SESSION_LIST');
assert.equal(records[0]!.result[0], raw);
assert.equal(raw.msg?.files, 42);
assert.equal(raw.msg?.con, '我: 我: hello', 'the existing second formatting still runs');
console.log('✓ real lifecycle → real thunk → real formatter/sorter preserves the row and opaque attachment');

subject.componentDidUpdate({
  currentSession: {},
  messageListShowType: 2,
  dispatch: () => {
    throw new Error('unchanged display mode must not normalize');
  },
});
assert.equal(records.length, 1);
assert.equal(raw.msg?.con, '我: 我: hello');
console.log('✓ unchanged display mode does not dispatch another normalization');

const another: Row = { id: 'other', value: 'other', type: '3', msg: { con: 'system' } };
const mixed = formatList([another, raw]);
assert.equal(mixed[0], another);
assert.equal(mixed[1], raw);
assert.notEqual(mixed, formatted);
assert.equal(raw.msg?.files, 42);
console.log('✓ mixed raw/formatted input returns the original row objects in a new array');

assert.throws(() => formatList([{ type: 3 }]), TypeError);
console.log('✓ missing message content retains the original native failure');
