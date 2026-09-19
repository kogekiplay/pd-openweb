/**
 * applyThemeVars 的行为 spec。
 *
 * 【守的是什么】这一层只做四件事，每件都有一个【不报错的】出错方式：
 *   1. 写 inline style —— 写错属性名不会抛，只会「主题色没生效」。
 *   2. 卸载时【逐键删除】而不是整体清空 —— 整体清空会顺带抹掉别人写在
 *      documentElement 上的 inline 样式。
 *   3. 整站只有 documentElement 一处写主题变量 —— 不再有平台作用域例外，
 *      也不往 head 注入任何 <style>。
 *   4. 明暗要看 data-theme —— 看错了暗色下聚焦环和高亮底基本看不见。
 *
 * 本仓没有 jsdom，所以这里用最小假 DOM。ElementLike 的类型也是照着
 * 「只要求 setProperty/removeProperty」写的，正是为了这一点。
 */
const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');

type ThemeVars = Record<string, string>;
type FakeEl = { props: Record<string, string>; attrs: Record<string, string>; style: unknown };
type ApplyModule = {
  currentThemeMode: () => 'light' | 'dark';
  applyThemeVars: (el: unknown, vars: ThemeVars) => void;
  clearThemeVars: (el: unknown, vars: ThemeVars) => void;
  installPlatformTheme: () => void;
  applyAppTheme: (seed: string) => void;
  resetToPlatformTheme: () => void;
};

function fakeEl(): FakeEl {
  const props: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  return {
    props,
    attrs,
    style: {
      setProperty: (k: string, v: string) => {
        props[k] = v;
      },
      removeProperty: (k: string) => {
        delete props[k];
      },
    },
    getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
  } as unknown as FakeEl;
}

/** 最小假 document：只实现被测代码真正用到的那几个成员。 */
const docEl = fakeEl();
const headChildren: Array<{ id: string; textContent: string }> = [];
const g = globalThis as unknown as Record<string, unknown>;

/**
 * 假 MutationObserver：只记下回调，由 setThemeAttr() 手动触发。
 * 真实现里它是异步微任务，这里同步触发是【有意】的 —— spec 要断言的是
 * 「属性变了会重刷成什么」，不是 DOM 规范的调度时机。
 */
const modeCallbacks: Array<() => void> = [];
g.MutationObserver = class {
  cb: () => void;
  constructor(cb: () => void) {
    this.cb = cb;
  }
  observe() {
    modeCallbacks.push(this.cb);
  }
  disconnect() {}
};

/** 改 data-theme 并触发观察者，模拟 setBodyThemeMode 干的事。 */
function setThemeAttr(value: string | null) {
  if (value === null) delete docEl.attrs['data-theme'];
  else docEl.attrs['data-theme'] = value;
  modeCallbacks.forEach(cb => cb());
}

g.document = {
  documentElement: docEl,
  head: {
    appendChild: (el: { id: string; textContent: string }) => {
      headChildren.push(el);
    },
  },
  getElementById: (id: string) => headChildren.find(c => c.id === id) || null,
  createElement: () => ({ id: '', textContent: '' }),
};

function load(): ApplyModule {
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'applyThemeVars.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports as unknown as ApplyModule;
}

const {
  currentThemeMode,
  applyThemeVars,
  clearThemeVars,
  installPlatformTheme,
  applyAppTheme,
  resetToPlatformTheme,
} = load();

// 1. 写入：键值原样落到 inline style
const el = fakeEl();
applyThemeVars(el, { '--color-primary': '#e91e63', '--color-primary-dark': '#e91e63' });
assert.deepStrictEqual(el.props, { '--color-primary': '#e91e63', '--color-primary-dark': '#e91e63' });

// 2. 【核心】清除是逐键删，不碰别人写的 inline 样式。
//    改成 cssText = '' 这一组会红。
(el.style as { setProperty: (k: string, v: string) => void }).setProperty('zoom', '1.2');
clearThemeVars(el, { '--color-primary': '', '--color-primary-dark': '' });
assert.deepStrictEqual(el.props, { zoom: '1.2' });

// 3. 重复 apply 是覆盖而不是叠加
const el2 = fakeEl();
applyThemeVars(el2, { '--color-primary': '#111111' });
applyThemeVars(el2, { '--color-primary': '#222222' });
assert.deepStrictEqual(el2.props, { '--color-primary': '#222222' });

