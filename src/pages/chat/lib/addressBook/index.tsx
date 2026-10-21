import React from 'react';
// react-redux 9 移除了 lib/ 内部路径，shallowEqual 现在是公开导出。
import { shallowEqual } from 'react-redux';
import { default as MingDialog } from 'ming-ui/components/Dialog';
import Icon from 'ming-ui/components/Icon';
import { config } from './config';
import { gatherProjects, SIDER_BAR_LIST, TYPES } from './constants';
import Apps from './containers/Apps';
import Contacts from './containers/Contacts';
import Friends from './containers/Friends';
import Groups from './containers/Groups';
import NewFriends from './containers/NewFriends';
import Others from './containers/Others';
import ProjectContacts from './containers/ProjectContacts';
import SiderBar from './containers/SiderBar';
import type { SiderBarRow } from './containers/SiderBar';
import type { AddressBookClosePayload } from './types';
import './style.less';

const Dialog = MingDialog.DialogBase;

interface AddressBookState {
  /** 当前选中的左侧分组（`TYPES` 值） */
  type?: string | undefined;
  /** 当前项目筛选（null = 不限） */
  projectId: string | null | undefined;
  /** 左侧列表项（内置分组 + 收拢后的项目） */
  list: SiderBarRow[];
}

interface AddressBookProps {
  type?: string | undefined;
}

/** 地址簿弹层入口（父级按 showAddressBook/showNewFriends/closeDialog 控制） */
interface AddressBookDialogProps {
  showAddressBook?: boolean | undefined;
  showNewFriends?: boolean | undefined;
  /**
   * 关闭弹层。Dialog onClose 会传事件对象，工具栏调用方会传 `{target}` 形态的数据判断来源，
   * 而 `config.callback` 的消费方传的是 `AddressBookCallbackPayload` —— 三种都是对象，按 object 承接。
   */
  closeDialog: (data?: AddressBookClosePayload | undefined) => void;
}

class AddressBook extends React.Component<AddressBookProps, AddressBookState> {
  constructor(props: AddressBookProps) {
    // 原实现 `super()` 未传 props；React 之后仍会写 this.props，运行等价（Babel 1 行差异）。
    super(props);

    this.state = {
      type: props.type,
      projectId: null,
      // 擦除标记：内置分组与收拢后的项目是两种行形状（原 any 直接 concat）。
      list: (SIDER_BAR_LIST as SiderBarRow[]).concat(gatherProjects() as SiderBarRow[]),
    };

    this.updateHighlightTab = this.updateHighlightTab.bind(this);
  }

  override shouldComponentUpdate(_nextProps: AddressBookProps, nextState: AddressBookState) {
    return !shallowEqual(nextState, this.state);
  }

  renderContent() {
    const { type, projectId } = this.state;

    switch (type) {
      case TYPES.NEW_FRIENDS:
        return <NewFriends />;
      case TYPES.ALL_GROUPS:
      case TYPES.PROJECT_GROUPS:
        // 擦除标记：projectId 初始为 null（不限项目），子级只按真值和请求参数消费；null 与 undefined 等价（原 any 直接透传）。
        return <Groups projectId={projectId} />;
      case TYPES.ALL_CONTACTS:
        return <Contacts />;
      case TYPES.FRIENDS:
        return <Friends />;
      case TYPES.OTHERS:
        return <Others />;
      case TYPES.PROJECT_CONTACTS:
      case TYPES.CONTACTS:
        return <ProjectContacts projectId={projectId} />;
      case TYPES.INBOX:
        return <Apps />;
      default:
        break;
    }
    return undefined;
  }

  updateHighlightTab(type: string | undefined, projectId: string | null | undefined) {
    this.setState({
      type,
      projectId,
    });
  }

  override render() {
    const { type, projectId, list } = this.state;
    return (
      <div className="contacts-dialog">
        <SiderBar {...{ type, projectId, list }} updateHighlightTab={this.updateHighlightTab} />
        {this.renderContent()}
      </div>
    );
  }
}

export default function AddressBookDialog(props: AddressBookDialogProps) {
  const dialogProps = {
    width: 900,
    visible: props.showAddressBook,
    anim: false,
    type: 'scroll',
    className: 'overflowHidden Relative',
    onClose: props.closeDialog,
  };

  config.callback = props.closeDialog;

  if (!props.showAddressBook) return null;
  return (
    <Dialog {...dialogProps}>
      <Icon
        icon={'delete'}
        className="contacts-dialog-close textSecondary Hand"
        onClick={() => {
          props.closeDialog();
        }}
      />
      <AddressBook {...{ type: props.showNewFriends ? TYPES.NEW_FRIENDS : TYPES.ALL_CONTACTS }} />
    </Dialog>
  );
}
