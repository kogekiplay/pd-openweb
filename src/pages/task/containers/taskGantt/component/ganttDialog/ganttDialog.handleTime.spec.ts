/**
 * 甘特弹窗日期范围换算（ganttDialog index.handleTime）行为规格 —— 历史 A/B 对照版
 *
 * 【为什么单开一份】`ganttDialog.spec.ts` 里 `handleTime` 只被 `getData` 与
 * `switchDisplayType` 间接覆盖，没有直接规格。lead 在 2026-10-17 复核意见中
 * 点名允许为它建直接覆盖的 spec。日期换算是"日期分组"这条行为的核心：
 * day/week/month 三种粒度各自的加减与对齐错了，甘特图的时间轴就会整体偏移。
 *
 * A 侧来源：`git show a3bd34da1`（main可达、源码与协作基线相同）的 `ganttDialog/index.tsx`，
 * 规格开头按 sha256 冻结校验，因此对照不会随工作区改动而漂移。
 *
 * 【本规格特别守住的一条契约】`handleTime` **原地修改**传入的 moment
 * （`subtract`/`add`/`startOf`/`endOf` 都是就地变更并返回自身），返回的也是
 * 同两个引用。调用方（`getData` / `switchDisplayType`）因此必须先 `.clone()`
 * 再传进来 —— 这条契约一旦被改成"内部克隆"，调用方的语义会跟着变。
 *
 * 【日期对齐与 locale】`startOf('week')` 的结果取决于 moment 的 locale
 * （周一或周日起算）。本规格因此**不硬编码星期几**，而是逐字段比对 A/B 两侧；
 * 只在 locale 无关的地方（如"减 7 天"、startOf('month')）给绝对断言。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { transformFileSync, transformSync, ROOT } = require('../../../../../../../scripts/spec-harness.ts');

/* ────────────────────────── A/B 双版本加载 ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/task/containers/taskGantt/component/ganttDialog';
/** main可达的类型批次前 revision；冻结SHA与原协作基线相同 */
const BASE_REV = 'a3bd34da1e6ca32c7fd452bc15bf49ded33cfd01';
/** 原实现 index.tsx 的 sha256 冻结值 */
const ORIG_SHA = 'aa9c33cac03f5eb65292fddcdbec74ed6540330442a6a49239e0fbcbe5925738';

let cachedOrig: string | undefined;

function origSource(): string {
  if (cachedOrig === undefined) {
    cachedOrig = execFileSync('git', ['show', `${BASE_REV}:${REL_DIR}/index.tsx`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  }

  return cachedOrig;
}

function assertOriginalIntact(): void {
  const actual = crypto.createHash('sha256').update(origSource()).digest('hex');
  assert.equal(actual, ORIG_SHA, `原实现 index.tsx（${BASE_REV}）的 sha256 与冻结值不符，A/B 对照失效`);
}

/* ────────────────────────── 环境替身（仅加载所需） ────────────────────────── */

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };

class FakeHTMLElement {
  className = '';
  style: Record<string, string> = {};
  addEventListener(): void {}
  getBoundingClientRect() {
    return { top: 0, width: 0, height: 0 };
  }
}
Object.assign(globalThis, { HTMLElement: FakeHTMLElement, HTMLCanvasElement: FakeHTMLElement });
(globalThis as Record<string, unknown>)['_l'] = (s: string) => s;
(globalThis as Record<string, unknown>)['alert'] = () => {};

(globalThis as Record<string, unknown>)['btoa'] = (s: string) => Buffer.from(s, 'binary').toString('base64');
(globalThis as Record<string, unknown>)['window'] = { open: () => {} };
(globalThis as Record<string, unknown>)['md'] = {
  global: { FileStoreConfig: { uploadHost: 'https://upload.test', pubHost: 'https://pub.test' } },
};
(globalThis as Record<string, unknown>)['document'] = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
};

class FakeComponent {
  props: Record<string, unknown>;
  state: Record<string, unknown> = {};
  constructor(props: Record<string, unknown>) {
    const defaults = (this.constructor as unknown as { defaultProps?: Record<string, unknown> }).defaultProps || {};
    this.props = { ...defaults, ...(props || {}) };
  }
  setState(update: Record<string, unknown>, cb?: () => void): void {
    this.state = { ...this.state, ...update };
    if (cb) cb();
  }
}
const createElement = (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children });
const fakeReact = { Component: FakeComponent, Fragment: 'Fragment', createElement };

