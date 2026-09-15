const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');

function requireEsm(file) {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const module: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  new Function('module', 'exports', 'require', code)(module, module.exports, require);
  return module.exports;
}

const { parseStreamingJsonlData } = requireEsm('./sse.js');

assert.deepStrictEqual(parseStreamingJsonlData('{"id":"001","value":1}\n', false), [{ id: '001', value: 1 }]);

console.log('sse utils tests passed');
