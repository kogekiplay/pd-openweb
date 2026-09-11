/**
 * antd 升级的【第二类】样式失效：类名没变，但 antd 开始自己接管某个属性。
 *
 * tools/verify-antd-class-names.cjs 比的是「类名还在不在」。它抓不到这种情况 ——
 * 类名一模一样，变的是「样式挂在哪个元素上 / 哪些属性由 antd 自己设」。
 * 线上被这个咬过一次：后台「成员与部门」的部门树整条变成实心蓝、文字看不见。
 * 根因是 antd 4 把目录树选中态的高亮画在 .ant-tree-treenode-selected::before 上
 *（本仓正是覆盖它，改成 11% 透明蓝 + 主题色文字），
 * antd 5 改成直接画在节点元素本身 background:#1677ff，
 * 于是实心蓝底压着主题色蓝字 = 一条空白蓝条。类名差分完全看不见。
 *
 * 本判据的信号：
 *   OURS = 本仓为某个 .ant-* 类（含其伪元素）声明的属性
 *   NEW  = antd 新版为该类【新增】声明的属性（旧版没有）
 *   交集 = antd 开始自己管这个属性了，很可能盖过或绕过我们的覆盖
 * 再对交集算双方特异性，静态判出谁赢；并列的才需要人工去浏览器实测。
 *
 * 刻意排除逻辑属性改名（left → inset-inline-start 这类）与字体微调：
 * 不排的话 292 条里有 197 条「有变化」，全是噪声、没法用。
 *
 * ────────── 这个判据踩过的坑，都会造出假配对或判反胜负，别再踩回去 ──────────
 *
 * 1) 伪元素不能折叠进本体。antd 5 把 .ant-tree-treenode::before 改成了拖拽落点
 *    指示条（height:4px），折叠后看起来就是「antd5 接管了节点本体的 height」，
 *    而本体的 height 根本没人动。伪元素和本体是两个绘制目标。
 *
 * 2) 只能取【主语】（最后一个复合选择器）。之前对本仓取选择器里所有 ant- 类，
 *    `.ant-tree .ant-tree-switcher{height}` 会把 height 也记到 ant-tree 名下。
 *
 * 3) 取值相同不算碰撞。.ant-select-clear{border-radius} 两版都是 50%，谁赢都一样。
 *
 * 4) 【最隐蔽的一个】继承属性（font-size / line-height / color 等）在 v4 可能
 *    声明在祖先上、v5 下移到元素本身，渲染值完全没变，按类比对却像是「新接管」。
 *    实例：.ant-select-selector 的 font-size:14px —— antd4 声明在 .ant-select 根上
 *    继承下来，antd5 直接写在 .ant-select-single .ant-select-selector 上。
 *    但这类【仍然值得看】，因为真正的风险不是取值，而是特异性：
 *    继承值会输给任何直接声明，所以 v4 时代一条 (0,1,0) 的规则就能压住；
 *    v5 元素上有了 (0,2,0) 的直接声明后，同样的规则就悄悄输了。
 *
 * 5) 本仓的 LESS 必须真的展开嵌套再算特异性。只取最内层那一行得到的是残缺选择器，
 *    祖先链只会让特异性变高，不展开就系统性低估我方。我拿残缺选择器判过两次胜负，
 *    两次都跟浏览器实测相反（.ant-tree-switcher{height}、.ant-tree-treenode{border-radius}）。
 *
 * 6) antd5 的 :where() 贡献【零特异性】。cssinjs 把版本 hash 类
 *    .css-dev-only-do-not-override-xxx 全塞在 :where() 里；当成普通类计，
 *    等于白送 antd5 一分，一堆本该我方赢的会判成 antd5 赢。
 *
 * 7) 单冒号伪元素是坑 1 的后门。antd5 的产物写的是 `.ant-tree-switcher:before`，
 *    只认 `::` 的话它会被折叠到本体上，凭空造出
 *   「antd5 接管了 .ant-tree-switcher 的 height / border-radius」两条假碰撞
 *    —— 而那两条实测都是我方生效。所以 subjectKeys 先把 :before 规范成 ::before。
 *
 * 8) antd5 那侧【不能只看最强的规则】。最强的往往挂着 .ant-select-sm、
 *    .ant-picker-multiple 这类修饰类，组件不传 size / mode 就根本不存在；
 *    更有 .ant-select-single 与 .ant-select-multiple 这种互斥类，永远撞不上。
 *    所以分成「基准档」（特异性最低、必然存在）和「条件档」两档输出：
 *    只有输给基准档才是确定回归，输给条件档要去核对组件 props。
 *
 * ────────── 一条实测结论：特异性并列时【我方赢】 ──────────
 * antd 5 的 cssinjs 经 rc-util 以 prependQueue 注入，标签带
 * data-rc-order="prependQueue" data-rc-priority="-999"，永远插在 <head> 最前。
 * 本地实测：7 个 cssinjs 标签全在 head 索引 0–6，本仓 307 个样式标签在 7–313；
 * cssinjs 标签是 React 渲染时才建的、比本仓的晚，却排在前面 —— 只有 prepend 能解释。
 * 这是 antd 5 的刻意设计（业务样式不靠 !important 也能覆盖）。
 *
 * 输入：
 *   antd 旧版的 dist/antd.css（4.x 有静态样式表）
 *   antd 新版【运行时注入】的 CSS —— v5 起没有静态样式表了，要先渲染一遍导出，
 *   导出脚本见 verify-antd-class-names.cjs 的渲染部分。
 *
 * 运行：node tools/verify-antd-style-collisions.cjs
 */
