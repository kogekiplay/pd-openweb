// CodeMirror 6。CM5 → CM6 迁移的第 3 步（最后一步）——迁完这里，仓里就没有 CM5 了。
//
// 前两步（ChatBot/ReactCodeEditor、FunctionEditorDialog/Func）为了和 CM5 共存，
// 刻意只装 @codemirror/* 子包、不装名为 codemirror 的 CM6 元包（元包与 CM5 同名，
// 装了就会顶掉 CM5）。这一步删掉 CM5 之后那条约束就自动解除了，但也没必要再换元包：
// 元包只是这些子包的 re-export，直接用子包反而更利于 tree-shaking。
//
// CM5 的 mode 是全局注册制（import 一下就把自己塞进 CodeMirror.modes），
// CM6 改成了显式的 LanguageSupport 值——所以这里返回 mode 对应的扩展本身，
// 由调用方拼进 extensions 数组。
let corePromise;
const langPromises = {};

const LANG_LOADERS = {
  javascript: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  xml: () => import('@codemirror/lang-xml').then(m => m.xml()),
};

/* 【失败的 promise 一定不能留在缓存里】这里的 corePromise / langPromises 是「只算一次」
   的缓存，原先无论成败都留着。可 webpack 的 chunk 加载是会失败的（发布时那一下原子换目录、
   网络抖一下、chunk 请求被中断都算），而它失败之后【自己会把 installedChunks 里的记录删掉】，
   就是为了让下次重试还能成。我们这层却把那个已拒绝的 promise 永久缓存了下来 ——
   于是这个页面在【剩下的整个生命周期里】，每次挂 TagTextarea 都是 await 同一个死 promise：
   编辑器永远不出现，框是空的，控制台一条错误都没有（上层是 .then(...)，没人接 reject）。

   实测就是这个形态：「日历视图 -> 标题 -> 指定显示在时间块上的内容」是个空框，
   TagTextarea 实例里 cmcon 正常、unmounted 为 false，但 cm / view 始终是 undefined；
   在同一页面先手工 __webpack_require__.e(7032) 把 chunk 预热上，再打开面板就正常了。
   刷新页面能好，也是因为模块作用域重建、缓存跟着没了 —— 所以它表现为「时好时坏」。

   改法：失败就把缓存清掉并把错误抛出去，下一次挂载重新试。 */
function loadLang(mode) {
  if (!mode || !LANG_LOADERS[mode]) return Promise.resolve(null);

  if (!langPromises[mode]) {
    langPromises[mode] = LANG_LOADERS[mode]().catch(err => {
      langPromises[mode] = undefined;
      throw err;
    });
  }

  return langPromises[mode];
}

function loadCore() {
  if (!corePromise) {
    // CM5 那边还要额外 import placeholder addon 和 codemirror.css；
    // CM6 的 placeholder 在 @codemirror/view 里内置，样式也由 EditorView 自带的
    // baseTheme 注入（运行时插 <style>），所以两个 import 都不需要了。
    corePromise = Promise.all([
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('@codemirror/language'),
      import('@codemirror/commands'),
    ])
      .then(([state, view, language, commands]) => ({ state, view, language, commands }))
      .catch(err => {
        corePromise = undefined;
        throw err;
      });
  }

  return corePromise;
}

export default function loadCodeMirror(mode) {
  return Promise.all([loadCore(), loadLang(mode)]).then(([core, lang]) => ({ ...core, lang }));
}
