/**
 * styled-components 4.4.1 → 6.5.3 的【生成 CSS】差分实测。
 *
 * 为什么这么验：仓里 1536 个文件用它、2886 处 styled.<tag>，但 API 面很窄
 * （styled.<tag> / styled(Component) / keyframes / css / createGlobalStyle，
 * 没有 .attrs / .withConfig / ThemeProvider / withTheme / css prop），
 * 所以升级基本不用改消费方代码——真正的风险在【CSS 编译器换了】：
 *   styled-components 4.4.1 内部是 stylis 3.5.4
 *   styled-components 6.5.3 内部是 stylis 4.3.6
 * stylis 大版本会改嵌套解析、选择器展开、@media/@supports 处理和自动前缀。
 * 这类差异不报错、不进控制台，只是样式悄悄变了——所以必须逐字节比生成的 CSS。
 *
 * 做法：从 src 里静态抽出真实的 styled 模板字面量（只取【不含 ${} 插值】的，
 * 那些是纯 CSS，正好直接喂给 stylis），分别用两个版本 SSR 渲染、取出注入的样式，
 * 把版本间必然不同的哈希类名归一化掉之后比对。
 *
 * 运行（v6 装在仓库外，避免污染依赖树；react 用软链指回本仓，否则两份 React 实例）：
 *   mkdir -p /tmp/sc6 && cd /tmp/sc6 && echo '{"private":true}' > package.json \
 *     && npm i styled-components@6.5.3
 *   cd /tmp/sc6/node_modules && for p in react react-dom scheduler; do \
 *     rm -rf $p && ln -s <repo>/node_modules/$p $p; done
 *   cd <repo> && SC_NEW=/tmp/sc6/node_modules/styled-components node tools/verify-styled-components-css.cjs
 *
 * 升级落地后这个脚本就没有「旧版」参照物了，届时同样要把结果冻结成 fixture
 * （做法见 tools/verify-rc-trigger-parity.cjs 文件头）。
 */
const fs = require('fs');
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';

const NEW_PATH = process.env.SC_NEW || '/tmp/sc6/node_modules/styled-components';
const OLD_PATH = RW + 'node_modules/styled-components';

// ---------- 1. 从源码里抽出不含插值的 styled 模板 ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);

    if (e.isDirectory()) {
      // src/library 是 vendored 的第三方代码，不算我们的用法
      if (e.name === 'node_modules' || e.name === 'library') continue;

      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(p);
    }
  }

  return out;
}

