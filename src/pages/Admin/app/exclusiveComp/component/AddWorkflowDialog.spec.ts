/**
 * AddWorkflowDialog 的 appList 分页/过滤合约（行为 spec）。
 *
 * 只从真实源码里 **抽取** 两段闭包执行，不复制实现：
 *   1. getAppsForProject(...).then(({ apps, total }) => setApp({ ... })) 的回调
 *   2. appList.filter(l => l.appName.toLowerCase()...) 的回调
 *
 * 现状（tsx 未改时）应失败：
 *   - 第一页接口缺省 apps → appList 变成 undefined（后续 .filter 会炸）
 *   - 第二页缺省 apps → appList.concat(undefined) 把 undefined 当元素拼进来
 *   - appName 缺省的行 → l.appName.toLowerCase() 抛 TypeError
 *
 * 修好后应全部通过，且下面固定的 total / appIndex / appLoading 行为不得改变。
 */
import type { SpecHarness } from '../../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../../scripts/spec-harness.ts');
const traverse: typeof import('@babel/traverse').default = require('@babel/traverse').default;
const generate: typeof import('@babel/generator').default = require('@babel/generator').default;

const SOURCE_PATH = path.join(__dirname, 'AddWorkflowDialog.tsx');

type Callback = (...args: unknown[]) => unknown;

let passed = 0;
function check(name: string, run: () => void): void {
  run();
  passed += 1;
  console.log('  \u2713 ' + name);
}

/** 从源码 AST 里取一段表达式（真实抽取，不做文本替换）。 */
function extractExpressions(source: string): { thenCallback: string; filterCallback: string } {
  const tree = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let thenCallback: string | undefined;
  let filterCallback: string | undefined;

  traverse(tree, {
    CallExpression(entry) {
      const callee = entry.node.callee;
      if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return;

      // getAppsForProject(...).then(<callback>)
      if (callee.property.name === 'then') {
        const call = generate(entry.node).code;
        if (!call.includes('getAppsForProject') || !call.includes('appList')) return;
        const callback = entry.node.arguments[0];
        if (!callback) return;
        thenCallback = generate(callback).code;
        return;
      }

      // <array>.filter(<callback>) —— 认带 appName 的那个
      if (callee.property.name === 'filter') {
        const call = generate(entry.node).code;
        if (!call.includes('appName')) return;
        const callback = entry.node.arguments[0];
        if (!callback) return;
        filterCallback = generate(callback).code;
      }
    },
  });

  assert.ok(thenCallback, 'extract: getAppsForProject.then callback not found in source');
  assert.ok(filterCallback, 'extract: appList.filter callback not found in source');
  return { thenCallback: thenCallback, filterCallback: filterCallback };
}

/** 把抽取出的表达式转译成 CJS 片段，再用给定依赖当形参执行，返回该闭包。 */
function compile(expression: string, dependencyNames: string[]): (...deps: unknown[]) => Callback {
  const code = harness.transformSync('const closure = (' + expression + ');', {
    filename: 'add-workflow-dialog-fragment.ts',
    sourceType: 'script',
  }).code;
  const factory = new Function(...dependencyNames, code + '\nreturn closure;');
  return (...deps: unknown[]): Callback => {
    const produced: unknown = Reflect.apply(factory, undefined, deps);
    if (typeof produced !== 'function') throw new TypeError('compiled closure is not callable');
    return (...args: unknown[]): unknown => Reflect.apply(produced, undefined, args);
  };
}

const source = fs.readFileSync(SOURCE_PATH, 'utf8');
const extracted = extractExpressions(source);

interface ThenPatch {
  appList?: unknown;
  appLoading?: unknown;
  appIndex?: unknown;
  total?: unknown;
}

/** 执行真实的 .then 回调：注入 setApp / _pageIndex / appList 三个外部自由变量。 */
function runThenCallback(options: {
  appList: unknown[];
  pageIndex: number;
  response: Record<string, unknown>;
}): ThenPatch {
  let captured: ThenPatch | undefined;
  const setApp = (patch: ThenPatch): void => {
    captured = patch;
  };
  const callback = compile(extracted.thenCallback, ['setApp', '_pageIndex', 'appList'])(
    setApp,
    options.pageIndex,
    options.appList,
  );
  callback(options.response);
  assert.ok(captured, 'the .then callback must call setApp');
  return captured;
}

