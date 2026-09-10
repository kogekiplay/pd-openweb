/**
 * DragSource / DropTarget 兼容层的差分实测：真 react-dnd@11 的装饰器 ↔ 本仓的 v16 兼容层。
 *
 * 为什么必须有这个：react-dnd v14 把 DragSource / DropTarget 装饰器彻底删掉了，
 * 官方没有替代包，本仓仅剩的 5 个使用方全在【任务清单拖拽排序】和【甘特图拖拽】里。
 * 这两处一拖就写真实业务数据，生产环境上不允许试拖 —— 也就是说这次升级里
 * 风险最高的改动恰好没有线上验证手段。所以把它搬到离线环境里做差分。
 *
 * 判据不是「能跑起来」，而是【两版的 spec 回调序列逐条一致】：
 *   - beginDrag / hover / endDrag 的调用顺序与次数
 *   - 每次调用拿到的 props（第 1 参）是不是当次渲染的最新值
 *   - 第 3 参 component 是不是【被装饰的那个类实例】
 *     （本仓 checklist / checklistItem 真的在用它：beginDrag 和 hover 会调
 *      component.getNode() 拿 DOM 算悬停位置。少了它拖拽位置会全错，而且不报错。）
 *   - collect(connect, monitor) 出来的 connectDragSource / connectDropTarget
 *     能不能像 v11 那样直接包住一个 React 元素
 *   - 组合顺序 DragSource(DropTarget(C)) 下，两层各自拿到的 props 是否与 v11 一致
 *
 * 被测组件是【照着 checklist.tsx 的真实用法】写的最小复刻：类组件 + getNode() +
 * connectDragSource(connectDropTarget(<div/>))，而不是随手编一个 —— 差分只有在
 * 复刻了真实用法时才说明问题。
 *
 * 运行（两侧 react-dnd 都装在仓外，react 软链回本仓避免两份实例）：
 *   mkdir -p /tmp/dnd11 && cd /tmp/dnd11 && echo '{"private":true}' > package.json \
 *     && npm i react-dnd@11.1.3 react-dnd-test-backend@11.1.3
 *   （/tmp/dnd16 同理，装 16.0.1）
 *   cd /tmp/dndNN/node_modules && for p in react react-dom scheduler; do \
 *     rm -rf $p && ln -s <repo>/node_modules/$p $p; done
 *   cd <repo> && JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom \
 *     node tools/verify-dnd-legacy-decorators.cjs
 */
const fs = require('fs');
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';

function loadJsdom() {
  for (const c of [process.env.JSDOM_PATH, RW + 'node_modules/jsdom', 'jsdom'].filter(Boolean)) {
    try {
      return require(c);
    } catch (e) {
      /* 试下一个 */
    }
  }

  console.error('找不到 jsdom，见其它 verify-* 脚本文件头。');
  process.exit(2);
}
const { JSDOM } = loadJsdom();
const dom = new JSDOM('<!doctype html><div id="app"></div>', { pretendToBeVisual: true, url: 'https://example.test/' });
for (const k of [
  'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Text', 'getComputedStyle',
  'DOMParser', 'Range', 'Selection', 'MutationObserver', 'DOMRect', 'Event', 'CustomEvent',
  'KeyboardEvent', 'MouseEvent', 'Window', 'location', 'history', 'localStorage', 'sessionStorage',
  'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k];
}
global.self = global.window;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require(RW + 'node_modules/react');
const { createRoot } = require(RW + 'node_modules/react-dom/client');
const babel = require(RW + 'node_modules/@babel/core');

const DND11 = process.env.DND11 || '/tmp/dnd11/node_modules';
const DND16 = process.env.DND16 || '/tmp/dnd16/node_modules';

for (const d of [DND11, DND16]) {
  if (!fs.existsSync(d)) {
    console.error(`找不到 ${d}，见本文件头的安装说明。`);
    process.exit(2);
  }
}

/* ---------- 被测组件：照抄 checklist.tsx 的真实用法 ---------- */

const log = [];
const record = (e, ...rest) => log.push([e, ...rest]);

// 与 checklist.tsx / checklistItem.tsx 里的同名辅助函数【逐字一致】。
// 它先判 component.getNode 存在再调 —— 这个判断本身就是判据的一部分：
// v11 下 DragSource 那层拿到的 component 没有 getNode，走的是 null 分支。
const getNode = component => (component && component.getNode ? component.getNode() : null);

// 两版共用同一份 spec —— 差分比的是「装饰器怎么调 spec」，spec 本身必须一模一样
const makeSource = () => ({
  beginDrag(props, monitor, component) {
    const node = getNode(component);

    record('beginDrag', { index: props.index, hasComponent: !!component, node: node ? node.className : null });

    return { index: props.index };
  },
  isDragging(props, monitor) {
    const item = monitor.getItem();

    return !!item && item.index === props.index;
  },
  endDrag(props, monitor, component) {
    record('endDrag', { index: props.index, hasComponent: !!component, dropped: monitor.didDrop() });
  },
});

const makeTarget = () => ({
  hover(props, monitor, component) {
    const node = getNode(component);

    record('hover', {
      index: props.index,
      dragIndex: (monitor.getItem() || {}).index,
      hasComponent: !!component,
      node: node ? node.className : null,
    });
  },
  drop(props, monitor, component) {
    record('drop', { index: props.index, hasComponent: !!component });

    return { droppedOn: props.index };
  },
});

function makeInner(React) {
  return class Row extends React.Component {
    node = null;
    getNode = () => this.node;
    render() {
      const { connectDragSource, connectDropTarget, isDragging, isOver } = this.props;
      handlerIds[this.props.index] = {
        source: this.props.sourceHandlerId,
        target: this.props.targetHandlerId,
      };

      return connectDragSource(
        connectDropTarget(
          React.createElement('div', {
            className: `row-${this.props.index}`,
            ref: n => (this.node = n),
            'data-dragging': String(!!isDragging),
            'data-over': String(!!isOver),
          }),
        ),
      );
    }
  };
}

const collectSource = (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging(),
  // TestBackend 要按 handlerId 驱动，从 collect 里带出来（v11 / v16 的 monitor 都有）
  sourceHandlerId: monitor.getHandlerId(),
});
const collectTarget = (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop(),
  targetHandlerId: monitor.getHandlerId(),
});