const moment = require('moment');
moment.suppressDeprecationWarnings = true;
moment.now = () => new Date('2026-10-12T12:00:00+08:00').valueOf();

const esm = <T>(value: T) => ({ __esModule: true, default: value });
const configModule = require('./config.ts');
const config = configModule.default || configModule;

function loadDialog(variant: 'orig' | 'current') {
  const stubs: Record<string, unknown> = {
    react: fakeReact,
    'react/jsx-runtime': { __esModule: true, jsx: createElement, jsxs: createElement, Fragment: 'Fragment' },
    lodash: require('lodash'),
    moment,
    classnames: require('classnames'),
    'ming-ui/components/Icon': esm(() => null),
    'prop-types': { string: {}, func: {} },
    './config': config,
    './config.ts': config,
    './dataBoundary': require('./dataBoundary.ts'),
    './time': require('./time.ts'),
    './time.ts': require('./time.ts'),
    './GanttContent': esm(() => null),
    './GanttContent.tsx': esm(() => null),
    './GanttHeader': esm(() => null),
    './GanttHeader.tsx': esm(() => null),
    './GanttSideBar': esm(() => null),
    './GanttSideBar.tsx': esm(() => null),
    'ming-ui/components/Dialog': esm(() => null),
    'ming-ui/components/Dialog/DialogBase': esm(() => null),
    'ming-ui/components/LoadDiv': esm(() => null),
    'src/components/errorPage/errorState': esm(() => null),
    '../../../taskDetail/taskDetail': esm(() => null),
    'src/api/taskCenter': esm({ getTaskStaticGanttChart: () => Promise.resolve({ status: false }) }),
    'src/utils/common': { downloadFile: (u: string) => u, getToken: () => Promise.resolve([]) },
    'src/utils/commonRequestBoundary': { requireBase64FileToken: () => ({ key: '', uptoken: '' }) },
    axios: { post: () => Promise.resolve({ data: {} }) },
    html2canvas: () => Promise.resolve({}),
  };
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };

  const req = (r: string) => {
    if (r in stubs) return stubs[r];
    if (r.endsWith('.less') || r.endsWith('.html')) return {};
    throw new Error(`spec 没给 ${r} 打桩（${variant}/index.tsx）`);
  };

  const filename = path.join(DIR, 'index.tsx');
  const babelOpts = {
    presets: [require.resolve('@babel/preset-react')],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  };
  const code =
    variant === 'orig'
      ? (transformSync(origSource(), { ...babelOpts, filename }) as { code: string }).code
      : (transformFileSync(filename, babelOpts) as { code: string }).code;
  // 原实现的 exportData 用 $ —— 这里只是加载，给一个最小替身即可
  new Function('module', 'exports', 'require', '$', code)(moduleLike, moduleLike.exports, req, () => ({
    width: () => 0,
    height: () => 0,
    find: () => ({ width: () => 0, height: () => 0 }),
    clone: () => ({}),
    css: () => {},
    append: () => {},
    remove: () => {},
    0: null,
  }));
  return (moduleLike.exports as { default: new (props: Record<string, unknown>) => any }).default;
}

/* ────────────────────────── 探针 ────────────────────────── */

type Case = {
  name: string;
  type: string;
  begin: string;
  end: string;
};

