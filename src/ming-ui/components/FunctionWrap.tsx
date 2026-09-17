import React from 'react';
import { createRoot } from 'react-dom/client';
import _ from 'lodash';
import { StyleSheetManager } from 'styled-components';
import shouldForwardProp from 'src/common/shouldForwardProp';
import { browserIsMobile } from 'src/utils/common';

/**
 * 使用方法
 * import functionWrap from 'ming-ui/components/FunctionWrap';
 * import DialogSelectOrgRole from './DialogSelectOrgRole';
 * // visibleName: 传入子组件的属性名 默认为 "visible"
 * // closeFnName: 关闭组件属性名 默认为 "onClose"
 * export const selectRole = props => functionWrap(DialogSelectOrgRole, { ...props, visibleName: 'orgRoleDialogVisible', closeFnName: 'onHide'  });
 */

export default function (Comp, props: Record<string, any> = {}) {
  const div = document.createElement('div');
  let destroyed = false;

  document.body.appendChild(div);

  const root = createRoot(div);

  const handlePopState = () => !browserIsMobile() && destroy();

  function destroy() {
    if (destroyed) return;
    destroyed = true;

    window.removeEventListener('popstate', handlePopState);
    root.unmount();

    if (div && div.parentNode) {
      div.parentNode.removeChild(div);
    }
  }

  window.addEventListener('popstate', handlePopState);

  /* 【这是另一棵 React 树】createRoot 起的树不继承 preall 里那层 StyleSheetManager，
     styled-components 又没有全局开关（shouldForwardProp 走 context）。不挂这一层，
     所有走 functionWrap 的弹窗里的 styled 组件都会把自定义 prop 透传到 DOM 上，
     控制台成片地刷 `React does not recognize the xxx prop on a DOM element`
     （记录新建/详情弹窗里的 showTitle / titleColor / isEditing / hasContent … 就是这么漏的）。
     主应用树里同一批组件不报，因为那边被 preall 罩着 —— 这也是为什么按组件名全仓搜
     搜不出所以然：区别不在组件，在它挂在哪棵树上。 */
  root.render(
    <StyleSheetManager shouldForwardProp={shouldForwardProp}>
      <Comp
        {...(props.visibleName ? { [props.visibleName]: true } : { visible: true })}
        {...props}
        onClose={(...args) => {
          destroy();
          if (_.isFunction(props.onClose)) {
            props.onClose(...args);
          }
        }}
        onCancel={() => {
          destroy();
          if (_.isFunction(props.onCancel)) {
            props.onCancel();
          }
        }}
        {...(props.closeFnName
          ? {
              [props.closeFnName]: () => {
                destroy();
                if (_.isFunction(props[props.closeFnName])) {
                  props[props.closeFnName]();
                }
              },
            }
          : {})}
      />
    </StyleSheetManager>,
  );
}
