/**
 * dev server 代理配置的成对性护栏。
 *
 * 【这条 spec 在防什么】
 * rewriteAbsoluteHosts 把接口响应里的绝对地址（https://host:8880/excelapi）
 * 改写成相对地址（/excelapi），让请求落回 dev server；proxyConfigs 再把它转发到
 * 真实部署。两者必须【成对】存在 —— 只加改写、不加转发，比两者都不加【更糟】：
 *
 *   都不加 → 请求发绝对地址 → 浏览器报 CORS，错误信息直指问题。
 *   只改写 → 请求发到 localhost，没有匹配的代理，被 serve-handler 兜底成 SPA 的
 *            index.html，返回【200 + text/html】。调用方拿到一段 HTML 当接口响应去
 *            解析，报出来的是「解析失败」或「404 页面不存在」，完全看不出是代理漏了。
 *
 * 实际踩过：Config.WorksheetDownUrl（工作表导出/打印服务）两条都没加，
 * dev 下点「导出 Excel」直接 CORS 失败。它不像 workflow / report 那样在
 * __api_server__ 里有 dev 侧条目（见 CI/generate.js 的 apiMap），
 * 地址【纯粹来自接口响应】，所以两份清单都漏了它。
 *
 * 不 require CI/serve.js：那个模块一加载就会启动服务器。这里只做静态解析。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, 'serve.js'), 'utf8');

// 先剥注释再解析。两个理由：
//   1. 注释里写满了 '/api/xxx' 这样的路径举例，不剥会被当成配置项读进来。
//   2. 括号配对要在纯代码上做。
// 剥的时候必须跟踪字符串状态 —— 源码里有 'https://…' 这类字面量，
// 见到 // 就当注释会把它从中间截断。
function stripComments(src) {
  let out = '';
  let quote = null; // 当前所在字符串的引号字符
  let i = 0;

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (quote) {
      if (c === '\\') {
        out += c + (next ?? '');
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      out += c;
      i++;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }

    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

const source = stripComments(raw);

// 单行数组（REWRITE_PREFIXES）和多行数组（proxyConfigs）都要能切，
// 所以按括号配对找结尾，不能靠 '\n];' 这种形状假设。
function sliceArray(varName) {
  const decl = source.indexOf(`const ${varName} = [`);
  assert.notStrictEqual(decl, -1, `serve.js 里找不到 ${varName} —— 改名了就同步改这条 spec`);

  const open = source.indexOf('[', decl);
  let depth = 0;

  for (let i = open; i < source.length; i++) {
    if (source[i] === '[') depth++;
    else if (source[i] === ']' && --depth === 0) return source.slice(open + 1, i);
  }

  assert.fail(`${varName} 的数组字面量没有正常收尾`);
}

// 两套改写前缀都是简单的字符串数组字面量。
// 注意 sliceArray 用 `const <名字> = [` 定位，'const REWRITE_PREFIXES = [' 不会
// 误命中 'const PLATFORM_REWRITE_PREFIXES = ['（中间隔着 PLATFORM_），两者互不干扰。
const parseList = name => [...sliceArray(name).matchAll(/'([^']+)'/g)].map(m => m[1]);
const rewritePrefixes = parseList('REWRITE_PREFIXES');
const platformPrefixes = parseList('PLATFORM_REWRITE_PREFIXES');

// proxyConfigs：取每个条目的 path（dev 侧匹配前缀）
const proxyBody = sliceArray('proxyConfigs');
const proxyPaths = [...proxyBody.matchAll(/\bpath:\s*'([^']+)'/g)].map(m => m[1]);

assert.ok(rewritePrefixes.length > 0, '没解析到 REWRITE_PREFIXES，解析逻辑失效了');
assert.ok(platformPrefixes.length > 0, '没解析到 PLATFORM_REWRITE_PREFIXES，解析逻辑失效了');
assert.ok(proxyPaths.length > 0, '没解析到 proxyConfigs 的 path，解析逻辑失效了');

// 【匹配规则要和 serve.js 的实际判定一致】
// 转发的判定是 req.url.startsWith(config.path)。改写后的地址形如
// `<prefix>/Xxx`（调用点自己拼下一段），所以 prefix 带不带尾斜杠都要能对上：
//   '/file/'     ↔ path '/file/'
//   '/chatmq'    ↔ path '/chatmq/'
//   '/excelapi'  ↔ path '/excelapi/'
for (const [listName, prefixes] of [
  ['REWRITE_PREFIXES', rewritePrefixes],
  ['PLATFORM_REWRITE_PREFIXES', platformPrefixes],
]) {
  for (const prefix of prefixes) {
    // '/' 是唯一豁免：它就是 dev server 自己的根（主站 SPA），本地直接就有，
    // 不需要也不该有转发条目。见 PLATFORM_REWRITE_PREFIXES 的注释。
    if (prefix === '/') continue;

    const covered = proxyPaths.some(p => p === prefix || p === `${prefix}/`);
    assert.ok(
      covered,
      `${listName} 里的 '${prefix}' 在 proxyConfigs 里没有对应的转发条目。\n` +
        `  后果是【静默】的：请求被 serve-handler 兜底成 SPA 的 index.html（200 + HTML），\n` +
        `  调用方报「解析失败」，看着完全不像代理问题。\n` +
        `  现有 proxyConfigs 的 path：${proxyPaths.join(', ')}`,
    );
  }
}

// 平台管理（/pm）必须四件套齐全，少一件页面就停在「初始化失败，请刷新页面后重试」，
// 而且三种成因的【症状完全一样】，靠看页面区分不了：
//   1. /pm 没在 REWRITE_PREFIXES  → 压根不跳 localhost，还在生产（不算坏，但不是本意）
//   2. /platformapi 没有转发条目   → GetSysSettings 拿到 dev 自己的 index.html 当 JSON 解析
//   3. /platformapi 没开 rewriteHosts → 控制台照着响应里的绝对 accountApiUrl 发 XHR，被 CORS 挡死
assert.ok(rewritePrefixes.includes('/pm/'), "REWRITE_PREFIXES 里缺 '/pm/'，dev 下点平台管理会跳到生产地址");
assert.ok(proxyPaths.includes('/platformapi/'), "proxyConfigs 里缺 path '/platformapi/'");
assert.ok(
  /name: 'platformapi'[\s\S]{0,220}?rewriteHosts: PLATFORM_REWRITE_PREFIXES/.test(source),
  'platformapi 这条代理必须带 rewriteHosts: PLATFORM_REWRITE_PREFIXES，否则平台管理会对着生产发 XHR 被 CORS 挡死',
);

// 钉住这次修复本身：导出/打印服务（Config.WorksheetDownUrl）两条都得在。
// 尾斜杠不能统一加 —— 该配置项的值是裸的 `https://host:8880/excelapi`，
// 写成 '/excelapi/' 就匹配不上，导出会照旧发绝对地址、照旧被 CORS 挡死。
assert.ok(
  rewritePrefixes.includes('/excelapi'),
  "REWRITE_PREFIXES 里缺 '/excelapi'（注意：不带尾斜杠），dev 下导出 Excel / 导出 Word / 打印模板会 CORS 失败",
);
assert.ok(proxyPaths.includes('/excelapi/'), "proxyConfigs 里缺 path '/excelapi/'");

// favicon 的 dev/生产对齐：generate.js 生成的是写死的 /favicon.png，
// 生产由 nginx 的 subs_filter 换成 ProjectLogo 下那张。dev 靠这条转发达到同样效果。
assert.ok(
  /name: 'favicon'[\s\S]{0,200}?replace: '\/file\/mdpic\/ProjectLogo\/favicon\.png'/.test(source),
  "proxyConfigs 里缺 favicon 那条（/favicon.png → /file/mdpic/ProjectLogo/favicon.png），dev 下只会显示默认图标",
);

console.log(`serve proxy tests passed (${rewritePrefixes.length} rewrite prefixes, ${proxyPaths.length} proxy paths)`);
