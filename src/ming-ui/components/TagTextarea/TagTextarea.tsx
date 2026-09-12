import React from 'react';
import { createRoot } from 'react-dom/client';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { Tooltip } from 'ming-ui/antd-components';
import { MODE } from './enum';
import loadCodeMirror from './loadCodeMirror';
import { computeTagMarks, sanitizeInput } from './tagMarks';
import './TagTextarea.less';

// CodeMirror 6。CM5 → CM6 迁移的第 3 步（最后一步）。
//
// 这个组件是仓里 CM5 用得最深的一处：26 个消费方，而且其中 15 个直接把
// `.cmObj`（一个 CM5 实例）当编辑器句柄用。那个句柄已经整个去掉，换成本组件
// 自己的 offset 方法（见下面 getCursor / replaceRange 一带的注释）。
// CM5 与 CM6 的差异集中在三处：
//   1. markText({replacedWith}) → Decoration.replace({widget}) —— 坐标从
//      {line, ch} 变成全文绝对 offset（换算逻辑抽到 tagMarks.ts 并做了差分验证）
//   2. beforeChange 里 obj.cancel() / obj.update() 的输入拦截
//      → EditorState.transactionFilter（返回 [] 取消，返回新 spec 改写）
//   3. CM5 的 change 事件对象（origin / text[] / removed[]）是对外契约的一部分，
//      工作流公式那边真的在读它，所以在 updateListener 里重建了同样形状的对象。

// 我们自己发起的改动带上 CM5 时代的 origin 字符串。
// 不能只靠 CM6 的 Transaction.userEvent：外部 replaceRange 会传 'insertfn'
// 'insertfield' 这类自定义 origin，而消费方（工作流公式）拿 origin 做分支判断。
let CM5_ORIGIN = null;
let MarkWidget = null;

// CM6 的 WidgetType 要在模块异步加载完之后才拿得到，所以这两个只能延迟构造。
function initCmGlobals({ state, view }) {
  if (!CM5_ORIGIN) CM5_ORIGIN = state.Annotation.define();

  if (MarkWidget) return;

  MarkWidget = class extends view.WidgetType {
    owner;
    mark;
    root;

    constructor(owner, mark) {
      super();
      this.owner = owner;
      this.mark = mark;
      this.root = null;
    }

    // 【刻意恒为 false】。CM6 在 eq() 为真时会复用旧 DOM、不再调 toDOM，
    // 但 renderTag 的输出并不只取决于 tag id —— 它闭包着消费方的 props
    // （比如字段列表，决定这个 tag 该显示字段名还是「字段已删除」）。
    // CM5 那边每次文档变化都是 clear 全部 marker 再整批重画，也就是每次都重新
    // 调一遍 renderTag。返回 false 就是把这个行为一比一保留下来；
    // 返回 true 的话，字段列表更新之后 tag 会停在旧样子。
    // 代价（每次输入重建 React root）与 CM5 完全相同——CM5 也是每个 marker
    // 每次都 createRoot + render，所以不是新增开销。
    eq() {
      return false;
    }

    toDOM() {
      const { mark, owner } = this;

      if (mark.kind === 'operator') {
        const el = document.createElement('span');
        el.classList.add('operator');
        // CM5 那边是 innerHTML = pos.tag。操作符只有 +-*/(), 这几个字符，
        // 两种写法等价，但 textContent 不给未来留 XSS 的口子。
        el.textContent = mark.tag;

        return el;
      }

      const node = document.createElement('div');
      node.classList.add('columnTagCon');
      const { renderTag } = owner.props;

      if (_.isFunction(renderTag)) {
        const tag = renderTag(mark.tag, { isLast: mark.isLast });

        if (React.isValidElement(tag)) {
          // CM5 需要一个 TagWrapper + onDidMount 回调，等 React 提交完拿到节点
          // 才能调 markText。CM6 的 toDOM 只要求返回节点，React 之后往里填就行，
          // 所以那套回调整个不需要了。
          this.root = createRoot(node);
          this.root.render(tag);
        } else if (tag) {
          node.appendChild(tag);
        }

        return node;
      }

      node.append(mark.tag);

      return node;
    }

    destroy() {
      // CM5 的 markText 从来没 unmount 过这些 React root（clear() 只丢 DOM），
      // 也就是每次输入都漏一个 root。CM6 给了 destroy 钩子，顺手补上。
      // 延到微任务：CM6 可能在自己的 update 周期里调 destroy，
      // 这时同步 unmount 会撞上 React「不能在渲染过程中同步卸载」的警告。
      const root = this.root;
      this.root = null;

      if (root) queueMicrotask(() => root.unmount());
    }

    // CM5 那边是 handleMouseEvents: true —— 由编辑器接管 widget 内的鼠标事件
    // （点 tag 会正常落光标）。CM6 的 ignoreEvent 默认返回 true（编辑器不管），
    // 要返回 false 才等价。tag 上的 Tooltip 靠 mouseenter/leave，
    // 不在编辑器处理的事件集合里，不受影响。
    ignoreEvent() {
      return false;
    }
  };
}

