import { Component } from 'react';
import type { ChangeEvent, CSSProperties, TextareaHTMLAttributes } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import PropTypes from 'prop-types';
import './less/Textarea.less';

// 其余属性原样落到 <textarea> 上
interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  /** 自动撑高的上下限，原样写进 style，默认 100 / 10000（px） */
  minHeight?: CSSProperties['minHeight'] | undefined;
  maxHeight?: CSSProperties['maxHeight'] | undefined;
  /** 挂载后全选文字 */
  isSelect?: boolean | undefined;
  /** 挂载时、以及由 false 变成 true 时聚焦并把光标放到末尾 */
  isFocus?: boolean | undefined;
  /** 参数是输入后的文字 */
  onChange?: ((value: string, event: ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  /** 失焦时也重算一次高度 */
  resizeAfterBlur?: boolean | undefined;
  manualRef?: ((textarea: HTMLTextAreaElement | null) => void) | undefined;
  /** 聊天输入框用：算高度前多归零一次（adjustHeight 开头已统一归零，现在和不传效果相同） */
  chat?: boolean | undefined;
}

class Textarea extends Component<TextareaProps, { defaultValue?: TextareaProps['defaultValue'] }> {
  declare textarea: HTMLTextAreaElement | null;

  static override propTypes = {
    minHeight: PropTypes.number,
    maxHeight: PropTypes.number,
    maxLength: PropTypes.number,
    className: PropTypes.string,
    defaultValue: PropTypes.string,
    placeholder: PropTypes.string,
    isSelect: PropTypes.bool,
    isFocus: PropTypes.bool,
    onChange: PropTypes.func,
    onKeyDown: PropTypes.func,
    onBlur: PropTypes.func,
    resizeAfterBlur: PropTypes.bool,
    name: PropTypes.string, // 表单item名字
    manualRef: PropTypes.func,
    chat: PropTypes.bool,
  };

  static defaultProps = {
    minHeight: 100,
    maxHeight: 10000,
    defaultValue: '',
    resizeAfterBlur: false,
    chat: false,
    manualRef: () => {},
  };

  override componentDidMount() {
    const { textarea } = this;
    // ref 在 componentDidMount 之前就挂上了，这里只是让类型知道它不是 null
    if (!textarea) return;
    const $textarea = $(textarea);
    const events = this.props.resizeAfterBlur ? 'input keyup blur' : 'input keyup';
    const { chat } = this.props;
    this.adjustHeight($textarea, chat);
    $textarea.on(events, () => {
      this.adjustHeight($textarea, chat);
    });

    if (this.props.isSelect) {
      $textarea.select();
    }

    if (this.props.isFocus) {
      textarea.focus({ preventScroll: true });
      this.moveCaretToEnd(textarea);
    }

    setTimeout(() => {
      this.adjustHeight($textarea, chat);
    }, 0);
  }

  // 获取最近的滚动容器
  getScrollParent(element: HTMLElement | null) {
    if (!element) return null;
    let parent = element.parentElement;

    while (parent) {
      const { overflow, overflowY } = window.getComputedStyle(parent);

      if (overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll') {
        return parent;
      }

      parent = parent.parentElement;
    }

    return null;
  }

  // 调整高度时保持滚动位置
  adjustHeight($textarea: JQuery<HTMLTextAreaElement>, chat: boolean | undefined) {
    if (!this.textarea) return;
    const scrollParent = this.getScrollParent(this.textarea);
    const scrollTop = scrollParent ? scrollParent.scrollTop : 0;

    // 先重置高度为 0，确保 scrollHeight 是基于当前实际 padding 计算的
    $textarea.height(0);

    // 获取当前实际应用的 padding（可能被 CSS 覆盖了）
    const diff = parseInt($textarea.css('paddingBottom'), 10) + parseInt($textarea.css('paddingTop'), 10) || 0;

    const scrollHeight = this.textarea.scrollHeight;

    if (chat) {
      $textarea.height(0).height(scrollHeight - diff);
    } else {
      $textarea.height(scrollHeight - diff);
    }

    // 恢复滚动位置
    if (scrollParent && scrollParent.scrollTop !== scrollTop) {
      scrollParent.scrollTop = scrollTop;
    }
  }

  override componentDidUpdate(prevProps: TextareaProps) {
    const { textarea } = this;
    // 下面的 setState 只为在回调里做 DOM 操作（render 不读 state），没有 textarea 时整段都是空转
    if (!textarea) return;
    if (!shallowEqual(prevProps, this.props)) {
      const $textarea = $(textarea);

      // 处理 isFocus 变化
      if (this.props.isFocus && !prevProps.isFocus) {
        textarea.focus({
          preventScroll: true,
        });
        this.moveCaretToEnd(textarea);
      }

      this.setState(
        {
          defaultValue: this.props.defaultValue,
        },
        () => {
          $textarea.trigger('input');
          this.adjustHeight($textarea, prevProps.chat);
        },
      );
    }
  }

  // 原来还有 IE 的 createTextRange 分支：textarea 的 selectionStart 在所有支持的浏览器里都是数字，那一支走不到
  moveCaretToEnd(el: HTMLTextAreaElement) {
    el.selectionStart = el.selectionEnd = el.value.length;
  }

  onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (this.props.onChange) {
      this.props.onChange(event.target.value, event);
    }
  }

  override render() {
    // 【isSelect / isFocus / resizeAfterBlur / chat 也要解构掉】它们都在上面的 propTypes 里，
    // 是本组件自己消费的（见 componentDidMount / onBlur / 样式分支），
    // 漏掉就会随 ...rest 落到真实 <textarea> 上，React 逐个报
    //   Received `true` for a non-boolean attribute `chat`.
    //   React does not recognize the `isFocus` prop on a DOM element
    const {
      minHeight,
      maxHeight,
      className,
      style,
      value,
      defaultValue,
      manualRef,
      isSelect,
      isFocus,
      resizeAfterBlur,
      chat,
      ...rest
    } = this.props;
    const obj = value !== undefined ? { value } : { defaultValue };

    return (
      <textarea
        name="textarea"
        autoComplete="off"
        {...rest}
        {...obj}
        className={cx('ming Textarea', className)}
        ref={textarea => {
          this.textarea = textarea;
          // 运行时一定有（defaultProps 给了空函数），?. 只是因为类型上它是可选属性
          manualRef?.(textarea);
        }}
        onChange={event => this.onChange(event)}
        style={{
          minHeight,
          maxHeight,
          ...style,
        }}
      />
    );
  }
}

export default Textarea;
