const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');

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

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire);
  return module.exports;
}

global._l = text => text;

const { handleCopyOptionClick } = requireEsm('./MoreOption.jsx', {
  react: {
    Component: class {},
    Fragment: 'Fragment',
    createElement: () => null,
  },
  'ming-ui': {
    Dialog: { confirm: () => null },
    Icon: () => null,
  },
  'ming-ui/components/ClickAway': {
    wrap: Component => Component,
  },
});

const calls = [];
handleCopyOptionClick({
  event: { stopPropagation: () => calls.push('stop') },
  setFn: value => calls.push(['setFn', value]),
  onCopy: () => calls.push('copy'),
});

assert.deepStrictEqual(calls, ['stop', ['setFn', { showMoreOption: false }], 'copy']);

console.log('MoreOption tests passed');