export default class TagTextarea extends React.Component<any, any> {
  static propTypes = {
    noCursor: PropTypes.bool,
    className: PropTypes.string,
    mode: PropTypes.number,
    rightIcon: PropTypes.bool,
    readonly: PropTypes.bool,
    operatorsSetMargin: PropTypes.bool,
    defaultValue: PropTypes.string,
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    maxHeight: PropTypes.number,
    renderTag: PropTypes.func,
    getRef: PropTypes.func,
    onAddClick: PropTypes.func,
    onChange: PropTypes.func,
    onFocus: PropTypes.func,
    onBlur: PropTypes.func,
    codeMirrorMode: PropTypes.string,
    lineNumbers: PropTypes.bool,
  };

  static defaultProps = {
    mode: MODE.TEXT,
    operatorsSetMargin: false,
    defaultValue: '',
    noCursor: false,
    lineNumbers: false,
    getRef: () => {},
    onAddClick: () => {},
    onChange: () => {},
    onFocus: () => {},
    onBlur: () => {},
  };

  // 这些原来都是隐式挂上去的。TS 下不声明会变成 TS2339，
  // 而 babel 只做类型擦除、不会报错，属于「构建绿但类型不干净」那一类。
  cmcon;
  view;
  cm;
  unmounted;
  pendingValue;
  tempValue;
  tempObj;
  marksField;
  forceRemark;
  heightRaf;

  constructor(props) {
    super(props);
    this.state = {
      active: false,
    };
  }

  componentDidMount() {
    this.props.getRef(this);
    this.initCodeMirror();
  }

  componentWillUnmount() {
    this.unmounted = true;
    this.props.getRef(undefined);

    if (this.heightRaf) {
      cancelAnimationFrame(this.heightRaf);
      this.heightRaf = null;
    }

    // CM5 那版没有这一步——编辑器和它的事件监听会随组件一起漏掉。
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }

