/**
 * 应用详情 redux 模块（`PageHeader/redux`）行为规格 —— 历史 A/B 对照版
 *
 * 批次目标：消除 `RootState['appPkg']` 整个 slice 的推导 `any`。
 * 本规格要守住的是：**类型化没有改变运行行为**。
 *
 * A 侧来源：`git show 62dfebaea:<file>`（lead 指定，**在 origin/main 上可达**），
 * 已核验与我 HEAD 的内容逐字节一致，sha256 冻结并在开头校验。
 *
 * 【覆盖范围】默认值、`SYNC_APP_DETAIL` 的浅合并、颜色/导航色、分组、状态、
 * 清空、未知 action、以及**引用与浅合并契约**（清空是否返回新对象、未命中分支
 * 是否原样返回同一引用）。
 *
 * 【防假绿】主体是异步 `main().catch(...)` + 每个用例 `try/catch` + `beforeExit`
 * 检查是否真的打印过汇总行 —— 见文件末尾。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { transformFileSync, transformSync, ROOT } = require('../../../../scripts/spec-harness.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };

/* ────────────────────────── A 侧基线 ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/PageHeader/redux';
/**
 * A 侧基线：`62dfebaea`（lead 指定，**在 origin/main 上可达**）。
 * 已核验该提交下 `reducers.ts` / `action.ts` 与我 HEAD 内容完全相同，
 * 因此冻结 SHA 对两侧都成立。
 */
const BASE_REV = '62dfebaea8ee591203664db80096240946efe21f';

const ORIG_SHA: Record<string, string> = {
  'reducers.ts': '598e8b0f36a80df4',
  'action.ts': 'c39c39861e07a0f9',
};

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

function assertOriginalIntact(): void {
  for (const [file, prefix] of Object.entries(ORIG_SHA)) {
    const full = crypto.createHash('sha256').update(origSource(file)).digest('hex');
    assert.equal(full.slice(0, 16), prefix, `A 侧 ${file} 的 sha256 与冻结值不符，A/B 对照失效`);
  }
}

/* ────────────────────────── 环境替身 ────────────────────────── */

(globalThis as Record<string, unknown>)['_l'] = (s: string) => String(s);

/** 产品侧只用了这几个常量字符串；A 侧文件与 B 侧文件都要能加载 */
function buildStubs() {
  return {
    'src/redux/types': {},
    'src/utils/appTypes': {},
    './types': {},
  };
}

/**
 * 按 variant 建立一套模块加载器。
 *
 * `reducers.ts` 会 `import { ... } from './action'`，而 `action.ts` 里的常量就是
 * `switch` 比较用的字面量 —— 两侧必须**各自**加载自己的 `./action`，
 * 否则 A/B 比的是同一份 creator，会掩盖差异。因此这里做 variant 作用域的缓存加载。
 */
function makeLoader(variant: 'orig' | 'current') {
  const stubs = buildStubs();
  const cache = new Map<string, Record<string, any>>();

  const load = (rel: string): Record<string, any> => {
    if (cache.has(rel)) return cache.get(rel) as Record<string, any>;
    const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
    cache.set(rel, moduleLike.exports as Record<string, any>);
    const filename = path.join(DIR, rel);
    const babelOpts = {
      presets: [require.resolve('@babel/preset-react')],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    };
    const code =
      variant === 'orig'
        ? (transformSync(origSource(rel), { ...babelOpts, filename }) as { code: string }).code
        : (transformFileSync(filename, babelOpts) as { code: string }).code;
    const req = (r: string) => {
      if (r.startsWith('./')) {
        // 同目录的运行时模块（action.ts）按同 variant 加载；types.ts 是纯类型，替身即可
        if (r === './types') return {};
        return load(`${r.slice(2)}.ts`);
      }
      if (r in stubs) return stubs[r];
      if (r.endsWith('.less') || r.endsWith('.html')) return {};
      throw new Error(`spec 没给 ${r} 打桩（${variant}/${rel}）`);
    };
    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports as Record<string, any>;
  };

  return load;
}

/* ────────────────────────── 断言脚手架与防假绿 ────────────────────────── */

