const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');

function requireEsm(file, stubs = {}) {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const module: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function localRequire(request) {
    if (stubs[request]) {
      return stubs[request];
    }

    return require(request);
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire);
  return module.exports;
}

global.window = global.window || {};
window['langData-app-1'] = [{}];
global.safeParse =
  global.safeParse ||
  ((value, defaultValue = {}) => {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue === 'array' ? [] : defaultValue;
    }
  });

const { replaceAdvancedSettingTranslateInfo, replaceControlsTranslateInfo } = requireEsm('./translate.js', {
  'src/utils/app': {
    getTranslateInfo: () => ({
      name: 'translated name',
      confirmMsg: 'translated confirm',
      key1: 'translated item',
    }),
  },
});

assert.doesNotThrow(() =>
  replaceControlsTranslateInfo('app-1', 'worksheet-1', [
    {
      controlId: 'control-1',
      controlName: 'origin',
      type: 36,
      advancedSetting: {
        itemnames: '{bad json',
      },
    },
  ]),
);

assert.strictEqual(
  replaceControlsTranslateInfo('app-1', 'worksheet-1', [
    {
      controlId: 'control-1',
      controlName: 'origin',
      type: 36,
      advancedSetting: {
        itemnames: JSON.stringify([{ key: 'key1', value: 'origin item' }]),
      },
    },
  ])[0].advancedSetting.itemnames,
  JSON.stringify([{ key: 'key1', value: 'translated item' }]),
);

assert.doesNotThrow(() =>
  replaceAdvancedSettingTranslateInfo('app-1', 'worksheet-1', {
    doubleconfirm: '{bad json',
  }),
);

console.log('translate utils tests passed');
