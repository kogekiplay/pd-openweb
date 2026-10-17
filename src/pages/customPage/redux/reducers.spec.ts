/**
 * 自定义页面 redux（`customPage/redux`）行为规格 —— 历史 A/B 对照版
 *
 * 批次目标：消除 `RootState['customPage']` 整个 slice 的推导 `any`。
 * 本批对 `reducers.ts` 做了较多**语义等价重写**（`update()` 的计算键/深层 Spec
 * 换成显式 `map` 重建、`$push` 换成显式拼数组），因此**必须用 A/B 证明等价**，
 * 不能只靠"看起来一样"。
 *
 * A 侧：`git show fc6676e67:src/pages/customPage/redux/*`（lead 指定、main 可达），
 * sha256 冻结并在开头**实际断言**。
 *
 * 【为什么两边都要注入确定化的 uuid】`ADD_WIDGET` / `COPY_WIDGET` 里用 `uuidv4()`
 * 生成 id；A/B 比较必须让两侧拿到同一串 uuid，否则结果必然不同。这里**不是**在模仿
 * reducer 实现，而是把"随机数来源"确定化后仍然**驱动真实 reducer 代码**。
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { parser, transformFileSync, transformSync, ROOT } = require('../../../../scripts/spec-harness.ts');

const realConsole = { log: console.log.bind(console), error: console.error.bind(console) };
(globalThis as Record<string, unknown>)['_l'] = (s: string) => String(s);

/* ────────────────────────── A 侧基线（实际断言 SHA） ────────────────────────── */

const DIR = __dirname;
const REL_DIR = 'src/pages/customPage/redux';
/** lead 指定、已核验在 origin/main 上可达 */
const BASE_REV = 'fc6676e67';

const ORIG_SHA: Record<string, string> = {
  'reducers.ts': '51e8f494a24e546e06addd5d225c46a8d8a11ec300f917e6a92664d220104d1a',
  'action.ts': 'b31930a8fe8144144e826e6c38b4a4f8f498588e79daa0dfe95f4a248e76f288',
  'actionType.ts': 'c6eb67f60e6e052c92162bd88990f498241088ca328f3c80f3a9c3fb5604e8e1',
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

/** 冻结 SHA 的**实际断言**（不是只打印） */
function assertBaselineIntact(): void {
  for (const [file, expected] of Object.entries(ORIG_SHA)) {
    const actual = crypto.createHash('sha256').update(origSource(file)).digest('hex');
    assert.equal(actual, expected, `A 侧 ${file} 在 ${BASE_REV} 的 sha256 与冻结值不符，A/B 对照失效`);
  }
}

/* ────────────────────────── 环境替身 ────────────────────────── */

/** 确定化的 uuid：每次调用产生 `uuid-1`、`uuid-2`…，两侧各重置一次即可对齐 */
let uuidSeq = 0;
function makeUuidStub() {
  uuidSeq = 0;
  return { v4: () => `uuid-${++uuidSeq}` };
}

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

const realLodash = require('lodash');
const realMaxBy = require('lodash/maxBy');
const realUpdate = require('immutability-helper').default || require('immutability-helper');

/** 文档 / sessionStorage 替身（UPDATE_EDIT_PAGE_VISIBLE 会碰它们） */
const sessionStore: Record<string, string> = {};
const classList: string[] = [];
/**
 * `sessionStorage` 替身。
 *
 * 【关键：必须让 `_.keys(sessionStorage)` 能枚举出存储的键】
 * 原实现是 `_.keys(sessionStorage).filter(_.includes('customPageEditVisible-'))`。
 * 真实浏览器里 sessionStorage 的键会被当作可枚举属性暴露（WebIDL 具名属性），
 * lodash 的 `_.keys` 走 `Object.keys` 路径就能拿到。
 * 只写 `length`/`key`/`getItem` 的普通对象**枚举不到键**，会把这条清理分支测成"什么都没发生"。
 * 因此这里在替身上把存储键**同时映射为可枚举属性**，与真实行为对齐。
 */
const sessionStorageStub: Record<string, any> = {
  get length() {
    return Object.keys(sessionStore).length;
  },
  key: (i: number) => Object.keys(sessionStore)[i] ?? null,
  getItem: (k: string) => sessionStore[k] ?? null,
  setItem: (k: string, v: string) => {
    sessionStore[k] = String(v);
    // 镜像成可枚举属性，供 `_.keys` 枚举
    Object.defineProperty(sessionStorageStub, k, {
      value: String(v),
      writable: true,
      configurable: true,
      enumerable: true,
    });
  },
  removeItem: (k: string) => {
    delete sessionStore[k];
    delete sessionStorageStub[k];
  },
};
(globalThis as Record<string, unknown>)['sessionStorage'] = sessionStorageStub;
const fakeChat = {
  classList: {
    add: (c: string) => classList.push(`+${c}`),
    remove: (c: string) => classList.push(`-${c}`),
  },
};
(globalThis as Record<string, unknown>)['document'] = {
  querySelector: (sel: string) => (sel === '#chat' ? fakeChat : null),
};

function makeLoader(variant: 'orig' | 'current') {
  const cache = new Map<string, Record<string, any>>();
  const load = (rel: string): Record<string, any> => {
    if (cache.has(rel)) {
      const hit = cache.get(rel) as any;
      return hit.exports ? (hit.exports as Record<string, any>) : hit;
    }
    const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
    // 【必须在执行前把 moduleLike.exports 放进缓存】循环引用时先拿到同一个对象；
    // 但**不能**缓存 `moduleLike.exports` 的当前值（那是个会被整体替换的空对象快照），
    // 否则取回的是未填充的 exports。这里缓存 moduleLike 本身、按需返回其 .exports。
    cache.set(rel, moduleLike as unknown as Record<string, any>);
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
      if (r === 'immutability-helper') return realUpdate;
      if (r === 'lodash') return realLodash;
      if (r === 'lodash/maxBy') return realMaxBy;
      if (r === 'uuid') return makeUuidStub();
      if (r === '../util') return loadUtil(variant);
      if (r === 'src/redux/types') return {};
      if (r.startsWith('./')) return load(`${r.slice(2)}.ts`);
      if (r.endsWith('.less') || r.endsWith('.html')) return {};
      throw new Error(`spec 没给 ${r} 打桩（${variant}/${rel}）`);
    };
    new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, req);
    return moduleLike.exports as Record<string, any>;
  };
  return load;
}

