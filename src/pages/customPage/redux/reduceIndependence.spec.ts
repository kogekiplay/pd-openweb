/**
 * `DELETE_LINKAGE_FILTERS_GROUP` 的 Redux 不可变性修复 —— 真实 RTK 反例规格
 *
 * 【背景】修复前该 case 写的是：
 *     delete state.linkageFiltersGroup[payload.value];
 *     return { ...state, linkageFiltersGroup: { ...state.linkageFiltersGroup } };
 * 即**直接就地修改旧 state**。Redux 要求 reducer 不得修改传入的 state，
 * 而 RTK 的 `configureStore` 默认会装 `immutable-state-invariant` 中间件（开发态），
 * 一旦检测到就地修改就会在派发时抛错。
 *
 * 【本规格证明什么】按 lead 要求，用**真实 `configureStore` 默认不可变中间件**重现：
 *   1. **旧路径**（`fc6676e67` 的实现）：派发即**抛错**，且旧 state 确实被就地改掉；
 *   2. **新路径**（本次 fix）：派发**不抛错**，旧 state **完整保留**，新 state 已移除该键。
 *
 * 【为什么用真实 store 而不是自己搭中间件】`configureStore` 的默认中间件组合
 * （含不可变检查）就是生产/开发实际使用的组合；自己拼一个中间件只能是"模仿"，
 * 无法证明真实环境下的失败。这里**不修改任何 store 配置、不关中间件**。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { parser, transformFileSync, transformSync, ROOT } = require('../../../../scripts/spec-harness.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };
(globalThis as Record<string, unknown>)['_l'] = (s: string) => String(s);

const { configureStore, combineReducers } = require('@reduxjs/toolkit');

/* ────────────────────────── A 侧基线 ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/customPage/redux';
/** lead 指定、main 可达 */
const BASE_REV = 'fc6676e67';
/** 修复前 reducers.ts 的冻结 sha256（与 8b25cb08b 的类型批次同一 A 侧） */
const BASE_SHA = '51e8f494a24e546e06addd5d225c46a8d8a11ec300f917e6a92664d220104d1a';