  initCodeMirror = () => {
    const { defaultValue, height, readonly, placeholder, codeMirrorMode, lineNumbers } = this.props;

    if (!this.cmcon) return;

    loadCodeMirror(codeMirrorMode).then(cm => {
      if (this.unmounted || !this.cmcon) return;

      initCmGlobals(cm);
      this.cm = cm;

      const { EditorState, StateField, StateEffect, RangeSetBuilder } = cm.state;
      const { EditorView, Decoration, keymap, lineNumbers: lineNumbersExt, placeholder: placeholderExt } = cm.view;
      const { defaultKeymap, history, historyKeymap } = cm.commands;
      const { syntaxHighlighting, defaultHighlightStyle } = cm.language;

      const nextValue = _.isUndefined(this.pendingValue) ? defaultValue : this.pendingValue;

      const buildDecorations = state => {
        const { mode, operatorsSetMargin } = this.props;
        const withOperators = mode === MODE.FORMULA || mode === MODE.DATE || operatorsSetMargin;
        const builder = new RangeSetBuilder();
        computeTagMarks(state.doc.toString(), { withOperators }).forEach(mark => {
          builder.add(mark.from, mark.to, Decoration.replace({ widget: new MarkWidget(this, mark) }));
        });

        return builder.finish();
      };

      // updateTextareaView() 是对外的公开方法（工作流消息节点在 props 变化后会调它
      // 强制重画 tag）。CM6 的 StateField 只在文档变化时重算，所以还需要一个
      // 显式的「重画」信号。
      const forceRemark = StateEffect.define();
      const marksField = StateField.define({
        create: buildDecorations,
        update: (deco, tr) =>
          tr.docChanged || tr.effects.some(e => e.is(forceRemark)) ? buildDecorations(tr.state) : deco,
        provide: f => EditorView.decorations.from(f),
      });
      this.forceRemark = forceRemark;
      this.marksField = marksField;

      const extensions = [
        // CM5 的 lineWrapping: true
        EditorView.lineWrapping,
        marksField,
        // tag 是折叠区间，方向键/删除要把它当成一个整体跳过或整块删掉。
        // CM5 的 replacedWith 天生就是折叠且原子的，CM6 得显式声明。
        EditorView.atomicRanges.of(v => v.state.field(marksField)),
        history(),
        keymap.of([...historyKeymap, ...defaultKeymap]),
        EditorState.transactionFilter.of(this.filterTransaction),
        EditorView.updateListener.of(this.handleUpdate),
        EditorView.domEventHandlers({
          focus: () => {
            if (this.cmcon) this.cmcon.classList.add('active');

            this.props.onFocus();

            return false;
          },
          blur: () => {
            if (this.cmcon) this.cmcon.classList.remove('active');

            this.flushComposition();
            this.props.onBlur();

            return false;
          },
          // CM5 是在 change 回调里 setTimeout(1) 轮询 display.input.composing，
          // CM6 直接有 compositionend 事件可挂。
          compositionend: () => {
            setTimeout(this.flushComposition, 0);

            return false;
          },
        }),
      ];

      if (lineNumbers) extensions.push(lineNumbersExt());

      if (placeholder) extensions.push(placeholderExt(placeholder));

      // CM5 的 readOnly: true 仍然允许聚焦和选中复制（只是拒绝改动），
      // 对应 EditorState.readOnly，而不是 EditorView.editable.of(false)
      //（后者会把 contenteditable 关掉，连选中都做不了）。
      // 光标的隐藏（CM5 的 cursorHeight: 0）交给 CSS，见 render 里的 noCursor 类。
      if (readonly) extensions.push(EditorState.readOnly.of(true));

      // CM5 的 mode 是全局注册 + 字符串引用，CM6 是显式的 LanguageSupport 值。
      // 染色也要显式挂：CM5 的颜色来自 codemirror.css 自带的默认主题，
      // 那份 CSS 已经不再引入了。
      if (cm.lang) extensions.push(cm.lang, syntaxHighlighting(defaultHighlightStyle, { fallback: true }));

      this.view = new EditorView({
        state: EditorState.create({ doc: nextValue || '', extensions }),
        parent: this.cmcon,
      });

      // CM5 的 setSize('100%', h)。写成行内样式而不是 EditorView.theme，
      // 是因为 TagTextarea.less 里 `.tagInputarea:not(.autoHeight) .cm-editor`
      // 的选择器权重高过 theme 注入的单类名，theme 会被压掉。
      if (height) {
        this.view.dom.style.width = '100%';
        this.view.dom.style.height = typeof height === 'number' ? `${height}px` : height;
      }

      this.scheduleHeightSync();
    });
  };

  /**
   * 对外的编辑器操作方法，坐标一律是【全文绝对 offset】。
   *
   * CM5 时代这些是挂在 `this.cmObj` 上的一个 CodeMirror 实例，仓里 15 个文件
   * 直接拿它当编辑器句柄用（getCursor/setCursor/replaceRange…），坐标是 {line, ch}。
   * 这次迁移把 cmObj 整个去掉了：内核是原生 CM6，对外也就没有「cm 对象」这回事，
   * 改成组件自己的方法。line/ch 也一并去掉——CM6 内部只有 offset，
   * 留着 line/ch 等于在每个调用点两边各换算一次，纯属自找麻烦。
   *
   * 仍需要 line/ch 的地方用 lineAt(offset) 拿。想直接用 CM6 API 的用 `.view`。
   */
  getValue = () => (this.view ? this.view.state.doc.toString() : this.pendingValue);

  /** 光标位置（全文绝对 offset）。编辑器还没就绪时返回 undefined。 */
  getCursor = () => (this.view ? this.view.state.selection.main.head : undefined);

