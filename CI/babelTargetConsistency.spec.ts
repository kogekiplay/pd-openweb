/**
 * 浏览器目标版本号在四处各写了一份，必须全部一致。
 *
 * 四处：.babelrc 的 development / production 两个 env 块，
 * CI/webpack.config.ts 和 CI/webpack.mingo-entry-widget.config.ts 里
 * 各有一条专门把 node_modules/@ctrl/tinycolor 降级的 babel-loader 规则。
 *
 * 【为什么值得立门禁】改漏一处**不会报任何错**，只是那一部分产物按另一个目标编译。
 * 表现是「某个第三方库在老设备上白屏，别的都好」这种极难归因的故障。
 * 2026-09-23 从 58 调到 103 时就是靠全仓 grep 才找齐四处的 ——
 * 其中 mingo-entry-widget 那份连当初记录这件事的笔记都漏了。
 *
 * 【当前值 103 的依据】生产 nginx 访问日志，2026-09-03 ~ 09-23 共 314 个去重会话：
 * 排掉扫描器段（64.62.197.x）之后，最老的真实客户端是一台 OPPO PEQM00（Android 13）
 * 上的 Mingdao Application WebView，系统 WebView 停在 Chrome 103。
 * 再往上调没有收益 —— 实测 preset-env 在 103 / 138 / 152 三档下产出逐字节相同。
 * 要往上调的前提是那台设备不再使用，而不是「看起来够新了」。
 *
 * 本门禁只管**一致性**，不管具体取值 —— 取值是业务决定，改的时候四处一起改就行。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../scripts/spec-harness.ts');

/** 每个来源报出它声明的所有 chrome 目标版本 */
const SOURCES = [
  {
    file: '.babelrc',
    pick: src => [...src.matchAll(/"chrome"\s*:\s*"(\d+)"/g)].map(m => m[1]),
    expect: 2, // development / production 两个 env 块
  },
  {
    file: 'CI/webpack.config.ts',
    pick: src => [...src.matchAll(/chrome:\s*'(\d+)'/g)].map(m => m[1]),
    expect: 1,
  },
  {
    file: 'CI/webpack.mingo-entry-widget.config.ts',
    pick: src => [...src.matchAll(/chrome:\s*'(\d+)'/g)].map(m => m[1]),
    expect: 1,
  },
];

const found = [];

for (const s of SOURCES) {
  const abs = path.join(ROOT, s.file);

  assert.ok(fs.existsSync(abs), `${s.file} 不存在 —— 门禁的扫描清单过期了`);

  const versions = s.pick(fs.readFileSync(abs, 'utf8'));

  assert.strictEqual(
    versions.length,
    s.expect,
    `${s.file} 里找到 ${versions.length} 处 chrome 目标声明，预期 ${s.expect} 处。` +
      '要么是新增/删除了声明（把本门禁的清单一起改掉），要么是匹配规则跟不上写法变化了。',
  );

  for (const v of versions) found.push({ file: s.file, version: v });
}

const distinct = [...new Set(found.map(f => f.version))];

assert.strictEqual(
  distinct.length,
  1,
  '浏览器目标版本不一致，改漏了：\n  ' +
    found.map(f => `${f.file} -> chrome ${f.version}`).join('\n  ') +
    '\n四处必须写同一个版本号（见本文件头）。',
);

console.log(`babel browser target consistency test passed（四处均为 chrome ${distinct[0]}）`);
