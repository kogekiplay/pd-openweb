import React from 'react';

/**
 * 设置页面标题。react-document-title 的【就地替代】，API 逐字兼容：
 *   <DocumentTitle title="x" />            只设标题，不渲染内容
 *   <DocumentTitle title="x">{child}</DocumentTitle>  设标题并渲染唯一的子节点
 *
 * 【为什么不继续用那个包】react-document-title 已停止维护，内部通过 react-side-effect
 * 使用 componentWillMount —— React 每次挂载都会打印
 *   componentWillMount has been renamed, and is not recommended for use.
 *   Please update the following components: SideEffect(DocumentTitle)
 * 而且 React 18.x 起只认 UNSAFE_ 前缀，这条早晚会从告警变成真的不工作。
 * 全仓 62 处在用，包本身只有几十行，自己实现比等上游修更实在。
 *
 * 【语义照搬原包】原包的 reducePropsToState 取 propsList 的【最后一个】，
 * 也就是「最后挂载的那个赢」，而不是按 DOM 层级算内外。这里用同一个规则：
 * 维护一个挂载顺序的列表，每次增删都重算，取列表末尾那个的 title。
 *
 * 【有一处故意与原包不同】原包在最后一个实例卸载后会把标题置为空串
 *（handleStateChangeOnClient 里 `title || ''`），页面切换时标题会闪一下空白。
 * 这里改成回落到【首次接管前的原始标题】，行为更合理，且不会有任何调用点依赖
 * 「标题被清空」这件事。
 */

interface DocumentTitleProps {
  title?: string;
  children?: React.ReactNode;
}

/** 按挂载顺序记录的实例，末尾的那个说了算 */
const mountedInstances: DocumentTitle[] = [];

/** 第一次接管之前的标题，最后一个实例卸载后回落到它 */
let titleBeforeTakeover: string | undefined;

function syncTitle(): void {
  if (typeof document === 'undefined') return;

  if (titleBeforeTakeover === undefined) {
    titleBeforeTakeover = document.title;
  }

  const last = mountedInstances[mountedInstances.length - 1];
  const next = last && typeof last.props.title === 'string' ? last.props.title : titleBeforeTakeover;

  // 【要比一下再赋值】无条件写 document.title 会让部分浏览器把它当成一次导航变更，
  // 原包也是这么做的。
  if (next !== document.title) {
    document.title = next;
  }
}

export default class DocumentTitle extends React.Component<DocumentTitleProps> {
  override componentDidMount() {
    mountedInstances.push(this);
    syncTitle();
  }

  override componentDidUpdate(prevProps: DocumentTitleProps) {
    if (prevProps.title !== this.props.title) {
      syncTitle();
    }
  }

  override componentWillUnmount() {
    const i = mountedInstances.indexOf(this);

    if (i > -1) {
      mountedInstances.splice(i, 1);
    }

    syncTitle();
  }

  override render() {
    // 与原包一致：有子节点就渲染【唯一的那个】，没有就什么都不渲染
    return this.props.children ? React.Children.only(this.props.children) : null;
  }
}
