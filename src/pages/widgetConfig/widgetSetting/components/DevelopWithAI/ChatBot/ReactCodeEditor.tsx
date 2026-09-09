import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

// CodeMirror 6。这是 CM5 → CM6 迁移的第一步（试点），仓里另外两处
// （ming-ui/components/TagTextarea、FunctionEditorDialog/Func）仍在 CM5 上。
//
// 两者能共存是因为只装了 @codemirror/* 子包、没装名为 codemirror 的 CM6 元包——
// 元包与 CM5 同名，装了就会顶掉 CM5，分步迁移根本无从下手。以后迁另外两处时也要守这一条，
// 直到 CM5 的最后一个引用被删掉，才可以考虑换成元包。
let cmPromise;

function loadCodeMirror() {
  if (!cmPromise) {
    cmPromise = Promise.all([
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('@codemirror/language'),
      import('@codemirror/autocomplete'),
      import('@codemirror/commands'),
      import('@codemirror/lang-javascript'),
    ]).then(([state, view, language, autocomplete, commands, langJavascript]) => ({
      state,
      view,
      language,
      autocomplete,
      commands,
      langJavascript,
    }));
  }

  return cmPromise;
}

// CM5 时代这里靠改写 CodeMirror.hint.javascript 往内置提示前面插一批 React 关键字。
// CM6 的补全是「数据源」模型：把这些做成一个 CompletionSource，和 lang-javascript
// 自带的补全一起挂进 autocompletion()，两边的结果会自动合并排序。
const REACT_COMPLETIONS = [
  'useState',
  'useEffect',
  'useCallback',
  'useMemo',
  'useRef',
  'useContext',
  'useReducer',
  'useLayoutEffect',
  'Fragment',
  'React.Fragment',
  'className',
  'onClick',
  'onChange',
  'onSubmit',
  'props',
  'children',
  'state',
  'render',
  'component',
  'return',
  'export default',
  'import React from "react"',
  'import { useState } from "react"',
  'import { useEffect } from "react"',
].map(label => ({ label, type: 'keyword' }));

// CM5 时代给 hint.html 挂 schemaInfo 来提示 JSX 属性。CM6 里同样做成 CompletionSource：
// 只在标签内（前面有未闭合的 `<`）时给出属性名。
const JSX_ATTRS = [
  'className',
  'style',
  'onClick',
  'onChange',
  'onSubmit',
  'value',
  'type',
  'id',
  'name',
  'disabled',
  'placeholder',
  'required',
  'checked',
  'readOnly',
].map(label => ({ label, type: 'property' }));

function reactCompletionSource(context) {
  const word = context.matchBefore(/[\w.]*/);

  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;

  // 判断光标是否在一个还没闭合的标签里：从行首往前找最近的 `<` 与 `>`
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const lastOpen = before.lastIndexOf('<');
  const lastClose = before.lastIndexOf('>');
  const inTag = lastOpen > lastClose;

  return {
    from: word.from,
    options: inTag ? JSX_ATTRS : REACT_COMPLETIONS,
    validFor: /^[\w.]*$/,
  };
}

const Con = styled.div`
  width: 100%;
  height: 100%;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* CM6 的 DOM 与类名与 CM5 完全不同：.CodeMirror* → .cm-*。
     对应关系：.CodeMirror→.cm-editor、-hints→.cm-tooltip-autocomplete、
     -hint→其 li、-hint-active→li[aria-selected]、-selected→.cm-selectionBackground、
     -activeline-background→.cm-activeLine、-cursor→.cm-cursor、
     -linenumber→.cm-lineNumbers .cm-gutterElement。 */
  .cm-editor {
    height: 100%;
    border-top: 1px solid var(--color-border-primary);
    font-size: 14px;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    background: var(--color-background-primary);
  }

  /* CM6 只在聚焦时给 .cm-focused 加轮廓，这里去掉以保持和原来一致的观感 */
  .cm-editor.cm-focused {
    outline: none;
  }

  .cm-scroller {
    overflow: auto;
    font-family: inherit;
  }

  /* 提示框样式 */
  .cm-tooltip-autocomplete {
    z-index: 10;
    border-radius: 3px;
    font-size: 90%;
    background: var(--color-background-primary);
    border: 1px solid var(--color-border-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    & > ul {
      max-height: 20em;
      overflow-y: auto;
      list-style: none;
      margin: 0;
      padding: 2px;
      font-family: inherit;

      & > li {
        margin: 0;
        padding: 4px 8px;
        border-radius: 2px;
        white-space: pre;
        color: var(--color-text-title);
        cursor: pointer;
      }

      & > li[aria-selected] {
        background: var(--color-background-disabled);
        color: var(--color-text-title);
      }
    }
  }

  /* 选中文本的背景色。CM6 用自绘的 .cm-selectionBackground，
     原生 ::selection 只在未聚焦时出现，两个都要设。 */
  .cm-selectionBackground,
  .cm-content ::selection {
    background: var(--color-primary-transparent) !important;
  }

  /* 当前行的背景色 */
  .cm-activeLine {
    background: var(--color-background-secondary);
  }

  /* 光标颜色 */
  .cm-cursor,
  .cm-dropCursor {
    border-left-color: var(--color-text-title);
  }

  /* 行号样式 */
  .cm-gutters {
    background: var(--color-background-primary);
    border-right: none;
  }

  .cm-lineNumbers .cm-gutterElement {
    color: var(--color-text-tertiary);
  }

  .cm-foldGutter {
    color: var(--color-text-tertiary);
  }
`;

