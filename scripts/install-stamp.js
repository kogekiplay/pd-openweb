#!/usr/bin/env node
'use strict';
/**
 * node_modules 与 package.json / yarn.lock 的一致性戳。
 *
 * 为什么要自己写：yarn 2 删掉了 `yarn check`（yarnpkg/rfcs#106，2019-02-18 合入）。
 * 那条 RFC 的讨论里就有人提出"我们在 pre-push 跑 yarn check 拦住状态不一致的人"，
 * 官方给的替代是"提交 cache + .pnp.js"—— 对不用 PnP 的仓库不成立。所以这里补一个。
 *
 * 拦的是【唯一】那个真实咬过人的场景：合并/切换了改依赖的分支，代码是新的、
 * node_modules 还是旧的。此时类型门禁会吐出几十条【指向业务文件】的类型错，
 * 看着像代码写错了，其实一条都不是。实际见过三次：
 *   - react-dnd 16 的代码撞上 v11 的 DragObjectWithType
 *   - chalk 6 的代码撞上 v4 → Cannot read properties of undefined (reading 'gray')
 *   - 2026-09-11：主检出合完 antd 5 分支后 node_modules 还停在 antd 4.19.0，
 *     push 被挡下并吐出 131 个 `TS2322 … maskStyle … not assignable to ModalProps`
 *
 * 能力边界（跟被它取代的 `yarn check --integrity` 【完全一致】，不是缩水）：
 * 读 yarn 1 源码 lib/cli.js 的 InstallationIntegrityChecker.check() 可以确认，
 * `--integrity` 比对的是 .yarn-integrity 这个 JSON（lockfileEntries、
 * topLevelPatterns、flags、linkedModules），最后只判断 node_modules 这个
 * 【目录】在不在，从不逐包走盘。会走盘的是另一个开关 `--check-files`，
 * 而 `--integrity` 明确把它从比对里过滤掉。所以：
 *   ✅ 拦得住：改了依赖声明/锁文件但没装
 *   ❌ 拦不住：rm -rf node_modules/某个包（v1 的 --integrity 同样拦不住）
 *
 * 指纹只取"会影响装出什么"的字段，故意不含 name/version/scripts ——
 * 改这些不需要重装，算进来只会制造假警报，而假警报多了这条门禁就会被无视。
 *
 * 用法：
 *   node scripts/install-stamp.js write   # 安装后写戳
 *   node scripts/install-stamp.js check   # 校验；0=一致 1=过期 2=没有戳
 *
 * write 由 .yarn/plugins/install-stamp.cjs 的 afterAllInstalled 钩子调用，
 * 【不是】package.json 的 postinstall —— 后者试过，不可靠，原因写在插件文件头。
 *
 * write 永远 exit 0：它在 yarn install 的流程里，一旦非 0 会让安装整体失败。
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
    // 换包管理器（yarn 1 → 4）同样要求重装，算进指纹。
    packageManager: pkg.packageManager || null,
  });
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(relevant));
  hash.update('\0');
  hash.update(fs.readFileSync(path.join(ROOT, 'yarn.lock')));
  return hash.digest('hex');
}

function write() {
  try {
    // node_modules 不在就什么都不做：说明这次安装根本没落盘（比如 PnP），
    // 硬造一个目录只会让 check 以为一切正常。
    if (!fs.existsSync(path.join(ROOT, 'node_modules'))) return;
    fs.writeFileSync(
      STAMP_PATH,
      JSON.stringify({ version: STAMP_VERSION, fingerprint: fingerprint(), at: new Date().toISOString() }, null, 2) +
        '\n',
    );
  } catch (err) {
    // 见文件头：绝不因为写戳失败而让 yarn install 挂掉。
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
