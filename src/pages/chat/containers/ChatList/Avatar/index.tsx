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

const AvatarSetting = props => {
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

export default connect(
  (state: RootState) => ({
    toolbarConfig: state.chat.toolbarConfig,
  }),
  dispatch => bindActionCreators(_.pick(actions, ['setToolbarConfig', 'closeSessionPanel']), dispatch),
)(AvatarSetting);