const MAX_KB = 64;

const CodeEditor = ({ value = '', onChange = () => {} }) => {
  const conRef = useRef(null);
  const viewRef = useRef(null);
  // onChange 每次渲染都可能是新函数，而 CM6 的扩展只在建 view 时装一次，
  // 所以用 ref 读最新值，避免为了拿到新 onChange 去重建整个编辑器。
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // 同理用 ref 读 value：扩展是异步 import 进来的，若这期间外部把 value 改了，
  // 挂载 effect 闭包里那个 value 已经是旧的，编辑器会用旧内容开局
  //（下面那个 [value] effect 那时还看不到 view，补不回来）。
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    let disposed = false;

    loadCodeMirror().then(({ state, view, language, autocomplete, commands, langJavascript }) => {
      if (disposed || !conRef.current) return;

      const { EditorState } = state;
      const { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } = view;
      const { indentUnit, bracketMatching, syntaxHighlighting, defaultHighlightStyle } = language;
      const { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } = autocomplete;
      const { defaultKeymap, history, historyKeymap, indentWithTab } = commands;
      const { javascript, autoCloseTags } = langJavascript;

      const editorView = new EditorView({
        state: EditorState.create({
          doc: valueRef.current || '',
          extensions: [
            lineNumbers(),
            highlightActiveLine(),
            highlightActiveLineGutter(),
            // CM6 默认不画选区（交给浏览器），要自绘才能被 .cm-selectionBackground 样式命中
            drawSelection(),
            history(),
            bracketMatching(),
            closeBrackets(),
            // mode: 'jsx' 的等价物
            javascript({ jsx: true }),
            autoCloseTags,
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            // CM5 的 lineWrapping: true
            EditorView.lineWrapping,
            // CM5 的 tabSize: 2 + indentWithTabs: false
            EditorState.tabSize.of(2),
            indentUnit.of('  '),
            autocompletion({
              override: [reactCompletionSource],
              // CM5 那边是 on('keyup') 里手工判断按键再 showHint；CM6 声明式打开即可。
              activateOnTyping: true,
              // 对应 CM5 的 completeSingle: false——只有一条候选时也不要直接替换
              defaultKeymap: true,
              selectOnOpen: false,
            }),
            // 顺序有讲究：closeBrackets / completion 的按键要排在 defaultKeymap 之前，
            // 否则会被后者先吃掉。indentWithTab 对应 CM5 extraKeys 里的 Tab 缩进。
            keymap.of([...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, indentWithTab, ...defaultKeymap]),
            EditorView.updateListener.of(update => {
              if (!update.docChanged) return;

              const next = update.state.doc.toString();

              if (new Blob([next]).size / 1024 > MAX_KB) {
                alert(_l('代码无法保存，代码长度不能超过64KB'), 3);
                return;
              }

              onChangeRef.current(next);
            }),
          ],
        }),
        parent: conRef.current,
      });

      viewRef.current = editorView;
    });

    return () => {
      disposed = true;

      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  // 外部把 value 改成与编辑器内容不同的值时同步进来，并把光标移到文末。
  // CM5 里是 setValue + setCursor(lastLine, lastCh) + scrollIntoView；
  // CM6 用一个事务把「替换全文 + 选区 + 滚动」一起提交。
  useEffect(() => {
    const editorView = viewRef.current;

    if (!editorView) return;

    const current = editorView.state.doc.toString();

    if (value === current) return;

    const next = value || '';
    editorView.dispatch({
      changes: { from: 0, to: current.length, insert: next },
      selection: { anchor: next.length },
      scrollIntoView: true,
    });
  }, [value]);

  // 高度不再需要 setSize：.cm-editor 拿 100%，由容器决定，
  // 所以原来那套 useMeasure + setSize(null, height) 整体删掉。
  return <Con ref={conRef} />;
};

export default CodeEditor;

// 供 tools/verify-cm6-reactcodeeditor.cjs 单测。它是这次迁移里唯一自写的逻辑
// （CM5 那边是改写 CodeMirror.hint.javascript / hint.html 两个全局），值得单独钉住。
export const __test_reactCompletionSource = reactCompletionSource;
