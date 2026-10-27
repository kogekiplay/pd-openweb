import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import _ from 'lodash';
import Mingo from 'src/components/Mingo';
import * as actions from 'src/pages/chat/redux/actions';
import type { ChatToolbarConfig } from 'src/pages/chat/redux/types';
import type { RootState } from 'src/redux/types';

/**
 * 原生 `Storage.setItem` 的**单一方法 input 视图**（type-only；Babel 发射后无代码；
 * 本文件局部声明，不 import FavoriteDrawer 的私有类型）：
 * - key / 返回类型派生自 `typeof localStorage.setItem`
 *   （lib.dom.d.ts:35958 `(key: string, value: string): void`）；
 * - 只增加本调用真实传的 boolean 域：WebIDL DOMString 转换在进入 native 前把它
 *   ToString 成 "true"/"false"；本文件不做 String()、不加包装器/默认值/可选调用。
 * 运行期仍是原 member call：receiver 仍是 localStorage、storage/方法 getter 各读 1 次、
 * 两个实参求值顺序、boolean 值本身与 native 转换时机不变；
 * 不是整体 Storage/DOM/Window 的 DTO 断言。
 */
export type NativeStorageSetItemWithBooleanValue = typeof localStorage.setItem & {
  (key: Parameters<typeof localStorage.setItem>[0], value: boolean): ReturnType<typeof localStorage.setItem>;
};

/**
 * props：
 * - `drawerVisible`：父 `ChatList/Toolbar/Drawer.tsx` 先创建 `<Mingo />`，再用
 *   `cloneElement(children, { drawerVisible: visible })` 注入；`visible` 来自
 *   `toolbarConfig.mingoVisible`（boolean）。父级创建时还没有该 prop，所以按真实调用形态标
 *   **可选、值域 boolean**（不是 any，也不靠“断言 caller 一定有 prop”）。
 * - `toolbarConfig` / `setToolbarConfig`：connect 注入的真实切片/action。
 */
export interface MingoDrawerProps {
  drawerVisible?: boolean | undefined;
  toolbarConfig: ChatToolbarConfig;
  setToolbarConfig: (config: Partial<ChatToolbarConfig>) => void;
}

const MingoDrawer = (props: MingoDrawerProps) => {
  const { drawerVisible, toolbarConfig, setToolbarConfig } = props;
  const { mingoFixing } = toolbarConfig;
  return (
    <Mingo
      drawerVisible={drawerVisible}
      mingoFixing={mingoFixing}
      onFixing={({ saveStateToLocal = true }) => {
        setToolbarConfig({ mingoFixing: !mingoFixing });
        if (saveStateToLocal) {
          (localStorage.setItem as NativeStorageSetItemWithBooleanValue)('mingoFixing', !mingoFixing);
        }
      }}
      onClose={() => {
        setToolbarConfig({ mingoVisible: false });
        localStorage.removeItem('toolBarOpenType');
      }}
    />
  );
};

export default connect(
  (state: RootState) => ({
    toolbarConfig: state.chat.toolbarConfig,
  }),
  dispatch => bindActionCreators(_.pick(actions, ['setToolbarConfig']), dispatch),
)(MingoDrawer);
