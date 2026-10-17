/**
 * 应用详情切片（`PageHeader/redux`）**真实 connect 消费**规格 —— 历史 A/B 对照版
 *
 * 【为什么要单独一份】`reducers.spec.ts` 直接调用 reducer 函数，能证明 reducer 自身
 * 行为不变；但本批的收益是「消费方能拿到真实类型」，因此还要证明：
 *   真实 `redux` store + 真实 `react-redux` connect + 真实 `react-dom/server` 渲染时，
 *   `state.appPkg` 能按预期流到组件；并且这一点在类型化前后**输出一致**。
 *
 * 全程使用真依赖：`react` / `react-dom` / `react-redux` / `redux`。
 * 只替身与本模块无关的东西（产品代码只用到类型导入，运行时几乎没有外部依赖）。
 *
 * A 侧：`git show 62dfebaea:` 下的 `reducers.ts` / `action.ts`（sha256 冻结）。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { transformFileSync, transformSync, ROOT } = require('../../../../scripts/spec-harness.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };
(globalThis as Record<string, unknown>)['_l'] = (s: string) => String(s);

/* ────────────────────────── A 侧基线 ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/PageHeader/redux';
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

/* ────────────────────────── 模块加载（variant 作用域） ────────────────────────── */

function makeLoader(variant: 'orig' | 'current') {
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
      if (r === './types') return {}; // 纯类型导入
      if (r.startsWith('./')) return load(`${r.slice(2)}.ts`);
      if (r === 'src/redux/types' || r === 'src/utils/appTypes') return {}; // 纯类型导入
      if (r.endsWith('.less') || r.endsWith('.html')) return {};
      throw new Error(`spec 没给 ${r} 打桩（${variant}/${rel}）`);
    };
    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports as Record<string, any>;
  };
  return load;
}

/* ────────────────────────── 真实 react / redux / react-redux ────────────────────────── */

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Provider, connect } = require('react-redux');
const { createStore, combineReducers } = require('redux');

/**
 * 一个**极小的真实消费方**：只读它需要的字段，形态与仓内真实消费点一致
 * （`iconColor` / `currentPcNaviStyle` / `appStatus` / `appGroups.length` / `projectId`）。
 */
const ProbeView = (props: { appPkg: Record<string, any> }) => {
  const { iconColor, currentPcNaviStyle, appStatus, appGroups, projectId, name } = props.appPkg;
  return React.createElement(
    'span',
    { className: 'probe' },
    `${name}|${iconColor}|${projectId}|${currentPcNaviStyle ?? 'unset'}|${appStatus}|${Array.isArray(appGroups) ? appGroups.length : 'na'}`,
  );
};

/* ────────────────────────── 防假绿 ────────────────────────── */

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

/* ────────────────────────── 渲染工具 ────────────────────────── */

/** 用真实 store + 真实 connect 渲染，返回 HTML */
function renderWith(
  reducer: (state: unknown, action: unknown) => unknown,
  steps: (dispatch: (a: unknown) => unknown, actions: Record<string, any>) => void,
  actions: Record<string, any>,
): string {
  const store = createStore(combineReducers({ appPkg: reducer as never }) as never);
  const Connected = connect((state: any) => ({ appPkg: state.appPkg }))(ProbeView as never) as never;
  steps(store.dispatch as never, actions);
  return renderToStaticMarkup(
    React.createElement(Provider, { store }, React.createElement(Connected, {})) as never,
  );
}

const GROUPS = [{ appSectionId: 's1', item: [{ workSheetId: 'w1' }] }, { appSectionId: 's2' }];

