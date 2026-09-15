const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../../scripts/spec-harness.ts');

function requireEsm(file) {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const module: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  new Function('module', 'exports', code)(module, module.exports);
  return module.exports;
}

const { getCodeForSave, shouldSyncCodeMirrorContent } = requireEsm('./utils.js');

assert.strictEqual(
  getCodeForSave({
    editorCode: 'output = { value: "latest" };',
    stateCode: 'output = { value: "stale" };',
  }),
  'output = { value: "latest" };',
);

assert.strictEqual(
  getCodeForSave({
    editorCode: undefined,
    stateCode: 'output = { value: "state" };',
  }),
  'output = { value: "state" };',
);

assert.strictEqual(
  shouldSyncCodeMirrorContent({
    codeChanged: true,
    fullCodeChanged: false,
    changedFromEditor: true,
  }),
  false,
);

assert.strictEqual(
  shouldSyncCodeMirrorContent({
    codeChanged: true,
    fullCodeChanged: false,
    changedFromEditor: false,
  }),
  true,
);

assert.strictEqual(
  shouldSyncCodeMirrorContent({
    codeChanged: false,
    fullCodeChanged: true,
    changedFromEditor: true,
  }),
  true,
);

assert.strictEqual(
  shouldSyncCodeMirrorContent({
    codeChanged: false,
    fullCodeChanged: false,
    changedFromEditor: false,
  }),
  false,
);

console.log('Code utils tests passed');
