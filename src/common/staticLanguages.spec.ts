/**
 * 引导脚本 staticLanguages 的行为 spec。
 *
 * 【为什么值得有】这段代码跑在【主包之前】，6 个静态页（登录、下载受限、
 * 企微/支付宝引导页…）的 <body> 初始是 display:none，全靠它最后一行放出来。
 * 它一旦抛错，那几个页面就是纯白屏，而且没有任何前端错误上报能兜到 ——
 * 主包还没加载。
 *
 * 【期望值取自迁移前的实现】2026-09-16 把 staticfiles/staticLanguages.js
 * 迁成 src/common/staticLanguages.ts 时，先用同一份假 DOM 跑了新旧两版做 A/B，
 * 下面这些期望值就是【旧实现当时的实际输出】，不是照着新代码写的。
 * 所以它守的是「行为没变」，而不是「代码自洽」。
 *
 * 【为什么用 esbuild 编译而不是直接 require】源码是浏览器经典脚本的写法：
 * 顶层就有副作用（读 document、注册 DOMContentLoaded），也没有 export。
 * 按模块 require 进来拿不到任何东西，必须像浏览器那样整段执行。
 */
const assert = require('assert');
const path = require('path');
const vm = require('vm');
const esbuild = require('esbuild');

const SOURCE = path.join(__dirname, 'staticLanguages.ts');

/** 假元素：只实现被测代码真正用到的那几个成员 */
function makeEl(text: string, contentAttr?: string) {
  return {
    innerHTML: text,
    _content: contentAttr,
    getAttribute(name: string) {
      return name === 'content' ? (this._content === undefined ? null : this._content) : null;
    },
  };
}

type Env = {
  sandbox: any;
  fireDomReady(): void;
  snapshot(): { title: string; tags: string[]; bodyDisplay: string };
};

/**
 * 造一份最小 DOM。
 * 【body 初始必须是 none】真实页面就是这样，被测代码的最后一行是唯一放出它的地方；
 * 初始给 'block' 的话「忘了放出来」这个回归就测不出来了。
 */
function makeEnv(cookie: string, language: string): Env {
  const title = makeEl('登录');
  const tags = [makeEl('统计图'), makeEl('不存在的词'), makeEl('注销')];
  const body = { style: { display: 'none' } };
  let domReady: (() => void) | null = null;

  const document = {
    cookie,
    body,
    querySelectorAll(sel: string) {
      return sel === 'title' ? [title] : tags;
    },
    addEventListener(ev: string, fn: () => void) {
      if (ev === 'DOMContentLoaded') domReady = fn;
    },
  };

  const sandbox: any = { document, navigator: { language }, console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  return {
    sandbox,
    fireDomReady() {
      assert.ok(domReady, '没有注册 DOMContentLoaded —— <body> 将永远不会显示');
      domReady!();
    },
    snapshot: () => ({
      title: title.innerHTML,
      tags: tags.map(t => t.innerHTML),
      bodyDisplay: body.style.display,
    }),
  };
}

const code = esbuild.buildSync({
  entryPoints: [SOURCE],
  bundle: true,
  format: 'iife',
  target: 'es2015',
  write: false,
  logLevel: 'silent',
}).outputFiles[0].text;

function run(cookie: string, language: string) {
  const env = makeEnv(cookie, language);
  vm.createContext(env.sandbox);
  vm.runInContext(code, env.sandbox);
  env.fireDomReady();
  return { ...env.snapshot(), sandbox: env.sandbox };
}

const cases: Array<[string, () => void]> = [];
const test = (name: string, fn: () => void) => cases.push([name, fn]);

// ── 选语言：cookie 优先 ───────────────────────────────────────────────────
test('cookie 里的 i18n_langtag 优先于 navigator.language', () => {
  const r = run(' i18n_langtag=ja;', 'zh-CN');
  assert.strictEqual(r.title, 'ログイン');
  assert.deepStrictEqual(r.tags, ['統計チャート', '不存在的词', 'ログアウト']);
});

test('cookie=zh-Hant 时用繁体', () => {
  const r = run(' i18n_langtag=zh-Hant;', 'en');
  assert.strictEqual(r.title, '登入');
  assert.deepStrictEqual(r.tags, ['統計圖', '不存在的词', '註銷']);
});

// ── 选语言：没有 cookie 时看 navigator.language ──────────────────────────
test('无 cookie 时 zh-CN / zh-SG 归一到简体', () => {
  for (const lang of ['zh-CN', 'zh_cn', 'zh-SG', 'zh_sg']) {
    const r = run('', lang);
    assert.strictEqual(r.title, '登录', `${lang} 应当用简体`);
  }
});

test('无 cookie 时 zh-TW / zh-HK / zh-Hant 归一到繁体', () => {
  for (const lang of ['zh-TW', 'zh-HK', 'zh-Hant']) {
    const r = run('', lang);
    assert.strictEqual(r.title, '登入', `${lang} 应当用繁体`);
  }
});

test('无 cookie 且语言不认识时兜底英文', () => {
  const r = run('', 'fr');
  assert.strictEqual(r.title, 'Login');
  assert.deepStrictEqual(r.tags, ['Statistics Chart', '不存在的词', 'Logout']);
});

// ── 两条回落 ─────────────────────────────────────────────────────────────
test('cookie 里是无效语言时回落到英文，而不是留空', () => {
  const r = run(' i18n_langtag=xx-YY;', 'zh-CN');
  assert.strictEqual(r.title, 'Login', 'langMap[lang] 取不到时应当退到 langMap.en');
});

test('词表里没有的文案【原样保留】，不能被清空', () => {
  const r = run('', 'en');
  assert.strictEqual(r.tags[1], '不存在的词');
});

// ── 副作用 ───────────────────────────────────────────────────────────────
test('DOMContentLoaded 之后必须把 body 显示出来', () => {
  const r = run('', 'en');
  assert.strictEqual(r.bodyDisplay, 'block', '不放出来的话这几个页面就是白屏');
});

test('仍然把 staticLanguages 挂到全局（原先是经典脚本里的 var）', () => {
  const r = run('', 'en');
  assert.strictEqual(typeof r.sandbox.staticLanguages, 'object');
  assert.strictEqual(r.sandbox.staticLanguages['登录'].en, 'Login');
});

// ── 词表本身 ─────────────────────────────────────────────────────────────
test('每条文案四种语言齐全且非空', () => {
  const r = run('', 'en');
  const table = r.sandbox.staticLanguages as Record<string, Record<string, string>>;
  const keys = Object.keys(table);
  assert.ok(keys.length > 50, `词条数看起来不对：${keys.length}`);
  for (const key of keys) {
    for (const locale of ['en', 'ja', 'zh-Hans', 'zh-Hant']) {
      assert.ok(table[key][locale], `「${key}」缺少 ${locale}`);
    }
  }
});

(async () => {
  let failed = 0;
  for (const [name, fn] of cases) {
    try {
      await fn();
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${name}`);
      console.error(`    ${(err && (err as any).message) || err}`);
    }
  }
  if (failed) {
    console.error(`staticLanguages spec: ${failed}/${cases.length} 个用例失败`);
    process.exit(1);
  }
  console.log(`staticLanguages spec: ${cases.length} 个用例全部通过`);
})();
