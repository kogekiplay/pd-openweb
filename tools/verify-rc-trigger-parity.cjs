/**
 * rc-trigger 2.6.5 → 5.3.4 的等价性验证（DOM + 交互行为）。
 *
 * 为什么要做：仓里 282 个文件直接 import rc-trigger，213 处传 popupClassName，
 * 还有 .less 里一批 `.rc-trigger-popup-*` 规则。升级不改这些文件（API 完全兼容），
 * 所以必须证明【渲染出来的东西没变】。
 *
 * 升级的动因是去重：2.6.5 占着 hoist 位，逼得 antd 那一族的 8 个 rc-*
 * 各自嵌套一份 5.3.4，树里一共 9 份。升完只剩 1 份，并顺带清掉
 * rc-animate / css-animation / add-dom-event-listener / component-classes /
 * component-indexof 这 5 个只服务于 2.6.5 的传递依赖。
 *
 * 【风险已知且不在本脚本覆盖内】对齐与翻转（popupAlign / builtinPlacements
 * 的 overflow 调整）依赖真实布局测量，jsdom 里尺寸恒为 0，测不出来。
 * 缓解依据：antd 4.19 自己用的就是 rc-trigger 5.3.4，那 8 份嵌套副本在生产上
 * 已经跑了很久（每个 Select / Dropdown / Tooltip / DatePicker 都在用），
 * 所以这次不是引入未验证的版本，而是收敛到已在跑的版本。真机仍需抽查弹层定位。
 *
 * 运行方式（jsdom 装在仓库外，见其它 verify-* 脚本的说明）：
 *   JSDOM_PATH=/tmp/jsdom-for-verify/node_modules/jsdom node tools/verify-rc-trigger-parity.cjs
 *
 * 2.6.5 已随升级从树里消失，所以参照值是【冻结的 fixture】。重新生成：
 *   mkdir -p /tmp/rc-trigger-old && cd /tmp/rc-trigger-old \
 *     && echo '{"private":true}' > package.json && npm i rc-trigger@2.6.5
 *   cd <repo> && JSDOM_PATH=... RC_TRIGGER_OLD=/tmp/rc-trigger-old/node_modules/rc-trigger \
 *     node tools/verify-rc-trigger-parity.cjs --write-fixture
 */
const fs = require('fs');
const path = require('path');
const RW = path.resolve(__dirname, '..') + '/';
const FIXTURE = RW + 'tools/fixtures/rc-trigger-2.6.5.json';
const WRITE_FIXTURE = process.argv.includes('--write-fixture');

function loadJsdom() {
  for (const c of [process.env.JSDOM_PATH, RW + 'node_modules/jsdom', 'jsdom'].filter(Boolean)) {
    try {
      return require(c);
    } catch (e) {
      /* 试下一个 */
    }
  }

  console.error('找不到 jsdom。见文件头说明。');
  process.exit(2);
}
const { JSDOM } = loadJsdom();
const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true, url: 'https://example.test/' });
for (const k of [
  'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Text', 'getComputedStyle',
  'DOMParser', 'Range', 'Selection', 'MutationObserver', 'DOMRect', 'Event', 'KeyboardEvent',
  'MouseEvent', 'InputEvent', 'Window', 'HTMLDivElement', 'HTMLCollection', 'NodeList',
  'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k];
}
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// jsdom 不做布局；rc-align 的测量路径会直接调这些，缺了会在 rAF 里静默抛
const zeroRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
dom.window.Element.prototype.getBoundingClientRect = () => zeroRect;
dom.window.Element.prototype.getClientRects = () => Object.assign([], { length: 0, item: () => null });
global.IS_REACT_ACT_ENVIRONMENT = true;
// rc-trigger 2.6.5 用的是 legacy childContextTypes / findDOMNode，React 18 下会各刷一条
// 弃用警告。只在生成 fixture 时出现，压掉以免淹掉真正的断言。
const origErr = console.error;
console.error = (...a) => {
  if (typeof a[0] === 'string' && /(legacy childContextTypes|findDOMNode is deprecated)/.test(a[0])) return;

  origErr(...a);
};

const React = require(RW + 'node_modules/react');
const { createRoot } = require(RW + 'node_modules/react-dom/client');
const { act } = React;

// 与仓里最常见的用法一致
const PROPS = {
  action: ['click'],
  popupVisible: true,
  popupClassName: 'myPopupClass anotherClass',
  popupStyle: { width: 200 },
  zIndex: 1000,
  destroyPopupOnHide: false,
  maskClosable: true,
  popupAlign: { points: ['tl', 'bl'], offset: [0, 4], overflow: { adjustX: true, adjustY: true } },
  popup: () => React.createElement('div', { className: 'popupInner' }, '弹层内容'),
};

const normalize = html =>
  html
    // 2.6.5 会给触发器子元素加一个【空的】 style=""（它无条件展开 style: {}），
    // 5.3.4 不加。空 style 属性对渲染没有任何影响，归一化掉。
    .replace(/ style=""/g, '')
    .replace(/style="[^"]*"/g, 'style="<略>"')
    .replace(/\s(?:top|left|right|bottom):\s*-?[\d.]+px;?/g, '')
    .replace(/-(?:appear|enter|leave)(?:-(?:start|active|prepare))?/g, '-<motion>')
    // class 值里的尾随/重复空格是 classnames 拼接的产物（2.6.5 多一个尾随空格），
    // 对选择器匹配没有影响。
    .replace(/class="([^"]*)"/g, (m, v) => 'class="' + v.replace(/\s+/g, ' ').trim() + '"')
    .replace(/>\s+</g, '><')
    .trim();

