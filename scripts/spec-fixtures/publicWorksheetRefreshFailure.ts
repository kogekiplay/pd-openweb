/**
 * `refreshShareUrl` 失败路径的**独立子进程夹具**
 *
 * 【为什么必须用子进程】`refreshShareUrl` 的旧实现（基线）**没有 `.catch`**：
 * 接口失败时该 Promise 没有任何处理器 → 必然产生**未处理拒绝**。
 * Node 对未处理拒绝的默认行为是**以非零码退出**。
 *
 * 要证明这一点，就**不能在主规格里装 `unhandledRejection` 处理器**（那会"全局吞掉"它），
 * 否则无法区分"旧路径真的会炸"与"被我们自己的守卫吃掉了"。
 * 因此：本夹具**不装任何全局处理器**，由调用方（规格）观察它的退出码。
 *
 * 用法：`node refreshFailureFixture.ts <orig|current>`
 *   退出码 0  = 失败路径被处理（无未处理拒绝）
 *   退出码 ≠0 = 出现未处理拒绝（旧行为）
 */
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { transformFileSync, transformSync, ROOT } = require('../spec-harness.ts');

const variant = process.argv[2] === 'orig' ? 'orig' : 'current';
const REL_DIR = 'src/pages/FormExtend/PublicWorksheetConfig/redux';
/** lead 指定、main 可达的冻结基线 */
const BASE_REV = '3f768fdd2603727b9ba11c0c579a6d58c4d8283a';

// 宿主替身（**不装 unhandledRejection**，这是本夹具的关键）
(globalThis as any)['_l'] = (s: string) => String(s);
(globalThis as any)['alert'] = (message: string) => {
  // 只记录，不打印（避免与退出码断言混淆）
  (globalThis as any).__alerts = ((globalThis as any).__alerts || []).concat(message);
};
(globalThis as any)['safeParse'] = (v: unknown) => v;
(globalThis as any)['window'] = {};

const _ = require('lodash');

/** 接口替身：**返回一个已拒绝的真实 Promise** */
const rejectingApi = {
  saveSetting: () => Promise.reject(new Error('x')),
  saveWorksheet: () => Promise.reject(new Error('x')),
  refreshPublicWorksheetUrl: () => Promise.reject(new Error('refresh-boom')),
  reset: () => Promise.reject(new Error('x')),
  getPublicWorksheetInfo: () => Promise.reject(new Error('x')),
};
const formApi = { addTextControl: () => Promise.reject(new Error('x')) };

const cache = new Map<string, any>();
const load = (rel: string): any => {
  if (cache.has(rel)) {
    const hit = cache.get(rel);
    return hit.exports ?? hit;
  }
  const moduleLike: any = { exports: {} };
  cache.set(rel, moduleLike);

  const filename = path.join(ROOT, REL_DIR, rel);
  const babelOpts = {
    presets: [require.resolve('@babel/preset-react')],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  };
  const code =
    variant === 'orig' && rel === 'actions.ts'
      ? (
          transformSync(
            execFileSync('git', ['show', `${BASE_REV}:${REL_DIR}/${rel}`], {
              cwd: ROOT,
              encoding: 'utf8',
              maxBuffer: 16 * 1024 * 1024,
            }),
            { ...babelOpts, filename },
          ) as { code: string }
        ).code
      : (transformFileSync(filename, babelOpts) as { code: string }).code;

  const req = (r: string) => {
    if (r === 'lodash') return _;
    if (r === 'src/api/form') return formApi;
    if (r === 'src/api/publicWorksheet') return rejectingApi;
    if (r === '../../utils') return { getDisabledControls: () => [], getNewControlColRow: () => ({ col: 0, row: 0 }) };
    if (r === 'src/redux/types' || r === 'src/utils/controlTypes') return {};
    if (r.startsWith('./')) return load(`${r.slice(2)}.ts`);
    throw new Error(`夹具没给 ${r} 打桩`);
  };

  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
  return moduleLike.exports;
};

const actions = load('actions.ts');

const state = {
  publicWorksheet: {
    worksheetInfo: { worksheetId: 'w1', projectId: 'p1' },
    worksheetSettings: {},
    originalControls: [],
    controls: [],
    hidedControlIds: [],
  },
};

const dispatched: string[] = [];
const dispatch = (action: any) => {
  if (typeof action === 'function') {
    return action(dispatch, () => state);
  }
  dispatched.push(action?.type);
};

// 只派发 refreshShareUrl（失败路径）
actions.refreshShareUrl()(dispatch, () => state);

// 给微任务/宏任务留出时间，让"未处理拒绝"真正被 Node 观测到
setTimeout(() => {
  const alerts: string[] = (globalThis as any).__alerts || [];
  process.stdout.write(
    `variant=${variant} dispatched=${JSON.stringify(dispatched)} alerts=${JSON.stringify(alerts)}\n`,
  );
  // 故意不设置 exitCode：让"未处理拒绝"决定退出码
}, 50);
