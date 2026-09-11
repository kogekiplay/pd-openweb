const childProcess = require('child_process');
const path = require('path');

function normalizeCacheKey(value) {
  return String(value || 'local')
    .replace(/^refs[\\/]heads[\\/]/, '')
    .replace(/^refs[\\/]remotes[\\/]/, '')
    .replace(/^origin[\\/]/, '')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .slice(0, 120);
}

function getGitValue(rootPath, command) {
  try {
    return childProcess
      .execSync(command, { cwd: rootPath, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

function getWebpackCacheBranch(rootPath) {
  const envBranch = process.env.GIT_BRANCH;

  if (envBranch) {
    return normalizeCacheKey(envBranch);
  }

  const gitBranch = getGitValue(rootPath, 'git rev-parse --abbrev-ref HEAD');

  if (gitBranch && gitBranch !== 'HEAD') {
    return normalizeCacheKey(gitBranch);
  }

  const gitCommit = getGitValue(rootPath, 'git rev-parse --short HEAD');
  return normalizeCacheKey(gitCommit ? `detached-${gitCommit}` : 'local');
}

/**
 * 缓存目录【默认全分支共用一份】。
 *
 * 原来是按分支名分目录的，后果实测下来有两条：
 *   1. 每开一个新分支就是一次冷构建。本仓的工作方式是「一个升级一个分支」，
 *      于是几乎每次都在付冷启动的钱（实测冷 4m17s vs 热 3m09s）。
 *   2. 磁盘堆积。清理时三个 worktree 合计 156GB，其中 114GB 属于早已合并的分支。
 *
 * webpack 的文件系统缓存是内容寻址的：内容变了自然 miss，跨分支共用不会串味，
 * 最多是不同分支互相挤掉一些条目。本仓一次只开一两个分支，实际影响很小。
 *
 * 需要隔离时（比如 CI 上要复现干净构建）设 WEBPACK_CACHE_KEY，
 * 设成分支名即可退回旧行为。
 */
function getWebpackCacheDirectory(rootPath) {
  const key = process.env.WEBPACK_CACHE_KEY || 'shared';

  return path.resolve(rootPath, 'node_modules/.cache/webpack', normalizeCacheKey(key));
}

function getWebpackCacheName(rootPath, parts) {
  // 与目录同源：默认不再按分支区分，理由见 getWebpackCacheDirectory
  const key = normalizeCacheKey(process.env.WEBPACK_CACHE_KEY || 'shared');

  return ['mdpublic', key].concat(parts).filter(Boolean).join('-');
}

module.exports = {
  getWebpackCacheBranch,
  getWebpackCacheDirectory,
  getWebpackCacheName,
};