// styled.div`...` / styled(X)`...` / css`...` / keyframes`...`
// 反引号内不允许出现 ` 与 ${，从而只留下纯 CSS 的那些
const TPL = /(?:styled\.[a-zA-Z][a-zA-Z0-9]*|styled\([^)]*\)|css|keyframes|createGlobalStyle)`([^`$]*)`/g;

function collect() {
  const bodies = new Map(); // css -> 出处
  for (const file of walk(RW + 'src')) {
    const src = fs.readFileSync(file, 'utf8');
    let m;

    while ((m = TPL.exec(src)) !== null) {
      const body = m[1];

      // 太短的（空模板、只有一条声明）信息量低，但也留着——它们能覆盖最常见的形态
      if (!body.trim()) continue;

      // 排除仍含插值残留的（正则已排除 $，这里再兜一次）
      if (body.includes('${')) continue;

      if (!bodies.has(body)) bodies.set(body, path.relative(RW, file));
    }
  }

  return [...bodies.entries()].map(([css, from]) => ({ css, from }));
}

// ---------- 2. 用某个版本渲染出 CSS ----------
function renderWith(scPath, bodies) {
  // 每个版本必须在干净的 require 缓存里加载，否则两版会共享内部状态
  for (const k of Object.keys(require.cache)) {
    if (k.includes('styled-components') || k.includes('stylis')) delete require.cache[k];
  }

  const React = require(RW + 'node_modules/react');
  const ReactDOMServer = require(RW + 'node_modules/react-dom/server');
  const sc = require(scPath);
  const styled = sc.default || sc;
  const { ServerStyleSheet } = sc;

  return bodies.map(({ css, from }) => {
    const sheet = new ServerStyleSheet();

    try {
      const C = styled.div(Object.assign([css], { raw: [css] }));
      ReactDOMServer.renderToStaticMarkup(sheet.collectStyles(React.createElement(C)));

      return { from, css, out: sheet.getStyleTags() };
    } catch (e) {
      return { from, css, out: 'THREW: ' + e.message };
    } finally {
      try {
        sheet.seal();
      } catch (e) {
        /* v4 没有 seal */
      }
    }
  });
}

// ---------- 3. 归一化：抹掉版本间必然不同的部分 ----------
function normalize(styleTags) {
  return (
    styleTags
      // <style ...> 外壳与属性（v6 多了 data-styled-version 等）
      .replace(/<\/?style[^>]*>/g, '')
      // 生成的类名/组件 id：两版哈希算法不同，必然不一样，必须抹掉。
      // 【统一抹掉所有类名 token】而不是试图只认「看起来像哈希」的：
      // 按长度/后瞻字符去猜会漏（.hVtL 只有 4 字符、.ebnmVj.CLS 里第一个后面跟的是 `.`），
      // 漏掉就会把纯哈希差异误报成真实差异。两边同样处理，不会掩盖真实回归——
      // CSS 行为的变化会体现在【声明内容】和【选择器结构】上，那些都原样保留。
      // 注意 [a-zA-Z_] 的限定：`0.08` 这种小数点后是数字，不会被误伤。
      .replace(/\.[a-zA-Z_][a-zA-Z0-9_-]*/g, '.CLS')
      .replace(/\bsc-[a-zA-Z0-9]+/g, 'SCID')
      .replace(/data-styled[^ >]*/g, '')
      // v6 会插入 /*!sc*/ 之类的定位注释
      .replace(/\/\*[^*]*\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// ---------- 4. 跑 ----------
const bodies = collect();
console.log(`从 src 抽出不含插值的 styled 模板 ${bodies.length} 条`);
console.log(`旧: ${require(OLD_PATH + '/package.json').version}  ↔  新: ${require(NEW_PATH + '/package.json').version}\n`);

const oldOut = renderWith(OLD_PATH, bodies);
const newOut = renderWith(NEW_PATH, bodies);

let same = 0;
const diffs = [];
const threw = [];

for (let i = 0; i < bodies.length; i++) {
  const a = normalize(oldOut[i].out);
  const b = normalize(newOut[i].out);

  if (oldOut[i].out.startsWith('THREW') || newOut[i].out.startsWith('THREW')) {
    threw.push({ ...bodies[i], old: oldOut[i].out.slice(0, 80), new: newOut[i].out.slice(0, 80) });
    continue;
  }

  if (a === b) same++;
  else diffs.push({ ...bodies[i], a, b });
}

console.log(`  CSS 完全一致: ${same}`);
console.log(`  CSS 有差异:   ${diffs.length}`);
console.log(`  渲染抛错:     ${threw.length}`);

if (threw.length) {
  console.log('\n抛错的（前 5 条）:');
  threw.slice(0, 5).forEach(t => {
    console.log(`  ${t.from}`);
    console.log(`    旧: ${t.old}`);
    console.log(`    新: ${t.new}`);
  });
}

// ---------- 5. 分级：把「已判定为安全」的差异逐层剥掉，剩下的才是真问题 ----------
//
// 第一层：厂商前缀。stylis 3 会打 -webkit-box / -ms-flexbox / -webkit-flex 这类
//   老式 flexbox 前缀，stylis 4 不打。本仓构建目标是 chrome 58、CSS 管线里没有
//   autoprefixer，而且产物含箭头函数/const/let —— IE11 本来就解析不了，
//   所以 -ms- 是死重；-webkit-box/-webkit-flex 针对 Safari≤8 / Chrome≤28，同样在目标之下。
// 第二层：空白与分号。`18px !important` vs `18px!important`、
//   `translate(-50%, -50%)` vs `translate(-50%,-50%)`、尾分号 —— 语义完全相同。
//
// 剥完这两层还不一样的，才需要人看。
// 两种都要剥，少一种就会把纯前缀差异误判成真实差异：
//   ① 属性名带前缀： -webkit-flex: 1
//   ② 值带前缀：     display: -webkit-box / display: -ms-flexbox
//                    （这类的属性名是标准的，只有值是老式关键字）
// 前导分隔符必须包含 `{`：规则体里【第一条】声明前面是 `{` 而不是 `;`，
// 只写 (?:^|;) 会把它漏掉（漏了就会把纯前缀差异误判成真实差异）。
// 用捕获组把分隔符原样留下，否则删掉 `{` 会破坏结构。
const PREFIXED_PROP = /([;{])\s*-(?:webkit|moz|ms|o)-[a-zA-Z-]+\s*:[^;}]*/g;
const PREFIXED_VALUE = /([;{])\s*[a-zA-Z-]+\s*:\s*-(?:webkit|moz|ms|o)-[^;}]*/g;
const stripPrefixes = s => {
  let prev;
  let cur = s;
  // 连续多条前缀声明时一次 replace 只能吃掉相间的那些（前一条的结尾被当作分隔符消费了），
  // 所以循环到不动为止。
  do {
    prev = cur;
    cur = cur.replace(PREFIXED_PROP, '$1').replace(PREFIXED_VALUE, '$1');
  } while (cur !== prev);

  return cur.replace(/;{2,}/g, ';').replace(/\{\s*;/g, '{');
};
const stripCosmetic = s =>
  s
    .replace(/\s+/g, '')
    .replace(/;(?=[}])/g, '')
    .toLowerCase();

// 第三层：带前缀的【伪元素规则】与【@keyframes 块】——它们是整条规则/整个 at-block，
// 上面按声明剥的两个正则够不着。
//   stylis 3: `::placeholder` 展开成 ::-webkit-input-placeholder / ::-moz-placeholder /
//             :-ms-input-placeholder 各一条规则；stylis 4 只出标准的 ::placeholder。
//   stylis 3: `@keyframes` 额外再出一份 @-webkit-keyframes；stylis 4 只出标准的。
// Chrome 57+ 支持无前缀 ::placeholder、Chrome 43+ 支持无前缀 @keyframes，
// 本仓目标是 chrome 58，所以这两类都安全。
const stripPrefixedRules = s =>
  s
    // 整条以带前缀伪元素为选择器的规则
    .replace(/[^{}]*::?-(?:webkit|moz|ms|o)-[a-zA-Z-]*placeholder[^{}]*\{[^{}]*\}/g, '')
    // 整个 @-webkit-keyframes 块（内部有嵌套花括号，单独处理）
    .replace(/@-(?:webkit|moz|ms|o)-keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

const semantic = s => stripCosmetic(stripPrefixedRules(stripPrefixes(s)));

if (diffs.length) {
  const prefixOnly = [];
  const cosmeticOnly = [];
  const real = [];

  for (const d of diffs) {
    if (semantic(d.a) === semantic(d.b)) {
      // 再细分一下是「只差前缀」还是「只差空白」，方便看构成
      if (stripCosmetic(d.a) === stripCosmetic(d.b)) cosmeticOnly.push(d);
      else prefixOnly.push(d);
    } else {
      real.push(d);
    }
  }

  console.log('\n差异分级:');
  console.log(`  仅厂商前缀 / 带前缀的伪元素与 @keyframes（已判定安全）: ${prefixOnly.length}`);
  console.log(`  仅空白/分号（语义相同）:                              ${cosmeticOnly.length}`);
  console.log(`  【剥掉以上各层后仍不同】:                             ${real.length}  <- 只有这些需要人看`);

  if (real.length) {
    // 只打【首个差异位置】附近：两串开头往往有几百字符是一样的，
    // 直接截前 N 字符会把真正的差异截没（第一版就是这么看不出东西的）。
    const around = (x, y) => {
      const a = stripPrefixedRules(stripPrefixes(x)).replace(/\s+/g, ' ');
      const b = stripPrefixedRules(stripPrefixes(y)).replace(/\s+/g, ' ');
      let i = 0;

      while (i < a.length && i < b.length && a[i] === b[i]) i++;

      const from = Math.max(0, i - 40);

      return [
        (from ? '…' : '') + a.slice(from, i + 120),
        (from ? '…' : '') + b.slice(from, i + 120),
        i,
      ];
    };
    console.log('\n真实差异（最多 25 条，只显示首个差异点附近）:');
    real.slice(0, 25).forEach((d, i) => {
      const [a, b, at] = around(d.a, d.b);
      console.log(`\n[${i + 1}] ${d.from}  (首个差异在第 ${at} 字符)`);
      console.log(`  4.4.1: ${a}`);
      console.log(`  6.5.3: ${b}`);
    });
  }

  process.exit(real.length || threw.length ? 1 : 0);
}

process.exit(threw.length ? 1 : 0);
