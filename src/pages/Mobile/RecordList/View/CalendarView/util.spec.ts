const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../../scripts/spec-harness.ts');

global._l = global._l || (text => text);

function requireEsm(file, stubs = {}) {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const module: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function localRequire(request) {
    if (stubs[request]) return stubs[request];
    return require(request);
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire);
  return module.exports;
}

const { getFormateView } = requireEsm('./util.js');

const view = getFormateView(
  {
    displayControls: ['name'],
    advancedSetting: {
      viewtitle: 'label',
      showcount: '5',
    },
  },
  {
    startData: { controlId: 'start' },
    endData: { controlId: 'end' },
  },
);

assert.deepStrictEqual(view.displayControls, ['start', 'end', 'name']);
assert.strictEqual(view.advancedSetting.viewtitle, '');
assert.strictEqual(view.advancedSetting.showcount, '5');

const viewWithoutEnd = getFormateView(
  {
    displayControls: ['start', 'name'],
    advancedSetting: {},
  },
  {
    startData: { controlId: 'start' },
    endData: {},
  },
);

assert.deepStrictEqual(viewWithoutEnd.displayControls, ['start', 'name']);

const notScheduledView = getFormateView({
  displayControls: ['name'],
  advancedSetting: {
    viewtitle: 'label',
  },
});

assert.deepStrictEqual(notScheduledView.displayControls, ['name']);
assert.strictEqual(notScheduledView.advancedSetting.viewtitle, '');

console.log('mobile CalendarView util tests passed');
