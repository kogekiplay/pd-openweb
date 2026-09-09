import React, { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import _, { get, identity } from 'lodash';
import { getIconByType } from 'src/pages/widgetConfig/util';
import { emitter } from 'src/utils/common';
import { checkTypeSupportForFunction } from 'src/utils/control';
import { functions } from '../enum';
import { getControlType } from './ControlList';
import { computeFormulaMarks } from './formulaMarks';

/**
 * 公式编辑器（CodeMirror 6）。CM5 → CM6 分三步走的第 2 步。
 *
 * 对外契约刻意保持与 CM5 版完全一致——构造参数、getValue / setValue / insertTag /
 * insertFn / destroy 五个方法、以及 ready 这个 Promise。所以 CodeEdit.tsx 与它上面
 * 5 个入口（字段公式、动态默认值、自定义事件条件、工作流公式）一行都不用改。
 *
 * 只装 @codemirror/* 子包、不装名为 codemirror 的 CM6 元包：元包与仍在用的 CM5 同名，
 * 装了就会顶掉 CM5，而 ming-ui/components/TagTextarea 还没迁。等它迁完才可以考虑换元包。
 *
 * 标记与校验规则全部搬到了 ./formulaMarks（纯函数），并用真实 CM5 做过差分验证
 * （见 tools/verify-cm6-formulamarks.cjs，58 项断言）。本文件只负责把那份结果翻译成
 * CM6 的 Decoration，以及补全、事件、主题这些编辑器层面的事。
 *
 * 两种 type 走不同的高亮路径：
 *   mdfunction —— 公式 DSL，函数名的绿/红由装饰器给（CM5 是借 JS mode 注入 keywords 染色的）
 *   javascript —— 用户写的真 JS（自定义事件条件），挂 @codemirror/lang-javascript
 */
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
      import('@lezer/highlight'),
    ]).then(([state, view, language, autocomplete, commands, langJavascript, lezerHighlight]) => ({
      state,
      view,
      language,
      autocomplete,
      commands,
      langJavascript,
      lezerHighlight,
    }));
  }

  return cmPromise;
}

const TagWrapper = ({ onDidMount = () => {}, tag }) => {
  useLayoutEffect(() => {
    onDidMount();
  });

  return tag;
};

if (!window.emitter) {
  window.emitter = emitter;
}

const isDarkTheme = () => document.documentElement.getAttribute('data-theme') === 'dark';

function createElement(text, style = {}, { tooltip } = {}) {
  const dom = document.createElement('span');
  dom.innerText = text;
  Object.keys(style).forEach(key => {
    dom.style[key] = style[key];
  });

  if (tooltip) {
    dom.setAttribute('title', tooltip);
    dom.setAttribute('data-tip', tooltip);
    dom.classList.add('tip-right', 'tip-no-animation', 'tip-red');
  }

  return dom;
}

function createTagEle(text) {
  const dom = createElement(text);
  dom.style.display = 'inline-block';
  dom.style.margin = '0 4px';
  dom.style.fontSize = '12px';
  dom.style.height = '24px';
  dom.style.lineHeight = '22px';
  dom.style.color = 'var(--color-link-hover)';
  dom.style.padding = '0 13px';
  dom.style.borderRadius = '24px';
  dom.style.border = '1px solid var(--color-primary-transparent)';
  dom.style.background = '#d8eeff';

  return dom;
}

export default class Function {
  // 实例字段一律显式声明。不声明不会影响运行，但 tsc 会为每次 this.x 赋值报一条
  // TS2551/TS2339，而差分门禁是按 file|错误码 的【计数】比的，凭空多出十几条就会红。
  type = 'mdfunction';
  controls = [];
  // 这几个回调故意【不带初值】：带了 TS 就会从初值推出返回类型
  //（如 () => {} 推成返回 void，于是 this.getControlName(id) || '' 报 TS1345），
  // 而它们在构造函数里必定被赋成调用方传的实现。不带初值即保持 any，与改动前一致。
  getControlName;
  renderTag;
  onChange;
  insertTagToEditor;
  onError;
  readOnly = false;
  noCursor = false;
  placeholder = '';
  autofocus = true;
  value = '';
  pendingActions = [];
  lastErrorText = undefined;
  destroyed = false;
  ready = undefined;
  cm = undefined;
  view = null;
  themeCompartment = undefined;
  _isDark = false;
  _themeObserver = null;

