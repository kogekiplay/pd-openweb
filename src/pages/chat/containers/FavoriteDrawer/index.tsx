import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import cx from 'classnames';
import _ from 'lodash';
import { Icon } from 'ming-ui';
import * as actions from 'src/pages/chat/redux/actions';
import type { ChatToolbarConfig } from 'src/pages/chat/redux/types';
import type { RootState } from 'src/redux/types';

/**
 * 原生 `Storage.setItem` 的**单一方法 input 视图**（type-only；Babel 发射后无任何代码）：
 * - key / 返回类型直接派生自 `typeof localStorage.setItem`
 *   （lib.dom.d.ts:35958 `(key: string, value: string): void`）；
 * - 只增加**本调用真实传的 boolean 域**：WebIDL 的 DOMString 转换会在进入 native 前把它
 *   ToString 成 "true"/"false"（native 实测 `logs/native-storage-native-*.log`），
 *   本文件**不做** String 转换、不换成包装器/默认值/可选调用。
 * 运行期仍是原 member call：`(localStorage.setItem as View)(…)` 在 dev/production 两 profile 的
 * Babel 输出与改前逐字节相同 → receiver 仍是 localStorage、storage/方法 getter 各读 1 次、
 * 两个实参求值顺序、boolean 值本身与 native 转换时机都不变（成对 fixture
 * `logs/native-storage-instrumented-*.log`）。这不是整体 Storage/DOM/Window 的 DTO 断言。
 */
export type NativeStorageSetItemWithBooleanValue = typeof localStorage.setItem & {
  (
    key: Parameters<typeof localStorage.setItem>[0],
    value: boolean,
  ): ReturnType<typeof localStorage.setItem>;
};

/**
 * props：connect 注入 `toolbarConfig`（`RootState['chat'].toolbarConfig`，真实 `ChatToolbarConfig`）
 * 与 `setToolbarConfig`（`chat/redux/actions.ts:2089` 真实签名）；不复制 DTO、不继承 RootState any。
 */
export interface FavoriteDrawerProps {
  toolbarConfig: ChatToolbarConfig;
  setToolbarConfig: (config: Partial<ChatToolbarConfig>) => void;
}

const Collect = (props: FavoriteDrawerProps) => {
  const { toolbarConfig, setToolbarConfig } = props;
  const { favoriteFixing } = toolbarConfig;
  return (
    <div className="flexColumn h100 bgPrimary pLeft20 pRight20 pTop15 pBottom15">
      <div className="header flexRow alignItemsCenter justifyContentBetween">
        <Icon
          icon="set_top"
          className={cx('Font22 pointer', favoriteFixing ? 'textSecondary' : 'textPlaceholder')}
          onClick={() => {
            setToolbarConfig({ favoriteFixing: !favoriteFixing });
            (localStorage.setItem as NativeStorageSetItemWithBooleanValue)('favoriteFixing', !favoriteFixing);
          }}
        />
        <Icon
          icon="close"
          className="Font22 pointer textSecondary"
          onClick={() => {
            setToolbarConfig({ favoriteVisible: false });
            localStorage.removeItem('toolBarOpenType');
          }}
        />
      </div>
      <div className="content mTop10 flex Font14">favorite content</div>
    </div>
  );
};

export default connect(
  (state: RootState) => ({
    toolbarConfig: state.chat.toolbarConfig,
  }),
  dispatch => bindActionCreators(_.pick(actions, ['setToolbarConfig']), dispatch),
)(Collect);
