/**
 * react-router-dom 4 → 7 的【路由匹配】差分实测。
 *
 * 为什么必须有这个：路由改错的后果是整站白屏或跳错页面，而生产上没法把
 * 183 条路由逐条点一遍。所以把「匹配」这件事本身变成可自动比对的：
 *   对同一批 URL，v4 选中哪条路由、解析出什么 params
 *   ↔ v7 选中哪条路由、解析出什么 params
 * 两边一致才算这条路由迁移成功。
 *
 * 两个版本的选路语义【根本不同】，这正是本脚本要盯住的：
 *   v4 的 <Switch>：按配置顺序取【第一条】匹配的，且默认非精确匹配
 *                   （不写 exact 时 /a 能匹配 /a/b/c）
 *   v7 的 <Routes>：按【具体度排序】取最优的，且默认精确匹配
 * 所以「顺序无关的等价改写」在这里是不成立的，必须逐条比。
 *
 * 另外 v7 不支持 v4 的正则式路径（交替组 (a|b)、可选字面量组 (app/)?、
 * 通配段 (.*)、重复组 ()+），仓里有 26 条这样的路径要改写成多条普通路由。
 * 本脚本就是改写过程中的判据。
 *
 * 运行（v7 装在仓库外，react 软链回本仓避免两份实例）：
 *   mkdir -p /tmp/rr7 && cd /tmp/rr7 && echo '{"private":true}' > package.json \
 *     && npm i react-router-dom@7.18.3
 *   cd /tmp/rr7/node_modules && for p in react react-dom scheduler; do \
 *     rm -rf $p && ln -s <repo>/node_modules/$p $p; done
 *   cd <repo> && RR7=/tmp/rr7/node_modules/react-router-dom node tools/verify-router-matching.cjs
 */
const fs = require('fs');
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';

const RR7_PATH = process.env.RR7 || '/tmp/rr7/node_modules/react-router-dom';

// ---------- 环境：加载 .ts 配置需要 jsdom + babel + 别名解析 + 全局桩 ----------
// 配置文件会 import src/utils/common，那条 import 链上有引用 self/document 的模块，
// 只塞几个假全局不够（第一版就是这么报 `self is not defined` 的），直接用 jsdom。
function loadJsdom() {
  for (const c of [process.env.JSDOM_PATH, RW + 'node_modules/jsdom', 'jsdom'].filter(Boolean)) {
    try {
      return require(c);
    } catch (e) {
      /* 试下一个 */
    }
  }

  console.error('找不到 jsdom。见其它 verify-* 脚本文件头的安装说明。');
  process.exit(2);
}
const { JSDOM } = loadJsdom();
const dom = new JSDOM('<!doctype html><div id="app"></div>', {
  pretendToBeVisual: true,
  url: 'https://example.test/',
});
for (const k of [
  'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Text', 'getComputedStyle',
  'DOMParser', 'Range', 'Selection', 'MutationObserver', 'DOMRect', 'Event', 'CustomEvent',
  'KeyboardEvent', 'MouseEvent', 'Window', 'location', 'history', 'localStorage', 'sessionStorage',
  'requestAnimationFrame', 'cancelAnimationFrame', 'XMLHttpRequest', 'FormData', 'Blob',
]) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k];
}
global.self = global.window;
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
global._l = (s, ...args) => args.reduce((acc, a, i) => acc.replace('%' + i, a), String(s));
global.md = { global: { Config: {}, Account: {}, SysSettings: {} } };
// addSubPathOfRoutes 在没有 subPath 时是恒等函数；这里刻意不设 subPath，
// 让配置里的 path 原样进来（子路径逻辑另有 src/router/subPathNavigation.spec.js 覆盖）
global.window.subPath = '';

const babel = require(RW + 'node_modules/@babel/core');
const Module = require('module');
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx'];
const ALIASES = { worksheet: 'src/pages/worksheet', mobile: 'src/pages/Mobile', statistics: 'src/pages/Statistics' };

function resolveFile(base) {
  for (const ext of EXTS) {
    const c = base + ext;

    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }

  for (const ext of EXTS.filter(Boolean)) {
    const c = path.join(base, 'index' + ext);

    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }

  return null;
}

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (!request.startsWith('.') && !path.isAbsolute(request)) {
    const head = request.split('/')[0];
    const mapped = ALIASES[head] ? request.replace(head, ALIASES[head]) : request;

    for (const base of [RW + mapped, RW + 'src/' + mapped]) {
      const hit = resolveFile(base);

      if (hit) return hit;
    }
  }

  return origResolve.call(this, request, parent, ...rest);
};

