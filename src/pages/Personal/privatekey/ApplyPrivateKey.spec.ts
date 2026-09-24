const assert = require('assert');
const path = require('path');
const { jsxRuntimeFrom, transformFileSync } = require('../../../../scripts/spec-harness.ts');

function createElement(type, props, ...children) {
  return { type, props: props || {}, children };
}

function findNodeByType(tree, targetType) {
  if (!tree || typeof tree !== 'object') return null;
  if (tree.type === targetType) return tree;

  return (tree.children || []).reduce((result, child) => result || findNodeByType(child, targetType), null);
}

async function run() {
  let resolveApply;
  const applyPromise = new Promise(resolve => {
    resolveApply = resolve;
  });
  const applyLicenseCodeCalls = [];

  const Button = function Button() {};

  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const moduleLike: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'ApplyPrivateKey.js'), {
    babelrc: false,
    presets: ['@babel/preset-react'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  class Component {
    // 这是手写的 React 替身。字段在构造函数里赋值，TS 下必须显式声明，
    // 否则每一处 this.props / this.state 都是一条 TS2339。
    props: Record<string, any>;
    state: Record<string, any>;

    constructor(props) {
      this.props = props;
      this.state = {};
    }

    setState(nextState, callback) {
      this.state = {
        ...this.state,
        ...nextState,
      };
      callback && callback();
    }
  }

  function localRequire(importPath) {
    // JSX 走 automatic runtime（与 .babelrc 一致），jsx() 也要落到假 createElement
    if (importPath === 'react/jsx-runtime') return jsxRuntimeFrom(createElement, 'fragment');
    if (importPath === 'react') {
      return { Component, Fragment: 'fragment', createElement };
    }

    if (importPath === 'ming-ui') {
      return {
        Button,
        Dropdown: function Dropdown() {},
        Icon: function Icon() {},
        Input: function Input() {},
        RadioGroup: function RadioGroup() {},
      };
    }

    if (importPath === 'src/api/privateGuide') {
      return {
        applyLicenseCode: (...args) => {
          applyLicenseCodeCalls.push(args);
          return applyPromise;
        },
      };
    }

    if (importPath === 'src/utils/common') {
      return {
        getRequest: () => ({
          serverId: 'server-001',
          product: 'hap',
          v: '5.3',
        }),
      };
    }

    return require(importPath);
  }

  global._l = text => text;
  global.alert = () => null;

  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, localRequire);
  const ApplyPrivateKey = moduleLike.exports.default || moduleLike.exports;
  let closeCount = 0;
  const applyPrivateKey = new ApplyPrivateKey({
    product: 'hap',
    onClose: () => {
      closeCount += 1;
    },
  });

  applyPrivateKey.setState({
    projectName: 'Mingdao',
    job: 'Engineer',
  });

  applyPrivateKey.handleGenerateKey({ type: 'click' });
  applyPrivateKey.handleGenerateKey({ type: 'click' });

  assert.strictEqual(applyLicenseCodeCalls.length, 1);
  assert.strictEqual(findNodeByType(applyPrivateKey.render(), Button).props.disabled, true);

  resolveApply('license-code');
  await applyPromise;
  await Promise.resolve();

  assert.strictEqual(closeCount, 1);
}

run()
  .then(() => {
    console.log('ApplyPrivateKey tests passed');
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
