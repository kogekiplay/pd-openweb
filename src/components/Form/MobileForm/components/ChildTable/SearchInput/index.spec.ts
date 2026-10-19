const assert = require('assert');
const path = require('path');
const { mock } = require('node:test');
const { transformFileSync } = require('../../../../../../../scripts/spec-harness.ts');

function requireEsm(file, stubs = {}) {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const module: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    presets: ['@babel/preset-env', '@babel/preset-react'],
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

function findByType(node, type) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findByType(child, type);
      if (result) return result;
    }

    return null;
  }

  if (node.type === type) return node;

  return findByType(node.props && node.props.children, type);
}

function createSearchInput(props) {
  const SearchInput = requireEsm('./index.js', {
    './index.less': {},
  }).default;
  const component = new SearchInput({
    ...SearchInput.defaultProps,
    ...props,
  });

  component.setState = (nextState, callback) => {
    Object.assign(
      component.state,
      typeof nextState === 'function' ? nextState(component.state, component.props) : nextState,
    );
    if (callback) callback();
  };

  return component;
}

global._l = global._l || (text => text);

(async function run() {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const debouncedCalls = [];
  const debouncedInput = createSearchInput({
    debounceTime: 20,
    onOk: value => debouncedCalls.push(value),
  });
  const debouncedInputNode = findByType(debouncedInput.render(), 'input');

  debouncedInputNode.props.onChange({ target: { value: 'a' } });
  debouncedInputNode.props.onChange({ target: { value: 'ab' } });

  mock.timers.tick(19);
  assert.deepStrictEqual(debouncedCalls, [], '输入变化后不应立即搜索');

  mock.timers.tick(1);
  assert.deepStrictEqual(debouncedCalls, ['ab'], '防抖后应只搜索最后一次输入');
  debouncedInput.componentWillUnmount();

  const enterCalls = [];
  const enterInput = createSearchInput({
    debounceTime: 20,
    onOk: value => enterCalls.push(value),
  });
  const enterInputNode = findByType(enterInput.render(), 'input');

  enterInputNode.props.onChange({ target: { value: 'abc' } });
  enterInputNode.props.onKeyUp({ keyCode: 13, target: { value: 'abc' } });

  assert.deepStrictEqual(enterCalls, ['abc'], '回车应立即搜索');
  mock.timers.tick(30);
  assert.deepStrictEqual(enterCalls, ['abc'], '回车应取消待执行防抖并立即搜索一次');
  enterInput.componentWillUnmount();

  const viewChangeCalls = [];
  const viewChangeInput = createSearchInput({
    viewId: 'view-1',
    debounceTime: 20,
    onOk: value => viewChangeCalls.push(value),
  });
  const viewChangeInputNode = findByType(viewChangeInput.render(), 'input');

  viewChangeInputNode.props.onChange({ target: { value: 'old' } });
  viewChangeInput.props = {
    ...viewChangeInput.props,
    viewId: 'view-2',
  };
  viewChangeInput.componentDidUpdate({ ...viewChangeInput.props, viewId: 'view-1' });

  mock.timers.tick(30);
  assert.deepStrictEqual(viewChangeCalls, [], '视图切换清空搜索时应取消待执行防抖');
  viewChangeInput.componentWillUnmount();

  const unmountCalls = [];
  const unmountInput = createSearchInput({ debounceTime: 20, onOk: value => unmountCalls.push(value) });
  findByType(unmountInput.render(), 'input').props.onChange({ target: { value: 'pending' } });
  unmountInput.componentWillUnmount();
  mock.timers.tick(30);
  assert.deepStrictEqual(unmountCalls, [], '卸载应取消待执行防抖');

  console.log('mobile SearchInput tests passed');
})()
  .finally(() => mock.timers.reset())
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
