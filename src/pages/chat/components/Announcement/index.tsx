import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import Textarea from 'ming-ui/components/Textarea';
import GroupController from 'src/api/group';
import * as utils from '../../utils';
import type { ChatSession } from '../../redux/types';
import './index.less';

export interface AnnouncementProps {
  session: ChatSession;
  /** 保存成功后把新公告回传父级（同步会话信息）；文本框值恒为 string */
  updateGroupAbout: (about: string) => void;
}

export interface AnnouncementState {
  value: ChatSession['about'];
  compile: boolean;
}

export default class Announcement extends Component<AnnouncementProps, AnnouncementState> {
  constructor(props: AnnouncementProps) {
    super(props);
    const { about } = this.props.session;
    this.state = {
      value: about,
      compile: false,
    };
  }

  override componentDidUpdate(prevProps: AnnouncementProps) {
    if (!shallowEqual(prevProps, this.props)) {
      const { session } = this.props;

      if (session.about !== this.state.value) {
        this.setState({
          value: session.about,
        });
      }
    }
  }
  handleChange(value: string) {
    this.setState({
      value,
    });
  }
  handleFocus() {
    this.setState({
      compile: true,
    });
  }
  handleBlur(event: { target: { value: string } }) {
    const { groupId } = this.props.session;
    const { value } = event.target;
    GroupController.updateGroupAbout({
      groupId,
      groupAbout: value,
    }).then(reuslt => {
      if (reuslt) {
        this.props.updateGroupAbout(value);
      }
    });
    this.setState({
      compile: false,
    });
  }
  renderTextarea() {
    const { value } = this.state;
    return (
      <Textarea
        className="ChatPanel-Announcement-textarea"
        value={value}
        placeholder={_l('暂无群公告')}
        minHeight={25}
        maxHeight={80}
        onChange={this.handleChange.bind(this)}
        onFocus={this.handleFocus.bind(this)}
        onBlur={this.handleBlur.bind(this)}
      />
    );
  }
  override render() {
    const { value, compile } = this.state;
    return (
      <div
        className={cx('ChatPanel-Announcement ChatPanel-sessionInfo-item', {
          'ChatPanel-Announcement-compile': compile,
        })}
      >
        <div className="ChatPanel-Announcement-hander ChatPanel-sessionInfo-hander">{_l('群公告')}</div>
        <div className="ChatPanel-Announcement-body">
          <div
            className="ChatPanel-Announcement-text"
            dangerouslySetInnerHTML={{ __html: utils.convertGroupAbout(value) }}
          />
        </div>
      </div>
    );
  }
}