// 渲染时把每一行的 handlerId 记下来，供下面驱动 TestBackend 用（不进差分日志）
const handlerIds = [];

/* ---------- 加载本仓的兼容层（TS/JSX 要过 babel） ---------- */

const Module = require('module');
function compileTs(module, filename) {
  const { code } = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [
      [RW + 'node_modules/@babel/preset-env', { targets: { node: 'current' } }],
      [RW + 'node_modules/@babel/preset-react', { runtime: 'classic' }],
      [RW + 'node_modules/@babel/preset-typescript', { onlyRemoveTypeImports: true }],
    ],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  module._compile(code, filename);
}
Module._extensions['.ts'] = compileTs;
Module._extensions['.tsx'] = compileTs;

// 兼容层里 `import { useDrag } from 'react-dnd'` 必须解析到【16】那一份，
// hoist-non-react-statics 用本仓的
const origResolve = Module._resolveFilename;
let dndTarget = DND16;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'react-dnd') return origResolve.call(this, dndTarget + '/react-dnd', parent, ...rest);

  if (request === 'react' || request === 'react-dom') {
    return origResolve.call(this, RW + 'node_modules/' + request, parent, ...rest);
  }

  if (request === 'hoist-non-react-statics') {
    return origResolve.call(this, RW + 'node_modules/hoist-non-react-statics', parent, ...rest);
  }

  return origResolve.call(this, request, parent, ...rest);
};

/* ---------- 跑一遍完整的拖放 ---------- */

async function run(which) {
  log.length = 0;

  const dndPath = which === 'v11' ? DND11 : DND16;
  const dnd = require(dndPath + '/react-dnd');
  const { TestBackend } = require(dndPath + '/react-dnd-test-backend');

  let DragSource;
  let DropTarget;

  if (which === 'v11') {
    DragSource = dnd.DragSource;
    DropTarget = dnd.DropTarget;
  } else {
    dndTarget = DND16;
    delete require.cache[RW + 'src/components/dnd/legacyDecorators.tsx'];
    const shim = require(RW + 'src/components/dnd/legacyDecorators.tsx');
    DragSource = shim.DragSource;
    DropTarget = shim.DropTarget;
  }

  const Inner = makeInner(React);
  const Row = DragSource('ROW', makeSource(), collectSource)(DropTarget('ROW', makeTarget(), collectTarget)(Inner));

  let manager = null;
  const CaptureManager = () => {
    manager = dnd.useDragDropManager ? dnd.useDragDropManager() : null;

    return null;
  };

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  const App = ({ n }) =>
    React.createElement(
      dnd.DndProvider,
      { backend: TestBackend },
      React.createElement(CaptureManager),
      ...Array.from({ length: n }, (_, i) => React.createElement(Row, { key: i, index: i, label: `row${i}` })),
    );

  await React.act(async () => {
    root.render(React.createElement(App, { n: 3 }));
  });
  await React.act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

  const backend = manager.getBackend();

  // 从第 0 行拖到第 1 行上并放下 —— 与清单排序的真实动作一致
  await React.act(async () => {
    backend.simulateBeginDrag([handlerIds[0].source], { clientOffset: { x: 0, y: 0 }, getSourceClientOffset: () => ({ x: 0, y: 0 }) });
  });
  await React.act(async () => {
    backend.simulateHover([handlerIds[1].target], { clientOffset: { x: 0, y: 30 } });
  });
  await React.act(async () => {
    backend.simulateDrop();
  });
  await React.act(async () => {
    backend.simulateEndDrag();
  });

  root.unmount();
  host.remove();

  return log.slice();
}

(async () => {
  console.log('  这一步只验兼容层本身，业务组件不参与（见文件头）\n');

  const a = await run('v11');
  const b = await run('v16');

  console.log('  react-dnd@11 装饰器 的回调序列:');
  a.forEach(e => console.log('    ' + JSON.stringify(e)));
  console.log('\n  本仓兼容层(v16) 的回调序列:');
  b.forEach(e => console.log('    ' + JSON.stringify(e)));

  // 【下限断言】两边都空也会「一致」—— 这种假通过在本仓的其它差分里踩过，
  // 所以先确认这一趟拖放确实把四个回调都走到了，再谈一致不一致。
  const kinds = new Set(a.map(e => e[0]));
  const missing = ['beginDrag', 'hover', 'drop', 'endDrag'].filter(k => !kinds.has(k));

  if (missing.length) {
    console.log(`\n  !! v11 基线里没跑到 ${missing.join('/')} —— 说明 harness 没真正驱动起拖放，`);
    console.log('     此时的「一致」没有意义。请先修 harness。');
    process.exit(2);
  }

  const same = JSON.stringify(a) === JSON.stringify(b);
  console.log(`\n  → ${same ? `一致（${a.length} 次回调逐条相同）` : '不一致'}`);
  process.exit(same ? 0 : 1);
})();
