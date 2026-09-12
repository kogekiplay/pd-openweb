/**
 * MenuItem 必须把鼠标事件【透传】给 props.onMouseEnter / onMouseLeave。
 *
 * 【这条 spec 在防什么】MenuItem 被 @rc-component/trigger 当作子元素时，
 * 那两个 prop 就是 trigger 自己的回调，它里面直接读 event.clientX：
 *   const setMousePosByEvent = event => { setMousePos([event.clientX, event.clientY]); };
 *   （@rc-component/trigger es/index.js:251，【没有任何守卫】，
 *     且 onMouseEnterCallback 是无条件调用它的，不受 alignPoint 影响）
 * 一旦这里写成 `onMouseEnter={() => this.handleMouseEnter()}` 把事件吞掉，
 * trigger 拿到 undefined，当场抛
 *   TypeError: Cannot read properties of undefined (reading 'clientX')
 * 带子菜单的菜单项（如工作表视图右键菜单里的「导出」）一 hover 就崩。
 *
 * 【为什么以前没事】旧的 rc-trigger 5.x 对应的 setPoint 有双重守卫：
 *   setPoint(point) { if (!alignPoint || !point) return; ... }   （es/index.js:396）
 * 迁到继任包后守卫没了，这个一直存在的「吞事件」才真正发作 ——
 * 也就是说，类型检查和构建都不会提示，只有运行时 hover 才炸。
 *
 * 做法：把 MenuItem 内部渲染的 Item 打桩，捕获它收到的 props，
 * 再直接调用捕获到的 onMouseEnter。不需要 DOM，也就不需要给 spec 套件引入 jsdom。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { transformSync, resolveSpecTarget } = require('../../../scripts/spec-harness');

global._l = text => text;

// 捕获 Item 收到的 props
let itemProps = null;
const ItemStub = props => {
  itemProps = props;
  return React.createElement('div', null, props.children);
};

function loadMenuItem() {
  const resolvedPath = resolveSpecTarget(path.join(__dirname, 'MenuItem.jsx'));
  const moduleLike = { exports: {} };
  const { code } = transformSync(fs.readFileSync(resolvedPath, 'utf8'), {
    // filename 是【必需】的：preset-typescript 靠它区分 TS / TSX
    filename: resolvedPath,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function localRequire(request) {
    if (request === './Item') return { __esModule: true, default: ItemStub };
    if (request.endsWith('.less')) return {};
    return require(request);
  }

  new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, localRequire);
  return moduleLike.exports.default || moduleLike.exports;
}

const MenuItem = loadMenuItem();

// ---------------------------------------------------------------- onMouseEnter
{
  const received = [];
  ReactDOMServer.renderToString(
    React.createElement(MenuItem, { onMouseEnter: (...args) => received.push(args) }, 'x'),
  );

  assert.ok(itemProps, 'Item 没有拿到 props —— MenuItem 的内部结构变了，请同步改这条 spec');
  assert.strictEqual(typeof itemProps.onMouseEnter, 'function', 'Item 应当收到 onMouseEnter');

  // 模拟真实的鼠标事件对象：trigger 只关心 clientX / clientY
  const event = { clientX: 123, clientY: 456 };
  itemProps.onMouseEnter(event);

  assert.strictEqual(received.length, 1, 'props.onMouseEnter 应当被调用一次');
  assert.strictEqual(
    received[0][0],
    event,
    'props.onMouseEnter 必须拿到【原始事件对象】。写成 () => this.handleMouseEnter() 会把它吞掉，' +
      '@rc-component/trigger 随即在 setMousePosByEvent 里读 undefined.clientX 崩掉',
  );
}

// ---------------------------------------------------------------- onMouseLeave
{
  itemProps = null;
  const received = [];
  ReactDOMServer.renderToString(
    React.createElement(MenuItem, { onMouseLeave: (...args) => received.push(args) }, 'x'),
  );

  const event = { clientX: 7, clientY: 8 };
  itemProps.onMouseLeave(event);

  assert.strictEqual(received.length, 1, 'props.onMouseLeave 应当被调用一次');
  assert.strictEqual(received[0][0], event, 'props.onMouseLeave 同样必须拿到原始事件对象');
}

console.log('MenuItem mouse-event forwarding tests passed');
