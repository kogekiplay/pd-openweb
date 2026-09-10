/**
 * withoutHeaderUrl / withoutChatUrl 的谓词，对着【真的 react-router 4】做差分。
 *
 * 这两个东西在 v4 里是路径字符串 `/(.*)(片段1|片段2|…)`，当成 <Route path> 用来
 * 占掉某些 URL、从而不渲染顶栏或聊天栏。v7 的路径语法没有交替组，只能改写成谓词。
 *
 * 第一版改成了 `pathname.includes(片段)`，并且我在注释里断言「v4 的语义就是子串匹配」。
 * 【没有实测，而且是错的】：v4 的 <Route> 默认 end:false，path-to-regexp 会补
 * `(?=\/|$)`，片段必须停在分隔符或结尾。'role' 这个片段下，v4 不匹配
 * /admin/roles/<id>，includes 匹配 —— 线上三个后台页面的顶栏整个消失。
 *
 * 教训是：把一段声明式配置改写成手写代码时，「语义等价」这句话本身就是待验证的假设，
 * 不能只写在注释里。所以有了这个脚本 —— 它把老实现（真 v4 的 matchPath）和新实现
 * （config.ts 导出的谓词）放在同一批 URL 上逐条比。
 *
 * 语料直接用路由匹配差分那份 fixture（1292 条真实 URL，覆盖四种渲染上下文），
 * 外加一批专门盯着「片段是别的词的前缀」这类边界的手工用例。
 *
 * 运行（RR4 默认在 /tmp/rr4，见 verify-router-matching.cjs 文件头）：
 *   node tools/verify-without-url-predicates.cjs
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RW = path.resolve(__dirname, '..') + '/';

const v4 = require(process.env.RR4 || '/tmp/rr4/node_modules/react-router-dom');

// 老实现：从迁移前的那个提交里把两个列表原样取出来，按 v4 的写法拼成 path 字符串。
// 【不要改成从当前 config.ts 读】—— 那样就是拿新代码验新代码。
const BASE_COMMIT = '80411b84c';
const oldSrc = execFileSync('git', ['show', `${BASE_COMMIT}:src/router/config.ts`], {
  cwd: RW,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

function extractList(name) {
  const m = oldSrc.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));

  if (!m) {
    console.error(`在 ${BASE_COMMIT} 的 config.ts 里找不到 ${name}`);
    process.exit(2);
  }

  return m[1]
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^['"]|['"]$/g, ''));
}

const oldHeaderList = extractList('withoutHeaderPathList');
const oldChatList = extractList('withoutChatPathList');

// 新实现：直接吃 config.ts 里的谓词。config.ts 顶层会 import 一堆业务模块，
// 在 Node 里全量加载成本很高，所以这里只把两个列表和那两行谓词抠出来跑。
// 抠取失败会立刻报错，不会静默退化成「验了个寂寞」。
const newSrc = fs.readFileSync(RW + 'src/router/config.ts', 'utf8');
const builderMatch = newSrc.match(/const buildWithoutUrlRegExp = list =>\n?([\s\S]*?);\n/);

if (!builderMatch) {
  console.error('config.ts 里找不到 buildWithoutUrlRegExp —— 谓词实现变了，请同步本脚本。');
  process.exit(2);
}

const newHeaderList = (() => {
  const m = newSrc.match(/const withoutHeaderPathList = \[([\s\S]*?)\];/);

  return m[1]
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^['"]|['"]$/g, ''));
})();
const newChatList = (() => {
  const m = newSrc.match(/const withoutChatPathList = \[([\s\S]*?)\];/);

  return m[1]
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^['"]|['"]$/g, ''));
})();

// eslint-disable-next-line no-new-func
const buildWithoutUrlRegExp = new Function('return ' + builderMatch[0].replace(/^const \w+ = /, '').replace(/;\s*$/, ''))();
const newHeader = pathname => buildWithoutUrlRegExp(newHeaderList).test(pathname);
const newChat = pathname => buildWithoutUrlRegExp(newChatList).test(pathname);

const oldHeader = pathname => !!v4.matchPath(pathname, { path: `/(.*)(${oldHeaderList.join('|')})`, exact: false });
const oldChat = pathname => !!v4.matchPath(pathname, { path: `/(.*)(${oldChatList.join('|')})`, exact: false });

// 先确认两边的片段列表本身没漂移，否则下面比的是两套配置而不是两套实现
const listDiff = (a, b) => a.length !== b.length || a.some((x, i) => x !== b[i]);

if (listDiff(oldHeaderList, newHeaderList) || listDiff(oldChatList, newChatList)) {
  console.log('  注意：片段列表相对迁移前有变化，下面的差异可能来自配置而不是实现');
  console.log(`    header ${oldHeaderList.length} -> ${newHeaderList.length}`);
  console.log(`    chat   ${oldChatList.length} -> ${newChatList.length}`);
}

// 语料：路由差分的 fixture + 手工边界用例
const urls = new Set();
const fixture = require(RW + 'tools/fixtures/router-v4-matching.json');

// fixture 的 case 键形如 '主路由|/admin/rt1/proj0005'，取竖线后面那段
for (const key of Object.keys(fixture.cases)) {
  urls.add(key.slice(key.indexOf('|') + 1).split('?')[0]);
}

if (urls.size < 500) {
  console.error(`只从 fixture 解析出 ${urls.size} 条 URL，格式大概率变了，拒绝在空语料上宣布通过。`);
  process.exit(2);
}

const fromFixture = urls.size;

// 手工边界：片段恰好是更长单词的前缀 / 后缀 / 跨段，这些才是 includes 与 v4 分道扬镳的地方
for (const u of [
  '/admin/role/PID',
  '/admin/roles/PID',
  '/admin/sysroles/PID',
  '/admin/sysroles',
  '/admin/workflow/PID',
  '/admin/workflows/PID',
  '/admin/home/PID',
  '/admin/structure/PID',
  '/workflow',
  '/workflowedit/x',
  '/print',
  '/printPivotTable',
  '/printFormx',
  '/app/lib',
  '/app/library',
  '/mobile',
  '/mobiles/x',
  '/demo',
  '/demography',
  '/land',
  '/landing/x',
  '/apps/kc/shareFolder',
  '/apps/kc/shareFolders/x',
]) {
  urls.add(u);
}

let same = 0;
const diffs = [];

for (const url of urls) {
  for (const [label, oldFn, newFn] of [
    ['顶栏', oldHeader, newHeader],
    ['聊天栏', oldChat, newChat],
  ]) {
    const o = oldFn(url);
    const n = newFn(url);

    if (o === n) same++;
    else diffs.push({ label, url, v4: o, v7: n });
  }
}

console.log(`\n  语料 ${urls.size} 条 URL（fixture ${fromFixture} + 手工边界 ${urls.size - fromFixture}）× 2 个谓词`);
console.log(`  一致 ${same} / 不一致 ${diffs.length}`);

if (diffs.length) {
  console.log('\n  不一致（前 25 条）:');
  diffs
    .slice(0, 25)
    .forEach(d => console.log(`    [${d.label}] ${d.url}   v4 屏蔽=${d.v4}  现在屏蔽=${d.v7}`));

  if (diffs.length > 25) console.log(`    …还有 ${diffs.length - 25} 条`);
}

process.exit(diffs.length ? 1 : 0);