const fs = require('fs');
const path = require('path');

const RW = '/Users/kogeki/dev/pd-openweb-dnd/';
const V4_CSS = '/tmp/antd424/node_modules/antd/dist/antd.css';
const V5_CSS = '/tmp/antd5-runtime.css';
const LOGICAL =
  /^(inset|margin-(inline|block)|padding-(inline|block)|border-(start|end)|font-family|font-feature-settings|font-variant)/;

for (const f of [V4_CSS, V5_CSS]) {
  if (!fs.existsSync(f)) {
    console.error(`缺少输入：${f}\n（v4 见 /tmp/antd424，v5 需先渲染导出运行时 CSS）`);
    process.exit(1);
  }
}

// ───────────────────────── 特异性 ─────────────────────────

// 按 token 逐类剥离后计数，而不是一堆互相打架的正则并列匹配。
// 顺序要紧：先剥 :where()（零分），再剥伪元素，最后剩下的单词才是元素名。
function spec(sel) {
  let s = ` ${sel} `;

  // :where(...) 整块零特异性 —— 这是 antd5 藏版本 hash 类的地方
  s = stripFunctional(s, ':where', () => '');
  // :not()/:is() 括号本身不计分，内部照常计分
  s = stripFunctional(s, ':not', inner => ` ${inner} `);
  s = stripFunctional(s, ':is', inner => ` ${inner} `);

  let el = 0;
  let cls = 0;
  let ids = 0;

  // 伪元素（含 :before 这种单冒号老写法）计入元素档
  s = s.replace(/::[a-zA-Z-]+/g, () => (el++, ' '));
  s = s.replace(/:(before|after|first-line|first-letter)\b/g, () => (el++, ' '));
  // 属性选择器、伪类、类 → 类档
  s = s.replace(/\[[^\]]*\]/g, () => (cls++, ' '));
  s = s.replace(/:[a-zA-Z-]+(\([^)]*\))?/g, () => (cls++, ' '));
  s = s.replace(/#[\w-]+/g, () => (ids++, ' '));
  s = s.replace(/\.[\w-]+/g, () => (cls++, ' '));
  // 剩下的裸单词就是元素名（* 不计分）
  for (const _ of s.match(/[a-zA-Z][\w-]*/g) || []) el++;

  return [ids, cls, el];
}