  setCursor = offset => {
    if (!this.view) return;

    const max = this.view.state.doc.length;
    this.view.dispatch({
      selection: { anchor: Math.min(Math.max(offset || 0, 0), max) },
      scrollIntoView: true,
    });
  };

  /** offset 换行列，给少数确实需要行号的调用点（如按行定位联想弹层） */
  lineAt = offset => {
    if (!this.view) return undefined;

    const line = this.view.state.doc.lineAt(Math.min(Math.max(offset || 0, 0), this.view.state.doc.length));

    return { line: line.number - 1, ch: offset - line.from, from: line.from, to: line.to, text: line.text };
  };

  lineCount = () => (this.view ? this.view.state.doc.lines : 0);

  /**
   * 替换 [from, to) 为 text。to 省略时为纯插入。
   * origin 会原样出现在 onChange 第三个参数的 origin 上（沿用 CM5 的那套字符串）。
   */
  replaceRange = (text, from, to, origin) => {
    if (!this.view) return;

    const max = this.view.state.doc.length;
    const f = Math.min(Math.max(from || 0, 0), max);
    const t = _.isNumber(to) ? Math.min(Math.max(to, f), max) : f;
    const insert = String(text);
    this.view.dispatch({
      changes: { from: f, to: t, insert },
      // CM6 默认把光标映射到插入内容【之前】（assoc = -1），
      // 而 CM5 的 replaceRange 把光标留在插入内容之后。必须显式指定，
      // 否则连续插入会得到反序的结果（第 2 步 FunctionEditor 上踩过这个坑）。
      selection: { anchor: f + insert.length },
      annotations: CM5_ORIGIN.of(origin || '+input'),
      scrollIntoView: true,
    });
  };

  focus = () => {
    if (this.view) this.view.focus();
  };

  /** scrollToEnd 的通用形式；目前只被它用到，留着是因为 offset 版滚动是个自然的原语 */
  scrollIntoView = (offset, margin) => {
    if (!this.view) return;

    const max = this.view.state.doc.length;
    this.view.dispatch({
      effects: this.cm.view.EditorView.scrollIntoView(
        Math.min(Math.max(offset || 0, 0), max),
        _.isNumber(margin) ? { yMargin: margin } : undefined,
      ),
    });
  };

  /** 滚到文末（原来消费方是自己 scrollIntoView({line: lineCount()-1, ch: 0}, 50)） */
  scrollToEnd = () => this.scrollIntoView(this.view ? this.view.state.doc.length : 0, 50);

  /**
   * 滚动位置。对应 CM5 的 getScrollInfo() / scrollTo(left, top)——
   * 消费方用它在 setValue 前后保住滚动条不跳。CM6 没有专门的 API，
   * 滚动容器就是 .cm-scroller（view.scrollDOM），直接读写它即可。
   */
  getScrollPos = () =>
    this.view ? { left: this.view.scrollDOM.scrollLeft, top: this.view.scrollDOM.scrollTop } : null;

  setScrollPos = pos => {
    if (!this.view || !pos) return;

    this.view.scrollDOM.scrollLeft = pos.left || 0;
    this.view.scrollDOM.scrollTop = pos.top || 0;
  };

  /** CM6 的 userEvent / 自定义注解 → CM5 时代的 origin 字符串 */
  originOf = tr => {
    const own = tr.annotation(CM5_ORIGIN);

    if (own) return own;

    if (tr.isUserEvent('undo')) return 'undo';

    if (tr.isUserEvent('redo')) return 'redo';

    if (tr.isUserEvent('input.paste')) return 'paste';

    if (tr.isUserEvent('delete')) return '+delete';

    if (tr.isUserEvent('input.type.compose')) return '*compose';

    return tr.docChanged ? '+input' : '';
  };