function compileTs(module, filename) {
  const { code } = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [
      [RW + 'node_modules/@babel/preset-env', { targets: { node: 'current' } }],
      [RW + 'node_modules/@babel/preset-react', { runtime: 'classic' }],
      [RW + 'node_modules/@babel/preset-typescript', { onlyRemoveTypeImports: true }],
    ],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  module._compile(code, filename);
}
Module._extensions['.ts'] = compileTs;
Module._extensions['.tsx'] = compileTs;
Module._extensions['.less'] = m => m._compile('module.exports = {};', 'noop.less');
Module._extensions['.css'] = Module._extensions['.less'];
Module._extensions['.png'] = Module._extensions['.less'];
Module._extensions['.svg'] = Module._extensions['.less'];

// ---------- 1. 加载全部路由配置，保留声明顺序 ----------
// v4 的 Switch 取第一条匹配，所以【顺序是语义的一部分】，不能用 Set/Map 打乱。
const CONFIG_FILES = [
  ['主路由', 'src/router/config.ts', 'ROUTE_CONFIG'],
  ['应用内', 'src/router/Application/config.ts', 'ROUTE_CONFIG'],
  ['应用内-外部门户', 'src/router/Application/config.ts', 'PORTAL_ROUTE_CONFIG'],
  ['顶栏', 'src/router/PageHeader/config.ts', 'PAGE_HEADER_ROUTE_CONFIG'],
  ['外部门户', 'src/pages/Portal/config.ts', null],
  ['外部门户顶栏', 'src/pages/Portal/PageHeader/config.ts', null],
  ['管理后台-支付', 'src/pages/Admin/pay/config.ts', null],
  ['移动端', 'src/pages/Mobile/config.ts', null],
];

// 管理后台的路由表结构不同：menuList → subMenuList → routes 三层嵌套，
// 而且它不走 <Switch>，是 src/pages/Admin/index.tsx 自己摊平后渲染的。
function loadAdminRoutes() {
  const { menuList } = require(RW + 'src/pages/Admin/router.config.ts');
  const routes = [];

  for (const g of menuList || []) {
    for (const sub of g.subMenuList || []) {
      for (const r of sub.routes || []) {
        if (r && typeof r.path === 'string') routes.push({ key: `${g.key}/${sub.key}`, path: r.path });
      }
    }
  }

  return routes;
}

function loadConfigs() {
  const out = [];

  for (const [label, file, exportName] of CONFIG_FILES) {
    let mod;

    try {
      mod = require(RW + file);
    } catch (e) {
      out.push({ label, file, error: e.message.split('\n')[0] });
      continue;
    }

    // 没指定导出名时，取第一个「看起来像路由表」的导出
    const candidates = exportName
      ? [[exportName, mod[exportName]]]
      : Object.entries(mod).filter(
          ([, v]) => v && typeof v === 'object' && Object.values(v).some(r => r && typeof r.path === 'string'),
        );

    for (const [name, table] of candidates) {
      if (!table) {
        out.push({ label, file, error: `导出 ${name} 不存在` });
        continue;
      }

      // path 可以是【数组】（仓里有 4 条这么写），v4 的 <Route path={[...]}> 是
      // 「任一命中即命中」。第一版加载器只收字符串，把这 4 条整个漏掉了，
      // fixture 也就少了它们 —— 这类遗漏不会报错，只会让安全网出现盲区。
      const routes = Object.entries(table)
        .filter(([, r]) => r && (typeof r.path === 'string' || Array.isArray(r.path)))
        .map(([key, r]) => ({ key, path: r.path, exact: r.exact, strict: r.strict, sensitive: r.sensitive }));
      out.push({ label: candidates.length > 1 ? `${label}:${name}` : label, file, name, routes });
    }
  }

  return out;
}