/** 执行真实的 filter 回调；用标准 Array.prototype.filter 应用（应用方式不参与被测逻辑）。 */
function filterRows(rows: unknown[], searchApp: string): unknown[] {
  const callback = compile(extracted.filterCallback, ['searchApp'])(searchApp);
  return rows.filter(row => Boolean(callback(row)));
}

console.log('AddWorkflowDialog appList contract');

// ---------------------------------------------------------------- 分页缺省
check('page 1 + missing apps -> [] (no undefined array)', () => {
  const patch = runThenCallback({ appList: [], pageIndex: 1, response: { total: 0 } });
  assert.deepEqual(patch.appList, [], 'page 1 without apps must fall back to an empty array');
});

check('page 1 + missing apps keeps pinned total/appIndex/appLoading', () => {
  const patch = runThenCallback({ appList: [], pageIndex: 1, response: { total: 7 } });
  assert.equal(patch.total, 7, 'total must be forwarded from the response');
  assert.equal(patch.appIndex, 2, 'appIndex must advance by one');
  assert.equal(patch.appLoading, false, 'appLoading must be cleared');
});

check('page 2 + missing apps keeps the rows already loaded', () => {
  const existing = [{ appName: 'alpha' }];
  const patch = runThenCallback({ appList: existing, pageIndex: 2, response: { total: 1 } });
  assert.deepEqual(
    patch.appList,
    [{ appName: 'alpha' }],
    'page 2 without apps must preserve loaded rows (no undefined element)',
  );
});

check('page 2 + empty page keeps the rows already loaded', () => {
  const existing = [{ appName: 'alpha' }];
  const patch = runThenCallback({ appList: existing, pageIndex: 2, response: { apps: [], total: 0 } });
  assert.deepEqual(patch.appList, [{ appName: 'alpha' }]);
});

check('page 2 + normal page concatenates new rows after existing ones', () => {
  const existing = [{ appName: 'alpha' }];
  const patch = runThenCallback({
    appList: existing,
    pageIndex: 2,
    response: { apps: [{ appName: 'beta' }], total: 2 },
  });
  assert.deepEqual(patch.appList, [{ appName: 'alpha' }, { appName: 'beta' }]);
});

check('the previously loaded array is never mutated', () => {
  const existing = [{ appName: 'alpha' }];
  const patch = runThenCallback({
    appList: existing,
    pageIndex: 2,
    response: { apps: [{ appName: 'beta' }], total: 2 },
  });
  assert.deepEqual(existing, [{ appName: 'alpha' }], 'source array must stay untouched');
  assert.notEqual(patch.appList, existing, 'page 2 must produce a new array');
});

// ---------------------------------------------------------------- 过滤缺省
check('filter without search text keeps every row, including rows missing appName', () => {
  const rows = [{ appName: 'alpha' }, {}, { appName: undefined }, { appName: null }];
  const kept = filterRows(rows, '');
  assert.equal(kept.length, rows.length, 'empty search must not drop rows');
  for (const row of rows) assert.ok(kept.includes(row), 'every original row must be kept by identity');
});

check('filter with search text drops rows whose appName is missing', () => {
  const rows = [{ appName: 'alpha' }, {}, { appName: undefined }, { appName: null }];
  assert.deepEqual(filterRows(rows, 'alpha'), [{ appName: 'alpha' }]);
  assert.deepEqual(filterRows(rows, 'NaN-never-matches'), []);
});

check('filter keeps case-insensitive matching and drops non matches', () => {
  const rows = [{ appName: 'Zap' }, { appName: 'alpha' }];
  assert.deepEqual(filterRows(rows, 'zap'), [{ appName: 'Zap' }]);
  assert.deepEqual(filterRows(rows, 'ALPHA'), [{ appName: 'alpha' }]);
  assert.deepEqual(filterRows(rows, ''), [{ appName: 'Zap' }, { appName: 'alpha' }]);
});

check('filter over page-1 default result does not throw', () => {
  const patch = runThenCallback({ appList: [], pageIndex: 1, response: { total: 0 } });
  const rows = patch.appList;
  assert.ok(Array.isArray(rows), 'page-1 result must be an array before filtering');
  assert.doesNotThrow(() => filterRows(rows, ''));
});

console.log('  ' + passed + ' behaviour checks passed');
