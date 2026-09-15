const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');

function requireEsm(file, stubs = {}) {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const module: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    presets: ['@babel/preset-react'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function localRequire(request) {
    if (stubs[request]) return stubs[request];
    return require(request);
  }

  new Function('module', 'exports', 'require', 'window', '_l', 'md', code)(
    module,
    module.exports,
    localRequire,
    global.window,
    global._l,
    global.md,
  );
  return module.exports;
}

global._l = text => text;
global.md = { global: { Account: { projects: [] } } };
global.window = { getSelection: () => null };

const styled = {
  div: () => 'div',
};

const { applySelectionRange } = requireEsm('./index.jsx', {
  'styled-components': { __esModule: true, default: styled },
  'src/utils/common': { browserIsMobile: () => false },
  '../../appSource': {
    fetchDefaultApps: () => [],
    readAppCache: () => null,
    searchApps: () => [],
    writeAppCache: () => null,
  },
  './AppMentionPopup': { __esModule: true, default: () => null },
});

const range = { range: true };

assert.doesNotThrow(() => {
  window.getSelection = () => null;
  applySelectionRange(range);
});

const calls = [];
window.getSelection = () => ({
  removeAllRanges: () => calls.push('removeAllRanges'),
  addRange: currentRange => calls.push(['addRange', currentRange]),
});

applySelectionRange(range);

assert.deepStrictEqual(calls, ['removeAllRanges', ['addRange', range]]);

console.log('MentionInput tests passed');
