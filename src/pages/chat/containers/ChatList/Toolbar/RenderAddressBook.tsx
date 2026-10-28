import { lazy, Suspense, useEffect } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import _ from 'lodash';
import { dialogKeyboardShortcuts } from 'src/pages/chat/components/KeyboardShortcuts';
import * as actions from 'src/pages/chat/redux/actions';
import Constant from 'src/pages/chat/utils/constant';
import { createDiscussion } from 'src/pages/chat/utils/group';
import * as socket from 'src/pages/chat/utils/socket';
import GlobalSearch from 'src/pages/PageHeader/components/GlobalSearch/index';
import type { RootState } from 'src/redux/types';
import { getPathWithoutSubPath } from 'src/utils/common';

const LoadableAddressBook = lazy(() => import('src/pages/chat/lib/addressBook'));

/**
 * bound action 视图：保留真实 action 的 Parameters；
 * 返回值按 bindActionCreators 的真实形态忽略为 void（参数/返回都从真实 action 派生，
 * 不手抄 DTO、不新增 any）。
 */
type BoundAction<T extends (...args: never[]) => unknown> = (...args: Parameters<T>) => void;

/**
 * props：`showAddressBook` 来自 `RootState['chat'].showAddressBook`（boolean）；5 个动作全部从
 * 真实 action 的 `Parameters` 派生（bound 后返回 void），不手抄参数 DTO、不新增 any/宽索引。
 */
export interface RenderAddressBookProps {
  showAddressBook: boolean;
  setShowAddressBook: BoundAction<typeof actions.setShowAddressBook>;
  addUserSession: BoundAction<typeof actions.addUserSession>;
  addGroupSession: BoundAction<typeof actions.addGroupSession>;
  updateSessionList: BoundAction<typeof actions.updateSessionList>;
  addSysSession: BoundAction<typeof actions.addSysSession>;
}

const RenderAddressBook = (props: RenderAddressBookProps) => {
  const { showAddressBook } = props;

  useEffect(() => {
    !md.global.Account.isPortal && bindShortcut();
  }, []);

  const bindShortcut = () => {
    const callDialog = _.debounce(which => {
      switch (which) {
        case 119:
          document.querySelector<HTMLElement>('.toolbarWrap .sessionList')?.click();
          break;
        case 113:
          createDiscussion(undefined, (result, isGroup) => {
            if (!isGroup) {
              const { accountId, avatar, fullname } = result[0];
              const msg = {
                logo: avatar,
                uname: fullname,
                sysType: 1,
              };
              props.addUserSession(accountId, msg);
            }
          });
          break;
        case 101:
        case 69:
          props.setShowAddressBook(true);
          break;
        case 109:
        case 77:
          document.querySelector<HTMLElement>('.ChatList-wrapper .mingo')?.click();
          break;
        case 70:
        case 102:
          // 全局搜索
          const pathname = getPathWithoutSubPath(location.pathname);
          let path = pathname.split('/');
          GlobalSearch({
            match: {
              params: {
                appId: pathname.startsWith('/app/') && path.length > 2 && path[2].length > 20 ? path[2] : undefined,
              },
            },
            onClose: () => {},
          });
          break;
        case 75:
        case 107:
          // 键盘快捷键
          let ele = $('.keyboardShortcutsDialog');

          if (!ele.length) {
            dialogKeyboardShortcuts();
          }

          break;
        default:
          break;
      }
    }, 200);

    $(document).on('keypress', function (e) {
      // 原来这里还有一项 e.cmdKey —— DOM 键盘事件上【没有这个属性】，Mac 的 Command
      // 键就是紧跟着判的 metaKey。它恒为 undefined，从来没起过作用，删掉行为不变。
      if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
      const target = e.target as unknown as HTMLElement;
      var tag = target.tagName && target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || $(e.target).is('[contenteditable]')) return;
      callDialog(e.which);
    });
  };

  const handleAddressBook = data => {
    const { accountId, groupId, type } = data;

    if (accountId) {
      props.addUserSession(accountId, {
        msg: { con: '' },
        sysType: 1,
      });
      return;
    }

    if (groupId) {
      props.addGroupSession(groupId);
      return;
    }

    if (type === 'file-transfer') {
      const { name } = Constant.FILE_TRANSFER;
      const message = {
        uname: name,
        sysType: 1,
      };
      props.addUserSession(type, message);
    } else {
      const message = {
        count: 0,
        id: type,
        type,
        dtype: type,
      };

      switch (type) {
        case 'post':
          message.type = Constant.SESSIONTYPE_POST;
          break;
        case 'system':
          message.type = Constant.SESSIONTYPE_SYSTEM;
          break;
        case 'calendar':
          message.type = Constant.SESSIONTYPE_CALENDAR;
          break;
        case 'task':
          message.type = Constant.SESSIONTYPE_TASK;
          break;
        case 'knowledge':
          message.type = Constant.SESSIONTYPE_KNOWLEDGE;
          break;
        case 'hr':
          message.type = Constant.SESSIONTYPE_HR;
          break;
        case 'worksheet':
          message.type = Constant.SESSIONTYPE_WORKSHEET;
          break;
        case 'workflow':
          message.type = Constant.SESSIONTYPE_WORKFLOW;
          break;
        default:
          break;
      }

      socket.Contact.recordAction({
        id: message,
        type: 3,
      });
      socket.Contact.clearUnread({
        type: message.type,
        value: type,
      }).then(() => {
        props.updateSessionList({
          id: type,
          clearCount: 0,
        });
      });
      props.addSysSession(type, message);
    }
  };

  return (
    showAddressBook && (
      <Suspense fallback={null}>
        <LoadableAddressBook
          showAddressBook={showAddressBook}
          closeDialog={data => {
            props.setShowAddressBook(false);
            if (data && !data.target) {
              handleAddressBook(data);
            }
          }}
        />
      </Suspense>
    )
  );
};

/**
 * 公开 render 合同：组件自身的函数类型（type-only，不产生运行时代码），供 probe 用
 * `Parameters<…>[0]` 做真实绑定断言。
 */
export type RenderAddressBookRender = typeof RenderAddressBook;

export default connect(
  (state: RootState) => ({
    showAddressBook: state.chat.showAddressBook,
  }),
  dispatch =>
    bindActionCreators(
      _.pick(actions, [
        'addUserSession',
        'setShowAddressBook',
        'addGroupSession',
        'updateSessionList',
        'addSysSession',
      ]),
      dispatch,
    ),
)(RenderAddressBook);
