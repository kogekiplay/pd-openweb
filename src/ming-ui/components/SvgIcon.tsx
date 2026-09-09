import React from 'react';
import { ReactSVG } from 'react-svg';

// react-svg 19 把 beforeInjection / afterInjection 存进内部的 callbacksRef，而注入 effect 的
// 依赖数组是固定的 [desc, evalScripts, httpRequestWithCredentials, renumerateIRIElements,
// src, title, useRequestCache, wrapper]——两个回调都不在里面。也就是说【只有 src 变了才会重新注入】，
// fill / size 变了回调压根不会再跑一次，颜色和尺寸会永远停在首次注入时的值。
//
// v11 时代看不出来：那是个类组件，componentDidUpdate 里 shallowDiffers(prevProps, this.props)
// 一比就 removeSVG + renderSVG，而 beforeInjection 是内联箭头、每次渲染都是新函数，
// 于是每渲染必重新注入——很浪费，但顺带掩盖了这个问题。11→19 之后就暴露成
// 「切换左侧表单后，上一个表单的图标还是选中色，新选中的反而不变色」。
//
// 所以这里不再把真值写进注入产物，而是让 svg 只引用 currentColor 和一个 CSS 变量，
// 真值放在 wrapper 的 inline style 上由 React 正常更新，完全不依赖重新注入。
// ReactSVG 会把未识别的 props（含 style）展开到 wrapper 元素上，svg 是它的后代，
// color 与自定义属性都会继承下去。
const SVG_SIZE_VAR = '--svg-icon-size';

export default ({ url = '', size = 24, fill = '#1677ff', className, addClassName = '' }) => {
  return (
    <ReactSVG
      className={className}
      src={url}
      // 这里必须再兜一次底，不能只靠上面的默认参数：JS 默认参数只对 undefined 生效，
      // 实参是 null 或 '' 时会原样传进来，React 会把 style.color 当作「删除该声明」处理，
      // wrapper 就没有 inline color 了，svg 的 currentColor 会一路继承到祖先的文字色。
      // 旧实现是把这些值直接写进 svg 的 fill 属性（fill="null" / fill=""），属无效值、退化成黑色。
      // 全仓有 40 处 fill 是取服务端数据的动态表达式（如 _.get(item, 'appIconColor')）会踩到。
      // as any：React 的 CSSProperties 不认 CSS 自定义属性（TS2353），断言是这个场景的常规写法。
      style={{ color: fill || '#1677ff', [SVG_SIZE_VAR]: `${size}px` } as any}
      beforeInjection={svg => {
        if (addClassName) {
          svg.classList.add(...addClassName.split(' '));
        }

        const styleTags = svg.querySelectorAll('style');
        const styleTagArray = styleTags.length !== undefined ? styleTags : [styleTags];

        if (styleTagArray.length) {
          const uniqKey = 'svg_' + Math.random().toString(36).substring(2, 10);
          svg.classList.add(uniqKey);
          styleTagArray.forEach(styleTag => {
            styleTag.textContent = styleTag.textContent.replace(/\.([a-zA-Z0-9_-]+)/g, `.${uniqKey} .$1`);
          });
        }

        // 尺寸与颜色都只写「引用」，不写真值——真值在上面 wrapper 的 style 里。
        svg.setAttribute('style', `width: var(${SVG_SIZE_VAR});height: var(${SVG_SIZE_VAR});vertical-align: top;`);
        svg.setAttribute('fill', 'currentColor');
      }}
      // react-svg v12 起 afterInjection 的签名从 (error, svg) 改成 (svg)，失败走独立的 onError。
      // 保留旧的两参写法不会报运行时错误，但 error 会接到 svg 本身（真值），
      // 于是下面整段 title 移除 + fill 剥离会被 `if (error) return` 静默跳过。
      afterInjection={svg => {
        const el = svg.getElementsByTagName('title')[0];

        if (el) {
          try {
            svg.removeChild(el);
          } catch (error) {
            console.error(error);
          }
        }

        if (
          svg &&
          svg.querySelectorAll('*') &&
          svg.querySelectorAll('*').length > 0 &&
          url.indexOf('_preserve.svg') === -1
        ) {
          try {
            // 只剥后代的 fill，根节点上那个 currentColor 要留着；剥掉后代后它们就继承根节点。
            svg.querySelectorAll('*').forEach(item => item.removeAttribute('fill'));
          } catch (error) {
            console.error(error);
          }
        }
      }}
    />
  );
};
