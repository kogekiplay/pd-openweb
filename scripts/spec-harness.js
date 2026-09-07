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

function babelPresets(file, extra = []) {
  const isTSX = /\.tsx$/.test(file);
  const isTS = /\.tsx?$/.test(file);
  const presets = extra.filter(p => {
    const name = Array.isArray(p) ? p[0] : p;
    return !String(name).includes('preset-typescript');
  });
  if (!presets.some(p => String(Array.isArray(p) ? p[0] : p).includes('preset-react'))) {
    presets.push('@babel/preset-react');
  }
  if (isTS) presets.push(['@babel/preset-typescript', { isTSX, allExtensions: true }]);
  return presets;
}

/**
 * Drop-in replacement for `require('@babel/core').transformFileSync`.
 * Specs swap only their `require('@babel/core')` line; call sites are untouched.
 */
function transformFileSync(filePath, opts = {}) {
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
function transformSync(code, opts = {}) {
  const file = opts.filename || 'unknown.tsx';
  return babel.transformSync(code, {
    ...opts,
    babelrc: false,
    configFile: false,
    presets: babelPresets(file, opts.presets || []),
    plugins: opts.plugins || ['@babel/plugin-transform-modules-commonjs'],
  });
}

/** Read a source file as text, re-resolving a stale extension. Used by the text-assert specs. */
function readSource(...parts) {
  return fs.readFileSync(resolveSpecTarget(path.join(...parts)), 'utf8');
}

/** `@babel/parser` with the `typescript` plugin forced on, for the AST-walking spec. */
const parser = {
  ...realParser,
  parse(code, opts = {}) {
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