const CASES: Case[] = [
  { name: 'day / 月中', type: 'day', begin: '2026-10-15 08:30:00', end: '2026-10-20 17:45:00' },
  { name: 'day / 跨月', type: 'day', begin: '2026-10-28 00:00:00', end: '2026-11-02 23:59:59' },
  { name: 'day / 跨年', type: 'day', begin: '2026-12-29 12:00:00', end: '2027-01-03 06:00:00' },
  { name: 'week / 月中', type: 'week', begin: '2026-10-15 08:30:00', end: '2026-10-20 17:45:00' },
  { name: 'week / 周日与周一的边界', type: 'week', begin: '2026-10-18 00:00:00', end: '2026-10-19 00:00:00' },
  { name: 'week / 跨月', type: 'week', begin: '2026-10-30 09:00:00', end: '2026-11-02 09:00:00' },
  { name: 'month / 月中', type: 'month', begin: '2026-10-15 08:30:00', end: '2026-10-20 17:45:00' },
  { name: 'month / 跨年', type: 'month', begin: '2026-01-15 00:00:00', end: '2026-01-20 00:00:00' },
  { name: 'month / 月末与月初', type: 'month', begin: '2026-10-31 23:00:00', end: '2026-11-01 01:00:00' },
  { name: 'month / 闰年 2 月', type: 'month', begin: '2028-02-10 00:00:00', end: '2028-02-20 00:00:00' },
  { name: '未知粒度 / 不应做任何调整', type: 'quarter', begin: '2026-10-15 08:30:00', end: '2026-10-20 17:45:00' },
];

/** 跑一个用例，返回可 JSON 化的结果（含"是否原地修改入参"的证据） */
function runCase(Dialog: any, item: Case) {
  const dialog = new Dialog({ folderID: 'f1' });
  dialog.state = { ...dialog.state, type: item.type };

  const beginInput = moment(item.begin);
  const endInput = moment(item.end);
  // 记录调用前的值：用于验证入参被原地改写
  const beginBefore = beginInput.format('YYYY-MM-DD HH:mm:ss');
  const endBefore = endInput.format('YYYY-MM-DD HH:mm:ss');

  const result = dialog.handleTime(beginInput, endInput);

  return {
    type: item.type,
    begin: String(result.beginTime?.format?.('YYYY-MM-DD HH:mm:ss') ?? result.beginTime),
    end: String(result.endTime?.format?.('YYYY-MM-DD HH:mm:ss') ?? result.endTime),
    // 原地修改契约：返回的必须是同两个引用
    returnsSameRefs: result.beginTime === beginInput && result.endTime === endInput,
    // 入参确实被改写（原值 → 新值）
    inputWasMutated:
      beginInput.format('YYYY-MM-DD HH:mm:ss') !== beginBefore || endInput.format('YYYY-MM-DD HH:mm:ss') !== endBefore,
    // 输入是否带时间部分（用于确认"没被意外 startOf('day')"）
    beginKeptTimeOfDay: result.beginTime?.format?.('HH:mm:ss'),
    endKeptTimeOfDay: result.endTime?.format?.('HH:mm:ss'),
  };
}

/* ────────────────────────── 执行 ────────────────────────── */

let failed = 0;
let checks = 0;

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

try {
  assertOriginalIntact();
  realConsole.log('  ✓ 原实现快照完整（A/B 对照前提）');
} catch (error) {
  failed += 1;
  realConsole.error(`  ✗ 原实现快照校验失败：${error instanceof Error ? error.message : String(error)}`);
}

const OrigDialog = loadDialog('orig');
const CurrentDialog = loadDialog('current');

const initialLocale = moment.locale();
require('moment/locale/zh-cn');
const weekBoundaries: string[] = [];

for (const locale of ['en', 'zh-cn']) {
  assert.equal(moment.locale(locale), locale);
  for (const item of CASES) {
    check(`${locale} / ${item.name}（A/B 逐字段一致）`, () => {
      const origValue = runCase(OrigDialog, item);
      const currentValue = runCase(CurrentDialog, item);
      if (item.name.includes('周日与周一')) weekBoundaries.push(currentValue.begin);
      assert.deepEqual(currentValue, origValue);
    });
  }
}

moment.locale(initialLocale);
check('英文与中文的不同周起算日均得到覆盖', () => assert.notEqual(weekBoundaries[0], weekBoundaries[1]));

/* ────────────────────────── locale 无关的绝对断言 ────────────────────────── */
/* 这些值不依赖 startOf('week') 的起算日，因此可以写死，作为"确实做了正确加减"的兜底。 */

