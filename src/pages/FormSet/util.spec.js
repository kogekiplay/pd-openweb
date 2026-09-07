const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { transformSync, resolveSpecTarget } = require('../../../scripts/spec-harness');

global._l = text => text;

const moduleCache = new Map();

function requireSource(filePath) {
  // resolveSpecTarget handles both the extensionless case and a stale .js/.jsx
  // left over from before the TS codemod. See scripts/spec-harness.js.
  const resolvedPath = resolveSpecTarget(filePath);

  if (moduleCache.has(resolvedPath)) {
    return moduleCache.get(resolvedPath).exports;
  }

  const moduleLike = { exports: {} };
  moduleCache.set(resolvedPath, moduleLike);
  const { code } = transformSync(fs.readFileSync(resolvedPath, 'utf8'), {
    // filename is load-bearing: preset-typescript infers TS vs TSX from it.
    filename: resolvedPath,
    babelrc: false,
    presets: ['@babel/preset-react'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function localRequire(request) {
    if (request === 'react') {
      return { __esModule: true, default: { createElement: () => null } };
    }

    if (request.startsWith('.')) {
      return requireSource(path.resolve(path.dirname(resolvedPath), request));
    }

    if (request.startsWith('src/')) {
      return requireSource(path.resolve(__dirname, '../../..', request));
    }

    return require(request);
  }

  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, localRequire);
  return moduleLike.exports;
}

const { permitList } = requireSource(path.join(__dirname, 'config.js'));
const { allSwitchKeys } = requireSource(path.join(__dirname, 'containers/FunctionalSwitch/config.js'));
const { isOpenPermit } = requireSource(path.join(__dirname, 'util.js'));

assert.strictEqual(permitList.filterSwitch, 1001);
assert.strictEqual(permitList.statsSwitch, 1002);
assert(allSwitchKeys.includes(permitList.filterSwitch));
assert(allSwitchKeys.includes(permitList.statsSwitch));

const legacySwitches = [{ type: permitList.createButtonSwitch, state: true, viewIds: [] }];
assert.strictEqual(isOpenPermit(permitList.filterSwitch, legacySwitches), true);
assert.strictEqual(isOpenPermit(permitList.statsSwitch, legacySwitches), true);

const deniedSwitches = [
  ...legacySwitches,
  { type: permitList.filterSwitch, state: false, viewIds: [] },
  { type: permitList.statsSwitch, state: false, viewIds: [] },
];
assert.strictEqual(isOpenPermit(permitList.filterSwitch, deniedSwitches, 'view-id'), false);
assert.strictEqual(isOpenPermit(permitList.statsSwitch, deniedSwitches, 'view-id'), false);

console.log('FormSet permission util tests passed');