/** 本规格用到的「派发脚本」集合：所有场景只通过真实 dispatch 驱动 */
const STEPS: { name: string; run: (dispatch: (a: unknown) => unknown, actions: Record<string, any>) => void }[] = [
  { name: '初始（未派发）', run: () => {} },
  {
    name: '同步详情（颜色 + 导航风格）',
    run: (d, a) => d(a.syncAppDetail({ iconColor: '#ff0000', currentPcNaviStyle: 2 })),
  },
  { name: '改色', run: (d, a) => d(a.changeAppColor('#00ff00')) },
  { name: '改导航色', run: (d, a) => d(a.changeNavColor('#0000ff')) },
  { name: '写分组', run: (d, a) => d(a.updateAppGroup(GROUPS)) },
  { name: '写状态', run: (d, a) => d(a.setAppStatus(300016)) },
  {
    name: '清空（回到默认）',
    run: (d, a) => {
      d(a.syncAppDetail({ iconColor: '#ff0000', projectId: 'p9' }));
      d(a.clearAppDetail());
    },
  },
  {
    name: '组合序列',
    run: (d, a) => {
      d(a.syncAppDetail({ id: 'app-1', currentPcNaviStyle: 3, themeType: 'dark' }));
      d(a.changeAppColor('#111111'));
      d(a.updateAppGroup(GROUPS));
      d(a.setAppStatus(4));
    },
  },
  { name: '未知 action', run: d => d({ type: 'UNRELATED' }) },
];

/* ────────────────────────── 执行 ────────────────────────── */

function main(): void {
  assertOriginalIntact();
  realConsole.log(`  ✓ A 侧基线 ${BASE_REV.slice(0, 9)} 的 sha256 校验通过`);

  const loadOrig = makeLoader('orig');
  const loadCurrent = makeLoader('current');
  const OrigReducer = loadOrig('reducers.ts').default;
  const OrigActions = loadOrig('action.ts');
  const CurrentReducer = loadCurrent('reducers.ts').default;
  const CurrentActions = loadCurrent('action.ts');

  /* ① 真实 connect 消费下的历史 A/B：逐场景比对渲染出的 HTML */
  for (const step of STEPS) {
    check(`真实 connect 消费 A/B：${step.name}`, () => {
      const origHtml = renderWith(OrigReducer, step.run, OrigActions);
      const currentHtml = renderWith(CurrentReducer, step.run, CurrentActions);
      assert.equal(currentHtml, origHtml, `渲染结果不一致：\n      原 ${origHtml}\n      现 ${currentHtml}`);
      // 防假等价：必须有真正的探针内容
      assert.ok(origHtml.includes('class="probe"'), '渲染结果里必须有探针节点');
    });
  }

  /* ② 绝对断言：证明 appPkg 真的经 store/connect 流到了组件 */
  check('connect 接线：初始默认值到达组件', () => {
    const html = renderWith(CurrentReducer, () => {}, CurrentActions);
    assert.ok(html.includes('应用|#1677ff||unset|0|0'), `初始渲染应含默认值，实际 ${html}`);
  });

  check('connect 接线：dispatch 后新值到达组件', () => {
    const html = renderWith(CurrentReducer, (d, a) => {
      d(a.syncAppDetail({ iconColor: '#abcabc', currentPcNaviStyle: 2, projectId: 'proj-9' }));
      d(a.updateAppGroup(GROUPS));
      d(a.setAppStatus(7));
    }, CurrentActions);
    assert.ok(
      html.includes('应用|#abcabc|proj-9|2|7|2'),
      `dispatch 后应反映新值，实际 ${html}`,
    );
  });

  check('connect 接线：清空后回到默认值', () => {
    const html = renderWith(CurrentReducer, (d, a) => {
      d(a.syncAppDetail({ iconColor: '#ff0000', projectId: 'p9', currentPcNaviStyle: 1 }));
      d(a.clearAppDetail());
    }, CurrentActions);
    assert.ok(html.includes('应用|#1677ff||unset|0|0'), `清空后应回默认，实际 ${html}`);
  });

  check('消费方读取的字段确实存在（名字/颜色/项目/导航/状态/分组长度）', () => {
    const html = renderWith(CurrentReducer, () => {}, CurrentActions);
    const parts = /<span class="probe">([^<]*)<\/span>/.exec(html);
    assert.ok(parts, `未能从 HTML 里解析探针内容：${html}`);
    const fields = parts[1].split('|');
    assert.equal(fields.length, 6, `探针字段数应为 6，实际 ${fields.length}`);
  });

  summarized = true;
  if (failed) {
    realConsole.error(`PageHeader/redux 真实 connect 消费规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `PageHeader/redux 真实 connect 消费规格通过：${checks} 项（${STEPS.length} 个真 store+connect 渲染 A/B + 3 条接线断言 + 1 条字段断言）`,
  );
}

main();
