import { Fragment, useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Drawer } from 'antd';
import _ from 'lodash';
import { Tooltip } from 'ming-ui/antd-components';
import Setting from 'src/pages/chat/containers/SettingDrawer';
import User from 'src/pages/chat/containers/UserDrawer';
import * as actions from 'src/pages/chat/redux/actions';
import Avatar from 'src/pages/PageHeader/components/Avatar';
import type { RootState } from 'src/redux/types';
import type { UserDrawerProps } from 'src/pages/chat/containers/UserDrawer';

/**
 * 本组件真实 4 个 props：
 * - `embed` 来自唯一 caller `SessionListDrawer:75` `<Avatar embed={embed} />`（其 props 默认 `false`）；
 * - 其余三项由 `connect` 注入，且都取**真实来源的类型**：
 *   `toolbarConfig` = `state.chat.toolbarConfig`（canonical，A48 已把两个 drawer 开关具名成 optional bool）；
 *   `setToolbarConfig`/`closeSessionPanel` = 两个真实 action 的入参（dispatch 返回值按 void 忽略）。
 * 不复制本地 intersection，不新增 any/宽索引。
 */
export interface AvatarSettingProps {
  embed?: boolean | undefined;
  toolbarConfig: RootState['chat']['toolbarConfig'];
  setToolbarConfig: (...args: Parameters<typeof actions.setToolbarConfig>) => void;
  closeSessionPanel: (...args: Parameters<typeof actions.closeSessionPanel>) => void;
}

const AvatarSetting = (props: AvatarSettingProps) => {
  const { embed = false, toolbarConfig, setToolbarConfig, closeSessionPanel } = props;
  /**
   * 初值仍是 `null`，唯一 writer 是 :61 `setDefaultNavType(navType)`，而 navType 的域来自
   * UserDrawer 的真实形参 `onChangeSettingDrawerVisible(visible, navType)`（'toolbar' | 'base'）。
   * 用 Parameters 派生同一域 + 原有 null 初值，不另造 string/enum，也不改 init/body/调用次数。
   */
  const [defaultNavType, setDefaultNavType] = useState<Parameters<UserDrawerProps['onChangeSettingDrawerVisible']>[1] | null>(null);
  const { userDrawerVisible, settingDrawerVisible } = toolbarConfig;
  return (
    <Fragment>
      <div className="flexColumn alignItemsCenter justifyContentCenter mTop8 mBottom8">
        <Tooltip title={md.global.Account.fullname} placement={embed ? 'bottom' : 'left'} mouseLeaveDelay={0.1}>
          <div
            onClick={() => {
              setToolbarConfig({
                userDrawerVisible: true,
                settingDrawerVisible: false,
                mingoVisible: false,
                sessionListVisible: false,
                favoriteVisible: false,
              });
              setTimeout(closeSessionPanel, 0);
            }}
          >
            <Avatar src={md.global.Account.avatar} size={32} />
          </div>
        </Tooltip>
      </div>
      <Drawer
        placement="right"
        rootClassName="userDrawerWrap"
        open={userDrawerVisible}
        closable={false}
        styles={{
          mask: {
            backgroundColor: 'transparent',
          },
          body: {
            padding: 0,
          },
        }}
        onClose={() => setToolbarConfig({ userDrawerVisible: false })}
        getContainer={() => document.body}
        rootStyle={{
          // position: embed ? undefined : 'absolute',
          zIndex: 20,
          right: embed ? 0 : 52,
        }}
      >
        <User
          onClose={() => setToolbarConfig({ userDrawerVisible: false })}
          onChangeSettingDrawerVisible={(visible, navType) => {
            setDefaultNavType(navType);
            setToolbarConfig({ settingDrawerVisible: visible });
          }}
        />
      </Drawer>
      <Drawer
        placement="right"
        open={settingDrawerVisible}
        destroyOnHidden={true}
        closable={false}
        styles={{
          mask: {
            backgroundColor: 'transparent',
          },
          body: {
            padding: 0,
          },
        }}
        size={680}
        onClose={() => setToolbarConfig({ settingDrawerVisible: false })}
        getContainer={() => (embed ? document.body : document.querySelector('#containerWrapper'))}
        rootStyle={{
          position: embed ? undefined : 'absolute',
          zIndex: 20,
        }}
      >
        <Setting defaultNavType={defaultNavType} onClose={() => setToolbarConfig({ settingDrawerVisible: false })} />
      </Drawer>
    </Fragment>
  );
};

/**
 * 真实 render 的类型别名（type-only，不影响发射）：仓外 probe 用
 * `Parameters<AvatarSettingRender>[0]` 断言真实入参并 Equal 本文件的 AvatarSettingProps，
 * 而不是另造一份 phantom props 自证。
 */
export type AvatarSettingRender = typeof AvatarSetting;

/**
 * 显式四泛型（**type-only**，不改变运行期调用与函数 length/merge 顺序，也不加 mergeProps、不给 mapState 加第二参数）：
 * - TStateProps = mapState 的真实返回（canonical `state.chat.toolbarConfig`）；
 * - TDispatchProps = 两个真实 action 的入参（dispatch 返回值按 void 忽略）；
 * - TOwnProps = **两个真实 own 输入**：`embed`（SessionListDrawer:75）与**旧的可选 setToolbarConfig**
 *   （Toolbar/index:122 仍在 JSX 上传；运行期由 mapDispatch 按默认 merge 顺序覆盖，不能删该 JSX prop）；
 * - State = `RootState`。
 */
export default connect<
  { toolbarConfig: RootState['chat']['toolbarConfig'] },
  {
    setToolbarConfig: (...args: Parameters<typeof actions.setToolbarConfig>) => void;
    closeSessionPanel: (...args: Parameters<typeof actions.closeSessionPanel>) => void;
  },
  {
    embed?: boolean | undefined;
    setToolbarConfig?: ((...args: Parameters<typeof actions.setToolbarConfig>) => void) | undefined;
  },
  RootState
>(
  (state: RootState) => ({
    toolbarConfig: state.chat.toolbarConfig,
  }),
  dispatch => bindActionCreators(_.pick(actions, ['setToolbarConfig', 'closeSessionPanel']), dispatch),
)(AvatarSetting);