  constructor(
    dom,
    {
      value,
      options = {},
      type = 'mdfunction',
      getControlName = () => {},
      controls = [],
      renderTag,
      onChange = () => {},
      insertTagToEditor = () => {},
      onError = () => {},
    } = {},
  ) {
    if (!dom) {
      console.log('target is not a dom element');
      return;
    }

    this.type = type;
    this.getControlName = getControlName;
    this.controls = controls;
    this.renderTag = renderTag;
    this.onChange = onChange;
    this.insertTagToEditor = insertTagToEditor;
    this.onError = onError;
    // CM5 里 readOnly 可能是 'nocursor'（只读且不可聚焦），也可能是 undefined
    this.readOnly = !!options.readOnly;
    this.noCursor = options.readOnly === 'nocursor';
    this.placeholder = options.placeholder || '';
    this.autofocus = options.autofocus !== false;
    this.value = value || '';
    this.pendingActions = [];
    this.lastErrorText = undefined;

    this.ready = loadCodeMirror().then(cm => {
      if (this.destroyed) return;

      this.cm = cm;
      this.view = this.createView(dom);

      // CM5 是 args.theme = getCodeMirrorThemeName() + MutationObserver 换 theme 选项；
      // CM6 用 Compartment 热替换那一段扩展。
      this._themeObserver = new MutationObserver(() => {
        const next = isDarkTheme();

        if (this._isDark === next || !this.view) return;

        this._isDark = next;
        this.view.dispatch({ effects: this.themeCompartment.reconfigure(this.buildTheme()) });
      });
      this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

      if (this.value) {
        // CM5 的 init()：setValue + 标记 + 光标放到末尾 + 派发默认激活函数
        this.setCursor(this.value.length);
        setTimeout(() => this.handleDefaultActiveFn(this.value), 10);
      }

      if (this.autofocus && !this.noCursor) this.view.focus();

      this.pendingActions.forEach(action => action());
      this.pendingActions = [];
    });
  }

  // ---------- CM6 扩展装配 ----------

