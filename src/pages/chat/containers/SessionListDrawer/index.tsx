import { Fragment, useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { BgIconButton, LoadDiv } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import SearchMember from 'src/pages/chat/components/SearchMember';
import * as actions from 'src/pages/chat/redux/actions';
import type { ChatToolbarConfig } from 'src/pages/chat/redux/types';
import * as socket from 'src/pages/chat/utils/socket';
import type { RootState } from 'src/redux/types';
import { pathCompletion } from 'src/utils/common';
import Avatar from '../ChatList/Avatar';
import RenderAddressBook from '../ChatList/Toolbar/RenderAddressBook';
import SessionList from '../SessionList';
import errorIcon from '../SessionList/resource/errorIcon.png';
import CreateGroup from './CreateGroup';

const Wrap = styled.div`
  box-shadow: var(--shadow-md);
  .icon-home_page {
    border: 1px solid var(--color-border-secondary);
    padding: 3px;
    border-radius: 50%;
  }
  .errorIcon {
    transform: scale(0.5);
  }
`;

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
 * - `toolbarConfig` / `socketState`：connect 注入的 `RootState['chat']` 真实切片（canonical
 *   `ChatToolbarConfig`、socket 状态 number）；
 * - `setToolbarConfig`：真实 action（`Partial<ChatToolbarConfig>` 入参）；
 * - `setShowAddressBook`：真实 action（`actions.ts:1933 (isShowAddressBook: boolean) => AppThunk`，
 *   dispatch 后返回 undefined）；
 * - `embed`：own prop，保留原 `= false` 默认；真实调用
 *   `windowChat/Chat.tsx:85 <SessionListDrawer embed={true} />`。
 */
export interface SessionListDrawerProps {
  toolbarConfig: ChatToolbarConfig;
  socketState: number;
  setToolbarConfig: (config: Partial<ChatToolbarConfig>) => void;
  setShowAddressBook: (isShowAddressBook: boolean) => void;
  embed?: boolean | undefined;
}

const SessionListDrawer = (props: SessionListDrawerProps) => {
  const { toolbarConfig, setToolbarConfig, embed = false, socketState } = props;
  const { sessionListFixing } = toolbarConfig;
  const [searchValue, setSearchValue] = useState(null);
  const hideChat = md.global.SysSettings.forbidSuites.includes('6');

  return (
    <Wrap className={cx('flexColumn h100 w100 bgPrimary pLeft10 pRight10', embed ? 'pTop4' : 'pTop10')}>
      <div className="header flexRow alignItemsCenter justifyContentBetween">
        {embed ? (
          <BgIconButton
            tooltip={_l('首页')}
            icon="home_page"
            iconClassName="Font20 textSecondary"
            onClick={() => {
              location.href = pathCompletion('/dashboard');
            }}
          />
        ) : (
          <BgIconButton
            icon="set_top"
            tooltip={sessionListFixing ? _l('取消固定') : _l('固定')}
            iconClassName="Font20"
            iconStyle={
              sessionListFixing ? { color: 'var(--color-text-title)' } : { color: 'var(--color-text-placeholder)' }
            }
            onClick={() => {
              setToolbarConfig({ sessionListFixing: !sessionListFixing });
              (localStorage.setItem as NativeStorageSetItemWithBooleanValue)('sessionListFixing', !sessionListFixing);
            }}
          />
        )}
        <div className="flexRow alignItemsCenter">
          <BgIconButton
            icon="clean"
            tooltip={_l('已读全部消息')}
            className="Font19 pointer textSecondary mRight10"
            onClick={() => {
              socket.Contact.clearAllUnread();
              alert(_l('操作成功'));
            }}
          />
          {embed ? (
            <Avatar embed={embed} />
          ) : (
            <Fragment>
              <BgIconButton
                icon="launch"
                tooltip={_l('新窗口打开')}
                className="Font19 pointer textSecondary mRight10"
                onClick={() => {
                  window.open(pathCompletion('/windowChat'));
                }}
              />
              <BgIconButton
                icon="close"
                className="Font22 pointer textSecondary"
                onClick={() => {
                  setToolbarConfig({ sessionListVisible: false });
                  localStorage.removeItem('toolBarOpenType');
                }}
              />
            </Fragment>
          )}
        </div>
      </div>
      {socketState === 1 && (
        <div className="flexRow alignItemsCenter mTop10">
          <LoadDiv className="mp0 mLeft5" size="small" />
          <div className="mLeft5 bold">{_l('正在连接...')}</div>
        </div>
      )}
      {socketState === 2 && (
        <div className="flexRow alignItemsCenter mTop10 textError">
          <Tooltip title={_l('连接失败，点击刷新重试')} placement="bottom">
            <img src={errorIcon} className="errorIcon pointer" onClick={() => location.reload()} />
          </Tooltip>
          <div className="mLeft5 bold">{_l('连接已断开')}</div>
        </div>
      )}
      <div className="content flexColumn mTop10 flex Font14 Relative minHeight0">
        {embed && (
          <Fragment>
            <div className="textPrimary bold Font28 pLeft12 pRight12 mBottom5" style={{ lineHeight: 1 }}>
              {_l('消息')}
            </div>
            <RenderAddressBook />
          </Fragment>
        )}
        {!hideChat && (
          <div className="flexRow alignItemsCenter pLeft4 pRight4 mTop5 mBottom10">
            <SearchMember embed={embed} searchValue={searchValue} setSearchValue={setSearchValue} />
            <BgIconButton
              icon="contacts-book"
              iconClassName="Font19 pointer textSecondary"
              tooltip={`${_l('通讯录')}`}
              onClick={() => props.setShowAddressBook(true)}
              shortcut={'E'}
            />
          </div>
        )}
        <div className="flexColumn flex Relative minHeight0">
          <SessionList visible={true} />
        </div>
        {!searchValue && !hideChat && <CreateGroup />}
      </div>
    </Wrap>
  );
};

export default connect(
  (state: RootState) => ({
    toolbarConfig: state.chat.toolbarConfig,
    socketState: state.chat.socketState,
  }),
  dispatch => bindActionCreators(_.pick(actions, ['setToolbarConfig', 'setShowAddressBook']), dispatch),
)(SessionListDrawer);