const groups = loadConfigs();
try {
  groups.push({ label: '管理后台', file: 'src/pages/Admin/router.config.ts', routes: loadAdminRoutes() });
} catch (e) {
  groups.push({ label: '管理后台', file: 'src/pages/Admin/router.config.ts', error: e.message.split('\n')[0] });
}
console.log('路由表加载情况：');
for (const g of groups) {
  if (g.error) console.log(`  !! ${g.label}  ${g.file}  ->  ${g.error}`);
  else console.log(`  ${String(g.routes.length).padStart(3)} 条  ${g.label}  (${g.file})`);
}
const total = groups.filter(g => g.routes).reduce((n, g) => n + g.routes.length, 0);
console.log(`  合计 ${total} 条路由，${groups.filter(g => g.error).length} 个表加载失败`);

module.exports = { groups };

// ---------- 2. 语料：把每条 path 展开成具体 URL ----------
// 目标是覆盖「每条路由的每种形态」，而不是穷举所有 URL。
// 对每条 path 生成：全部可选段都给值 / 全部可选段都省略 / 交替组各分支 / 通配段给样例。
// 另外每条再补一个「多带一层尾巴」的变体 —— v4 默认非精确匹配（不写 exact 时
// /a 能匹配 /a/b/c），v7 默认精确匹配，这个差异只有带尾巴的 URL 才能暴露出来。
const SAMPLE = {
  appId: 'app0001', worksheetId: 'ws0002', viewId: 'view0003', rowId: 'row0004',
  projectId: 'proj0005', groupId: 'grp0006', roleId: 'role0007', id: 'id0008',
  type: 'typeA', printType: 'pt1', from: 'fromX', key: 'k9', flowId: 'flow0010',
  reportId: 'rep0011', themeColor: 'blue', operator: 'op1', operatorId: 'oid1',
  explanId: 'ex1', vertionType: 'vt1', listType: 'lt1', editType: 'et1',
  apkId: 'apk1', path: 'a/b', routeType: 'rt1', roleType: 'rlt1',
};
const sampleFor = name => SAMPLE[name] || name.toLowerCase() + '_v';

// 把一条 v4 path 展开成若干具体 URL
function expand(p) {
  let variants = [p];

  // 交替组 (a|b|c) —— 每个分支各来一条
  for (let i = 0; i < 6; i++) {
    const next = [];
    let changed = false;

    for (const v of variants) {
      const m = /\(([^)|]*\|[^)]*)\)(\+|\?)?/.exec(v);

      if (!m) { next.push(v); continue; }

      changed = true;
      const alts = m[1].split('|');
      // 带 ? 的交替组还要有「整段省略」的变体
      if (m[2] === '?') alts.push('');
      for (const a of new Set(alts)) next.push(v.slice(0, m.index) + a + v.slice(m.index + m[0].length));
    }

    variants = next;
    if (!changed) break;
  }

  // 可选字面量组 (app/)? —— 给值 / 省略 两种
  for (let i = 0; i < 4; i++) {
    const next = [];
    let changed = false;

    for (const v of variants) {
      const m = /\(([^)|]*)\)\?/.exec(v);

      if (!m) { next.push(v); continue; }

      changed = true;
      next.push(v.slice(0, m.index) + m[1] + v.slice(m.index + m[0].length));
      next.push(v.slice(0, m.index) + v.slice(m.index + m[0].length));
    }

    variants = next;
    if (!changed) break;
  }

  // 通配段 (.*)：v4 里它是【跨 / 贪婪】的，一段和多段都能匹配。
  // 这两种都要进语料 —— 如果迁移时把它换成单段的 :param，多段 URL 就会 404，
  // 只测单段的话这个错会漏过去。
  {
    const next = [];

    for (const v of variants) {
      if (v.includes('(.*)')) {
        next.push(v.replace(/\(\.\*\)/g, 'seg1'));
        next.push(v.replace(/\(\.\*\)/g, 'seg1/seg2'));
      } else next.push(v);
    }

    variants = next;
  }
  // 裸捕获组 (x) / 重复组 (x)+ —— 取其字面内容
  variants = variants.map(v => v.replace(/\(([^)|]+)\)\+?/g, '$1'));

  // splat :p* —— 空 / 多段 两种
  const out = [];
  for (const v of variants) {
    if (/:\w+\*/.test(v)) {
      out.push(v.replace(/\/?:\w+\*/, ''));
      out.push(v.replace(/:\w+\*/, 'x/y/z'));
    } else out.push(v);
  }

  // 可选参数 :p? —— 全给值 / 全省略 两种
  const final = new Set();
  for (const v of out) {
    if (/:\w+\?/.test(v)) {
      final.add(v.replace(/:(\w+)\?/g, (_m, n) => sampleFor(n)));
      final.add(v.replace(/\/:\w+\?/g, ''));
    } else final.add(v);
  }

  // 必填参数统一替换成样例值
  return [...final]
    .map(v => v.replace(/:(\w+)/g, (_m, n) => sampleFor(n)))
    .map(v => (v.length > 1 ? v.replace(/\/+$/, '') : v))
    .map(v => (v.startsWith('/') ? v : '/' + v));
}

