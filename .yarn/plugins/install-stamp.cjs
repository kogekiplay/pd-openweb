/**
 * 安装后写一致性戳。见 scripts/install-stamp.js 的文件头了解这个戳是干什么的。
 *
 * 为什么是插件，不是 package.json 的 postinstall —— 实测过，postinstall 不可靠：
 * Berry 按【依赖树哈希】缓存 build 结果，树没变就不重跑 workspace 的 postinstall。
 * 于是出现这种死局：改了 package.json（比如把 "antd": "6.6.3" 改成 "^6.6.3"，
 * 解析结果同一个版本但锁文件内容变了）→ 指纹变了 → 门禁报"跑 yarn install"
 * → 跑了 → yarn 判定无需 rebuild、不执行 postinstall → 戳还是旧的 → 继续报。
 * 一个永远过不去、而且提示还是错的门禁，比没有门禁更糟：它教会所有人用
 * --no-verify，把行为门禁和类型门禁一起带走。
 *
 * afterAllInstalled 是 Berry 官方的"每次 install 结束都跑"钩子，不参与 build
 * 缓存，所以没有上面那个问题。
 *
 * 用 execFile 起子进程而不是 require：插件运行在 yarn 自带的打包运行时里，
 * 模块解析跟普通 Node 不完全一样，起子进程是最没有意外的做法（代价约 50ms）。
 */
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = {
  name: 'plugin-install-stamp',
  factory: () => ({
    hooks: {
      afterAllInstalled(project) {
        const cwd = project.cwd;
        try {
          execFileSync(process.execPath, [path.join(cwd, 'scripts', 'install-stamp.js'), 'write'], {
            cwd,
            stdio: 'inherit',
          });
        } catch (err) {
          // 绝不因为写戳失败而让 yarn install 挂掉。
          console.warn('install-stamp 插件: 写入失败（不影响安装）:', err.message);
        }
      },
    },
  }),
};