// 4. 空对象是安全的 no-op
const el3 = fakeEl();
applyThemeVars(el3, {});
clearThemeVars(el3, {});
assert.deepStrictEqual(el3.props, {});

// 5. 【反向断言】整站只有 documentElement 一处写主题变量，不再注入任何 <style>。
//    最初给顶栏 / 聊天挂过 .platformThemeScope 把平台色声明回去，
//    2026-09-19 决定整站一起跟随应用色之后那套机制删掉了。
//    这组防止它被「顺手加回来」。
assert.strictEqual(headChildren.length, 0, '主题引擎不该往 head 注入 <style>');

// 6. 明暗看的是 documentElement 的 data-theme（setBodyThemeMode 设的就是它）
assert.strictEqual(currentThemeMode(), 'light');
docEl.attrs['data-theme'] = 'dark';
assert.strictEqual(currentThemeMode(), 'dark');
docEl.attrs['data-theme'] = 'light';
assert.strictEqual(currentThemeMode(), 'light');
delete docEl.attrs['data-theme'];
assert.strictEqual(currentThemeMode(), 'light');

// 7. installPlatformTheme：平台色落到 documentElement
installPlatformTheme();
assert.strictEqual(docEl.props['--color-primary'], '#1677ff');
assert.strictEqual(headChildren.length, 0);

// 8. 重复调用是幂等的（观察者也只装一次，见第 11 组仍然只刷一次的行为）
installPlatformTheme();
installPlatformTheme();
assert.strictEqual(docEl.props['--color-primary'], '#1677ff');
assert.strictEqual(headChildren.length, 0);

// 9. applyAppTheme 换成应用色，resetToPlatformTheme 换回平台色（不是清空）
applyAppTheme('#e91e63');
assert.strictEqual(docEl.props['--color-primary'], '#e91e63');
resetToPlatformTheme();
assert.strictEqual(docEl.props['--color-primary'], '#1677ff');
assert.ok('--color-primary-transparent' in docEl.props, 'reset 是换回平台色，不是把变量删光');

// 10. 暗色下 installPlatformTheme 产出的是暗色档，且注入的规则也跟着变
docEl.attrs['data-theme'] = 'dark';
installPlatformTheme();
const platformDark = docEl.props['--color-primary'];
assert.notStrictEqual(platformDark, '#1677ff');
setThemeAttr(null);

// 11. 【核心】切换明暗时自动重刷 —— 主题引擎自己盯 data-theme，
//     不依赖 setBodyThemeMode 来通知（那个函数在 utils/common.ts 里，
//     被 788 个文件引用，往它里面 import 主题引擎会把 antd 拽进每一个入口）。
assert.strictEqual(docEl.props['--color-primary'], '#1677ff');
setThemeAttr('dark');
assert.strictEqual(docEl.props['--color-primary'], platformDark, '切暗色没有自动重刷');
setThemeAttr('light');
assert.strictEqual(docEl.props['--color-primary'], '#1677ff', '切回亮色没有自动重刷');

// 12. 【核心】应用里切明暗，重刷出来的是【应用色的暗色档】，不是平台色。
//     这条是把 activeSeed 收成模块状态的全部理由 —— 原方案靠两个观察者的
//     注册顺序来决定谁赢，能用但脆。
applyAppTheme('#e91e63');
const appLight = docEl.props['--color-primary'];
setThemeAttr('dark');
const appDark = docEl.props['--color-primary'];
assert.notStrictEqual(appDark, appLight, '切暗色后应用色没变');
assert.notStrictEqual(appDark, platformDark, '切暗色后被平台色冲掉了');
setThemeAttr('light');
assert.strictEqual(docEl.props['--color-primary'], appLight, '切回亮色后应用色没恢复');

// 13. 应用色生效期间，整站（含顶栏、聊天）都取这一套值 —— 没有任何作用域例外
assert.strictEqual(docEl.props['--color-primary'], '#e91e63');
assert.strictEqual(headChildren.length, 0, '不该有平台岛 <style>');

// 14. 离开应用后回到平台色，且明暗切换继续跟随平台
resetToPlatformTheme();
assert.strictEqual(docEl.props['--color-primary'], '#1677ff');
setThemeAttr('dark');
assert.strictEqual(docEl.props['--color-primary'], platformDark);
setThemeAttr(null);

console.log('applyThemeVars.spec: 14 组断言全部通过');
