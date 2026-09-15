#!/usr/bin/env node
'use strict';
/**
 * node_modules 与 package.json / bun.lock 的一致性戳。
 *
 * 为什么要自己写：bun 没有「校验 node_modules 是否与锁文件一致」的命令。
 * `bun install --frozen-lockfile` 校验的是 lock 与 package.json 是否匹配，
 * 管不到已经落盘的 node_modules 是不是过期的。所以这里补一个。
 *
 * 拦的是【唯一】那个真实咬过人的场景：合并/切换了改依赖的分支，代码是新的、
 * node_modules 还是旧的。此时类型门禁会吐出几十条【指向业务文件】的类型错，
 * 看着像代码写错了，其实一条都不是。实际见过三次：
 *   - react-dnd 16 的代码撞上 v11 的 DragObjectWithType
 *   - chalk 6 的代码撞上 v4 → Cannot read properties of undefined (reading 'gray')
 *   - 2026-09-11：主检出合完 antd 5 分支后 node_modules 还停在 antd 4.19.0，
 *     push 被挡下并吐出 131 个 `TS2322 … maskStyle … not assignable to ModalProps`
 *
 * 能力边界（说清楚，免得高估）：
 *   ✅ 拦得住：改了依赖声明 / 锁文件但没重装
 *   ❌ 拦不住：rm -rf node_modules/某个包 —— 指纹不走盘，只比对声明与锁文件
 *
 * 指纹只取"会影响装出什么"的字段，故意不含 name/version/scripts ——
 * 改这些不需要重装，算进来只会制造假警报，而假警报多了这条门禁就会被无视。
 *
 * 用法：
 *   node scripts/install-stamp.js write   # 安装后写戳
 *   node scripts/install-stamp.js check   # 校验；0=一致 1=过期 2=没有戳
 *
 * write 由 package.json 的 postinstall 调用。
 *
 * 【这里有个硬性前提，换工具时必须先验】postinstall 必须【每次】install 都跑，
 * 哪怕依赖树没变。有的包管理器会按依赖树哈希缓存 build 结果、树没变就跳过
 * workspace 的 postinstall —— 一旦如此就会出现死局：改了 package.json
 *（比如把 "antd": "6.6.3" 改成 "^6.6.3"，解析同一个版本但锁文件内容变了）
 * → 指纹变了 → 门禁报"去装依赖" → 装了 → 判定无需 rebuild、不跑 postinstall
 * → 戳还是旧的 → 继续报。一个永远过不去、提示还是错的门禁比没有门禁更糟：
 * 它教会所有人用 --no-verify，把行为门禁和类型门禁一起带走。
 * bun 实测【没有】这个行为：连续两次 bun install，第二次照样跑 postinstall。
 *
 * write 永远 exit 0：它在 bun install 的流程里，一旦非 0 会让安装整体失败。
 * 一个辅助性的门禁不配把安装搞挂。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const STAMP_PATH = path.join(ROOT, 'node_modules', '.install-stamp.json');
const STAMP_VERSION = 1;

/** 键排序后再序列化：package.json 里字段换个位置不该算成"依赖变了"。 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = canonical(value[k]);
        return acc;
      }, {});
  }
  return value;
}

function fingerprint() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const relevant = canonical({
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    optionalDependencies: pkg.optionalDependencies || {},
    peerDependencies: pkg.peerDependencies || {},
    resolutions: pkg.resolutions || {},
    // 改白名单会改变「哪些包跑了 install 脚本」，装出来的东西是不一样的，算进指纹。
    trustedDependencies: pkg.trustedDependencies || [],
  });
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(relevant));
  hash.update('\0');
  hash.update(fs.readFileSync(path.join(ROOT, 'bun.lock')));
  return hash.digest('hex');
}

function write() {
  try {
    // node_modules 不在就什么都不做：说明这次安装根本没落盘，
    // 硬造一个目录只会让 check 以为一切正常。
    if (!fs.existsSync(path.join(ROOT, 'node_modules'))) return;
    fs.writeFileSync(
      STAMP_PATH,
      JSON.stringify({ version: STAMP_VERSION, fingerprint: fingerprint(), at: new Date().toISOString() }, null, 2) +
        '\n',
    );
  } catch (err) {
    // 见文件头：绝不因为写戳失败而让 bun install 挂掉。
    console.warn('install-stamp: 写入失败（不影响安装）:', err.message);
  }
}

function check() {
  let stamp;
  try {
    stamp = JSON.parse(fs.readFileSync(STAMP_PATH, 'utf8'));
  } catch {
    return 2;
  }
  if (stamp.version !== STAMP_VERSION) return 2;
  return stamp.fingerprint === fingerprint() ? 0 : 1;
}

const mode = process.argv[2];
if (mode === 'write') {
  write();
  process.exit(0);
} else if (mode === 'check') {
  process.exit(check());
} else {
  console.error('用法: node scripts/install-stamp.js <write|check>');
  process.exit(64);
}
