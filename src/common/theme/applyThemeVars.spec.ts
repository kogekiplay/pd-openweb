/**
 * applyThemeVars 的行为 spec。
 *
 * 【守的是什么】这一层只做四件事，每件都有一个【不报错的】出错方式：
 *   1. 写 inline style —— 写错属性名不会抛，只会「主题色没生效」。
 *   2. 卸载时【逐键删除】而不是整体清空 —— 整体清空会顺带抹掉别人写在
 *      documentElement 上的 inline 样式。
 *   3. 平台 <style> 只注入一次 —— 每次调用都 append 的话就是
 *      setAppThemeColor 那个老毛病（它每调一次往 head 塞一个 style）。
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
  PLATFORM_SCOPE_CLASS: string;
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
  PLATFORM_SCOPE_CLASS,
  currentThemeMode,
  applyThemeVars,
  clearThemeVars,
  installPlatformTheme,
  applyAppTheme,
  resetToPlatformTheme,
} = load();

// 1. 写入：键值原样落到 inline style
const el = fakeEl();
applyThemeVars(el, { '--color-primary': '#e91e63', '--color-app': '#e91e63' });
assert.deepStrictEqual(el.props, { '--color-primary': '#e91e63', '--color-app': '#e91e63' });

// 2. 【核心】清除是逐键删，不碰别人写的 inline 样式。
//    改成 cssText = '' 这一组会红。
(el.style as { setProperty: (k: string, v: string) => void }).setProperty('zoom', '1.2');
clearThemeVars(el, { '--color-primary': '', '--color-app': '' });
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

// 5. 平台岛类名是这个确切的字符串 —— App.tsx / PageHeader 里手写的那几处靠它
assert.strictEqual(PLATFORM_SCOPE_CLASS, 'platformThemeScope');

// 6. 明暗看的是 documentElement 的 data-theme（setBodyThemeMode 设的就是它）
assert.strictEqual(currentThemeMode(), 'light');
docEl.attrs['data-theme'] = 'dark';
assert.strictEqual(currentThemeMode(), 'dark');
docEl.attrs['data-theme'] = 'light';
assert.strictEqual(currentThemeMode(), 'light');
delete docEl.attrs['data-theme'];
assert.strictEqual(currentThemeMode(), 'light');

// 7. installPlatformTheme：平台色落到 documentElement，且注入一个带作用域类的规则
installPlatformTheme();
assert.strictEqual(docEl.props['--color-primary'], '#1677ff');
assert.strictEqual(headChildren.length, 1);
assert.strictEqual(headChildren[0].id, 'md-platform-theme');
assert.ok(headChildren[0].textContent.startsWith(`.${PLATFORM_SCOPE_CLASS}{`));
assert.ok(headChildren[0].textContent.includes('--color-primary:#1677ff;'));

// 8. 【核心】重复调用【不】再注入 <style>。
//    旧的 setAppThemeColor 每调一次就往 head 追加一个，这组钉住别重蹈。
installPlatformTheme();
installPlatformTheme();
assert.strictEqual(headChildren.length, 1);

// 9. applyAppTheme 换成应用色，resetToPlatformTheme 换回平台色（不是清空）
applyAppTheme('#e91e63');
assert.strictEqual(docEl.props['--color-primary'], '#e91e63');
resetToPlatformTheme();
assert.strictEqual(docEl.props['--color-primary'], '#1677ff');
assert.ok('--color-primary-transparent' in docEl.props, 'reset 是换回平台色，不是把变量删光');

// 10. 暗色下 installPlatformTheme 产出的是暗色档，且注入的规则也跟着变
docEl.attrs['data-theme'] = 'dark';
installPlatformTheme();
assert.notStrictEqual(docEl.props['--color-primary'], '#1677ff');
assert.ok(headChildren[0].textContent.includes(docEl.props['--color-primary']));
assert.strictEqual(headChildren.length, 1);
delete docEl.attrs['data-theme'];

console.log('applyThemeVars.spec: 10 组断言全部通过');
