const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../../scripts/spec-harness.ts');

function requireEsm(file) {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const module: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    presets: ['@babel/preset-react'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  new Function('module', 'exports', 'require', code)(module, module.exports, require);
  return module.exports.default || module.exports;
}

global._l = (text, ...args) => args.reduce((result, value, index) => result.replace(`%${index}`, value), text);

const CountDown = requireEsm('./CountDown.jsx');

let nextTimerId = 1;
const activeTimers = new Set();
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

// 替身只接 (callback, delay) 两个参数，跟 Node 的 setInterval 重载签名对不上；
// spec 只需要拦住定时器，用 any 接住这个刻意的简化
(global as any).setInterval = (callback, delay) => {
  assert.strictEqual(delay, 60000);
  const id = nextTimerId++;
  activeTimers.add(id);
  return id;
};

global.clearInterval = id => {
  activeTimers.delete(id);
};

try {
  const firstEndDate = new Date(Date.now() + 60 * 60 * 1000);
  const secondEndDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const instance = new CountDown({ endDate: firstEndDate });

  instance.setState = function (state, callback) {
    this.state = {
      ...this.state,
      ...(typeof state === 'function' ? state(this.state, this.props) : state),
    };
    if (callback) {
      callback();
    }
  };

  instance.componentDidMount();
  assert.strictEqual(activeTimers.size, 1);

  instance.props = { endDate: secondEndDate };
  instance.componentDidUpdate({ endDate: firstEndDate });
  assert.strictEqual(activeTimers.size, 1);

  instance.componentWillUnmount();
  assert.strictEqual(activeTimers.size, 0);
} finally {
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
}

console.log('CountDown tests passed');