const cleanup = () => {
  [...document.querySelectorAll('body > div')].filter(d => d.id !== 'root').forEach(d => d.remove());
  document.getElementById('root').innerHTML = '';
};

async function renderDom(Trigger) {
  const host = document.createElement('div');
  document.getElementById('root').appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(Trigger, PROPS, React.createElement('span', { className: 'triggerChild' }, '点我')));
  });
  await act(async () => {
    await new Promise(r => setTimeout(r, 50));
  });
  const child = normalize(host.innerHTML);
  const popup = normalize(
    [...document.querySelectorAll('body > div')]
      .filter(d => d.id !== 'root' && d.innerHTML.includes('popupInner'))
      .map(d => d.outerHTML)
      .join('\n'),
  );
  await act(async () => {
    root.unmount();
  });
  cleanup();

  return { child, popup };
}

async function renderBehaviour(Trigger) {
  const host = document.createElement('div');
  document.getElementById('root').appendChild(host);
  const container = document.createElement('div');
  container.id = 'myContainer';
  document.body.appendChild(container);
  const calls = [];
  const root = createRoot(host);
  await act(async () => {
    root.render(
      React.createElement(
        Trigger,
        {
          action: ['click'],
          // 必须给：rc-align 会读 points[1]，缺了会在 <Align> 里抛
          // TypeError: Cannot read properties of undefined (reading '1')
          popupAlign: { points: ['tl', 'bl'], offset: [0, 4] },
          onPopupVisibleChange: v => calls.push(v),
          getPopupContainer: () => container,
          popup: () => React.createElement('div', { className: 'popupInner' }, 'x'),
        },
        React.createElement('span', { className: 'triggerChild' }, '点我'),
      ),
    );
  });
  const childEl = host.querySelector('.triggerChild');
  const click = async () => {
    await act(async () => {
      childEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 30));
    });
  };
  await click();
  const opened = { inContainer: !!container.querySelector('.popupInner'), calls: [...calls] };
  await click();
  const closed = {
    hidden: !container.querySelector('.popupInner') || /hidden/.test(container.innerHTML),
    calls: [...calls],
  };
  await act(async () => {
    root.unmount();
  });
  container.remove();
  cleanup();

  return { opened, closed };
}

let pass = 0;
let fail = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log('  ' + (ok ? 'PASS ' : 'FAIL ') + label);

  if (!ok) {
    console.log('        参照(2.6.5): ' + JSON.stringify(want).slice(0, 400));
    console.log('        当前:        ' + JSON.stringify(got).slice(0, 400));
  }
}

(async () => {
  const cur = require(RW + 'node_modules/rc-trigger');
  const CurTrigger = cur.default || cur;
  const curVer = require(RW + 'node_modules/rc-trigger/package.json').version;

  let ref;

  if (WRITE_FIXTURE) {
    const oldDir = process.env.RC_TRIGGER_OLD;

    if (!oldDir) {
      console.error('--write-fixture 需要 RC_TRIGGER_OLD 指向装好的 2.6.5，见文件头说明。');
      process.exit(2);
    }

    const oldMod = require(oldDir);
    const OldTrigger = oldMod.default || oldMod;
    ref = {
      _note:
        '由真实 rc-trigger 2.6.5 渲染出的归一化 DOM 与交互结果，用于在 2.6.5 从依赖树里' +
        '消失之后继续守住「5.x 的渲染与行为与它一致」。重新生成方式见 tools/verify-rc-trigger-parity.cjs 文件头。',
      generatedFrom: require(oldDir + '/package.json').version,
      dom: await renderDom(OldTrigger),
      behaviour: await renderBehaviour(OldTrigger),
    };
    fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
    fs.writeFileSync(FIXTURE, JSON.stringify(ref, null, 2) + '\n');
    console.log('已写入 fixture：' + FIXTURE.replace(RW, '') + '（来自 ' + ref.generatedFrom + '）\n');
  } else {
    ref = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  }

  console.log('参照 rc-trigger ' + ref.generatedFrom + '  ↔  当前 ' + curVer + '\n');

  const dom2 = await renderDom(CurTrigger);
  check('触发器自身的 DOM', dom2.child, ref.dom.child);
  check('弹层 DOM（结构 + 类名）', dom2.popup, ref.dom.popup);

  const be2 = await renderBehaviour(CurTrigger);
  check('点击后弹层进入 getPopupContainer 指定的容器', be2.opened, ref.behaviour.opened);
  check('再次点击后收起 + onPopupVisibleChange 序列', be2.closed, ref.behaviour.closed);

  console.log('\n  → PASS ' + pass + ' / FAIL ' + fail);
  console.log('  提醒：对齐/翻转依赖真实布局，jsdom 测不了，需真机抽查弹层定位。');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
