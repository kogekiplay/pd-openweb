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

function loadLang(mode) {
  if (!mode || !LANG_LOADERS[mode]) return Promise.resolve(null);

  if (!langPromises[mode]) {
    langPromises[mode] = LANG_LOADERS[mode]();
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
    ]).then(([state, view, language, commands]) => ({ state, view, language, commands }));
  }

  return corePromise;
}

export default function loadCodeMirror(mode) {
  return Promise.all([loadCore(), loadLang(mode)]).then(([core, lang]) => ({ ...core, lang }));
}