check('day 粒度：起始减 7 天、结束加 8 天，且不裁剪时分秒', () => {
  const dialog = new CurrentDialog({ folderID: 'f1' });
  dialog.state = { ...dialog.state, type: 'day' };
  const out = dialog.handleTime(moment('2026-10-15 08:30:00'), moment('2026-10-20 17:45:00'));
  assert.equal(out.beginTime.format('YYYY-MM-DD HH:mm:ss'), '2026-10-08 08:30:00');
  assert.equal(out.endTime.format('YYYY-MM-DD HH:mm:ss'), '2026-10-28 17:45:00');
});

check('month 粒度：起始对齐到月初、结束对齐到月末', () => {
  const dialog = new CurrentDialog({ folderID: 'f1' });
  dialog.state = { ...dialog.state, type: 'month' };
  const out = dialog.handleTime(moment('2026-10-15 08:30:00'), moment('2026-10-20 17:45:00'));
  // 起始：减 1 月（2026-09-15）再 startOf('month') → 2026-09-01 00:00:00
  assert.equal(out.beginTime.format('YYYY-MM-DD HH:mm:ss'), '2026-09-01 00:00:00');
  // 结束：加 1 月（2026-11-20）再 endOf('month') → 2026-11-30 23:59:59
  assert.equal(out.endTime.format('YYYY-MM-DD HH:mm:ss'), '2026-11-30 23:59:59');
});

check('month 粒度跨年：1 月减 1 月应落到上一年 12 月', () => {
  const dialog = new CurrentDialog({ folderID: 'f1' });
  dialog.state = { ...dialog.state, type: 'month' };
  const out = dialog.handleTime(moment('2026-01-15 00:00:00'), moment('2026-01-20 00:00:00'));
  assert.equal(out.beginTime.format('YYYY-MM-DD'), '2025-12-01');
  assert.equal(out.endTime.format('YYYY-MM-DD'), '2026-02-28');
});

check('未知粒度：不做任何调整，原值返回', () => {
  const dialog = new CurrentDialog({ folderID: 'f1' });
  dialog.state = { ...dialog.state, type: 'quarter' };
  const out = dialog.handleTime(moment('2026-10-15 08:30:00'), moment('2026-10-20 17:45:00'));
  assert.equal(out.beginTime.format('YYYY-MM-DD HH:mm:ss'), '2026-10-15 08:30:00');
  assert.equal(out.endTime.format('YYYY-MM-DD HH:mm:ss'), '2026-10-20 17:45:00');
});

check('原地修改契约：入参被改写，且调用方因此必须先 clone', () => {
  const dialog = new CurrentDialog({ folderID: 'f1' });
  dialog.state = { ...dialog.state, type: 'day' };
  const begin = moment('2026-10-15 08:30:00');
  const end = moment('2026-10-20 17:45:00');
  const out = dialog.handleTime(begin, end);
  // 返回同引用
  assert.equal(out.beginTime, begin);
  assert.equal(out.endTime, end);
  // 入参本身已被改写（调用方若不 clone 会连带改掉自己的源对象）
  assert.equal(begin.format('YYYY-MM-DD'), '2026-10-08');
  assert.equal(end.format('YYYY-MM-DD'), '2026-10-28');
});

check('clone 后调用：源对象不被影响（这正是 getData/switchDisplayType 的用法）', () => {
  const dialog = new CurrentDialog({ folderID: 'f1' });
  dialog.state = { ...dialog.state, type: 'week' };
  const source = moment('2026-10-15 08:30:00');
  const sourceEnd = moment('2026-10-20 17:45:00');
  dialog.handleTime(source.clone(), sourceEnd.clone());
  assert.equal(source.format('YYYY-MM-DD HH:mm:ss'), '2026-10-15 08:30:00', '源对象应保持不变');
  assert.equal(sourceEnd.format('YYYY-MM-DD HH:mm:ss'), '2026-10-20 17:45:00', '源对象应保持不变');
});

/* ────────────────────────── 汇总 ────────────────────────── */

if (failed) {
  realConsole.error(`ganttDialog handleTime 规格失败 ${failed}/${checks} 项`);
  process.exitCode = 1;
} else {
  realConsole.log(
    `ganttDialog handleTime 规格通过：${checks} 项（${CASES.length * 2} 个双 locale A/B 用例 + 7 条契约/locale断言）`,
  );
}
