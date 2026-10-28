import { Fragment, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, LoadDiv } from 'ming-ui';
import accountSettingApi from 'src/api/accountSetting';
import * as actions from 'src/pages/chat/redux/actions';
import common from 'src/pages/Personal/common';
import type { ChatToolbarConfig } from 'src/pages/chat/redux/types';
import type { UserDrawerProps } from 'src/pages/chat/containers/UserDrawer';
import Base from './Base';
import Toolbar, { type ToolbarProps } from './Toolbar';

const Wrap = styled.div`
  .nav {
    width: 180px;
    background-color: var(--color-background-tertiary);
  }
  .content {
    min-width: 0;
  }
  .navItem {
    font-size: var(--font-md);
    padding: 10px var(--space-5);
    position: relative;
    &.active {
      color: var(--color-primary-text);
      font-weight: bold;
      background-color: var(--color-background-card);
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        height: 16px;
        width: 3px;
        border-radius: var(--radius-sm);
        transform: translateY(-50%);
        background: currentColor;
      }
    }
  }
  .divider {
    width: 100%;
    height: 1px;
    background-color: var(--color-border-secondary);
    margin: 0 auto;
  }
  .widthMaxContent {
    width: max-content;
  }
  .RadioGroup--vertical .Radio {
    margin-bottom: 10px;
  }
`;

/** 导航类型：唯一 writer 是 `UserDrawer` 的 `onChangeSettingDrawerVisible(visible, navType)`，
 *  从它的真实 `UserDrawerProps` 派生（`'toolbar' | 'base'`），不另造 string。 */
type SettingNavType = Parameters<UserDrawerProps['onChangeSettingDrawerVisible']>[1];

/** 显式 tuple 注解：保持原**可变数组**形态（不是 `as const`），只让 `navs[0]` 在
 *  `noUncheckedIndexedAccess` 下不再是 `undefined`。两项字面量正是 `SettingNavType` 的两个成员。 */
const navs: [{ value: SettingNavType; name: string }, { value: SettingNavType; name: string }] = [
  {
    value: 'base',
    name: _l('基础'),
  },
  {
    value: 'toolbar',
    name: _l('右侧栏'),
  },
];

/** 两个子组件对 `handleSureSettings` 的**默认导出函数 Params**，逐项派生（不手抄 13）。
 *  `Base` 的形参名是 `settingName`、`Toolbar` 的是 `key`，这里按位置取。 */
type BaseSureParams = Parameters<Parameters<typeof Base>[0]['handleSureSettings']>;
type ToolbarSureParams = Parameters<ToolbarProps['handleSureSettings']>;
/** 键域 = 两子组件 live 字面量 union（Base 5 + Toolbar 8 = 13）。
 *  `map`/`timeZone` 只在 Base 侧、且只写到 `md.global.Account`，不进 16 键 state。 */
type SureSettingName = BaseSureParams[0] | ToolbarSureParams[0];
/** 值域 = 两子组件实参 union（`number | undefined` ∪ `0 | 1 | 2 | undefined` = `number | undefined`）。 */
type SureSettingValue = Exclude<BaseSureParams[1] | ToolbarSureParams[1], never>;

/** 原运行时是 3 个形参（`settingNum`, `value`, `successCallback`）：
 *  这里把第三个声明成可选仅用于**类型**，编译后仍是 3 个形参，`handleSureSettings.length` 不变。 */
const handleSureSettings = (settingNum: SureSettingName, value: SureSettingValue, successCallback?: (() => void) | undefined) => {
  accountSettingApi
    .editAccountSetting({
      /** `common` 是 `Record<string, any>`（`Personal/common.ts:3`），这条查表仍是 opaque any，
       *  只按 `noPropertyAccessFromIndexSignature` 换成字面量索引，**不声称类型闭合**。 */
      settingType: common['settingOptions'][settingNum],
      settingValue: value,
    })
    .then(data => {
      if (data) {
        alert(_l('设置成功'));
        if (_.isFunction(successCallback)) {
          successCallback();
        }
      } else {
        alert(_l('操作失败'), 2);
      }
    })
    .catch();
};

/** 16 个状态键 = 实际 `_.pick` 的 15 个 + `backHomepageWay`（`|| 1` 兜底补的那一个）。
 *  **全部保留**（含 `joinFriendMode`/`isPrivateMobile`/`isPrivateEmail`/`isOpenFavorite` 这些本
 *  组件子树内暂无读取方的键）—— 删掉会改变 state 的 ownKeys，属改行为。
 *  逐键从 canonical `AccountSettingModel` modelled 成 optional + 显式 `| undefined`：
 *  因为 `_.pick` 会丢键、`|| 1` 会改值，且 `{...values, ...patch}` 会把子组件 patch 合进来。 */