/* ────────────────────────── 断言脚手架 ────────────────────────── */

let summarized = false;
let checks = 0;
let failed = 0;
/** 绝对断言里复用当前实现的 loader */
let currentLoader: ((rel: string) => Record<string, any>) | undefined;
function check(name: string, fn: () => void): void {
  checks += 1;
  try {
    fn();
    realConsole.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    realConsole.error(`  ✗ ${name}`);
    realConsole.error(`      ${error instanceof Error ? error.stack || error.message : String(error)}`);
  }
}

function firstDiff(a: unknown, b: unknown, at = '$'): string {
  if (Object.is(a, b)) return '';
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
  return `${at}: ${String(a)} vs ${String(b)}`;
}

/* ────────────────────────── 场景 ────────────────────────── */

/** 一个典型的 widget 夹具（覆盖 web/mobile 槽、layout、value、config） */
function widget(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    uuid: 'u1',
    type: 1,
    value: 'v1',
    config: { objectId: 'o1' },
    web: { title: 'T1', titleVisible: false, visible: true, layout: { x: 0, y: 0, w: 24, h: 12, minW: 2, minH: 4 } },
    mobile: { title: 'T1', titleVisible: false, visible: true, layout: { x: 0, y: 0, w: 4, h: 6, minW: 1, minH: 2 } },
    ...overrides,
  };
}

/** reducer 既接受 (undefined, action) 也接受 (state, action) */
type ReducerFn = (state: unknown, action: unknown) => any;

interface Scenario {
  name: string;
  run: (R: ReducerFn, A: Record<string, any>) => unknown;
}

