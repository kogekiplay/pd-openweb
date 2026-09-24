const assert = require('assert');
const path = require('path');
const { jsxRuntimeFrom, transformFileSync } = require('../../../../../scripts/spec-harness.ts');

let createIntlTelInputOptions;

function loadModule() {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const moduleLike: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'index.js'), {
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
    if (importPath === 'react/jsx-runtime') return jsxRuntimeFrom(() => null, 'fragment');
    if (importPath === 'react') {
      return { Component, Fragment: 'fragment', createElement: () => null };
    }

    if (importPath === 'styled-components') {
      return {
        __esModule: true,
        default: {
          div: () => 'div',
          input: () => 'input',
        },
      };
    }

    if (importPath === 'ming-ui') {
      return {
        Button: () => null,
        Dialog: () => null,
        VerifyPasswordInput: () => null,
      };
    }

    if (importPath === 'ming-ui/components/PhoneNumberInput/util') {
      return {
        createIntlTelInput: (element, options) => {
          createIntlTelInputOptions = options;
          return { destroy: () => null };
        },
      };
    }

    if (importPath === 'ming-ui/components/FunctionWrap') {
      return component => component;
    }

    if (importPath === 'ming-ui/functions') {
      return { captcha: function captcha() {} };
    }

    if (importPath === 'src/api/account') {
      return {};
    }

    if (importPath === 'src/components/verifyPassword') {
      return () => null;
    }

    if (importPath === 'src/utils/expression') {
      return {
        isEmail: () => true,
        isPasswordValid: () => true,
      };
    }

    return require(importPath);
  }

  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, localRequire);

  return moduleLike.exports.default || moduleLike.exports;
}

const ValidateInfoCon = loadModule();
global._l = text => text;
const validateInfoCon = new ValidateInfoCon({ type: 'mobilePhone' });
validateInfoCon.mobile = { tagName: 'INPUT' };

validateInfoCon.initTel();

assert.strictEqual(createIntlTelInputOptions.showDialCodeInput, true);
console.log('Personal ValidateInfo tests passed');
