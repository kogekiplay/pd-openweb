import isPropValid from '@emotion/is-prop-valid';

/**
 * styled-components 6 的 prop 过滤器。
 *
 * 【它解决什么】v6 起 styled 会把收到的全部 prop 原样转发给宿主元素，于是模板里那些
 * 只用来算样式的自定义 prop（isEditing / titleColor / showMaskValue ……）会一路落到
 * DOM 上，控制台刷 `React does not recognize the xxx prop on a DOM element`
 * 和 `Received true for a non-boolean attribute`。
 *
 * 【为什么不逐个改成瞬态 prop（$ 前缀）】全仓在 styled 模板里解构的自定义 prop 有上百个，
 * 逐个改要动几百处调用点，且新写的代码随时会再引入一个。这里用的是官方告警文案推荐的方案。
 *
 * 【为什么是安全的】只在 target 是【原生标签】时过滤；styled(SomeComponent) 一律放行，
 * 组件自己的 prop 不受影响。而被过滤掉的那些本来就没进 DOM —— React 对驼峰命名的未知
 * prop 是丢弃 + 警告，不是渲染成属性。也就是说只消掉警告，不改变任何实际渲染结果。
 *
 * 【必须每个 React root 各挂一次】StyleSheetManager 靠 context 生效，styled-components
 * 没有全局开关。preall 里挂了一次只覆盖主应用树；functionWrap 这类 createRoot 出来的
 * 独立树是另一棵，不挂就漏 —— 记录弹窗那一片告警当初就是这么来的。
 */
export default function shouldForwardProp(propName: string, target: unknown): boolean {
  return typeof target === 'string' ? isPropValid(propName) : true;
}