const SCENARIOS: Scenario[] = [
  {
    name: '初始状态：14 个字段的默认值',
    run: (R, A) => R(undefined, { type: '@@INIT' }),
  },
  {
    name: 'UPDATE_PAGE_INFO：部分更新（pageName）',
    run: (R, A) => {
      const s0 = R(undefined, { type: '@@INIT' });
      return R(s0, A.updatePageInfo({ pageName: '新名字' }));
    },
  },
  {
    name: 'UPDATE_PAGE_INFO：注入 activeContainerInfo / urlParams / config（不在 initialState 的 3 个字段）',
    run: (R, A) => {
      const s0 = R(undefined, { type: '@@INIT' });
      return R(
        s0,
        A.updatePageInfo({
          activeContainerInfo: { sectionId: 'sec1', tabId: 'tab1' },
          urlParams: ['a', 'b'],
          config: { theme: 'dark' },
        }),
      );
    },
  },
  {
    name: 'UPDATE_LOADING / UPDATE_SAVE_LOADING / UPDATE_MODIFIED',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateLoading(false));
      s = R(s, A.updateSaveLoading(true));
      s = R(s, A.updateModified(true));
      return { loading: s.loading, saveLoading: s.saveLoading, modified: s.modified };
    },
  },
  {
    name: 'UPDATE_EDIT_PAGE_VISIBLE：写 sessionStorage + chat class + visible',
    run: (R, A) => {
      const s0 = R(undefined, { type: '@@INIT' });
      const withPage = R(s0, A.updatePageInfo({ pageId: 'p1' }));
      return R(withPage, A.updateEditPageVisible(true));
    },
  },
  {
    name: 'UPDATE_COMPONENTS：整体替换',
    run: (R, A) => {
      const s0 = R(undefined, { type: '@@INIT' });
      return R(s0, A.updateComponents([widget()]));
    },
  },
  {
    name: 'ADD_WIDGET：普通组件（web 走 getDefaultLayout）',
    run: (R, A) => {
      const s0 = R(undefined, { type: '@@INIT' });
      return R(s0, A.addWidget({ type: 1, config: {}, value: 'v9' }));
    },
  },
  {
    name: 'ADD_WIDGET：filter 组件（同时更新 loadFilterComponentCount 与 filterComponents）',
    run: (R, A) => {
      const s0 = R(undefined, { type: '@@INIT' });
      return R(
        s0,
        A.addWidget({
          type: 'filter',
          config: {},
          value: 'f1',
          filter: { advancedSetting: { a: 1 }, filters: [{ objectControls: ['c1', 'c2'] }] },
        }),
      );
    },
  },
  {
    name: 'ADD_WIDGET：带 tabId（layout 只参考同 tab 组件）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget({ tabId: 't1' }), widget({ id: 'w2', uuid: 'u2', tabId: 't2' })]));
      return R(s, A.addWidget({ type: 1, config: {}, tabId: 't1' }));
    },
  },
  {
    name: 'COPY_WIDGET：普通组件（web layout 自适应 + 新 uuid）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      return R(s, A.copyWidget({ ...widget(), id: undefined, uuid: undefined, type: 1 }));
    },
  },
  {
    name: 'COPY_WIDGET：button 组件（buttonList 重置 id/filterId、config.isFilter 被清掉）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      return R(
        s,
        A.copyWidget({
          type: 4,
          web: { layout: { x: 0, y: 0, w: 24, h: 12 } },
          button: { buttonList: [{ id: 'b1', btnId: 'bb1', filterId: 'ff1', config: { isFilter: true } }] },
        }),
      );
    },
  },
  {
    name: 'UPDATE_WIDGET_VISIBLE：web 槽 toggle',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      return R(s, A.updateWidgetVisible({ widget: widget(), layoutType: 'web' }));
    },
  },
  {
    name: 'UPDATE_WIDGET_VISIBLE：mobile 槽 toggle（原值 true → false）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      return R(s, A.updateWidgetVisible({ widget: widget(), layoutType: 'mobile' }));
    },
  },
  {
    name: 'UPDATE_WIDGET：带 layoutType（只改该端槽位）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      return R(s, A.updateWidget({ widget: widget(), layoutType: 'mobile', title: '改标题' }));
    },
  },
  {
    name: 'UPDATE_WIDGET：不带 layoutType（改组件本身）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      return R(s, A.updateWidget({ widget: widget(), value: 'v2' }));
    },
  },
  {
    name: 'UPDATE_LAYOUT：web 布局部分更新（40 高度上限 + adjustScreen）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget(), widget({ id: 'w2', uuid: 'u2' })]));
      return R(
        s,
        A.updateLayout({
          layoutType: 'web',
          layouts: [
            { x: 0, y: 0, w: 24, h: 50, minW: 2, minH: 4 },
            { x: 24, y: 0, w: 24, h: 12, minW: 2, minH: 4 },
          ],
          components: [widget(), widget({ id: 'w2', uuid: 'u2' })],
          adjustScreen: true,
        }),
      );
    },
  },
  {
    name: 'UPDATE_LAYOUT：layouts 缺省时原样返回',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      const after = R(s, A.updateLayout({ layoutType: 'web' }));
      return { sameRef: after === s, value: after };
    },
  },
  {
    name: 'UPDATE_LAYOUT：不支持的 layoutType 原样返回',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      const after = R(s, A.updateLayout({ layoutType: 'tablet', layouts: [], components: [] }));
      return { sameRef: after === s };
    },
  },
  {
    name: 'INSET_TITLE：显示标题（h+1）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      return R(s, A.insertTitle({ widget: widget(), layoutType: 'web', visible: true }));
    },
  },
  {
    name: 'INSET_TITLE：隐藏标题（h-1）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget()]));
      return R(s, A.insertTitle({ widget: widget(), layoutType: 'mobile', visible: false }));
    },
  },
  {
    name: 'DEL_WIDGET：普通组件',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget(), widget({ id: 'w2', uuid: 'u2' })]));
      return R(s, A.delWidget({ id: 'w1', uuid: 'u1', type: 1 }));
    },
  },
  {
    name: 'DEL_WIDGET：filter 组件（loadFilterComponentCount-1 且 filterComponents 被过滤）',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget({ type: 'filter', value: 'f1' }), widget({ id: 'w2', uuid: 'u2' })]));
      s = R(
        s,
        A.updatePageInfo({
          loadFilterComponentCount: 1,
          filterComponents: [{ value: 'f1', advancedSetting: {}, filters: [] }],
        }),
      );
      return R(s, A.delWidget({ type: 'filter', value: 'f1' }));
    },
  },
  {
    name: 'DEL_TABS_WIDGET：按 config.objectId 与 sectionId 一起删除',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(
        s,
        A.updateComponents([
          widget({ id: 'w1', uuid: 'u1', config: { objectId: 'o1' } }),
          widget({ id: 'w2', uuid: 'u2', sectionId: 'o1' }),
          widget({ id: 'w3', uuid: 'u3' }),
        ]),
      );
      return R(s, A.delTabsWidget({ config: { objectId: 'o1' } }));
    },
  },
  {
    name: 'DEL_WIDGET_TAB：按 tabId 删除',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateComponents([widget({ tabId: 't1' }), widget({ id: 'w2', uuid: 'u2', tabId: 't2' })]));
      return R(s, A.delWidgetTab({ tabId: 't1' }));
    },
  },
  {
    name: 'UPDATE_FILTERS_GROUP / UPDATE_LINKAGE_FILTERS_GROUP',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateFiltersGroup({ value: 'v1', filters: [1, 2] }));
      s = R(s, A.updateLinkageFiltersGroup({ value: 'v2', filters: [3] }));
      return { filtersGroup: s.filtersGroup, linkageFiltersGroup: s.linkageFiltersGroup };
    },
  },
  {
    name: 'DELETE_LINKAGE_FILTERS_GROUP：删除指定键',
    run: (R, A) => {
      let s = R(undefined, { type: '@@INIT' });
      s = R(s, A.updateLinkageFiltersGroup({ value: 'v1', filters: [1] }));
      s = R(s, A.updateLinkageFiltersGroup({ value: 'v2', filters: [2] }));
      return R(s, A.deleteLinkageFiltersGroup({ value: 'v1' }));
    },
  },
  {
    name: '未知 action：原样返回同一引用',
    run: (R, A) => {
      const s0 = R(undefined, { type: '@@INIT' });
      const same = R(s0, { type: 'UNRELATED' });
      return { sameRef: same === s0 };
    },
  },
];

