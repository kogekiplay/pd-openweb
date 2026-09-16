#!/usr/bin/env node
/**
 * 第 6 道门禁：工具链自身的类型零容忍。
 *
 * 守的是 scripts/ 和 tools/ 下【已经改成 .ts】的文件（口径见 tsconfig.tools.json）。
 *
 * 【为什么值得单开一道】2026-09-15 把 scripts/typecheck/*.js 改名成 .ts 时才发现：
 * 根 tsconfig.json 的 include 只有 ["src","types"]，工具链一个文件都不在里面。
 * 光改后缀而不纳入任何 tsconfig，写的类型标注一个字都不会被验证 —— 纯装饰。
 * 接上之后当场就抓到 4 条真诊断（baseline.json 读出来的 Map 是 unknown，
 * 下游 `n - b` 和 `b[1] - a[1]` 全是「算术运算的操作数类型不对」）。
 *
 * 【为什么是零容忍、没有基线】和语法门禁同理：这批文件是我们自己刚写的，
 * 数量小、增量可控，不存在历史包袱，一开始就该保持 0。
 * 有基线就意味着「允许欠账」，而这一层的欠账会直接腐蚀其它五道门禁的可信度。
 *
 * 随着 scripts/ CI/ tools/ 下的 .js 逐个改成 .ts，它们会自动进入这道门禁的范围，
 * 不需要改这里。
 */
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT: string = path.resolve(__dirname, '../..');
/**
 * 两份配置都要过，因为工具链里其实有【两种运行环境】：
 *   · tsconfig.tools.json          —— Node 脚本（lib 不带 DOM），外加 src 下的 spec
 *   · tsconfig.tools.browser.json  —— 跑在浏览器里的预览/验证页（要 DOM lib）
 * 混成一份的代价实测过：给前者开 DOM，19 个 spec 立刻报假错误
 *（它们用部分对象模拟 window/location，理由见 types/spec-globals.d.ts）。
 */
const CONFIGS = ['tsconfig.tools.json', 'tsconfig.tools.browser.json'];

// TS 7 只导出 '.'、'./package.json' 和 './unstable/*'，
// require.resolve('typescript/bin/tsc') 会 ERR_PACKAGE_PATH_NOT_EXPORTED。
// 解析 package.json 再拼 bin/tsc 是唯一稳的写法。
const tsc: string = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc');

const t0 = Date.now();
const errors: string[] = [];

for (const config of CONFIGS) {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', config], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (r.error) {
    console.error(`工具链类型门禁：tsc 起不来（${config}）—— ${r.error.message}`);
    process.exit(2);
  }

  const out: string = `${r.stdout || ''}${r.stderr || ''}`;
  errors.push(...out.split('\n').filter((l: string) => /error TS\d+/.test(l)));
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);

if (!errors.length) {
  console.log(`工具链类型门禁通过：${CONFIGS.join(' + ')} 下 0 条诊断（${secs}s）`);
  process.exit(0);
}

console.error(`\n工具链类型门禁失败：${errors.length} 条诊断（${secs}s）`);
console.error('这一层没有基线，请直接修掉 —— 它守的是我们自己刚写的工具代码。\n');
for (const line of errors.slice(0, 40)) console.error(`  ${line}`);
if (errors.length > 40) console.error(`  …还有 ${errors.length - 40} 条`);
process.exit(1);
