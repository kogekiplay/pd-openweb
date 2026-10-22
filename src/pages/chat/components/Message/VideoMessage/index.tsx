import { Component } from 'react';
import type { ChatMessage, ChatSession } from '../../../redux/types';
import FileMessage from '../FileMessage';
import * as utils from '../../../utils/';
import { handleMessageFilePreview } from '../MessageToolbar';
import './index.less';

const formatTime = (seconds: number = 0) => {
  let minute: number | string = parseInt(String((seconds / 60) % 60));
  let second: number | string = parseInt(String(seconds % 60));

  minute = minute >= 10 ? minute : `0${minute}`;
  second = second >= 10 ? second : `0${second}`;

  return `${minute}:${second}`;
};

export interface VideoMessageState {
  loading: boolean;
}

export interface VideoMessageProps {
  message: ChatMessage;
  session: ChatSession;
}

export default class VideoMessage extends Component<VideoMessageProps, VideoMessageState> {
  declare _isMounted: boolean | undefined;

  constructor(props: VideoMessageProps) {
    super(props);
    this.state = {
      loading: false,
    };
  }
  override componentDidMount() {
    const { loading } = this.state;
    const { session, message } = this.props;
    const files = message.msg?.files;
    if (files === undefined || files === null) return;
    const { video_pic } = files;

    if (video_pic && !loading) {
      this._isMounted = true;
      this.handleLoadImage(video_pic).then(() => {
        if (!this._isMounted) {
          return;
        }

        this.setState(
          {
            loading: true,
          },
          () => {
            utils.scrollEnd(session.id, message.waitingId ? true : false);
          },
        );
      });
    }
  }
  override componentWillUnmount() {
    this._isMounted = false;
  }
  handleMessageFilePreview() {
    handleMessageFilePreview.call(this);
  }
  handleLoadImage(url: string) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = resolve;
      image.src = url;
    });
  }
  override render() {
    const { message, session } = this.props;
    const files = message.msg?.files;
    if (files === undefined || files === null) return <FileMessage message={message} session={session} />;
    const { video_pic, video_duration, video_width, video_height } = files;
    const size = {
      width: (video_width || 2) > (video_height || 1) ? 240 : 180,
      height: (video_height || 1) > (video_width || 2) ? 240 : 180,
    };
    return (
      <div className="Message-card Message-cardVideo" style={size} onClick={this.handleMessageFilePreview.bind(this)}>
        <div className="Message-cardVideo-pic" style={{ backgroundImage: `url(${video_pic})` }} />
        <div className="Message-cardVideo-bottom">
          <i className="icon icon-video2" />
          <span>{video_duration ? formatTime(Number(video_duration)) : undefined}</span>
        </div>
      </div>
    );
  }
}
