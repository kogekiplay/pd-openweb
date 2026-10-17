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
const { transformFileSync, transformSync, ROOT } = require('../../../../scripts/spec-harness.ts');

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

/**
 * `../util` 的**最小替身**（只含 reducer 真正用到的 3 个导出）。
 *
 * 【为什么不能直接加载真实 util.ts】它是范围外文件，依赖链很深
 * （`src/...` webpack alias、styled-components、antd colors、moment 等），
 * 在 spec 的 `new Function` 沙箱里无法解析 —— 这不是本批要验证的东西。
 *
 * 【为什么这个替身不算"假实现"】这三段是**从真实文件逐字复制**的：
 * `enumWidgetType`（util.ts:34-47）、`getIndexById`（util.ts:91-94）、
 * `getDefaultLayout`（util.ts:96-136）。它们与真实实现同源同义，
 * 且 **A/B 两侧共用同一份替身**，因此对比的仍是 reducer 自身的行为差异。
 */
function makeUtilStub(_realUtil?: unknown) {
  const enumWidgetType = {
    analysis: 1,
    richText: 2,
    embedUrl: 3,
    button: 4,
    view: 5,
    filter: 6,
    carousel: 7,
    ai: 8,
    tabs: 9,
    card: 10,
    image: 11,
    subsection: 12,
  };

  const getIndexById = ({ component, components }: any) => {
    const id = component.id || component.uuid;
    return realLodash.findIndex(components, (item: any) => item.id === id || item.uuid === id);
  };

  const getDefaultLayout = ({
    components = [],
    index = components.length,
    layoutType = 'web',
    titleVisible,
    type,
  }: any) => {
    if (layoutType === 'web') {
      if (['view', 'tabs'].includes(type)) {
        return { x: (components.length * 24) % 48, y: Infinity, w: 48, h: 10, minW: 2, minH: 6 };
      } else if (type === 'filter') {
        return { x: (components.length * 24) % 48, y: Infinity, w: 48, h: 4, minW: 2, minH: 3 };
      } else if (type === 'image') {
        return { x: (components.length * 24) % 48, y: Infinity, w: 48, h: 10, minW: 2, minH: 4 };
      } else if (type === 'subsection') {
        return { x: (components.length * 24) % 48, y: Infinity, w: 48, h: 3, minW: 48, minH: 2 };
      }
      return { x: (components.length * 24) % 48, y: Infinity, w: 24, h: 12, minW: 2, minH: 4 };
    }

    if (layoutType === 'mobile') {
      const pickedType = realLodash.pick(components[index], 'type');
      const last = realMaxBy(components, (item: any) => realLodash.get(item, ['mobile', 'layout', 'y'])) || {};
      const y = (last as any).y ?? 0;
      const h = (last as any).h ?? 6;
      const typeName = Object.keys(enumWidgetType).find(
        key => (enumWidgetType as any)[key] === (pickedType as any).type,
      );
      const isButton = typeName === 'button';
      const minW = isButton ? 2 : 1;

      if (['view', 'tabs'].includes(typeName as string)) {
        return { x: 0, y: y + h, w: 4, h: titleVisible ? 9 : 8, minW, minH: 4 };
      } else if (typeName === 'filter') {
        return { x: 0, y: y + h, w: 4, h: 2, minW, minH: 1 };
      } else if (typeName === 'image') {
        return { x: 0, y: y + h, w: 4, h: titleVisible ? 9 : 8, minW, minH: 2 };
      } else if (typeName === 'subsection') {
        return { x: 0, y: y + h, w: 4, h: 1, minW: 4, minH: 1 };
      }
      return { x: 0, y: y + h, w: 4, h: titleVisible ? 7 : 6, minW, minH: 2 };
    }

    return undefined;
  };

  return { enumWidgetType, getIndexById, getDefaultLayout };
}

const realLodash = require('lodash');
const realMaxBy = require('lodash/maxBy');
const realUpdate = require('immutability-helper').default || require('immutability-helper');


/** 文档 / sessionStorage 替身（UPDATE_EDIT_PAGE_VISIBLE 会碰它们） */
const sessionStore: Record<string, string> = {};
const classList: string[] = [];
(globalThis as Record<string, unknown>)['sessionStorage'] = {
  get length() {
    return Object.keys(sessionStore).length;
  },
  key: (i: number) => Object.keys(sessionStore)[i],
  getItem: (k: string) => sessionStore[k] ?? null,
  setItem: (k: string, v: string) => {
    sessionStore[k] = String(v);
  },
  removeItem: (k: string) => {
    delete sessionStore[k];
  },
};
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
      if (r === '../util') {
        // 【不要 require 真实 util.ts】它依赖 `src/...` alias、styled-components、
        // antd colors、moment 等，在 `new Function` 沙箱里会一路 require 到 PNG 资源并崩。
        // 用上面那份**逐字复制**的三函数替身；A/B 两侧共用，对比的仍是 reducer 自身。
        return makeUtilStub();
      }
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
      s = R(
        s,
        A.updateComponents([widget({ type: 'filter', value: 'f1' }), widget({ id: 'w2', uuid: 'u2' })]),
      );
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

      assert.equal(
        JSON.stringify(currentValue),
        JSON.stringify(origValue),
        `A/B 不一致 → ${firstDiff(origValue, currentValue)}`,
      );
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
    s = R(s, A.copyWidget({ ...widget({ id: undefined, uuid: undefined }), web: { layout: { x: 0, y: 0, w: 48, h: 10 } } }));
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
    `customPage/redux 行为规格通过：${checks} 项（${SCENARIOS.length} 个历史 A/B 场景 + 6 条绝对断言）`,
  );
}

/* ── 防假绿：异步异常与非零退出 ── */

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

main();