// 剥掉 `name(...)`，括号可嵌套；replacer 决定内部内容是否留下继续计分
function stripFunctional(s, name, replacer) {
  let out = '';
  let i = 0;

  while (i < s.length) {
    const at = s.indexOf(`${name}(`, i);

    if (at < 0) return out + s.slice(i);

    out += s.slice(i, at);

    let depth = 0;
    let j = at + name.length;

    for (; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')' && --depth === 0) break;
    }

    out += replacer(s.slice(at + name.length + 1, j));
    i = j + 1;
  }

  return out;
}

const cmpSpec = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const fmtSpec = a => `(${a.join(',')})`;

// 顶层逗号切分：:where(.a,.b) / :not(.a,.b) 里的逗号不能切
function splitTop(sel) {
  const out = [];
  let depth = 0;
  let buf = '';

  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;

    if (ch === ',' && depth === 0) {
      out.push(buf);
      buf = '';
    } else buf += ch;
  }

  out.push(buf);

  return out.map(s => s.trim()).filter(Boolean);
}

// ───────────────────────── 键：主语复合选择器 ─────────────────────────

// 键必须取「主语复合选择器」，且伪元素要留着（坑 1、坑 2）。
function subjectKeys(sel) {
  const normalized = sel.replace(/(^|[^:]):(before|after|first-line|first-letter)\b/g, '$1::$2');
  const last = normalized.trim().replace(/[>+~]/g, ' ').split(/\s+/).filter(Boolean).pop() || '';
  const cls = (last.match(/\.(ant-[a-zA-Z0-9_-]+)/g) || []).map(s => s.slice(1));

  if (!cls.length) return [];

  const pseudo = (last.match(/::[a-zA-Z-]+/) || [''])[0];

  return cls.map(c => c + pseudo);
}

// key -> prop -> [{sel, val, spec, src}]
function record(map, key, prop, val, sel, src) {
  if (!map.has(key)) map.set(key, new Map());

  const m = map.get(key);

  if (!m.has(prop)) m.set(prop, []);

  m.get(prop).push({ sel, val, spec: spec(sel), src });
}

function index(css, src) {
  const m = new Map();

  for (const r of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const decls = r[2]
      .split(';')
      .map(d => {
        const i = d.indexOf(':');
        return i < 0 ? null : [d.slice(0, i).trim(), d.slice(i + 1).trim()];
      })
      .filter(Boolean);

    for (const one of splitTop(r[1])) {
      for (const key of subjectKeys(one)) for (const [p, v] of decls) record(m, key, p, v, one, src);
    }
  }

  return m;
}

const i4 = index(fs.readFileSync(V4_CSS, 'utf8'), 'antd4');
const i5 = index(fs.readFileSync(V5_CSS, 'utf8'), 'antd5');

// ───────────────────────── 本仓：展开 LESS 嵌套 ─────────────────────────

const walk = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const a = path.join(d, e.name);

    if (e.isDirectory()) {
      if (!/\/(node_modules|library)$/.test(a)) walk(a, o);
    } else if (/\.(less|css)$/.test(e.name)) o.push(a);
  }

  return o;
};

