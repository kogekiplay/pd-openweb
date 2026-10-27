import { Component } from 'react';
import cx from 'classnames';
import player from '../../../lib/mp3player/mp3player';
import type { MP3PlayerConstructor, MP3PlayerPlayback } from '../../../lib/mp3player/mp3player';
import type { ChatMessage, ChatMessageFiles } from '../../../redux/types';
import { present } from '../../../utils/present';
import * as socket from '../../../utils/socket';
import './index.less';

export interface AudioMessageProps {
  message: ChatMessage;
}

export interface AudioMessageState {
  audioPlaying: boolean;
  // The existing wire leaves this flag opaque; this component only tests its truthiness.
  isRead: ChatMessageFiles['read'];
}

export type AudioDurationParser = (value: ChatMessageFiles['len']) => number;

export default class AudioMessage extends Component<AudioMessageProps, AudioMessageState> {
  declare audio: MP3PlayerPlayback | null;

  constructor(props: AudioMessageProps) {
    super(props);
    const { message } = this.props;
    const { files } = present(message.msg, 'files');
    this.state = {
      audioPlaying: false,
      isRead: files ? files['read'] : true,
    };
    this.audio = null;
  }
  handlePlayAudio() {
    const { message } = this.props;
    const { files: suppliedFiles } = present(message.msg, 'files');
    const files = present(suppliedFiles, 'read');

    if (!files['read']) {
      socket.Message.markAudioAsRead({
        messageId: message.id,
      });
      this.setState({
        isRead: true,
      });
    }

    // 第一次播放
    if (!this.audio) {
      this.setState({
        audioPlaying: true,
      });
      this.audio = new (player as typeof player & MP3PlayerConstructor)({
        mp3_url: files.url,
        wav_url: files.url,
        onStop: () => {
          this.setState({
            audioPlaying: false,
          });
        },
      });
      window.chatAudioPlayer = this.audio;
      window.chatAudioPlayer.play();
    } else if (this.state.audioPlaying) {
      // 取消播放
      this.audio.stop();
      present(window.chatAudioPlayer, 'stop').stop();
    } else {
      // 重播
      window.chatAudioPlayer = this.audio;
      window.chatAudioPlayer.play();
      this.setState({
        audioPlaying: true,
      });
    }
  }
  override render() {
    const { message } = this.props;
    const { files } = present(message.msg, 'files');
    const { audioPlaying, isRead } = this.state;
    return (
      <div className="Message-audio" onClick={this.handlePlayAudio.bind(this)}>
        <i className={cx('Message-audioIcon', { audioPlaying })} />
        <span>{files ? (parseInt as AudioDurationParser)(files.len) || 0 : 0} ”</span>
        {isRead ? undefined : <div className="Message-audioUnread" />}
      </div>
    );
  }
}