function outcome(run: () => unknown): unknown {
  try {
    return { value: run() };
  } catch (error) {
    return { error: error instanceof Error ? error.name : String(error) };
  }
}

SCENARIOS.push(
  {
    name: 'UPDATE_PAGE_INFO preserves own __proto__ metadata',
    run: (R, A) => R(R(undefined, { type: '@@INIT' }), A.updatePageInfo(JSON.parse('{"__proto__":{"metadata":true}}'))),
  },
  {
    name: 'COPY_WIDGET preserves incomplete layout arithmetic',
    run: (R, A) => {
      const item = widget({ web: { layout: { x: 0, y: 0, h: 3 } } });
      const state = R(R(undefined, { type: '@@INIT' }), A.updateComponents([item]));
      return outcome(() => R(state, A.copyWidget(item)));
    },
  },
  {
    name: 'COPY_WIDGET preserves missing layout failure',
    run: (R, A) => outcome(() => R(R(undefined, { type: '@@INIT' }), A.copyWidget({ web: {} }))),
  },
  {
    name: 'COPY_WIDGET preserves a row whose y is omitted',
    run: (R, A) => {
      const item = widget({ web: { layout: { x: 0, w: 2 } } });
      const state = R(R(undefined, { type: '@@INIT' }), A.updateComponents([item]));
      return outcome(() => R(state, A.copyWidget(item)));
    },
  },
  {
    name: 'INSET_TITLE preserves missing height arithmetic',
    run: (R, A) => {
      const item = widget({ web: { layout: { x: 0 } } });
      const state = R(R(undefined, { type: '@@INIT' }), A.updateComponents([item]));
      return R(state, A.insertTitle({ widget: item, layoutType: 'web', visible: true }));
    },
  },
  {
    name: 'INSET_TITLE preserves a no-op state reference with null layout',
    run: (R, A) => {
      const item = widget({ web: { titleVisible: false, layout: null } });
      const state = R(R(undefined, { type: '@@INIT' }), A.updateComponents([item]));
      state.modified = true;
      const next = R(state, A.insertTitle({ widget: item, layoutType: 'web', visible: false }));
      return { sameState: state === next, sameComponents: state.components === next.components };
    },
  },
  {
    name: 'UPDATE_WIDGET preserves the supplied layout key',
    run: (R, A) => {
      const item = widget({ tablet: { title: 'before' } });
      const state = R(R(undefined, { type: '@@INIT' }), A.updateComponents([item]));
      return R(state, A.updateWidget({ widget: item, layoutType: 'tablet', title: 'after' }));
    },
  },
  {
    name: 'UPDATE_WIDGET preserves the library behavior for a missing target',
    run: (R, A) => {
      const state = R(R(undefined, { type: '@@INIT' }), A.updateComponents([widget()]));
      return outcome(() => R(state, A.updateWidget({ widget: { id: 'absent', uuid: 'absent' }, value: 'new' })));
    },
  },
  {
    name: 'UPDATE_WIDGET_VISIBLE preserves missing slot failure',
    run: (R, A) => {
      const item = widget({ web: undefined });
      const state = R(R(undefined, { type: '@@INIT' }), A.updateComponents([item]));
      return outcome(() => R(state, A.updateWidgetVisible({ widget: item, layoutType: 'web' })));
    },
  },
  {
    name: 'ADD_WIDGET does not silently replace missing filter data',
    run: (R, A) => outcome(() => R(R(undefined, { type: '@@INIT' }), A.addWidget({ type: 'filter' }))),
  },
);

