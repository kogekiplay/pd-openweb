const assert = require('assert');
const path = require('path');
const { jsxRuntimeFrom, transformFileSync } = require('../../../../scripts/spec-harness.ts');

function requireMobileCityPicker() {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const moduleLike: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'MobileCityPciker.jsx'), {
    babelrc: false,
    presets: ['@babel/preset-env', '@babel/preset-react'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function localRequire(importPath) {
    // JSX 走 automatic runtime（与 .babelrc 一致），jsx() 也要落到假 createElement
    if (importPath === 'react/jsx-runtime') return jsxRuntimeFrom(() => null, 'Fragment');
    if (importPath === 'react') {
      class Component {
        // 手写的 React 替身，字段要显式声明（见其它 spec 同样处理）
        props: Record<string, any>;
        state: Record<string, any>;

        constructor(props) {
          this.props = props;
          this.state = {};
        }

        setState(nextState) {
          this.state = { ...this.state, ...(typeof nextState === 'function' ? nextState(this.state) : nextState) };
        }
      }

      return {
        __esModule: true,
        default: { Component, Fragment: 'Fragment', createElement: () => null },
        Component,
        Fragment: 'Fragment',
        createElement: () => null,
      };
    }

    if (importPath === 'lodash') {
      return require('lodash');
    }

    if (importPath === 'prop-types') {
      return new Proxy({}, { get: () => () => null });
    }

    if (importPath === 'ming-ui') {
      return {
        Icon: 'Icon',
        LoadDiv: 'LoadDiv',
        MobileSearch: 'MobileSearch',
        PopupWrapper: 'PopupWrapper',
        Radio: 'Radio',
      };
    }

    if (importPath.endsWith('.less')) {
      return {};
    }

    return require(importPath);
  }

  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, localRequire);
  return moduleLike.exports;
}

global._l = global._l || (text => text);

const { getConfirmDisable } = requireMobileCityPicker();

assert.strictEqual(
  getConfirmDisable({
    select: [{ id: '110100', path: '北京市/北京市', last: false }],
    mustLast: true,
    level: 3,
    indexLevel: 2,
  }),
  true,
  '必须选择最后一级时，未选到配置层级前应禁用确定按钮',
);

assert.strictEqual(
  getConfirmDisable({
    select: [{ id: '110101', path: '北京市/北京市/东城区', last: false }],
    mustLast: true,
    level: 3,
    indexLevel: 3,
  }),
  false,
  '必须选择最后一级时，达到配置层级应允许点击确定按钮',
);

assert.strictEqual(
  getConfirmDisable({
    select: [{ id: '110100', path: '北京市/北京市', last: false }],
    mustLast: true,
    level: 2,
    indexLevel: 2,
  }),
  false,
  '配置为省市时，选中城市节点应允许点击确定按钮',
);

assert.strictEqual(
  getConfirmDisable({
    select: [{ id: '110101', path: '北京市/北京市/东城区', last: true }],
    mustLast: true,
    level: 3,
    indexLevel: 3,
  }),
  false,
  '选择最后一级时应允许点击确定按钮',
);

assert.strictEqual(
  getConfirmDisable({
    select: [{ id: '110100', path: '北京市/北京市', last: false }],
    mustLast: false,
    level: 3,
    indexLevel: 2,
  }),
  false,
  '未开启必须选择最后一级时，选择任意层级后应允许确定',
);

console.log('Mobile city picker tests passed');
