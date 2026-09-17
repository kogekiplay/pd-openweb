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

  /* 【unmount 必须挪出 React 的渲染/提交阶段】
     React 18 起，在 React 正在渲染时同步调 root.unmount() 会报
     "Attempted to synchronously unmount a root while React was already rendering.
      React cannot finish unmounting the root until the current render has completed,
      which may lead to a race condition."

     这条路径真实存在且不止一处：关闭记录详情时
       Commenter.componentWillUnmount → MentionsInput 的 input.destroy()
       → 这里的 onClose → destroy() → root.unmount()
     也就是【在另一棵树的卸载提交过程中】去拆自己这棵树。

     destroyed 标记仍然同步置位（防重复调用、后续的 onClose 立刻短路），
     只把真正的 unmount + 摘节点推到微任务里 —— 那时当前这轮渲染已经结束。
     用 queueMicrotask 而不是 setTimeout：同一帧内完成，弹窗关闭不会慢一拍。 */
  function destroy() {
    if (destroyed) return;
    destroyed = true;

    window.removeEventListener('popstate', handlePopState);

    queueMicrotask(() => {
      root.unmount();

      if (div && div.parentNode) {
        div.parentNode.removeChild(div);
      }
    });
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
