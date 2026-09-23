// jsencrypt 3.5.4 起 main 指向 bin/jsencrypt.min.js，该压缩版在模块加载时
// 就引用浏览器全局 self。浏览器里没问题（webpack 走 module 字段 lib/index.js），
// 但 Node 下的 spec 会 ReferenceError。补一个最小垫片。
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;

/**
 * Shared harness for the *.spec.js behaviour tests.
 *
 * Why this file exists
 * --------------------
 * The specs were written before the repo-wide `.js/.jsx -> .ts/.tsx` codemod.
 * They address their targets with the OLD extensions (`requireEsm('./control.js')`,
 * `path.join(__dirname, 'index.jsx')`, ...). Rather than rewrite ~86 hardcoded
 * extensions across 61 files, every path that reaches this module is re-resolved
 * against disk: a stale `.js`/`.jsx` suffix is stripped and `.ts` / `.tsx` /
 * `.js` / `.jsx` / `index.*` are tried in order.
 *
 * >>> Stale extensions in the spec bodies are EXPECTED and intentional. <<<
 * Do not "fix" `'./control.js'` to `'./control.ts'` -- the codemod renamed files
 * but did NOT rewrite import specifiers, so the product sources still import
 * `'src/pages/FormSet/config.js'` too. Leaving both alone keeps the two in sync.
 *
 * Deliberately NOT using the project .babelrc (`babelrc: false` AND
 * `configFile: false`, both load-bearing):
 *   1. `.babelrc` enables babel-plugin-import for `ming-ui`, which rewrites
 *      `import { Icon } from 'ming-ui'` into `require('ming-ui/components/Icon')`.
 *      15 specs stub the bare `'ming-ui'` request and would all break at once.
 *      (`src/ming-ui/` has no index file, so the bare form only works here.)
 *   2. `.babelrc`'s preset-env sets `modules: false`, which fights the
 *      `plugin-transform-modules-commonjs` the `new Function(...)` harness needs.
 *   3. `.babelrc`'s `production` env adds plugin-transform-runtime, making
 *      behaviour depend on NODE_ENV.
 *
 * Zero new dependencies: everything below already ships in the repo.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const realParser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');
const EXTS = ['', '.ts', '.tsx', '.js', '.jsx'];

/** Resolve `base` to a real file, trying bare, then each extension, then index.*. */
function resolveFile(base) {
  for (const ext of EXTS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  for (const ext of EXTS) {
    if (!ext) continue;
    const candidate = path.join(base, 'index' + ext);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Drop a `.js`/`.jsx` suffix that no longer exists on disk, so it can be re-resolved. */
function stripStale(p) {
  return fs.existsSync(p) ? p : p.replace(/\.(js|jsx)$/, '');
}

/** Full resolve used by every entry point below. Throws with the original request. */
function resolveSpecTarget(request) {
  const raw = path.isAbsolute(request) ? request : path.resolve(ROOT, request);
  const found = resolveFile(stripStale(raw));
  if (!found) throw new Error(`spec-harness: cannot resolve "${request}"`);
  return found;
}

// development 必须钉成 false：spec 跑的时候 NODE_ENV 没设，babel 会按 development 编译成
// react/jsx-dev-runtime 的 jsxDEV()，和发布构建（production 环境，jsx() / jsxs()）不是一回事，
// 假 React 的 spec 也就接不住。钉死之后 spec 编译出来的和发布包同一种调用。
const BUILD_JSX = { runtime: 'automatic', development: false };

function babelPresets(file, extra = []) {
  const isTS = /\.tsx?$/.test(file);
  // JSX 的 runtime 必须跟真实构建一致。.babelrc 在 2026-09-23 从 classic 切到了 automatic：
  // JSX 编译成 react/jsx-runtime 的 jsx() / jsxs()，产品文件里也不再为 JSX 去 import React。
  // 这里若还停在 classic，编译出来的 React.createElement 会找不到 React（ReferenceError）。
  // 自己造假 React 来观察渲染树的 spec，要同时把 'react/jsx-runtime' 指到 jsxRuntimeFrom(假 createElement)，
  // 否则 jsx() 走的是真 React，假树里什么都没有 —— 当年从 automatic 钉回 classic 时 5 个 spec 全红，是同一个坑。
  // 多数 spec 自己传了裸的 '@babel/preset-react'，所以对调用方那份也归一化（调用方显式指定了 runtime 的尊重它）。
  const withBuildJsx = p => {
    const name = Array.isArray(p) ? p[0] : p;

    if (!String(name).includes('preset-react')) return p;

    const opts = Array.isArray(p) ? p[1] || {} : {};

    return [name, { ...BUILD_JSX, ...opts }];
  };
  const presets = extra
    .filter(p => !String(Array.isArray(p) ? p[0] : p).includes('preset-typescript'))
    .map(withBuildJsx);

  if (!presets.some(p => String(Array.isArray(p) ? p[0] : p).includes('preset-react'))) {
    presets.push(['@babel/preset-react', BUILD_JSX]);
  }
  // Babel 8 移除了 .isTSX / .allExtensions，改为默认按文件扩展名判断是否 TSX——
  // 这里本来就是按扩展名算的，且传的是真实文件名，所以直接去掉即等价。
  if (isTS) presets.push('@babel/preset-typescript');
  return presets;
}

/**
 * Drop-in replacement for `require('@babel/core').transformFileSync`.
 * Specs swap only their `require('@babel/core')` line; call sites are untouched.
 */
function transformFileSync(filePath, opts: Record<string, any> = {}) {
  const file = resolveSpecTarget(filePath);
  return babel.transformFileSync(file, {
    ...opts,
    babelrc: false,
    configFile: false,
    presets: babelPresets(file, opts.presets || []),
    plugins: opts.plugins || ['@babel/plugin-transform-modules-commonjs'],
  });
}

/** Drop-in for `transformSync`, but `filename` drives TS/TSX detection. */
function transformSync(code, opts: Record<string, any> = {}) {
  const file = opts.filename || 'unknown.tsx';
  return babel.transformSync(code, {
    ...opts,
    babelrc: false,
    configFile: false,
    presets: babelPresets(file, opts.presets || []),
    plugins: opts.plugins || ['@babel/plugin-transform-modules-commonjs'],
  });
}

/**
 * 给「自己造了假 React」的 spec 用：把 automatic runtime 的 jsx / jsxs 调用转回它们的假 createElement，
 * 在 localRequire 里 `if (request === 'react/jsx-runtime') return jsxRuntimeFrom(createElement, Fragment)`。
 *
 * 参数形状要和 classic 下 createElement(type, props, ...children) 收到的一致：
 * jsx(type, props, key) 的 children 在 props 里 —— 单个子节点或动态数组原样当【一个】参数；
 * jsxs 的 children 是静态写出来的多个子节点，要摊开；key 放回 props。
 */
function jsxRuntimeFrom(createElement, Fragment: unknown = 'Fragment') {
  const adapt = (spread: boolean) => (type, props, key) => {
    const { children, ...rest } = props || {};
    const finalProps = key === undefined ? rest : { ...rest, key };
    const kids = children === undefined ? [] : spread ? children : [children];
    return createElement(type, finalProps, ...kids);
  };
  return { __esModule: true, jsx: adapt(false), jsxs: adapt(true), Fragment };
}

/** Read a source file as text, re-resolving a stale extension. Used by the text-assert specs. */
function readSource(...parts) {
  return fs.readFileSync(resolveSpecTarget(path.join(...parts)), 'utf8');
}

/** `@babel/parser` with the `typescript` plugin forced on, for the AST-walking spec. */
const parser = {
  ...realParser,
  parse(code, opts: Record<string, any> = {}) {
    const plugins = new Set([...(opts.plugins || []), 'typescript', 'decorators-legacy']);
    return realParser.parse(code, { ...opts, plugins: [...plugins] });
  },
};

/* ------------------------------------------------------------------ *
 * require() hook: lets UNSTUBBED transitive imports inside a target
 * module resolve to .ts/.tsx. Without it, `import './buildSteps'` in
 * streamEvents.ts dies with MODULE_NOT_FOUND once localRequire falls
 * through to Node's real require.
 * ------------------------------------------------------------------ */
function compileTs(module_, filename) {
  const { code } = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: babelPresets(filename, []),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  module_._compile(code, filename);
}

let hookInstalled = false;
function installRequireHook() {
  if (hookInstalled) return;
  hookInstalled = true;

  Module._extensions['.ts'] = compileTs;
  Module._extensions['.tsx'] = compileTs;

  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, ...rest) {
    try {
      return origResolve.call(this, request, parent, ...rest);
    } catch (err) {
      // 1. relative request that needs a .ts/.tsx (or a stale .js stripped)
      if (request.startsWith('.') && parent && parent.filename) {
        const found = resolveFile(stripStale(path.resolve(path.dirname(parent.filename), request)));
        if (found) return found;
      }
      // 2. webpack-style root-absolute request, e.g. 'src/utils/controlCommon'
      if (/^(src|scripts)\//.test(request)) {
        const found = resolveFile(stripStale(path.join(ROOT, request)));
        if (found) return found;
      }
      throw err;
    }
  };
}

installRequireHook();

/**
 * Quarantine for an assertion that encodes CORRECT intent but fails against a
 * known, still-open upstream defect. Warns instead of throwing, so the other
 * assertions in the file can still act as a gate.
 *
 * It is deliberately self-retiring: if the wrapped assertion starts PASSING,
 * this throws. That forces whoever fixes the underlying defect to delete the
 * quarantine rather than leave a stale "known failure" lying around forever.
 */
function expectedFailure(label, fn) {
  let passed = false;
  try {
    fn();
    passed = true;
  } catch (err) {
    // 只吞断言失败。别的异常（模块解析失败、readSource 出错、TypeError…）
    // 说明隔离区本身坏了，而不是「已知缺陷仍在」——必须原样抛出去。
    // 否则一个无关的 harness 故障会被伪装成 [known-failure]，spec 照样报绿，
    // 隔离区从此变成一个永远不会响的黑洞。
    if (err && err.code !== 'ERR_ASSERTION') {
      err.message =
        `expectedFailure("${label}") 捕获到【非断言】异常，隔离区可能已失效：\n` + err.message;
      throw err;
    }
    console.warn(`  [known-failure] ${label}\n    ${String(err.message).split('\n')[0]}`);
  }
  if (passed) {
    throw new Error(
      `expectedFailure("${label}") PASSED. The underlying defect appears fixed -- ` +
        `remove the expectedFailure() wrapper and let the assertion run normally.`,
    );
  }
}

module.exports = {
  expectedFailure,
  jsxRuntimeFrom,
  transformFileSync,
  transformSync,
  readSource,
  resolveFile,
  resolveSpecTarget,
  stripStale,
  parser,
  installRequireHook,
  ROOT,
};
