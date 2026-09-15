const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../../../scripts/spec-harness.ts');

// 一个够用的 viewport 假件：只实现 GunterScroll 真正读写的那几个属性，
// 外加事件订阅，好让 spec 能手动触发原生 scroll。
function makeViewport({ scrollWidth = 1000, clientWidth = 400, scrollHeight = 800, clientHeight = 300 } = {}) {
  const handlers = [];
  return {
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth,
    clientWidth,
    scrollHeight,
    clientHeight,
    addEventListener(type, fn) {
      if (type === 'scroll') handlers.push(fn);
    },
    removeEventListener(type, fn) {
      const i = handlers.indexOf(fn);
      if (i > -1) handlers.splice(i, 1);
    },
    /** 模拟浏览器派发一次 scroll */
    fireScroll() {
      [...handlers].forEach(fn => fn());
    },
    handlerCount() {
      return handlers.length;
    },
  };
}

let viewport;
let destroyed = 0;
let updated = 0;

function requireEsm(file, stubs = {}) {
  // exports 上挂的是被测模块的导出，形状由被测代码决定；不标类型
  // 的话推成 {}，下游每读一个导出都是一条 TS2339。
  const module: { exports: Record<string, any> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function localRequire(request) {
    if (request in stubs) return stubs[request];
    return require(request);
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire);
  return module.exports;
}

// rAF 在 node 下不存在；GunterScroll 用它做抑制标志的兜底解除。
// 这里手动收集回调，spec 自己决定什么时候「进入下一帧」。
const rafQueue = [];
global.requestAnimationFrame = fn => {
  rafQueue.push(fn);
  return rafQueue.length;
};
function nextFrame() {
  const queued = rafQueue.splice(0);
  queued.forEach(fn => fn());
}

viewport = makeViewport();

const GunterScroll = requireEsm('./index.ts', {
  overlayscrollbars: {
    OverlayScrollbars: () => ({
      elements: () => ({ viewport }),
      update: () => {
        updated += 1;
      },
      destroy: () => {
        destroyed += 1;
      },
    }),
  },
  'overlayscrollbars/styles/overlayscrollbars.css': {},
}).default;

const scroll = new GunterScroll({});

// ── 坐标约定：x/y 与 scrollLeft/scrollTop 反号 ───────────────────────
// 甘特图有 8 个文件依赖这个符号（translateX(${x}px) / Math.abs(x)），错一个负号就是静默错位。
viewport.scrollLeft = 120;
viewport.scrollTop = 40;
assert.strictEqual(scroll.x, -120);
assert.strictEqual(scroll.y, -40);

// maxScrollX 也是负值：-(内容宽 - 可视宽)
assert.strictEqual(scroll.maxScrollX, -600);
assert.strictEqual(scroll.maxScrollY, -500);
assert.strictEqual(scroll.wrapperWidth, 400);
assert.strictEqual(scroll.scrollerWidth, 1000);
assert.strictEqual(scroll.hasHorizontalScroll, true);
assert.strictEqual(scroll.hasVerticalScroll, true);

// ── scrollTo 收负值，写进去是正的 scrollLeft ─────────────────────────
scroll.scrollTo(-300, -50);
assert.strictEqual(viewport.scrollLeft, 300);
assert.strictEqual(viewport.scrollTop, 50);

// ── scrollTo 不派发 scroll（与 iScroll 无动画 scrollTo 一致）─────────
// 调用点普遍在 scrollTo 之后手动 _execEvent('scroll')（13 处），
// 这里若不吞掉那次原生 scroll，每次程序化滚动都会派发两遍。
let scrollCount = 0;
let startCount = 0;
let endCount = 0;
const onScroll = () => (scrollCount += 1);
scroll.on('scroll', onScroll);
scroll.on('scrollStart', () => (startCount += 1));
scroll.on('scrollEnd', () => (endCount += 1));

scroll.scrollTo(-360, -60);
viewport.fireScroll(); // 浏览器为这次程序化滚动派发的那一次
assert.strictEqual(scrollCount, 0, 'scrollTo 引起的原生 scroll 必须被吞掉');
assert.strictEqual(startCount, 0);

// 紧接着的真实滚动必须照常派发 —— 抑制标志只能吃掉一次
viewport.scrollLeft = 380;
viewport.fireScroll();
assert.strictEqual(scrollCount, 1, '抑制标志只能消费一次');
assert.strictEqual(startCount, 1, '静默后的第一次滚动要派发 scrollStart');

// 连续滚动不重复派发 scrollStart
viewport.scrollLeft = 390;
viewport.fireScroll();
assert.strictEqual(scrollCount, 2);
assert.strictEqual(startCount, 1);

// ── scrollTo 位置没变时不能置抑制标志 ────────────────────────────────
// 否则会把用户下一次真实滚动吃掉。
scroll.scrollTo(-390, -60); // 与当前位置相同
viewport.scrollLeft = 400;
viewport.fireScroll();
assert.strictEqual(scrollCount, 3, '位置未变的 scrollTo 不该吃掉后续真实滚动');

// ── _execEvent 手动派发（13 个调用点靠它驱动联动面板）──────────────
scroll._execEvent('scroll');
assert.strictEqual(scrollCount, 4);

// ── off 能摘掉 ───────────────────────────────────────────────────────
scroll.off('scroll', onScroll);
scroll._execEvent('scroll');
assert.strictEqual(scrollCount, 4);

// ── 兜底：抑制标志不会长期粘住 ───────────────────────────────────────
scroll.on('scroll', onScroll);
scroll.scrollTo(-500, -100); // 位置变了 → 置标志
nextFrame(); // 那次 scroll 事件没来，下一帧强制解除
viewport.scrollLeft = 520;
viewport.fireScroll();
assert.strictEqual(scrollCount, 5, 'rAF 兜底必须解除抑制标志');

// ── refresh / destroy ────────────────────────────────────────────────
scroll.refresh();
assert.strictEqual(updated, 1);

assert.strictEqual(scroll.enabled, true);
assert.strictEqual(viewport.handlerCount(), 1);
scroll.destroy();
assert.strictEqual(scroll.enabled, false);
assert.strictEqual(destroyed, 1);
assert.strictEqual(viewport.handlerCount(), 0, 'destroy 要摘掉原生监听');

console.log('GunterScroll tests passed');
