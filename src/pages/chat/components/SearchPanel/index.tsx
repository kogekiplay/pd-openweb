import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import * as ajax from '../../utils/ajax';
import type { ChatMessage, ChatSession } from '../../redux/types';
import type { MemberItem } from '../Members/Panel';
import Files from './Files';
import Members from './Members';
import Messages from './Messages';
import './index.less';

import type { ChatMatchedCounts } from 'src/api/chatTypes';
import { countForArithmetic } from './countValue';

/** 搜索面板标签页项（`formatMatchedTab` 产出，`renderTab`/`handleSetTab` 消费） */
export interface MatchedTab {
  title: string;
  count?: number | undefined;
  type: string;
}

const formatMatchedTab = (res: ChatMatchedCounts, isGroup: boolean | undefined): MatchedTab[] => {
  const tab: MatchedTab[] = [
    {
      title: _l('聊天记录'),
      count: res.matchedMessageCount,
      type: 'message',
    },
    {
      title: _l('文件'),
      count: res.matchedFileCount,
      type: 'file',
    },
    {
      title: _l('成员'),
      count: res.matchedMemberCount,
      type: 'member',
    },
  ];

  // 个人聊天没有成员
  if (!isGroup) {
    delete tab[2];
  }

    return tab.sort((a: MatchedTab, b: MatchedTab) => {
      // 计数字段可能缺省；`undefined` 参与减法得 NaN，与原实现一致（不改成默认 0）
      return countForArithmetic(b.count) - countForArithmetic(a.count);
  });
};

export interface SearchPanelProps {
  session: ChatSession;
  /** 搜索关键词（父级 `ChatPanelSessionInfo` 的 `searchText: string` 直接透传） */
  searchText: string;
  /** 跳到某条消息（父级 `ChatPanelSessionInfo.handleGotoMessage`） */
  onGotoMessage: (message: Pick<ChatMessage, 'id'>) => void;
  /** 打开与某成员的会话（父级 `handleOpenSession`） */
  onOpenSession: (item: MemberItem) => void;
  /**
   * 面板显隐（父级 `handleSetPanelVisible.bind(this, 'search')` 会传入）。
   * 本组件**内部不消费**；如实声明以保持父级传参的真实形状，不从父级删实参。
   */
  onSetPanelVisible?: ((visible: boolean) => void) | undefined;
}

export interface SearchPanelState {
  loading: boolean;
  tabIndex: number;
  tab: MatchedTab[];
  type: string;
}

export default class SearchPanel extends Component<SearchPanelProps, SearchPanelState> {
  constructor(props: SearchPanelProps) {
    super(props);
    this.state = {
      loading: true,
      tabIndex: 0,
      tab: [],
      type: '',
    };
  }
  override componentDidMount() {
    this.updateTabCount(this.props.searchText);
  }

  override componentDidUpdate(prevProps: SearchPanelProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.searchText) {
        this.updateTabCount(this.props.searchText);
      }
    }
  }
    updateTabCount(searchText: string | undefined) {
    const { session } = this.props;
    const param = {
      keywords: searchText,
      [session.isGroup ? 'groupId' : 'withUser']: session.id,
    };
      ajax.getCountByTabName(param).then(counts => {
        // 原实现在此把 `result` 从回执对象重赋为标签数组；改为独立变量，行为不变
        const result = formatMatchedTab(counts, session.isGroup);
      this.setState({
        tab: result,
        tabIndex: 0,
          type: result[0]!.type,
      });
    });
  }
  handleSetTab(item: MatchedTab, index: number) {
    const { type } = item;
    this.setState({
      tabIndex: index,
      type,
    });
  }
  renderTab() {
    const { tab, tabIndex } = this.state;
    return (
      <div className="ChatPanel-SearchPanelTab">
        {tab.map((item: MatchedTab, index: number) => (
          <div className="item-box" key={index} onClick={this.handleSetTab.bind(this, item, index)}>
            <span className={cx('item', { borderColorPrimary: index === tabIndex, colorPrimary: index === tabIndex })}>
              {item.title}
                {`(${countForArithmetic(item.count) >= 99 ? '99+' : item.count})`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  override render() {
    const { type } = this.state;
    const { searchText, session } = this.props;
    return (
      <div className="ChatPanel-SearchPanel">
        {this.renderTab()}
        {type === 'message' ? (
          <Messages onGotoMessage={this.props.onGotoMessage} session={session} searchText={searchText} />
        ) : undefined}
        {type === 'file' ? <Files session={session} searchText={searchText} /> : undefined}
        {type === 'member' ? (
          <Members onOpenSession={this.props.onOpenSession} session={session} searchText={searchText} />
        ) : undefined}
      </div>
    );
  }
}
