import React from 'react';
import { ReactSVG } from 'react-svg';

export default ({ url = '', size = 24, fill = '#1677ff', className, addClassName = '' }) => {
  return (
    <ReactSVG
      className={className}
      src={url}
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

        svg.setAttribute('style', `width: ${size}px;height: ${size}px;vertical-align: top;`);
        svg.setAttribute('fill', fill);
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
            svg.querySelectorAll('*').forEach(item => item.removeAttribute('fill'));
          } catch (error) {
            console.error(error);
          }
        }
      }}
    />
  );
};
