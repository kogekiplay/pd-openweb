const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { transformSync } = require('../../../../scripts/spec-harness.ts');
const redux = require('redux');
const root = path.resolve(__dirname, '../../../..');
const previous = '62dfebaea8ee591203664db80096240946efe21f';
global._l = (text: string) => text;
global.window = {};
Object.assign(globalThis, { $: () => ({ height: () => 900 }) });

function source(file: string, before = false): string {
  return before
    ? execFileSync('git', ['show', previous + ':' + file], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}

function load(file: string, before: boolean, imports: Record<string, unknown>) {
  const target = { exports: {} as Record<string, unknown> };
  const code = transformSync(source(file, before), { filename: path.join(root, file) }).code;
  new Function('module', 'exports', 'require', code)(target, target.exports, (name: string) => {
    if (name in imports) return imports[name];
    throw new Error('Unstubbed task config import: ' + name);
  });
  return target.exports;
}

interface TaskStateFixture {
  folderId: string | number;
  taskFilter: string | number;
  filterSettings: {
    tags: string[];
    customFilter: Record<string, string[]>;
    selectChargeIds: string[];
    folderSearchRange: number;
  };
  [key: string]: unknown;
}
type ActionFixture = { type: string; [key: string]: unknown };
type Creator = (...args: unknown[]) => ActionFixture | ((dispatch: (action: ActionFixture) => void) => void);
function setup(before: boolean) {
  const config = load('src/pages/task/config/config.ts', before, {});
  const stateConfig = load('src/pages/task/containers/taskGantt/config/stateConfig.ts', before, {});
  const gantt = load('src/pages/task/containers/taskGantt/redux/reducers.ts', before, {
    '../config/stateConfig': stateConfig,
  });
  const task = load('src/pages/task/redux/reducers.ts', before, {
    redux,
    '../config/config': config,
    '../containers/taskGantt/redux/reducers': gantt,
  });
  const actions = load('src/pages/task/redux/actions.ts', before, {
    lodash: require('lodash'),
    'src/api/tag': {},
    'src/api/taskCenter': {
      getFolderSettingsForCurrentUser: () =>
        Promise.resolve({ status: 1, data: { projectID: 'api-project', folderName: 'Project' } }),
    },
    'src/utils/common': { emitter: new (require('node:events'))() },
    '../components/updateTimeError/updateTimeError': {},
    '../config/config': config,
    '../utils/updateStage': () => {},
    '../utils/utils': {},
  }) as Record<string, Creator>;
  const store = redux.createStore(task.default);
  return { actions, store };
}

const fixtures: Array<[string, unknown[]]> = [
  ['updateStateConfig', [{ folderId: 1, taskFilter: '', filterUserId: 'other', isSubUser: true }]],
  ['updateStateConfig', [{ folderId: 'folder', taskFilter: 6, keyWords: 'project', searchKeyWords: 'needle' }]],
  ['updateNetwork', ['all']],
  ['updateNetwork', ['project']],
  ['updateTaskStatus', [-1, 4]],
  ['updateTaskStatus', [0, 10]],
  ['updateFolderRange', [7]],
  ['updateKeyWords', ['']],
  ['updateKeyWords', ['find']],
  ['updateCompleteTime', ['2026-10-17']],
  ['updateListSort', [0]],
  ['updateTaskAscription', [8]],
  ['updateTaskTags', [['tag-1', 'tag-2']]],
  ['updateCustomFilter', [{ choice: ['a', 'b'] }]],
  ['updateChargeIds', [['user-1', 'user-2']]],
  ['attachmentSwitch', [2]],
  ['getFolderSettings', ['folder']],
  [
    'updateStateConfig',
    [{ filterSettings: { tags: [], customFilter: {}, selectChargeIds: [], folderSearchRange: 6 } }],
  ],
];

async function scenario(before: boolean) {
  const { actions, store } = setup(before);
  const values: unknown[] = [];
  const dispatched: ActionFixture[] = [];
  const notifications: string[] = [];
  const unsubscribe = store.subscribe(() => notifications.push('updated'));

  for (const [name, args] of fixtures) {
    const creator = actions[name];
    if (!creator) throw new Error('Missing real action ' + name);
    const oldState = store.getState().taskConfig as TaskStateFixture;
    const snapshot = JSON.stringify(oldState);
    const action = creator(...args);

    const dispatch = (next: ActionFixture) => {
      dispatched.push(next);
      store.dispatch(next);
    };

    if (typeof action === 'function') action(dispatch);
    else dispatch(action);
    await new Promise<void>(resolve => setImmediate(resolve));
    const state = store.getState().taskConfig as TaskStateFixture;
    assert.equal(JSON.stringify(oldState), snapshot, 'task config updates never mutate the prior state');
    assert.notEqual(state, oldState);
    if (
      !['updateStateConfig', 'updateFolderRange', 'updateTaskTags', 'updateCustomFilter', 'updateChargeIds'].includes(
        name,
      )
    ) {
      assert.equal(
        state.filterSettings,
        oldState.filterSettings,
        'unrelated state updates preserve nested filter identity',
      );
    }

    if (name === 'updateTaskTags') assert.equal(state.filterSettings.tags, args[0]);
    if (name === 'updateCustomFilter') assert.equal(state.filterSettings.customFilter, args[0]);
    if (name === 'updateChargeIds') assert.equal(state.filterSettings.selectChargeIds, args[0]);
    values.push(JSON.parse(JSON.stringify(state)));
  }

  const current = store.getState().taskConfig;
  store.dispatch({ type: 'UNRELATED_TASK_ACTION' });
  assert.equal(store.getState().taskConfig, current, 'unrelated actions preserve slice identity');
  unsubscribe();
  const status = dispatched.findIndex(action => action.type === 'UPDATE_TASK_STATUS');
  assert.equal(dispatched[status - 1]?.type, 'UPDATE_LIST_SORT', 'status thunk changes sorting before status');
  assert.ok(notifications.length >= fixtures.length);
  return { values, dispatched, notifications };
}

(async () => {
  assert.deepEqual(
    await scenario(false),
    await scenario(true),
    'real creators + Redux reducers retain the production state protocol',
  );
  for (const file of ['src/pages/task/redux/reducers.ts', 'src/pages/task/redux/actions.ts']) {
    const runtime = (code: string) => transformSync(code, { filename: path.join(root, file), comments: false }).code;
    assert.equal(runtime(source(file)), runtime(source(file, true)), 'types erase to identical runtime: ' + file);
  }

  console.log(
    'Task configuration: 18 real action/store transitions, identity/ordering and exact runtime erasure comparisons passed',
  );
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