// 展开嵌套，产出 {sel, prop, val}，sel 是【完整的】选择器（坑 5）。
function resolveLess(src) {
  const out = [];
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const stack = [['']]; // 选择器列表栈，根是空串
  let buf = '';
  let quote = '';
  let depth = 0; // 括号深度：url(a;b)、calc(x: y) 里的分号冒号不能当分隔符

  const flushDecl = text => {
    const i = text.indexOf(':');

    if (i < 0) return; // mixin 调用、@import 之类，没有冒号

    const prop = text.slice(0, i).trim();

    if (!prop || /[@.&{}]/.test(prop[0])) return;
    // 【带 !important 的不算碰撞】antd 自己的声明一律不带 !important，
    // 我们带了就一定压得过它，不需要人工确认。不排的话列表里一半是噪声。
    if (/!important/.test(text)) return;

    for (const sel of stack[stack.length - 1]) if (sel) out.push({ sel, prop, val: text.slice(i + 1).trim() });
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (quote) {
      buf += ch;
      if (ch === quote) quote = '';
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }

    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);

    if (depth > 0 || (ch !== '{' && ch !== '}' && ch !== ';')) {
      buf += ch;
      continue;
    }

    if (ch === '{') {
      // @{var} 是插值，不是块 —— 整段吞掉，否则它的 } 会错误地弹栈
      if (buf.endsWith('@')) {
        const end = clean.indexOf('}', i);
        buf += clean.slice(i, end + 1);
        i = end;
        continue;
      }

      const raw = buf.trim();
      buf = '';

      const parents = stack[stack.length - 1];

      // @media / @supports 不改变特异性，原样继承父选择器。
      // 参数化 mixin 的【定义】（.chartSelect() { … }）也当作透明层：它不是选择器，
      // 里面的声明实际生效在每个调用点上，而调用点的祖先链这里解析不了。
      // 当透明层处理会低估我方特异性 —— 但这是安全方向（宁可多报不可漏报），
      // 若按选择器计反而会凭空给我方加一分、把该报的漏掉。
      if (raw.startsWith('@') || /^[.#][\w-]+\s*\(/.test(raw)) {
        stack.push(parents);
        continue;
      }

      const resolved = [];

      for (const p of parents)
        for (const part of splitTop(raw))
          resolved.push(part.includes('&') ? part.replace(/&/g, p).trim() : (p ? `${p} ` : '') + part);

      stack.push(resolved);
    } else if (ch === '}') {
      flushDecl(buf);
      buf = '';
      stack.pop();
      if (!stack.length) stack.push(['']); // 花括号不配对时兜底，别崩
    } else {
      flushDecl(buf);
      buf = '';
    }
  }

  return out;
}

const ours = new Map();

for (const f of walk(`${RW}src`)) {
  const rel = path.relative(RW, f);

  for (const { sel, prop, val } of resolveLess(fs.readFileSync(f, 'utf8'))) {
    if (!/\.ant-[a-z0-9-]/.test(sel)) continue;

    for (const key of subjectKeys(sel)) record(ours, key, prop, val, sel, rel);
  }
}

// ───────────────────────── 比对 ─────────────────────────

// 【比较方向必须是「我方每一条」对 antd5，不能我方也取最强】
// 我方取最强是【不安全】方向，会漏报：同一个类上我们往往有十几条覆盖，
// 只要其中一条写得够长（比如登录页那条 5 层的 .ant-select-selector），
// 就会把同属性上另外几条只有 (0,2,0) 的覆盖全遮住，而后者才是真会被压掉的。
//
// antd5 那侧则分成两档，因为「最强的那条」未必作用在同一个元素上（坑 8）：
//   基准档 = 特异性最低的那条，只用主语本身和必然存在的祖先类（如 .ant-select-single），
//            组件一渲染就在 → 输给它是【确定的回归】。
//   条件档 = 更强的变体，多挂了 .ant-select-sm / .ant-picker-multiple 这类修饰类，
//            只有组件真的传了 size="small" / mode="multiple" 才存在 → 需要去看组件 props。
// 不分档就会把「只有 size=small 才撞」的情况报成确定回归，逼人逐个去读源码。
const hits = [];
let won = 0;
let tied = 0;