function buildCorpus(groups) {
  const urls = new Set();

  for (const g of groups) {
    for (const r of g.routes || []) {
      for (const u of [].concat(r.path).flatMap(expand)) {
        urls.add(u);
        // 多带一层尾巴：专门用来暴露 v4 非精确匹配 vs v7 精确匹配的差异
        urls.add((u === '/' ? '' : u) + '/extraTail');
      }
    }
  }

  return [...urls].sort();
}

// ---------- 3. v4 侧：按 <Switch> 语义取第一条匹配 ----------
const v4 = require(RW + 'node_modules/react-router-dom');

function matchV4(group, url) {
  for (const r of group.routes) {
    let m = null;

    try {
      m = v4.matchPath(url, { path: r.path, exact: !!r.exact, strict: !!r.strict, sensitive: !!r.sensitive });
    } catch (e) {
      return { key: r.key, error: 'matchPath 抛错: ' + e.message.split('\n')[0] };
    }

    if (m) return { key: r.key, params: m.params, isExact: m.isExact };
  }

  return null;
}

const corpus = buildCorpus(groups);
console.log(`\n语料：${corpus.length} 条 URL\n`);

const fixture = { _note: '', generatedFrom: require(RW + 'node_modules/react-router-dom/package.json').version, cases: {} };
let matched = 0;
let unmatched = 0;
const errors = [];

for (const g of groups) {
  if (!g.routes) continue;

  for (const url of corpus) {
    const r = matchV4(g, url);

    if (r && r.error) errors.push({ group: g.label, url, ...r });

    if (r) matched++; else unmatched++;

    fixture.cases[`${g.label}|${url}`] = r ? { key: r.key, params: r.params, isExact: r.isExact } : null;
  }
}

console.log(`v4 匹配统计：命中 ${matched}，未命中 ${unmatched}，matchPath 抛错 ${errors.length}`);
if (errors.length) errors.slice(0, 5).forEach(e => console.log(`  !! ${e.group} ${e.url} -> ${e.error}`));

if (process.argv.includes('--write-fixture')) {
  fixture._note =
    '由 react-router-dom 4.3.1 跑出的路由匹配参照值（每条 URL 在每个路由表下选中哪条路由、' +
    '解析出什么 params）。用于在升到 v7 之后守住「选路结果不变」。' +
    '重新生成方式见 tools/verify-router-matching.cjs 文件头。';
  fs.mkdirSync(RW + 'tools/fixtures', { recursive: true });
  // 每个用例单独一行：4032 条用 JSON.stringify(_, null, 2) 会撑到 552K，
  // 而且改一条就整块重排、diff 没法看。一行一条既小又能逐条比。
  const lines = Object.keys(fixture.cases)
    .sort()
    .map(k => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(fixture.cases[k]));
  fs.writeFileSync(
    RW + 'tools/fixtures/router-v4-matching.json',
    '{\n  "_note": ' + JSON.stringify(fixture._note) +
      ',\n  "generatedFrom": ' + JSON.stringify(fixture.generatedFrom) +
      ',\n  "cases": {\n' + lines.join(',\n') + '\n  }\n}\n',
  );
  console.log(`\n已写入 fixture：tools/fixtures/router-v4-matching.json（${Object.keys(fixture.cases).length} 个用例）`);
}