const origCache: Record<string, string> = {};
function origSource(file: string): string {
  if (origCache[file] === undefined) {
    origCache[file] = execFileSync('git', ['show', `${BASE_REV}:${REL_DIR}/${file}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  }
  return origCache[file];
}

function assertBaselineIntact(): void {
  const actual = crypto.createHash('sha256').update(origSource('reducers.ts')).digest('hex');
  assert.equal(actual, BASE_SHA, `A 侧 reducers.ts 在 ${BASE_REV} 的 sha256 与冻结值不符，反例失效`);
}

/* ────────────────────────── 环境替身 ────────────────────────── */

const realLodash = require('lodash');
const realMaxBy = require('lodash/maxBy');
const realUpdate = require('immutability-helper').default || require('immutability-helper');

(globalThis as Record<string, unknown>)['sessionStorage'] = {
  length: 0,
  key: () => null,
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
(globalThis as Record<string, unknown>)['document'] = { querySelector: () => null };

/** Load the actual helper declarations verbatim, without importing unrelated UI/assets. */
const helperCodeCache = new Map<string, string>();
function loadUtil(variant: 'orig' | 'current') {
  const filename = path.resolve(DIR, '../util.ts');
  const source =
    variant === 'orig'
      ? execFileSync('git', ['show', `${BASE_REV}:src/pages/customPage/util.ts`], { cwd: ROOT, encoding: 'utf8' })
      : fs.readFileSync(filename, 'utf8');
  let code = helperCodeCache.get(source);
  if (code === undefined) {
    const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    const names = ['enumObj', 'enumWidgetType', 'getEnumType', 'getIndexById', 'getDefaultLayout'];
    const declarations = names
      .map(name => {
        const statement = tree.program.body.find(item => {
          const value = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
          return (
            (value?.type === 'VariableDeclaration' && value.declarations.some(entry => entry.id.name === name)) ||
            (value?.type === 'FunctionDeclaration' && value.id?.name === name && value.body)
          );
        });
        if (!statement || statement.start == null || statement.end == null)
          throw new Error('Missing real helper ' + name);
        return source.slice(statement.start, statement.end).replace(/^export /, '');
      })
      .join('\n');
    code = transformSync(declarations + '\nmodule.exports = { enumWidgetType, getIndexById, getDefaultLayout };', {
      filename,
    }).code;
    helperCodeCache.set(source, code);
  }
  const target = { exports: {} as Record<string, unknown> };
  new Function('module', '_', 'maxBy', 'get', code)(target, realLodash, realMaxBy, realLodash.get);
  return target.exports;
}

function makeLoader(variant: 'orig' | 'current') {
  const cache = new Map<string, any>();
  const load = (rel: string): any => {
    if (cache.has(rel)) {
      const hit = cache.get(rel);
      return hit.exports ?? hit;
    }
    const moduleLike: any = { exports: {} };
    cache.set(rel, moduleLike);
    const filename = path.join(DIR, rel);
    const babelOpts = {
      presets: [require.resolve('@babel/preset-react')],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    };
    const code =
      variant === 'orig'
        ? (transformSync(origSource(rel), { ...babelOpts, filename }) as { code: string }).code
        : transformFileSync(filename, babelOpts).code;
    const req = (r: string) => {
      if (r === 'immutability-helper') return realUpdate;
      if (r === 'lodash') return realLodash;
      if (r === 'lodash/maxBy') return realMaxBy;
      if (r === 'uuid') return { v4: () => 'uuid-1' };
      if (r === '../util') return loadUtil(variant);
      if (r === 'src/redux/types') return {};
      if (r.startsWith('./')) return load(`${r.slice(2)}.ts`);
      throw new Error(`spec 没给 ${r} 打桩（${variant}/${rel}）`);
    };
    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports;
  };
  return load;
}

/* ────────────────────────── 驱动一个真实 store ────────────────────────── */

/**
 * 用**真实 `configureStore`**（默认中间件，含不可变检查）跑一次删除。
 * 返回可断言的结果：是否抛错、旧 state 是否被改、新 state 的键。
 */
function runDelete(variant: 'orig' | 'current', valueToDelete: string) {
  const load = makeLoader(variant);
  const reducer = load('reducers.ts').default;
  const actions = load('action.ts');

  const store = configureStore({ reducer: combineReducers({ customPage: reducer }) });

  store.dispatch(actions.updateLinkageFiltersGroup({ value: 'keep', filters: [{ id: 'a' }] }));
  store.dispatch(actions.updateLinkageFiltersGroup({ value: valueToDelete, filters: [{ id: 'b' }] }));

  // 抓取派发前的「旧 state」——注意：要拿住引用，才能观察到它是否被就地改写
  const oldState = store.getState().customPage;
  const oldGroup = oldState.linkageFiltersGroup;
  const oldGroupKeysBefore = Object.keys(oldGroup).sort();

  let threw: string | null = null;
  try {
    store.dispatch(actions.deleteLinkageFiltersGroup({ value: valueToDelete }));
  } catch (error) {
    threw = error instanceof Error ? error.message.split('\n')[0] : String(error);
  }

  const newState = store.getState().customPage;

  return {
    threw,
    /** 旧 state 的 linkageFiltersGroup 在派发后是否仍含该键（含 = 未被就地修改 = 正确） */
    oldGroupStillHasKey: Object.prototype.hasOwnProperty.call(oldGroup, valueToDelete),
    oldGroupKeysBefore,
    /** 旧 group 对象在派发后的键（若被就地删掉，这里就不含该键了） */
    oldGroupKeysAfter: Object.keys(oldGroup).sort(),
    /** 旧 state 对象本身是否被替换（应为否：reducer 不该改写它） */
    oldStateRefChanged: oldState !== newState,
    newGroupKeys: Object.keys(newState.linkageFiltersGroup).sort(),
  };
}

/* ────────────────────────── 断言脚手架 + 防假绿 ────────────────────────── */

let summarized = false;
let checks = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
  checks += 1;
  try {
    fn();
    realConsole.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    realConsole.error(`  ✗ ${name}`);
    realConsole.error(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

process.on('unhandledRejection', reason => {
  realConsole.error(
    `未处理的 Promise 拒绝，判为失败：${reason instanceof Error ? reason.stack || reason.message : String(reason)}`,
  );
  process.exitCode = 1;
});
process.on('uncaughtException', error => {
  realConsole.error(`未捕获异常，判为失败：${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
process.on('beforeExit', () => {
  if (!summarized) {
    realConsole.error('规格没有跑到汇总行（可能有异常被吞掉），判为失败');
    process.exitCode = 1;
  }
});

/* ────────────────────────── 执行 ────────────────────────── */

function main(): void {
  assertBaselineIntact();
  realConsole.log(`  ✓ A 侧基线 ${BASE_REV} 的 reducers.ts sha256 已实际断言`);

  /* ── 1. 旧路径：真实 RTK 不可变中间件应当抓到 ── */
  check('修复前：真实 configureStore 派发时抛「state mutation」错误', () => {
    const result = runDelete('orig', 'gone');
    assert.ok(result.threw, '旧实现应当在不可变中间件下抛错，但没抛');
    assert.match(
      result.threw as string,
      /state mutation was detected/i,
      `错误信息不是不可变检查（实际：${result.threw}）`,
    );
    assert.match(result.threw as string, /linkageFiltersGroup\.gone/, '错误路径应指向 linkageFiltersGroup.gone');
  });

  check('修复前：旧 state 的 linkageFiltersGroup 被就地改掉（键消失）', () => {
    const result = runDelete('orig', 'gone');
    assert.equal(result.oldGroupStillHasKey, false, '旧 state 的键应被就地删除（这是缺陷本体）');
    assert.deepEqual(result.oldGroupKeysAfter, ['keep'], '旧 group 对象只剩 keep');
  });

  /* ── 2. 新路径：修复后应正常派发，旧 state 完整保留 ── */
  check('修复后：真实 configureStore 派发不再抛错', () => {
    const result = runDelete('current', 'gone');
    assert.equal(result.threw, null, `修复后不应抛错，实际：${result.threw}`);
  });

  check('修复后：旧 state 完整保留（键还在，未被就地修改）', () => {
    const result = runDelete('current', 'gone');
    assert.equal(result.oldGroupStillHasKey, true, '旧 state 的键必须保留');
    assert.deepEqual(result.oldGroupKeysAfter, ['gone', 'keep'], '旧 group 对象不应被改动');
    assert.deepEqual(result.oldGroupKeysBefore, ['gone', 'keep']);
  });

  check('修复后：新 state 已移除该键且保留其它键', () => {
    const result = runDelete('current', 'gone');
    assert.deepEqual(result.newGroupKeys, ['keep'], '新 state 应移除 gone、保留 keep');
  });

  check('修复后：被删的键不存在时是安全的（幂等，不抛错、不动其它键）', () => {
    // 注意：夹具会先写入 'not-there' 这个键再删它，所以删除后应只剩 'keep'。
    // （我最初把期望写成 ['keep','not-there'] 是错的 —— 那个键正是被删除的目标。）
    const result = runDelete('current', 'not-there');
    assert.equal(result.threw, null);
    assert.deepEqual(result.newGroupKeys, ['keep'], '删除目标键后应只剩 keep');
  });

  /* ── 3. 引用契约：新旧 state 必须是不同对象，且旧对象不变 ── */
  check('引用契约：返回新 state 对象，旧 state 引用与内容都不受影响', () => {
    const result = runDelete('current', 'gone');
    assert.equal(result.oldStateRefChanged, true, 'store 里应换成新对象');
    assert.equal(result.oldGroupStillHasKey, true, '旧 group 内容必须完好');
  });

  summarized = true;
  if (failed) {
    realConsole.error(`customPage 不可变性修复规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(`customPage 不可变性修复规格通过：${checks} 项（真实 configureStore + 默认不可变中间件）`);
}

main();