  buildTheme() {
    const { view, language, lezerHighlight } = this.cm;
    const { EditorView } = view;
    const { HighlightStyle, syntaxHighlighting } = language;
    const { tags } = lezerHighlight;
    const dark = this._isDark;

    // CM5 深色用的是 codemirror/theme/material-darker.css。CM6 的 token class 体系
    // 完全不同（@lezer/highlight 的 tag，不是 .cm-keyword），没有现成的 material-darker，
    // 所以按那份 CSS 的配色手抄一份 HighlightStyle——保视觉一致，也不用新加依赖。
    // 浅色沿用默认前景色即可（CM5 浅色时 theme 就是 'default'）。
    const darkStyle = HighlightStyle.define([
      { tag: tags.keyword, color: '#c792ea' },
      { tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: '#f07178' },
      { tag: [tags.function(tags.variableName), tags.labelName], color: '#82aaff' },
      { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#f78c6c' },
      { tag: [tags.definition(tags.name), tags.separator], color: '#eeffff' },
      {
        tag: [
          tags.typeName,
          tags.className,
          tags.number,
          tags.changed,
          tags.annotation,
          tags.modifier,
          tags.self,
          tags.namespace,
        ],
        color: '#ffcb6b',
      },
      {
        tag: [
          tags.operator,
          tags.operatorKeyword,
          tags.url,
          tags.escape,
          tags.regexp,
          tags.link,
          tags.special(tags.string),
        ],
        color: '#89ddff',
      },
      { tag: [tags.meta, tags.comment], color: '#546e7a' },
      { tag: tags.strong, fontWeight: 'bold' },
      { tag: tags.emphasis, fontStyle: 'italic' },
      { tag: tags.strikethrough, textDecoration: 'line-through' },
      { tag: tags.bool, color: '#ff5370' },
      // .cm-string 在 style.less 里被强行改成 --color-text-title，这里给个不刺眼的底色即可
      { tag: [tags.string, tags.inserted], color: '#c3e88d' },
      { tag: tags.invalid, color: '#f07178' },
    ]);

    return [
      EditorView.theme({ '&': { color: 'var(--color-text-title)' } }, { dark }),
      dark ? syntaxHighlighting(darkStyle) : [],
    ];
  }

  createView(dom) {
    const { state, view, language, autocomplete, commands, langJavascript } = this.cm;
    const { EditorState, Compartment } = state;
    const { EditorView, keymap, drawSelection, highlightSpecialChars, placeholder } = view;
    const { indentUnit, bracketMatching } = language;
    const { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } = autocomplete;
    const { defaultKeymap, history, historyKeymap } = commands;

    this.themeCompartment = new Compartment();
    this._isDark = isDarkTheme();

    const extensions = [
      drawSelection(),
      highlightSpecialChars(),
      history(),
      bracketMatching(),
      indentUnit.of('  '),
      // CM5 的 lineWrapping: true
      EditorView.lineWrapping,
      this.themeCompartment.of(this.buildTheme()),
      this.marksField(),
      keymap.of([...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...defaultKeymap]),
      EditorView.updateListener.of(update => this.handleUpdate(update)),
      EditorView.domEventHandlers({
        blur: () => {
          // 失焦只清临时 hover、保留点击选中的 activeFn，避免函数说明在编辑器失焦后消失
          window.emitter.emit('FUNCTIONEDITOR_BLUR_FN');
          return false;
        },
      }),
    ];

    if (this.placeholder) extensions.push(placeholder(this.placeholder));

    if (this.readOnly) {
      extensions.push(EditorState.readOnly.of(true));

      // CM5 的 'nocursor' 是只读且不可聚焦
      if (this.noCursor) extensions.push(EditorView.editable.of(false));
    } else {
      extensions.push(closeBrackets());
    }

    if (this.type === 'javascript') {
      // 自定义事件条件那里用户写的是真 JS，交给官方语言包
      extensions.push(langJavascript.javascript());
    }

    if (this.type === 'mdfunction' && !this.readOnly) {
      extensions.push(
        autocompletion({
          override: [ctx => this.formulaCompletions(ctx)],
          activateOnTyping: true,
          // 对应 CM5 showHint 的 completeSingle: false
          selectOnOpen: false,
          closeOnBlur: true,
        }),
      );
    }

    return new EditorView({
      state: EditorState.create({ doc: this.value, extensions }),
      parent: dom,
    });
  }

  /**
   * 把 formulaMarks 的纯函数结果翻成 Decoration。
   * CM5 那边是命令式的：每次 change 就 clearMarkers() 再逐个 markText()。
   * CM6 是声明式的——装饰集由文档推导，doc 一变就重算，天然不会漏清理。
   */
  marksField() {
    const { state, view } = this.cm;
    const { StateField } = state;
    const { Decoration, EditorView, WidgetType } = view;
    const self = this;

    // 字段引用的标签。CM5 是 renderColumnTag 里用 createRoot 渲 React 再交给 markText。
    class ControlTagWidget extends WidgetType {
      constructor(id) {
        super();
        this.id = id;
      }

      // 同一个 controlId 复用同一个 widget，避免每次输入都重挂 React
      eq(other) {
        return other.id === this.id;
      }

      toDOM() {
        const node = document.createElement('span');

        if (_.isFunction(self.renderTag)) {
          const tag = self.renderTag(this.id, {});

          if (React.isValidElement(tag)) {
            // 存在 dom 上，destroy 时才能 unmount——漏了这步就是 React root 泄漏
            node.__cmReactRoot = createRoot(node);
            node.__cmReactRoot.render(<TagWrapper tag={tag} />);
          } else if (tag) {
            node.appendChild(tag);
          }

          return node;
        }

        return createTagEle(self.getControlName(this.id) || '');
      }

      destroy(node) {
        if (node && node.__cmReactRoot) {
          const root = node.__cmReactRoot;
          node.__cmReactRoot = null;
          // React 不允许在自己的 commit 过程中同步 unmount，挪到微任务里
          Promise.resolve().then(() => root.unmount());
        }
      }

      ignoreEvent() {
        // CM5 那边 handleMouseEvents: true，即让事件照常落到替换出来的节点上
        return false;
      }
    }

    const build = docText => {
      const { marks, errors } = computeFormulaMarks(docText, { type: self.type, readOnly: self.readOnly });
      const ranges = [];

      marks.forEach(mark => {
        if (mark.kind === 'control') {
          ranges.push(Decoration.replace({ widget: new ControlTagWidget(mark.id) }).range(mark.from, mark.to));
          return;
        }

        if (mark.kind === 'chinese') {
          ranges.push(
            Decoration.replace({
              widget: new (class extends WidgetType {
                eq(o) {
                  return o.text === mark.text;
                }

                toDOM() {
                  return createElement(mark.text, { margin: '0 3px', color: '#F44336' });
                }

                ignoreEvent() {
                  return false;
                }
              })(),
            }).range(mark.from, mark.to),
          );
          return;
        }

        if (mark.kind === 'unclosed') {
          ranges.push(
            Decoration.replace({
              widget: new (class extends WidgetType {
                eq(o) {
                  return o.text === mark.text;
                }

                toDOM() {
                  return createElement(mark.text, { color: '#F44336' }, { tooltip: _l('函数括号未闭合') });
                }

                ignoreEvent() {
                  return false;
                }
              })(),
            }).range(mark.from, mark.to),
          );
          return;
        }

        if (mark.kind === 'badEnd') {
          // CM5 用的是 markText 的 css 选项（只改色、不替换文本）
          ranges.push(Decoration.mark({ attributes: { style: 'color: #F44336' } }).range(mark.from, mark.to));
          return;
        }

        if (mark.kind === 'fnName') {
          ranges.push(
            Decoration.mark({ class: mark.known ? 'cm-customFn' : 'cm-unknownFn' }).range(mark.from, mark.to),
          );
        }
      });

      // CM5 是每命中一条就 onError({text})、后一条覆盖前一条，所以最终显示的是【最后】那条。
      // formulaMarks 返回的 errors 顺序与 CM5 的规则执行顺序一致，取末尾即等价。
      self.reportError(errors.length ? errors[errors.length - 1] : undefined);

      return Decoration.set(ranges, true);
    };

    const field = StateField.define({
      create: st => build(st.doc.toString()),
      update: (deco, tr) => (tr.docChanged ? build(tr.state.doc.toString()) : deco),
      provide: f => EditorView.decorations.from(f),
    });

    return field;
  }

  reportError(text) {
    if (this.lastErrorText === text) return;

    this.lastErrorText = text;

    if (_.isFunction(this.onError)) this.onError(text ? { text } : undefined);
  }

  // ---------- 补全 ----------

  /**
   * CM5 是 CodeMirror.showHint() 加一份自造的 hint 数据（含 render / _handlers）。
   * CM6 换成 CompletionSource：候选里带 info/apply，四个 emitter 事件挂在对应时机上。
   */
  formulaCompletions(context) {
    const word = context.matchBefore(/[a-zA-Z0-9_一-龥]*/);

    if (!word) return null;

    if (word.from === word.to && !context.explicit) return null;

    const typed = word.text.toUpperCase();
    const controls = this.controls
      .filter(c => c.controlName && checkTypeSupportForFunction(c))
      .filter(c => c.controlName.toUpperCase().indexOf(typed) > -1);
    const fns = Object.keys(functions).filter(fn => fn.indexOf(typed) > -1);
    const options = [];

    controls.forEach(control => {
      options.push({
        label: control.controlName,
        type: 'variable',
        // 字段不是往文本里插名字，而是回调宿主去插 $id$（与 CM5 的 pick handler 一致）
        apply: (view, completion, from, to) => {
          view.dispatch({ changes: { from, to, insert: '' } });
          this.insertTagToEditor({
            value: [get(control, 'workflowGroupId', ''), get(control, 'controlId')].filter(identity).join('-'),
            text: get(control, 'controlName'),
          });
        },
        info: () => {
          const node = document.createElement('div');
          node.className = 'hint-item';
          node.innerHTML = `<i class="icon icon-${getIconByType(getControlType(control) || 2)}"></i> ${control.controlName}`;
          return node;
        },
      });
    });

    _.sortBy(fns).forEach(fnName => {
      options.push({
        label: fnName,
        type: 'function',
        apply: (view, completion, from, to) => {
          // CM5 是在 change 事件里看 origin === 'complete' 再 insertBrackets()；
          // CM6 直接在 apply 里一次事务搞定：插入 "FN()" 并把光标放进括号中间。
          const insert = fnName + '()';
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length - 1 },
          });
          window.emitter.emit('FUNCTIONEDITOR_ACTIVE_FN', fnName);
        },
      });
    });

    if (!options.length) return null;

    return { from: word.from, options, validFor: /^[a-zA-Z0-9_一-龥]*$/ };
  }

  // ---------- 事件 ----------

  handleUpdate(update) {
    if (update.docChanged) {
      this.value = update.state.doc.toString();

      if (_.isFunction(this.onChange)) this.onChange();
    }

    if (update.selectionSet || update.docChanged) this.emitActiveFn(update.state);
  }

  // CM5 的 cursorActivity：光标停在函数名上就把它派发出去，右侧好显示该函数的说明
  emitActiveFn(state) {
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);
    const ch = head - line.from;
    const before = line.text.charAt(ch - 1);
    const after = line.text.charAt(ch);

    if (!/[A-Z_]/.test(before) && !/[A-Z_]/.test(after)) return;

    const re = /([a-zA-Z0-9_]+)(?=\()/g;
    let match = re.exec(line.text);

    while (match) {
      const start = match.index;
      const end = start + match[0].length;

      if (ch >= start && ch <= end) window.emitter.emit('FUNCTIONEDITOR_ACTIVE_FN', match[0]);

      match = re.exec(line.text);
    }
  }

  handleDefaultActiveFn(value = '') {
    const match = /([a-zA-Z0-9_]+)(?=\()/.exec(value);

    if (match) window.emitter.emit('FUNCTIONEDITOR_ACTIVE_FN', match[1]);
  }

  // ---------- 对外 API（与 CM5 版逐一对应）----------

  runWhenReady(action) {
    if (this.view) {
      action();
      return;
    }

    this.pendingActions.push(action);
  }

  getValue() {
    return this.view ? this.view.state.doc.toString() : this.value;
  }

  setValue(value = '') {
    this.value = value;
    this.runWhenReady(() => {
      const cur = this.view.state.doc.toString();

      if (cur === value) return;

      this.view.dispatch({ changes: { from: 0, to: cur.length, insert: value } });
    });
  }

  setCursor(offset) {
    if (!this.view) return;

    const max = this.view.state.doc.length;
    this.view.dispatch({ selection: { anchor: Math.min(Math.max(offset, 0), max) } });
  }

  cursor() {
    return this.view ? this.view.state.selection.main.head : 0;
  }

  /**
   * position 在 CM5 版是 {line, ch}，但全部调用点其实都只传一个参数、position 恒为 undefined
   * （见 FnList.tsx / ControlList.tsx / CodeEdit.tsx 的 useImperativeHandle）。
   * 所以这里只接偏移量；传别的一律按「当前光标」处理，与既有实际行为一致。
   */
  insertTag({ value }, position) {
    this.runWhenReady(() => {
      const doc = this.view.state.doc.toString();
      const at = _.isNumber(position) ? position : this.cursor();
      // CM5：紧挨在上一个 $ 后面插时先补个逗号，免得两个字段粘在一起
      const needComma = doc[at - 1] === '$';
      // 一次事务插完，不拆成「先插逗号、再读光标、再插标签」两步。
      // 踩过：在光标处插入后 CM6 默认把光标映射到插入内容【之前】（assoc = -1），
      // 于是第二步又插回了逗号前面，结果是 "$c1$$c2$," 而不是 "$c1$,$c2$"。
      const insert = `${needComma ? ',' : ''}$${value}$`;
      this.view.dispatch({ changes: { from: at, to: at, insert }, selection: { anchor: at + insert.length } });
      this.view.focus();
    });
  }

  insertFn(value, position) {
    this.runWhenReady(() => {
      const at = _.isNumber(position) ? position : this.cursor();
      // CM5 是 replaceRange(value) 再 insertBrackets()，合起来就是插 "FN()" 且光标落在括号里
      const insert = `${value}()`;
      this.view.dispatch({
        changes: { from: at, to: at, insert },
        selection: { anchor: at + insert.length - 1 },
      });
      this.view.focus();
    });
  }

  destroy() {
    this.destroyed = true;

    if (this._themeObserver) {
      this._themeObserver.disconnect();
      this._themeObserver = null;
    }

    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }
}