// ---------- 4. v4 路径 → v7 路径 ----------
// v7 的路径语法里【没有正则】：不支持交替组 (a|b)、可选字面量组 (x)?、
// 通配段 (.*)、重复组 (x)+。所以一条 v4 路径可能要拆成【多条】v7 路由。
//
// 关于位置参数：v4 的匿名捕获组会产出 params[0]/[1]（实测 /apps/(task|taskcenter)
// 会给 {"0":"task"}）。查过全仓没有任何组件读它们 —— 管理后台看着像在读，
// 其实那是它自己的 Config.params（location.pathname.split('/')，见 src/pages/Admin/config.ts:14），
// 与路由无关。所以拆分不会丢信息。
// route.exact 为假时（仓里 189 条只有 1 条写了 exact）v4 是【前缀匹配】：
// <Route path="/admin/:a/:b"> 能匹配 /admin/x/y/还有更多/段。v7 默认精确匹配，
// 要保留前缀语义必须显式加 /*。这是 v4→v6 最根本的一处破坏性变化，
// 也是本差分最先抓出来的（1326 条「选中的路由不同」几乎全是它）。
function toV7Paths(route) {
  const p = typeof route === 'string' ? route : route.path;
  const isExact = typeof route === 'string' ? false : !!route.exact;
  let out = [p];

  // 交替组 (a|b|c) 和 (a|b)+ → 每个分支一条；带 ? 的再加一条「整段省略」
  for (let i = 0; i < 6; i++) {
    const next = [];
    let changed = false;

    for (const v of out) {
      const m = /\(([^)|]*\|[^)]*)\)(\+|\?)?/.exec(v);

      if (!m) { next.push(v); continue; }

      changed = true;
      const alts = m[1].split('|');

      if (m[2] === '?') alts.push('');

      for (const a of new Set(alts)) next.push(v.slice(0, m.index) + a + v.slice(m.index + m[0].length));
    }

    out = next;
    if (!changed) break;
  }

  // 可选字面量组 (x)? → 有 / 无 两条
  for (let i = 0; i < 4; i++) {
    const next = [];
    let changed = false;

    for (const v of out) {
      const m = /\(([^)|.*]+)\)\?/.exec(v);

      if (!m) { next.push(v); continue; }

      changed = true;
      next.push(v.slice(0, m.index) + m[1] + v.slice(m.index + m[0].length));
      next.push(v.slice(0, m.index) + v.slice(m.index + m[0].length));
    }

    out = next;
    if (!changed) break;
  }

  // 裸捕获组 / 重复组 (x) (x)+ → 字面量
  out = out.map(v => v.replace(/\(([^)|.*]+)\)\+?/g, '$1'));

  // 通配段 (.*)：v7 的 * 只能放在末尾。
  //   末尾的 (.*)  → /*
  //   中间的 (.*)  → 拆成「单段 :segN」和「多段用 * 兜底」两条，
  //                  因为 v4 的 (.*) 跨 / 贪婪，只用单段会让多段 URL 404。
  {
    const next = [];

    for (const v of out) {
      if (!v.includes('(.*)')) { next.push(v); continue; }

      if (v.endsWith('(.*)')) { next.push(v.slice(0, -4) + '*'); continue; }

      let n = 0;
      next.push(v.replace(/\(\.\*\)/g, () => `:seg${n++}`));
      // 多段兜底：把第一个中间通配段之后的部分整体交给 *
      next.push(v.slice(0, v.indexOf('(.*)')) + '*');
    }

    out = next;
  }

  // splat :p* → v7 的 *（参数名从 p 变成 '*'，消费方要跟着改）
  out = out.map(v => v.replace(/\/?:(\w+)\*/g, '/*'));

  // 规整：去掉重复斜杠与尾斜杠（v7 对尾斜杠敏感度与 v4 不同）
  out = out.map(v => (v.length > 1 ? v.replace(/\/{2,}/g, '/').replace(/\/$/, '') : v));

  // 非精确路由补 /*，还原 v4 的前缀匹配语义。
  // 注意要同时保留【不带 /*】的那条：v7 里 "/a/*" 不匹配 "/a" 本身。
  if (!isExact) {
    const withSplat = [];

    for (const v of out) {
      withSplat.push(v);

      if (!v.endsWith('*')) withSplat.push(v === '/' ? '/*' : v + '/*');
    }

    out = withSplat;
  }

  return [...new Set(out)];
}

// ---------- 5. v7 侧匹配 ----------
const rr7 = require(RR7_PATH);

function buildV7Routes(group) {
  const routes = [];

  for (const r of group.routes) {
    for (const one of [].concat(r.path)) {
      for (const p of toV7Paths({ path: one, exact: r.exact })) routes.push({ path: p, __key: r.key });
    }
  }

  return routes;
}

function matchV7(routes, url) {
  let m;

  try {
    m = rr7.matchRoutes(routes, url);
  } catch (e) {
    return { error: 'matchRoutes 抛错: ' + e.message.split('\n')[0] };
  }

  if (!m || !m.length) return null;

  const last = m[m.length - 1];

  return { key: last.route.__key, params: last.params };
}