/* ────────────────────────── 执行 ────────────────────────── */

function main(): void {
  assertBaselineIntact();
  realConsole.log(`  ✓ A 侧基线 ${BASE_REV} 的 reducers/action/actionType sha256 已实际断言`);

  const loadOrig = makeLoader('orig');
  const loadCurrent = makeLoader('current');
  // 供下面的绝对断言复用（每次调用会新建 loader 缓存，保证 uuid 计数器独立）
  currentLoader = loadCurrent;

  for (const scenario of SCENARIOS) {
    check(scenario.name, () => {
      // 【uuid 必须两侧各重置一次】A 侧跑完会消耗 uuid-1..n，若不重置，
      // B 侧会接着编号（uuid-n+1…），A/B 必然不一致 —— 这是夹具问题，不是行为差异。
      uuidSeq = 0;
      const OrigReducer = loadOrig('reducers.ts').default;
      const OrigActions = loadOrig('action.ts');
      const origValue = scenario.run(OrigReducer, OrigActions);

      uuidSeq = 0;
      const CurrentReducer = loadCurrent('reducers.ts').default;
      const CurrentActions = loadCurrent('action.ts');
      const currentValue = scenario.run(CurrentReducer, CurrentActions);

      assert.deepEqual(currentValue, origValue, `A/B 不一致 → ${firstDiff(origValue, currentValue)}`);
    });
  }

  /* ── 绝对断言：固定真实语义，防止两侧一起错 ── */

  check('initialState 的 14 个默认值', () => {
    const R = currentLoader!('reducers.ts').default;
    // R 是 reducer 函数本身
    const s = R(undefined, { type: '@@INIT' });
    assert.deepEqual(
      {
        loading: s.loading,
        modified: s.modified,
        pageName: s.pageName,
        visible: s.visible,
        pageId: s.pageId,
        desc: s.desc,
        adjustScreen: s.adjustScreen,
        version: s.version,
        apk: s.apk,
        components: s.components,
        filtersGroup: s.filtersGroup,
        linkageFiltersGroup: s.linkageFiltersGroup,
        filterComponents: s.filterComponents,
        loadFilterComponentCount: s.loadFilterComponentCount,
      },
      {
        loading: true,
        modified: false,
        pageName: '',
        visible: false,
        pageId: '',
        desc: '',
        adjustScreen: false,
        version: null,
        apk: {},
        components: [],
        filtersGroup: {},
        linkageFiltersGroup: {},
        filterComponents: [],
        loadFilterComponentCount: 0,
      },
    );
  });

  check('UPDATE_LAYOUT 的 40 高度上限（adjustScreen 时 h 被压到 40）', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');
    let s = R(undefined, { type: '@@INIT' });
    s = R(s, A.updateComponents([widget()]));
    s = R(
      s,
      A.updateLayout({
        layoutType: 'web',
        layouts: [{ x: 0, y: 0, w: 24, h: 50, minW: 2, minH: 4 }],
        components: [widget()],
        adjustScreen: true,
      }),
    );
    assert.equal(s.components[0].web.layout.h, 40, 'adjustScreen 时高度必须被压到 40');
  });

  /**
   * 【历史契约记录 —— 按 lead 决定，类型批次不改这里】
   * `updateLayout` 在 `adjustScreen && data.h >= 40` 时写的是 `data.h = maxH`，
   * 而 `data` 是 `layouts[index]` 的**引用**，因此会**就地改写调用方传入的 payload**。
   *
   * lead 的决定：类型批次先与历史 A/B 保持一致、把这个副作用如实记录，
   * 在没有"调用方依赖/不依赖被改写"的证据前，不顺手改成克隆（改克隆会改变行为）。
   */
  check('历史契约：updateLayout 会把传入 layouts 的 h 就地 clamp 到 40（副作用已记录）', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');

    const w = widget();
    let s = R(undefined, { type: '@@INIT' });
    s = R(s, A.updateComponents([w]));

    // 构造调用方自己的 layouts 数组；派发后检查它是否被就地改写
    const callerLayouts = [{ x: 0, y: 0, w: 24, h: 50, minW: 2, minH: 4 }];
    const callerHBefore = callerLayouts[0].h;

    const next = R(
      s,
      A.updateLayout({
        layoutType: 'web',
        layouts: callerLayouts as never,
        components: [w],
        adjustScreen: true,
      }),
    );

    // 1) reducer 产出的新组件里 h 被压到 40
    assert.equal(next.components[0].web.layout.h, 40);
    // 2) 调用方传入的数组对象也被就地改写了（这正是被记录的副作用）
    assert.equal(callerHBefore, 50, '夹具前提：调用方原始 h 应为 50');
    assert.equal(callerLayouts[0].h, 40, '历史契约：调用方的 layouts 会被就地 clamp（副作用；本次类型批次不修）');
  });

  check('UPDATE_LAYOUT：layouts 少于 components 时按原实现抛 TypeError（不静默跳过）', () => {
    // 【原行为】`adjustScreen` 为真且缺 `layouts[index]` 时，原实现读 `data.h` 会抛
    // `TypeError: Cannot read properties of undefined (reading 'h')`。
    // lead 明确要求保留该失败路径，不能静默 `return item` —— 我最早写的"原样保留"是错的。
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');
    const w1 = widget({ id: 'w1', uuid: 'u1' });
    const w2 = widget({ id: 'w2', uuid: 'u2' });
    let s = R(undefined, { type: '@@INIT' });
    s = R(s, A.updateComponents([w1, w2]));

    assert.throws(
      () =>
        R(
          s,
          A.updateLayout({
            layoutType: 'web',
            layouts: [{ x: 0, y: 0, w: 24, h: 12, minW: 2, minH: 4 }],
            components: [w1, w2],
            adjustScreen: true,
          }),
        ),
      /Cannot read properties of undefined/,
      '缺 layouts[index] 且 adjustScreen 时应抛 TypeError（原实现行为）',
    );
  });

  check('UPDATE_LAYOUT：data.h 缺省时不参与 40 clamp（不会算出 NaN）', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');
    const w = widget();
    let s = R(undefined, { type: '@@INIT' });
    s = R(s, A.updateComponents([w]));
    const next = R(
      s,
      A.updateLayout({
        layoutType: 'web',
        layouts: [{ x: 0, y: 0, w: 24, minW: 2, minH: 4 }],
        components: [w],
        adjustScreen: true,
      }),
    );
    // h 缺省 → 不触发 clamp，布局里 h 仍为 undefined（而不是 NaN 或被写成 40）
    assert.equal(next.components[0].web.layout.h, undefined);
  });

  check('ADD_WIDGET：带 sectionId 时只用同 section 的组件算默认布局', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');
    let s = R(undefined, { type: '@@INIT' });
    s = R(
      s,
      A.updateComponents([
        widget({ id: 'a1', uuid: 'a1', sectionId: 'sec1' }),
        widget({ id: 'a2', uuid: 'a2', sectionId: 'sec1' }),
        widget({ id: 'b1', uuid: 'b1', sectionId: 'sec2' }),
      ]),
    );
    uuidSeq = 0;
    const next = R(s, A.addWidget({ type: 1, config: {}, sectionId: 'sec1' }));
    const added = next.components[next.components.length - 1];
    // 同 section 有 2 个 → web 布局 x = (2*24)%48 = 0
    assert.equal(added.web.layout.x, 0);
    assert.equal(added.web.layout.y, Infinity);
  });

  check('UPDATE_EDIT_PAGE_VISIBLE：state.pageId 为空时清 sessionStorage 中同前缀键（不写新键）', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');
    // 预置一个同前缀键
    (globalThis as any).sessionStorage.setItem('customPageEditVisible-p0', 'true');
    (globalThis as any).sessionStorage.setItem('unrelated-key', 'x');
    const s0 = R(undefined, { type: '@@INIT' }); // pageId 初始为 ''
    const next = R(s0, A.updateEditPageVisible(true));
    assert.equal(next.visible, true);
    // pageId 为空 → 应清理同前缀键，但不碰无关键
    assert.equal((globalThis as any).sessionStorage.getItem('customPageEditVisible-p0'), null);
    assert.equal((globalThis as any).sessionStorage.getItem('unrelated-key'), 'x');
  });

  /**
   * 【lead 的真实反例，用于锁死几何比较不能被 Number() 化】
   * 组件 `web.layout = {x:0, w:2}`（**省略 y**），复制自身。
   * 历史行为：`getMaxXComponentInSingleLine(layouts, undefined)` 靠 `v.y === undefined`
   * 匹配到该行 → 成功，结果 `x = 2`。
   * 若把 y 先 `Number()` 成 NaN，则 `v.y === NaN` **永不成立** → 分组为空 →
   * `maxBy` 返回 undefined → 解构抛 TypeError。此用例正是抓这个回归的。
   */
  check('COPY_WIDGET：省略 y 的行仍能匹配（几何比较不得 Number 化 y）', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');

    const item = widget({ web: { layout: { x: 0, w: 2 } } });
    let s = R(undefined, { type: '@@INIT' });
    s = R(s, A.updateComponents([item]));

    uuidSeq = 0;
    const next = R(s, A.copyWidget(item));
    const copied = next.components[next.components.length - 1];

    assert.deepEqual(
      copied.web.layout,
      { x: 2, w: 2 },
      '省略 y 时仍应匹配到该行，并把副本放在同行末尾（x=2）',
    );
  });

  check('COPY_WIDGET 的 Infinity 位置（当前行放不下且末行即当前行 → y=Infinity）', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');
    let s = R(undefined, { type: '@@INIT' });
    // 占满第一行：两个 w=48 的组件（48+48+w > 12 必成立）
    s = R(
      s,
      A.updateComponents([
        widget({ id: 'a', uuid: 'a', web: { layout: { x: 0, y: 0, w: 48, h: 10 } } }),
        widget({ id: 'b', uuid: 'b', web: { layout: { x: 48, y: 0, w: 48, h: 10 } } }),
      ]),
    );
    uuidSeq = 0;
    s = R(
      s,
      A.copyWidget({ ...widget({ id: undefined, uuid: undefined }), web: { layout: { x: 0, y: 0, w: 48, h: 10 } } }),
    );
    const copied = s.components[s.components.length - 1];
    assert.equal(copied.web.layout.y, Infinity, '复制到放不下的行时应使用 Infinity 排到末尾');
    assert.equal(copied.web.layout.x, 0);
  });

  check('ADD_WIDGET 的 uuid 由 uuidv4 生成且 web/mobile 槽初始化一致', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');
    uuidSeq = 0;
    const s = R(R(undefined, { type: '@@INIT' }), A.addWidget({ type: 1, config: {} }));
    const added = s.components[0];
    assert.equal(added.uuid, 'uuid-1');
    assert.equal(added.web.title, '');
    assert.equal(added.web.titleVisible, false);
    assert.equal(added.web.visible, true);
    assert.equal(added.mobile.layout, null);
  });

  check('UPDATE_WIDGET_VISIBLE 是 toggle 语义（两次调用回到原值）', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');
    let s = R(undefined, { type: '@@INIT' });
    s = R(s, A.updateComponents([widget()]));
    s = R(s, A.updateWidgetVisible({ widget: widget(), layoutType: 'web' }));
    const afterOnce = s.components[0].web.visible;
    s = R(s, A.updateWidgetVisible({ widget: widget(), layoutType: 'web' }));
    const afterTwice = s.components[0].web.visible;
    assert.equal(afterOnce, false);
    assert.equal(afterTwice, true);
  });

  /**
   * `DELETE_LINKAGE_FILTERS_GROUP` 的不可变性契约。
   *
   * 【历史】修复前该 case 直接 `delete state.linkageFiltersGroup[value]`，会就地修改旧 state
   * （Redux 不可变更新缺陷）。类型批次曾把它作为"历史契约"固定下来（提交 `150b65996`），
   * 随后由**独立的 fix 提交**改为不可变删除（`{ [value]: _removed, ...rest }`）。
   *
   * 现在这条断言锁定**修复后**的契约：旧 state 完整保留、新 state 移除该键。
   * 真实 RTK 不可变中间件下的失败/通过对照见 `reduceIndependence.spec.ts`。
   */
  check('不可变契约：DELETE_LINKAGE_FILTERS_GROUP 不修改旧 state，新 state 移除该键', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');

    let s = R(undefined, { type: '@@INIT' });
    s = R(s, A.updateLinkageFiltersGroup({ value: 'keep', filters: [1] }));
    s = R(s, A.updateLinkageFiltersGroup({ value: 'gone', filters: [2] }));

    const oldGroupRef = s.linkageFiltersGroup;
    const next = R(s, A.deleteLinkageFiltersGroup({ value: 'gone' }));

    // 旧 state 上的键必须还在（不再被就地删除）
    assert.equal(
      Object.prototype.hasOwnProperty.call(oldGroupRef, 'gone'),
      true,
      '旧 state 的 linkageFiltersGroup 不应被就地修改',
    );
    assert.deepEqual(Object.keys(oldGroupRef).sort(), ['gone', 'keep'], '旧对象应保持两个键');
    // 新 state 移除该键、保留其它键
    assert.deepEqual(Object.keys(next.linkageFiltersGroup).sort(), ['keep']);
    // 返回新对象
    assert.notEqual(next, s);
  });

  check('引用契约：未改动的组件保持原引用（A/B 已对齐的 map 重建语义）', () => {
    const load = makeLoader('current');
    const R = load('reducers.ts').default;
    const A = load('action.ts');

    const w1 = widget({ id: 'w1', uuid: 'u1' });
    const w2 = widget({ id: 'w2', uuid: 'u2' });
    let s = R(undefined, { type: '@@INIT' });
    s = R(s, A.updateComponents([w1, w2]));

    // UPDATE_WIDGET_VISIBLE 只应替换命中的那个组件，另一个保持原引用
    const next = R(s, A.updateWidgetVisible({ widget: w1, layoutType: 'web' }));
    assert.notEqual(next.components[0], s.components[0], '被修改的组件应产生新对象');
    assert.equal(next.components[1], s.components[1], '未命中的组件必须保持原引用');
    assert.notEqual(next, s, 'state 本身应产生新对象');
  });

  check('未知 action 必须原样返回同一引用', () => {
    const R = currentLoader!('reducers.ts').default;
    // R 是 reducer 函数本身
    const s0 = R(undefined, { type: '@@INIT' });
    assert.equal(R(s0, { type: 'NOPE' }), s0);
  });

  summarized = true;
  if (failed) {
    realConsole.error(`customPage/redux 行为规格失败 ${failed}/${checks} 项`);
    process.exitCode = 1;
    return;
  }
  realConsole.log(
    `customPage/redux 行为规格通过：${checks} 项（${SCENARIOS.length} 个历史 A/B 场景 + ${checks - SCENARIOS.length} 条绝对断言）`,
  );
}

/* ── 防假绿：异步异常与非零退出 ── */

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

main();
