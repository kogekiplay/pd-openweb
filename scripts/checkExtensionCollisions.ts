#!/usr/bin/env node
/**
 * 后缀并存不变量检查。
 *
 * 拦的是这一种故障：同一个目录里出现同名不同后缀的模块（如 base.js 与 base.ts）。
 * 此时 webpack 的 resolve.extensions 让 .ts 先命中，而人眼看到的往往是刚更新的 .js，
 * 于是「改了没生效」——构建绿、tsc 绿、没有任何报错。
 *
 * 已知的并存来源是 codegen：scripts/downloadApiZip.js 从远端拉 zip，用 unzip -o
 * 只覆盖不清理，会把已迁移文件的旧 .js 重新吐出来。该脚本已加了后处理，这里是兜底。
 *
 * 全量改名迁移完成时该不变量为 0 违例，是一个干净的起点。
 */
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT_PATH = path.join(__dirname, '..');
const MODULE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);

function listTrackedFiles() {
  return execFileSync('git', ['ls-files', '-z', 'src'], { cwd: ROOT_PATH, maxBuffer: 64 * 1024 * 1024 })
    .toString()
    .split('\0')
    .filter(Boolean);
}

function findCollisions(files) {
  const byStem = new Map();
  for (const file of files) {
    const ext = path.extname(file);
    if (!MODULE_EXT.has(ext)) continue;
    // .d.ts 是类型声明，与同名 .js 并存是正常且期望的，不算违例
    if (file.endsWith('.d.ts')) continue;
    const stem = file.slice(0, -ext.length);
    if (!byStem.has(stem)) byStem.set(stem, []);
    byStem.get(stem).push(ext);
  }
  const collisions = [];
  for (const [stem, exts] of byStem) {
    if (exts.length > 1) collisions.push({ stem, exts: exts.sort() });
  }
  return collisions.sort((a, b) => a.stem.localeCompare(b.stem));
}

function main() {
  const collisions = findCollisions(listTrackedFiles());
  if (!collisions.length) {
    console.log('后缀并存检查通过：无同名不同后缀的模块。');
    return;
  }
  console.error(`后缀并存检查失败：${collisions.length} 处同名不同后缀。`);
  console.error('这些文件会互相遮蔽，构建不会报错但可能跑的是旧代码。请删掉多余的那一个。');
  for (const { stem, exts } of collisions) {
    console.error(`  ${stem} -> ${exts.join(' + ')}`);
  }
  process.exit(1);
}

if (require.main === module) main();

module.exports = { findCollisions };