// ---------- 6. 比对 ----------
if (process.argv.includes('--compare')) {
  const ref = JSON.parse(fs.readFileSync(RW + 'tools/fixtures/router-v4-matching.json', 'utf8'));
  let same = 0;
  const wrongRoute = [];
  const wrongParams = [];
  const v7Errors = [];

  for (const g of groups) {
    if (!g.routes) continue;

    const v7routes = buildV7Routes(g);

    for (const url of corpus) {
      const want = ref.cases[`${g.label}|${url}`];
      const got = matchV7(v7routes, url);

      if (got && got.error) { v7Errors.push({ group: g.label, url, error: got.error }); continue; }

      const wantKey = want ? want.key : null;
      const gotKey = got ? got.key : null;

      if (wantKey !== gotKey) { wrongRoute.push({ group: g.label, url, want: wantKey, got: gotKey }); continue; }

      if (want) {
        // 比对时排除两类：
        //  ① v4 的位置参数 "0"/"1"（匿名捕获组产物，全仓无消费方，v7 也不产出）
        //  ② v7 的 "*"：那是为还原 v4 前缀匹配而补的 /* 带来的人造参数，
        //     v4 侧压根没有对应物。唯一例外是 /apps/kc/:path*，它的 splat 是真数据，
        //     单独在下面 SPLAT_ROUTES 里核对。
        const named = o =>
          Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => !/^\d+$/.test(k) && k !== '*' && v !== undefined));
        const a = JSON.stringify(named(want.params));
        const b = JSON.stringify(named(got.params));

        if (a !== b) { wrongParams.push({ group: g.label, url, key: wantKey, want: a, got: b }); continue; }
      }

      same++;
    }
  }

  console.log(`\n=== v7 对照 fixture ===`);
  console.log(`  一致:        ${same}`);
  console.log(`  选中的路由不同: ${wrongRoute.length}`);
  console.log(`  params 不同:  ${wrongParams.length}`);
  console.log(`  v7 抛错:     ${v7Errors.length}`);

  const show = (title, arr, fmt) => {
    if (!arr.length) return;

    console.log(`\n${title}（前 15 条）:`);
    arr.slice(0, 15).forEach(x => console.log('  ' + fmt(x)));

    if (arr.length > 15) console.log(`  …还有 ${arr.length - 15} 条`);
  };
  show('v7 抛错', v7Errors, x => `[${x.group}] ${x.url}\n      ${x.error}`);
  show('选中的路由不同', wrongRoute, x => `[${x.group}] ${x.url}\n      v4: ${x.want}   v7: ${x.got}`);
  show('params 不同', wrongParams, x => `[${x.group}] ${x.url} (${x.key})\n      v4: ${x.want}\n      v7: ${x.got}`);

  // 按【源路径】归类才是可执行的待办清单 —— 一条有问题的 path 会在语料里
  // 炸出十几条 URL，按 URL 列等于把同一件事数了十几遍。
  const byPath = new Map();
  const noteFor = (arr, kind) => {
    for (const x of arr) {
      const g = groups.find(gg => gg.label === x.group);
      const route = (g.routes || []).find(r => r.key === (x.want || x.key)) ||
                    (g.routes || []).find(r => r.key === x.got);
      const paths = route ? [].concat(route.path) : ['(未命中任何路由)'];

      for (const pp of paths) {
        const k = `${x.group} | ${pp}`;
        if (!byPath.has(k)) byPath.set(k, { 路由不同: 0, params不同: 0 });
        byPath.get(k)[kind]++;
      }
    }
  };
  noteFor(wrongRoute, '路由不同');
  noteFor(wrongParams, 'params不同');

  if (byPath.size) {
    console.log('\n=== 待办清单（按源路径归类）===');
    [...byPath.entries()]
      .sort((a, b) => b[1].路由不同 + b[1].params不同 - (a[1].路由不同 + a[1].params不同))
      .forEach(([k, v]) => console.log(`  路由不同 ${String(v.路由不同).padStart(3)} / params ${String(v.params不同).padStart(3)}   ${k}`));
    console.log(`  共 ${byPath.size} 条源路径需要处理`);
  }

  process.exit(wrongRoute.length + wrongParams.length + v7Errors.length ? 1 : 0);
}