for (const [key, props] of ours) {
  const a = i4.get(key);
  const b = i5.get(key);

  if (!a || !b) continue;

  const collide = [];

  for (const [p, v5entries] of b) {
    if (a.has(p) || LOGICAL.test(p)) continue; // antd4 已有 → 不是新接管

    const ourEntries = props.get(p);

    if (!ourEntries) continue; // 我们没声明 → 不是碰撞

    for (const mine of ourEntries) {
      // 取值一致 → 谁赢都一样，不必人工看
      const diff = v5entries.filter(e => e.val !== mine.val);

      if (!diff.length) continue;

      // 【并列判我方赢，这是实测过的事实，不是假设】
      // antd 5 的 cssinjs 用 rc-util 的 prependQueue 注入，标签带
      // data-rc-order="prependQueue" data-rc-priority="-999"，永远插在 <head> 最前。
      // 实测：7 个 cssinjs 标签全部落在 head 索引 0–6，而本仓 307 个样式标签在 7–313 ——
      // cssinjs 标签是 React 渲染时才建的、比本仓的晚，却排在前面，只有 prepend 能解释。
      // 这是 antd 5 的刻意设计（让业务样式不靠 !important 就能覆盖）。
      const beaten = diff.filter(e => cmpSpec(e.spec, mine.spec) > 0);

      if (!beaten.length) {
        cmpSpec(top(v5entries).spec, mine.spec) === 0 ? tied++ : won++;
        continue;
      }

      const floor = beaten.reduce((x, y) => (cmpSpec(y.spec, x.spec) < 0 ? y : x));
      // 基准档：antd5 对这个属性【所有】规则里最低的那条也压过我们 → 必然生效
      const unconditional = cmpSpec(floor.spec, minSpec(v5entries)) === 0;

      collide.push({ prop: p, mine, theirs: floor, unconditional, extra: extraClasses(floor.sel, key) });
    }
  }

  if (collide.length) hits.push({ key, collide, sure: collide.some(c => c.unconditional) });
}

function top(entries) {
  return entries.reduce((a, b) => (cmpSpec(b.spec, a.spec) > 0 ? b : a));
}

function minSpec(entries) {
  return entries.reduce((a, b) => (cmpSpec(b.spec, a.spec) < 0 ? b : a)).spec;
}

// antd5 规则里除主语之外还要求哪些类 —— 就是「需要组件传了什么 props 才撞」
function extraClasses(sel, key) {
  const subject = key.replace(/::.*/, '');

  return [...new Set((sel.match(/\.(ant-[\w-]+)/g) || []).map(s => s.slice(1)))].filter(c => c !== subject);
}

hits.sort((x, y) => y.sure - x.sure || y.collide.length - x.collide.length);

const sure = hits.reduce((n, h) => n + h.collide.filter(c => c.unconditional).length, 0);
const cond = hits.reduce((n, h) => n + h.collide.filter(c => !c.unconditional).length, 0);

console.log(`  ❌ 确定回归（antd5 的无条件规则就压过我们）：${sure} 处`);
console.log(`  ⚠️  条件回归（antd5 只有带修饰类的变体更强，需核对组件 props）：${cond} 处`);
console.log(`  ✅ 我方稳赢 ${won} 处；并列 ${tied} 处（并列判我方赢，见下方注释的实测依据）\n`);

for (const h of hits) {
  console.log(`   .${h.key}`);

  for (const c of h.collide) {
    console.log(`       ${c.prop}   ${c.unconditional ? '❌ 确定被压' : `⚠️ 仅当元素同时带 ${c.extra.join(' ')}`}`);
    console.log(`         本仓  ${fmtSpec(c.mine.spec)} → ${c.mine.val}`);
    console.log(`               ${c.mine.sel}`);
    console.log(`               ${c.mine.src}`);
    console.log(`         antd5 ${fmtSpec(c.theirs.spec)} → ${c.theirs.val}`);
    console.log(`               ${c.theirs.sel}`);
  }

  console.log('');
}

// 下限断言：扫不到东西说明扫描逻辑坏了，而不是「全仓无碰撞」
const scanned = [...ours.keys()].length;

if (scanned < 50) {
  console.error(`只扫到 ${scanned} 个本仓覆盖的 antd 类，扫描逻辑大概率坏了`);
  process.exit(1);
}

console.log(`（本仓共覆盖 ${scanned} 个 antd 类/伪元素；antd4 与 antd5 均有声明的才进入比对）`);
