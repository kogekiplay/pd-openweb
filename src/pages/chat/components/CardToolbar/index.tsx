import { Component } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import moment from 'moment';
import Trigger from '@rc-component/trigger';
import calendar from 'src/api/calendar';
import taskCenter from 'src/api/taskCenter';
import * as cardSender from '../../utils/cardSender';
import config from '../../utils/config';
import Constant from '../../utils/constant';
import type { ChatSession, ChatCardDraftMessage } from '../../redux/types';
import './index.less';


/** 菜单项（`toolItems` getter 返回、`handleOpen` 消费；`fn` 是类上的方法名） */
interface CardToolbarItem {
  name: string;
  icon: string;
  classname: string;
  fn: 'onSelectTask' | 'onSelectSchedule' | 'onNewVote' | 'onNewFeed';
}

/** 卡片发送方（`cardSender` 各选择器读取的会话描述，构造器里由 `session` 拼出） */
interface CardAcceptor {
  avatar?: string | undefined;
  id?: string | undefined;
  isPost?: boolean | undefined;
  projectId?: string | undefined;
  type: number;
}

/** 容器（`ChatPanelSession`）传入的 props */
interface CardToolbarProps {
  session: ChatSession;
  onSendCardMsg: (card: ChatCardDraftMessage) => void;
}

interface CardToolbarState {
  visible: boolean;
}

const items: CardToolbarItem[] = [
  {
    name: _l('任务'),
    icon: 'icon-task',
    classname: 'menuItem-task',
    fn: 'onSelectTask',
  },
  {
    name: _l('日程'),
    icon: 'icon-bellSchedule',
    classname: 'menuItem-calendar',
    fn: 'onSelectSchedule',
  },
  {
    name: _l('投票'),
    icon: 'icon-votenobg',
    classname: 'menuItem-votenobg',
    fn: 'onNewVote',
  },
  {
    name: _l('动态'),
    icon: 'icon-chat-inputer-post',
    classname: 'menuItem-post',
    fn: 'onNewFeed',
  },
];

export default class CardToolbar extends Component<CardToolbarProps, CardToolbarState> {
  declare acceptor: CardAcceptor;

  constructor(props: CardToolbarProps) {
    super(props);
    const { session } = this.props;
    this.state = {
      visible: false,
    };
    this.acceptor = {
      avatar: session.avatar,
      id: session.id,
      isPost: session.isPost,
      // 擦除标记：`session.projectId` 为真时 `session.project` 必存在（原 any 直接读）；缺省时原实现抛原生 TypeError。
      projectId: session.projectId ? (session.project as { projectId?: string }).projectId : '',
      type: session.isGroup ? Constant.SESSIONTYPE_GROUP : Constant.SESSIONTYPE_USER,
    };
  }
  get toolItems(): CardToolbarItem[] {
    const { isGroup } = this.props.session;
    const forbidSuites = _.uniq(md.global.SysSettings.forbidSuites.split('|')).filter(item => item !== '5');
    return items.filter((item: CardToolbarItem) => {
      if (item.icon === 'icon-task') {
        return !forbidSuites.includes('2');
      }

      if (item.icon === 'icon-bellSchedule') {
        return !forbidSuites.includes('3');
      }

      return isGroup ? !forbidSuites.includes('1') : false;
    });
  }
  handleOpen(item: CardToolbarItem) {
    // 擦除标记：`fn` 是类方法名的有限联合；原实现动态取方法调用，运行表达式不变。
    item.fn && (this[item.fn] as () => void)();
    this.setState({
      visible: false,
    });
  }
  onSelectTask() {
    // 【必须保留实参】`selectTask` 的函数体确实忽略该参数，但实参表达式 `this.acceptor`
    // 在**调用时就会被求值**——它是 getter，读取本身有副作用（lead 2026-10-21 反例：抛异常 getter 必须抛）。
    // 删掉实参会让 getter 不被读，这是行为回退，故保留。
    cardSender.selectTask(this.acceptor).then(result => {
      if (!this.props.session.isGroup) {
        taskCenter
          .batchAddTaskMember({
            taskIDstr: result.card.entityid,
            memberstr: this.acceptor.id,
            specialAccounts: {},
          })
          .then(() => {
            this.props.onSendCardMsg(result);
          });
      } else {
        this.props.onSendCardMsg(result);
      }
    });
  }
  onSelectSchedule() {
    // 同上：实参 `this.acceptor` 的求值（getter 读取）必须保留，不能因"被忽略"而删除。
    cardSender.selectSchedule(this.acceptor).then(result => {
      if (!this.props.session.isGroup) {
        // 擦除标记：日程卡片的 entityid 必存在（原 any 直接 split）；缺省时原实现抛原生 TypeError。
        const calendarOpts = (result.card.entityid as string).split('_');
        calendar
          .addMembers({
            calendarID: calendarOpts[0],
            memberIDs: this.acceptor.id,
            specialAccounts: {},
            isAllCalendar: true,
            recurTime: calendarOpts[1] ? moment(calendarOpts[1]).toISOString() : '',
          })
          .then(() => {
            this.props.onSendCardMsg(result);
          });
      } else {
        this.props.onSendCardMsg(result);
      }
    });
  }
  onNewVote() {
    cardSender
      .newVote(this.acceptor, {
        showSuccessTip: false,
      })
      .then(result => {
        this.props.onSendCardMsg(result);
      });
  }
  onNewFeed() {
    cardSender
      .newFeed(this.acceptor, {
        showSuccessTip: false,
      })
      .then(result => {
        this.props.onSendCardMsg(result);
      });
  }
  handleChange(visible: boolean) {
    this.setState({
      visible,
    });
  }
  renderToolbar() {
    return (
      <div className="ChatPanel-addToolbar-menu">
        {this.toolItems.map((item: CardToolbarItem, index: number) => (
          <div
            key={index}
            className={cx('menuItem', {
              hide:
                (item.icon === 'icon-chat-inputer-post' || item.icon === 'icon-votenobg') &&
                !this.props.session.isGroup,
            })}
            onClick={this.handleOpen.bind(this, item)}
          >
            <i className={item.icon} />
            <div className="menuItem-text">{item.name}</div>
          </div>
        ))}
      </div>
    );
  }
  override render() {
    const { visible } = this.state;

    if (!this.toolItems.length) {
      return <div className="ChatPanel-addToolbar noTool" />;
    }

    return (
      <Trigger
        popupVisible={visible}
        onPopupVisibleChange={this.handleChange.bind(this)}
        popupClassName="ChatPanel-Trigger"
        action={['click']}
        popupPlacement="top"
        builtinPlacements={config.builtinPlacements}
        popup={this.renderToolbar()}
        popupAlign={{ offset: [64, -10] }}
        getPopupContainer={() => document.querySelector('.ChatPanel-wrapper') as HTMLElement}
      >
        <div className={cx('ChatPanel-addToolbar addToolbarHover')}>
          <i className="icon-plus" />
        </div>
      </Trigger>
    );
  }
}