type SettingStateKey =
  | 'joinFriendMode'
  | 'isPrivateMobile'
  | 'isPrivateEmail'
  | 'isOpenMessageSound'
  | 'isOpenMessageTwinkle'
  | 'isOpenMingoAI'
  | 'isOpenMessage'
  | 'isOpenSearch'
  | 'isOpenFavorite'
  | 'isShowToolName'
  | 'isOpenMessageList'
  | 'isOpenCommonApp'
  | 'commonAppShowType'
  | 'commonAppOpenType'
  | 'messageListShowType'
  | 'backHomepageWay';

type SettingsState = {
  [K in SettingStateKey]?: HapApi.MD.Web.Ajax.ResultModel.Account.AccountSettingModel[K] | undefined;
};

/** `handleChangeAccountSettings` 的入参 = 两个子组件 patch 形参的 union（从它们 Params 派生）。 */
type BaseChangeParam = Parameters<Parameters<typeof Base>[0]['handleChangeAccountSettings']>[0];
type ToolbarChangeParam = Parameters<ToolbarProps['handleChangeAccountSettings']>[0];
type SettingsPatch = BaseChangeParam | ToolbarChangeParam;

/** 真实 caller 只有 `ChatList/Avatar:87`：传 `defaultNavType` 与 `onClose`；
 *  `setToolbarConfig` 由 `connect` 注入（`index.tsx:166`），故用 action creator 的真实签名。 */
interface SettingProps {
  /** Avatar 的 state 是 `Parameters<UserDrawerProps['onChangeSettingDrawerVisible']>[1] | null`，
   *  这里再并 `undefined` 以允许「不传」；原 `defaultNavType || navs[0].value` 的 `||` 语义不变。 */
  defaultNavType?: SettingNavType | null | undefined;
  onClose: () => void;
  /** 由 `connect`+`bindActionCreators` 注入；与同目录其它容器（MingoDrawer:35、SessionListDrawer:61、
   *  Avatar、FavoriteDrawer、Apps:67、Toolbar/Drawer:64）的既有声明同型：形参 `Partial<ChatToolbarConfig>`，
   *  返回 `void`（`void` 目标兼容 action creator 的非 void 返回）。 */
  setToolbarConfig: (config: Partial<ChatToolbarConfig>) => void;
}

/** 合同探针用的 **type-only** 出口：直接绑定本文件真实的 render 函数（`typeof Setting`），
 *  探针由此取 `Parameters<…>[0]`，不需要 phantom 接口，也不引入任何运行期导出。
 *  `export type` 在编译后完全擦除，故不影响 emit。 */
export type SettingRender = typeof Setting;

const Setting = (props: SettingProps) => {
  const { defaultNavType, onClose, setToolbarConfig } = props;
  const [navType, setNavType] = useState<SettingNavType>(defaultNavType || navs[0].value);
  const [accountSettings, setAccountSettings] = useState<SettingsState>({});
  const [loading, setLoading] = useState(true);

  const handleChangeAccountSettings = (param: SettingsPatch) => {
    setAccountSettings(values => ({ ...values, ...param }));
    setToolbarConfig(param);
  };

  useEffect(() => {
    accountSettingApi.getAccountSettings({}).then(data => {
      const settings = _.pick(data, [
        'joinFriendMode',
        'isPrivateMobile',
        'isPrivateEmail',
        'isOpenMessageSound',
        'isOpenMessageTwinkle',
        'isOpenMingoAI',
        'isOpenMessage',
        'isOpenSearch',
        'isOpenFavorite',
        'isShowToolName',
        'isOpenMessageList',
        'isOpenCommonApp',
        'commonAppShowType',
        'commonAppOpenType',
        'messageListShowType',
      ]);
      setAccountSettings({
        ...settings,
        backHomepageWay: data.backHomepageWay || 1,
      });
      setLoading(false);
    });
  }, []);

  const otherProps = {
    accountSettings,
    handleChangeAccountSettings,
    handleSureSettings,
  };

  return (
    <Wrap className="flexRow w100 h100">
      <div className="nav">
        <div className="textPrimary bold Font22 pAll20">{_l('设置')}</div>
        {navs.map((nav, index) => (
          <div
            key={index}
            className={cx('navItem pointer', { active: nav.value === navType })}
            onClick={() => setNavType(nav.value)}
          >
            {nav.name}
          </div>
        ))}
      </div>
      <div className="content flexColumn flex pAll20">
        <div className="flexRow alignItemsCenter justifyContentRight">
          <Icon className="Font22 pointer textSecondary" icon="close" onClick={onClose} />
        </div>
        {loading ? (
          <div className="flexRow alignItemsCenter justifyContent flex">
            <LoadDiv />
          </div>
        ) : (
          <Fragment>
            {navType === 'base' && <Base {...props} {...otherProps} />}
            {navType === 'toolbar' && <Toolbar {...props} {...otherProps} />}
          </Fragment>
        )}
      </div>
    </Wrap>
  );
};

export default connect(
  () => ({}),
  dispatch => bindActionCreators(_.pick(actions, ['setToolbarConfig']), dispatch),
)(Setting);
