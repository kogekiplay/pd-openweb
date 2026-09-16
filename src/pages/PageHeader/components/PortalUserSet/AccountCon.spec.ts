const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');

let createIntlTelInputOptions;
let createIntlTelInputCount = 0;

function createElement(type, props, ...children) {
  return { type, props: props || {}, children };
}

function hasClassName(tree, targetClassName) {
  if (!tree || typeof tree !== 'object') return false;
  const classNames = String(tree.props?.className || '').split(/\s+/);

  if (classNames.includes(targetClassName)) return true;

  return (tree.children || []).some(child => hasClassName(child, targetClassName));
}

function loadModule() {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const moduleLike: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'AccountCon.jsx'), {
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

    setState(nextState) {
      this.state = {
        ...this.state,
        ...nextState,
      };
    }
  }

  function localRequire(importPath) {
    if (importPath === 'react') {
      return { Component, createElement };
    }

    if (importPath === 'classnames') {
      return (...args) =>
        args
          .flatMap(arg => {
            if (!arg) return [];
            if (typeof arg === 'string') return [arg];
            return Object.keys(arg).filter(key => arg[key]);
          })
          .join(' ');
    }

    if (importPath === 'styled-components') {
      return {
        __esModule: true,
        default: {
          div: () => 'div',
        },
      };
    }

    if (importPath === 'ming-ui/components/PhoneNumberInput/util') {
      return {
        createIntlTelInput: (element, options) => {
          createIntlTelInputCount += 1;
          createIntlTelInputOptions = options;
          return { destroy: () => null };
        },
      };
    }

    if (importPath === 'ming-ui/functions') {
      return { captcha: function captcha() {} };
    }

    if (importPath === 'src/api/externalPortal') {
      return {};
    }

    if (importPath === 'src/pages/AuthService/config') {
      return {
        ActionResult: {},
        CodeTypeEnum: {},
      };
    }

    if (importPath === 'src/utils/common') {
      return {
        browserIsMobile: () => false,
        encrypt: value => value,
      };
    }

    return require(importPath);
  }

  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, localRequire);

  return moduleLike.exports.default || moduleLike.exports;
}

const AccountCon = loadModule();
const accountCon = new AccountCon({ inputType: 'phone' });
accountCon.mobile = { tagName: 'INPUT' };
// 【为什么这里要 as any，而不是往 types/spec-globals.d.ts 加一条】
// 那个文件收的是「除此之外没人声明过」的测试替身全局。$ 不属于这类：
// @types/jquery 已经把它声明成 `declare const $`（misc.d.ts:7325），
// const 形态的全局在 TS 里不会成为 globalThis 的属性，也不允许被赋值，
// 再加一条 declare var 会直接冲突。这里就是要塞一个假的 $，只能局部放宽。
(global as any).$ = () => ({ on: () => null });
global._l = text => text;

accountCon.itiFn();

assert.strictEqual(createIntlTelInputOptions.showDialCodeInput, true);
assert.strictEqual(hasClassName(accountCon.render(), 'telInputWrap'), true);

const hiddenAccountCon = new AccountCon({ inputType: 'phone', account: '+8613539937039', type: 2 });
hiddenAccountCon.mobile = { tagName: 'INPUT', focus: () => null };
createIntlTelInputCount = 0;

hiddenAccountCon.componentDidMount();
assert.strictEqual(createIntlTelInputCount, 0);

hiddenAccountCon.props = { inputType: 'phone', account: '', type: 3 };
hiddenAccountCon.componentDidUpdate({ inputType: 'phone', account: '+8613539937039', type: 2 });
assert.strictEqual(createIntlTelInputCount, 1);

console.log('PortalUserSet AccountCon tests passed');
