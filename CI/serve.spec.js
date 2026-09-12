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

// REWRITE_PREFIXES：简单的字符串数组字面量
const rewriteBody = sliceArray('REWRITE_PREFIXES');
const rewritePrefixes = [...rewriteBody.matchAll(/'([^']+)'/g)].map(m => m[1]);

// proxyConfigs：取每个条目的 path（dev 侧匹配前缀）
const proxyBody = sliceArray('proxyConfigs');
const proxyPaths = [...proxyBody.matchAll(/\bpath:\s*'([^']+)'/g)].map(m => m[1]);

assert.ok(rewritePrefixes.length > 0, '没解析到 REWRITE_PREFIXES，解析逻辑失效了');
assert.ok(proxyPaths.length > 0, '没解析到 proxyConfigs 的 path，解析逻辑失效了');

// 【匹配规则要和 serve.js 的实际判定一致】
// 转发的判定是 req.url.startsWith(config.path)。改写后的地址形如
// `<prefix>/Xxx`（调用点自己拼下一段），所以 prefix 带不带尾斜杠都要能对上：
//   '/file/'     ↔ path '/file/'
//   '/chatmq'    ↔ path '/chatmq/'
//   '/excelapi'  ↔ path '/excelapi/'
for (const prefix of rewritePrefixes) {
  const covered = proxyPaths.some(p => p === prefix || p === `${prefix}/`);
  assert.ok(
    covered,
    `REWRITE_PREFIXES 里的 '${prefix}' 在 proxyConfigs 里没有对应的转发条目。\n` +
      `  后果是【静默】的：请求被 serve-handler 兜底成 SPA 的 index.html（200 + HTML），\n` +
      `  调用方报「解析失败」，看着完全不像代理问题。\n` +
      `  现有 proxyConfigs 的 path：${proxyPaths.join(', ')}`,
  );
}

// 钉住这次修复本身：导出/打印服务（Config.WorksheetDownUrl）两条都得在。
// 尾斜杠不能统一加 —— 该配置项的值是裸的 `https://host:8880/excelapi`，
// 写成 '/excelapi/' 就匹配不上，导出会照旧发绝对地址、照旧被 CORS 挡死。
assert.ok(
  rewritePrefixes.includes('/excelapi'),
  "REWRITE_PREFIXES 里缺 '/excelapi'（注意：不带尾斜杠），dev 下导出 Excel / 导出 Word / 打印模板会 CORS 失败",
);
assert.ok(proxyPaths.includes('/excelapi/'), "proxyConfigs 里缺 path '/excelapi/'");

console.log(`serve proxy tests passed (${rewritePrefixes.length} rewrite prefixes, ${proxyPaths.length} proxy paths)`);