  /**
   * CM5 beforeChange 的等价物。
   * 返回 tr 放行，返回 [] 取消，返回新的 spec 则改写这次改动。
   */
  filterTransaction = tr => {
    if (!tr.docChanged) return tr;

    const origin = this.originOf(tr);

    if (origin === 'undo' || origin === 'redo') return tr;

    // 事件内 mode 只能每次从 this.props 取，不然取不到最新（CM5 时代就有这条注释）
    const { mode } = this.props;
    // CM5 放行的就是这三种：删除、插字段、setValue。
    // 注意 'insertfn' / 'insertfield' 不在其中——CM5 那边它们也是要过滤的。
    const exempt = origin === '+delete' || origin === 'inserttag' || origin === 'setValue';

    if (mode === MODE.ONLYTAG && !exempt) return [];

    if (exempt) return tr;

    if (mode !== MODE.FORMULA && mode !== MODE.DATE) return tr;

    const kind = mode === MODE.FORMULA ? 'formula' : 'date';
    const isPaste = origin === 'paste';
    const changes = [];
    let dirty = false;
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      const raw = inserted.toString();
      const next = sanitizeInput(raw, { mode: kind, isPaste });

      if (next !== raw) dirty = true;

      changes.push({ from: fromA, to: toA, insert: next });
    });

    if (!dirty) return tr;

    // changes 里的 from/to 都是 startState 坐标，所以要把前面各段改动引起的
    // 长度差累加起来，才知道最后一段插完之后光标落在哪。
    let delta = 0;
    let anchor = 0;

    for (const c of changes) {
      anchor = c.from + delta + c.insert.length;
      delta += c.insert.length - (c.to - c.from);
    }

    // 返回新 spec 会丢掉原 tr 上的注解，得把 origin 带回去，
    // 否则 handleUpdate 里认不出这是 paste 还是 +input。
    return { changes, selection: { anchor }, scrollIntoView: tr.scrollIntoView, annotations: CM5_ORIGIN.of(origin) };
  };

  handleUpdate = update => {
    if (!update.docChanged) return;

    this.scheduleHeightSync();

    const value = update.state.doc.toString();
    const obj = this.toChangeObj(update);

    // CM5：setValue 引起的 change 不往外抛
    if (obj.origin === 'setValue') return;

    if (obj.origin === '*compose' || update.view.composing) {
      this.tempValue = value;
      this.tempObj = obj;
      // 兜底：有些输入法直接提交、不发 compositionend，
      // 靠这一跳把值吐出去（CM5 那边也是 setTimeout(1) 兜的）。
      setTimeout(() => {
        if (this.view && !this.view.composing) this.flushComposition();
      }, 1);

      return;
    }

    this.props.onChange(null, value, obj);
  };

  flushComposition = () => {
    if (_.isUndefined(this.tempValue)) return;

    this.props.onChange(null, this.tempValue, this.tempObj);
    this.tempValue = undefined;
    this.tempObj = undefined;
  };

  /**
   * 重建 CM5 change 事件对象的形状：{ origin, text[], removed[], from, to }。
   *
   * 这是对外契约的一部分，不是内部细节：
   * workflow/Detail/Formula 会读 obj.origin / obj.text[0] / obj.removed[0]
   * 来维护函数联想的匹配串。CM5 的 text / removed 是【按行切开的数组】。
   */
  toChangeObj = update => {
    const origin = update.transactions.length
      ? update.transactions.map(this.originOf).find(Boolean) || '+input'
      : '+input';
    const text = [];
    const removed = [];
    let from = null;
    let to = null;
    update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      if (from === null) {
        // from / to 也是全文绝对 offset（CM5 时代是 {line, ch}）。
        // 目前没有消费方读它们——工作流公式只读 origin / text[0] / removed[0]——
        // 但既然对外坐标已统一成 offset，这里也别再留一处 line/ch。
        from = fromA;
        to = toA;
      }

      text.push(...inserted.toString().split('\n'));
      removed.push(...update.startState.doc.sliceString(fromA, toA).split('\n'));
    });

    return { origin, text, removed, from, to };
  };

  /**
   * maxHeight 到了就固定高度，否则跟着内容长。
   * 不传 maxHeight 的消费方只靠这里的默认 500 封顶（JSX 上的 style.maxHeight 此时是
   * undefined），所以这个函数不是可有可无的。
   *
   * 量的元素从 CM5 的 .CodeMirror-sizer 换成 CM6 的 .cm-content
   *（都是包住全部行、撑出内容高度的那一层）。
   *
   * 一并顺手（同时也是 measure 里必须的）：也切 autoHeight 类，沿用 CM5 的写法。
   * 注意这个类【实际上不命中任何 CSS】——TagTextarea.less 里的规则是
   * `.tagInputarea.autoHeight`（外层 div），而这里切的是内层 .tagInputareaIuput，
   * CM5 时代就是这样。留着只为不改变 DOM 表现，别指望它有样式效果。
   */
  syncHeight = () => {
    const { maxHeight = 500 } = this.props;

    if (!this.cmcon) return;

    const content = this.cmcon.querySelector('.cm-content');

    if (!content) return;

    if (content.clientHeight >= maxHeight - 2) {
      this.cmcon.classList.remove('autoHeight');
      this.cmcon.style.height = maxHeight + 'px';
    } else {
      this.cmcon.classList.add('autoHeight');
      this.cmcon.style.height = 'auto';
    }
  };

  /**
   * 同步量一次 + 下一帧再量一次。
   *
   * 为什么需要第二次：字段标签是 React 根异步填进 widget 的（CM6 的 toDOM 只返回
   * 空节点，内容随后才提交），所以在 CM6 的 update 周期里量到的高度还没算上标签内容。
   * 纯文本不受影响（真机实测：60 行文本能正确封顶到 500），但一个装满标签的
   * ONLYTAG 输入框可能撑过 500 却量不出来。CM5 更早——它在 beforeChange 里量，
   * 量的是【改动前】的高度，比这里还慢一拍，所以这不是回归，是把它修对。
   */
  scheduleHeightSync = () => {
    this.syncHeight();

    if (this.heightRaf) return;

    this.heightRaf = requestAnimationFrame(() => {
      this.heightRaf = null;

      if (!this.unmounted) this.syncHeight();
    });
  };

  /** 强制重画全部 tag（props 变了但文档没变时用） */
  updateTextareaView = () => {
    if (!this.view) return;

    this.view.dispatch({ effects: this.forceRemark.of(null) });
  };

  setValue = value => {
    this.pendingValue = value || '';

    if (!this.view) return;

    const next = value || '';
    const current = this.view.state.doc.toString();

    if (next === current) {
      // CM5 的 setValue 即便内容相同也会派发一次 change，从而重画一遍 tag。
      // 这里跳过全文替换（那会把光标和滚动位置打回原点），但把重画补上。
      this.updateTextareaView();

      return;
    }

    this.view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
      annotations: CM5_ORIGIN.of('setValue'),
    });
  };

  insertColumnTag = id => {
    if (!this.view) return;

    const { mode, autoComma } = this.props;
    const at = this.view.state.selection.main.head;
    const value = this.view.state.doc.toString();
    // CM5 这里是 editorValue[position.ch - 1] —— 拿【列号】去索引【全文】，
    // 多行时读的是错的字符。单行（绝大多数场景）两者相同。这里用绝对 offset。
    const insert = `${mode === MODE.FORMULA && autoComma && value[at - 1] === '$' ? ',' : ''}$${id}$`;
    this.view.dispatch({
      changes: { from: at, to: at, insert },
      // 同 replaceRange：CM6 默认把光标映射到插入内容之前
      selection: { anchor: at + insert.length },
      annotations: CM5_ORIGIN.of('inserttag'),
      scrollIntoView: true,
    });
    this.view.focus();

    if (this.cmcon) {
      this.cmcon.scrollTop = this.cmcon.scrollHeight - this.cmcon.clientHeight;
    }
  };

  handleBlur = () => {
    this.setState({ active: false });
  };

  render() {
    const { className, maxHeight, rightIcon, onAddClick, noCursor, readonly } = this.props;
    return (
      <div className={cx('tagInputarea', className, { flexRow: rightIcon })}>
        <div
          className={cx('tagInputareaIuput autoHeight borderColorPrimary', {
            'flex hasRightIcon': rightIcon,
            // CM5 的 cursorHeight: 0。CM6 用的是原生光标，靠 caret-color 藏。
            noCursor: noCursor || readonly,
          })}
          ref={con => { this.cmcon = con; }}
          style={{ maxHeight }}
        />
        {rightIcon && (
          <Tooltip title={_l('添加字段')}>
            <span className="rightIcon Hand hoverColorPrimary" onClick={onAddClick}>
              <i className="icon icon-workflow_other"></i>
            </span>
          </Tooltip>
        )}
      </div>
    );
  }
}

export { getRePosFromStr } from './tagMarks';