let summarized = false;
process.on('unhandledRejection', reason => {
  realConsole.error(`未处理的 Promise 拒绝，判为失败：${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
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

function firstDiff(a: unknown, b: unknown, at = '$'): string {
  if (a === b) return '';
  if (typeof a !== typeof b) return `${at}: 类型 ${typeof a} vs ${typeof b}`;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${at}: 一侧非数组`;
    if (a.length !== b.length) return `${at}: 长度 ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${at}[${i}]`);
      if (d) return d;
    }
    return '';
  }
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.join(',') !== kb.join(',')) return `${at}: 字段 [${ka}] vs [${kb}]`;
    for (const k of ka) {
      const d = firstDiff((a as any)[k], (b as any)[k], `${at}.${k}`);
      if (d) return d;
    }
    return '';
  }
  return `${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
}

/* ────────────────────────── A/B 场景 ────────────────────────── */

interface Scenario {
  name: string;
  run: (reducerMod: Record<string, any>, actionMod: Record<string, any>) => unknown;
}

const GROUPS = [
  { appSectionId: 's1', item: [{ workSheetId: 'w1', workSheetName: '表一' }], childSections: [] },
  { appSectionId: 's2', workSheetInfo: [{ workSheetId: 'w2', name: '页二', type: 1 }] },
];

const SCENARIOS: Scenario[] = [
  {
    name: '初始状态（未派发任何 action）：默认值形状',
    run: (R, A) => {
      const s = R.default(undefined, { type: '@@INIT' });
      return { keys: Object.keys(s).sort(), value: s };
    },
  },
  {
    name: 'SYNC_APP_DETAIL：浅合并局部详情，未提到的字段保持不变',
    run: (R, A) => {
      const before = R.default(undefined, { type: '@@INIT' });
      const after = R.default(before, A.syncAppDetail({ currentPcNaviStyle: 2, iconColor: '#ff0000' }));
      return {
        after,
        // 浅合并契约：原对象不被改写
        beforeUnchanged: before,
        sameRefAsBefore: after === before,
        // 只并入了给出的两个字段，其余保持默认
        keptDefaults: { projectId: after.projectId, appStatus: after.appStatus, name: after.name },
      };
    },
  },
  {
    name: 'SYNC_APP_DETAIL：显式 undefined 会覆盖（浅合并的真实语义）',
    run: (R, A) => {
      const before = R.default(undefined, { type: '@@INIT' });
      const after = R.default(before, A.syncAppDetail({ name: undefined }));
      return { nameInAfter: after.name ?? null, nameIsOwnKey: Object.prototype.hasOwnProperty.call(after, 'name') };
    },
  },
  {
    name: 'CHANGE_APP_COLOR / CHANGE_NAV_COLOR：只改对应字段',
    run: (R, A) => {
      const s0 = R.default(undefined, { type: '@@INIT' });
      const s1 = R.default(s0, A.changeAppColor('#00ff00'));
      const s2 = R.default(s1, A.changeNavColor('#0000ff'));
      return {
        afterColor: { iconColor: s1.iconColor, navColor: s1.navColor ?? null },
        afterNav: { iconColor: s2.iconColor, navColor: s2.navColor ?? null },
        projectIdKept: s2.projectId,
      };
    },
  },
  {
    name: 'UPDATE_APP_GROUP：整数组替换，数组元素结构原样保留',
    run: (R, A) => {
      const s0 = R.default(undefined, { type: '@@INIT' });
      const s1 = R.default(s0, A.updateAppGroup(GROUPS));
      return {
        groups: s1.appGroups,
        sameArrayRef: s1.appGroups === GROUPS,
        firstSectionId: s1.appGroups[0]?.appSectionId ?? null,
        childHasWorkSheetInfo: Array.isArray(s1.appGroups[1]?.workSheetInfo),
      };
    },
  },
  {
    name: 'UPDATE_APP_GROUP：载荷缺失时回落成空数组（原实现的解构默认值）',
    run: (R, A) => {
      const s0 = R.default(undefined, { type: '@@INIT' });
      // 绕过 creator，直接派发缺载荷的原始 action —— 这正是原实现 `appGroups = []` 覆盖的路径
      const s1 = R.default(s0, { type: A.UPDATE_APP_GROUP });
      return { appGroups: s1.appGroups, isArray: Array.isArray(s1.appGroups) };
    },
  },
  {
    name: 'SET_APP_STATUS：写入状态；载荷缺失时回落成 0',
    run: (R, A) => {
      const s0 = R.default(undefined, { type: '@@INIT' });
      const s1 = R.default(s0, A.setAppStatus(4));
      const s2 = R.default(s0, { type: A.SET_APP_STATUS });
      return { explicit: s1.appStatus, fallback: s2.appStatus };
    },
  },
  {
    name: 'CLEAR_APP_DETAIL：回到默认值，且是**浅拷贝**而非默认对象本身',
    run: (R, A) => {
      const dirty = R.default(R.default(undefined, { type: '@@INIT' }), A.syncAppDetail({ iconColor: '#123456', projectId: 'p9' }));
      const cleared = R.default(dirty, A.clearAppDetail());
      const def = R.default(undefined, { type: '@@INIT' });
      return {
        cleared,
        // 与默认值逐字段相等……
        equalsDefault: JSON.stringify(cleared) === JSON.stringify(def),
        // ……但不是同一个对象引用（原实现 `{ ...defaultState }`）
        sameRefAsInternalDefault: cleared === def,
      };
    },
  },
  {
    name: 'CLEAR_APP_DETAIL 之后：默认对象不被后续合并污染',
    run: (R, A) => {
      const s0 = R.default(undefined, { type: '@@INIT' });
      const cleared = R.default(s0, A.clearAppDetail());
      const merged = R.default(cleared, A.syncAppDetail({ iconColor: '#abcdef' }));
      // 再清空一次：若之前污染了共享默认对象，这里会带上 #abcdef
      const again = R.default(merged, A.clearAppDetail());
      return { againIconColor: again.iconColor };
    },
  },
  {
    name: '未知 action：原样返回同一引用，且不新增字段',
    run: (R, A) => {
      const s0 = R.default(undefined, { type: '@@INIT' });
      const same = R.default(s0, { type: 'SOME_UNRELATED_ACTION' });
      return { sameRef: same === s0, keys: Object.keys(same).sort(), value: same };
    },
  },
  {
    name: '连续 action 序列：颜色 → 分组 → 状态 → 同步详情 的最终状态',
    run: (R, A) => {
      let s = R.default(undefined, { type: '@@INIT' });
      s = R.default(s, A.changeAppColor('#111111'));
      s = R.default(s, A.changeNavColor('#222222'));
      s = R.default(s, A.updateAppGroup(GROUPS));
      s = R.default(s, A.setAppStatus(300016));
      s = R.default(s, A.syncAppDetail({ id: 'app-1', currentPcNaviStyle: 3, themeType: 'dark' }));
      return s;
    },
  },
  {
    name: 'creator 产出的 action 形状（type 与载荷键）',
    run: (R, A) => ({
      sync: A.syncAppDetail({ id: 'x' }),
      color: A.changeAppColor('#fff'),
      nav: A.changeNavColor('#eee'),
      group: A.updateAppGroup([]),
      status: A.setAppStatus(1),
      clear: A.clearAppDetail(),
      constants: {
        SYNC: A.SYNC_APP_DETAIL,
        COLOR: A.CHANGE_APP_COLOR,
        NAV: A.CHANGE_NAV_COLOR,
        GROUP: A.UPDATE_APP_GROUP,
        STATUS: A.SET_APP_STATUS,
        CLEAR: A.CLEAR_APP_DETAIL,
      },
    }),
  },
];

/* ────────────────────────── 执行 ────────────────────────── */

async function main(): Promise<void> {
  assertOriginalIntact();
  realConsole.log(`  ✓ A 侧基线 ${BASE_REV.slice(0, 9)} 的 reducers.ts / action.ts sha256 校验通过`);

  const loadOrig = makeLoader('orig');
  const loadCurrent = makeLoader('current');
  const OrigReducer = loadOrig('reducers.ts');
  const OrigAction = loadOrig('action.ts');
  const CurrentReducer = loadCurrent('reducers.ts');
  const CurrentAction = loadCurrent('action.ts');

  for (const scenario of SCENARIOS) {
    try {
      const origValue = scenario.run(OrigReducer, OrigAction);
      const currentValue = scenario.run(CurrentReducer, CurrentAction);
      checks += 1;
      if (JSON.stringify(origValue) === JSON.stringify(currentValue)) {
        realConsole.log(`  ✓ ${scenario.name}`);
      } else {
        failed += 1;
        realConsole.error(`  ✗ ${scenario.name}：A/B 不一致 → ${firstDiff(origValue, currentValue)}`);
      }
    } catch (error) {
      checks += 1;
      failed += 1;
      realConsole.error(`  ✗ ${scenario.name}（用例异常）`);
      realConsole.error(`      ${error instanceof Error ? error.stack || error.message : String(error)}`);
    }
  }

  /* ── 绝对断言：固定真实语义，防止两侧一起错 ── */

  check('默认值必须是这 5 个字段的这组取值', () => {
    const s = CurrentReducer.default(undefined, { type: '@@INIT' });
    assert.deepEqual(
      { iconColor: s.iconColor, projectId: s.projectId, appGroups: s.appGroups, appStatus: s.appStatus, name: s.name },
      { iconColor: '#1677ff', projectId: '', appGroups: [], appStatus: 0, name: '应用' },
    );
  });

  check('SYNC_APP_DETAIL 是浅合并：只覆盖给出的键，且不改动入参', () => {
    const before = CurrentReducer.default(undefined, { type: '@@INIT' });
    const snapshot = JSON.stringify(before);
    const after = CurrentReducer.default(before, CurrentAction.syncAppDetail({ iconColor: '#ff0000' }));
    assert.equal(after.iconColor, '#ff0000');
    assert.equal(after.name, '应用', '未提到的字段必须保持');
    assert.equal(JSON.stringify(before), snapshot, '入参对象不得被改写');
    assert.notEqual(after, before, '必须返回新对象');
  });

  check('CLEAR_APP_DETAIL 返回浅拷贝，清空后再合并不会污染共享默认值', () => {
    const s0 = CurrentReducer.default(undefined, { type: '@@INIT' });
    const cleared = CurrentReducer.default(s0, CurrentAction.clearAppDetail());
    assert.equal(cleared.iconColor, '#1677ff');
    const merged = CurrentReducer.default(cleared, CurrentAction.syncAppDetail({ iconColor: '#abcdef' }));
    const again = CurrentReducer.default(merged, CurrentAction.clearAppDetail());
    assert.equal(again.iconColor, '#1677ff', '共享默认对象被污染了');
  });

  check('未知 action 必须原样返回同一引用', () => {
    const s0 = CurrentReducer.default(undefined, { type: '@@INIT' });
    assert.equal(CurrentReducer.default(s0, { type: 'NOPE' }), s0);
  });

  check('UPDATE_APP_GROUP / SET_APP_STATUS 的载荷缺失回落行为保持不变', () => {
    const s0 = CurrentReducer.default(undefined, { type: '@@INIT' });
    const g = CurrentReducer.default(s0, { type: CurrentAction.UPDATE_APP_GROUP });
    assert.ok(Array.isArray(g.appGroups), 'appGroups 应回落成数组');
    assert.equal(g.appGroups.length, 0);
    const st = CurrentReducer.default(s0, { type: CurrentAction.SET_APP_STATUS });
    assert.equal(st.appStatus, 0, 'appStatus 应回落成 0');
  });

  summarized = true;
  if (failed) {
    realConsole.error(`PageHeader/redux 行为规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `PageHeader/redux 行为规格通过：${checks} 项（${SCENARIOS.length} 个历史 A/B 场景 + 5 条绝对断言）`,
  );
}

main().catch(error => {
  realConsole.error(
    `PageHeader/redux 规格自身异常（不是被测代码差异）：${error instanceof Error ? error.stack || error.message : String(error)}`,
  );
  process.exitCode = 1;
});
