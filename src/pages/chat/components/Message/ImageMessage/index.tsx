import type { ChatMessage, ChatSession } from '../../../redux/types';
import { Component } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import { Tooltip } from 'ming-ui/antd-components';
import LoadDiv from 'ming-ui/components/LoadDiv';
import previewAttachments from 'src/components/previewAttachments/previewAttachments';
import Config from 'src/pages/chat/utils/config';
import * as utils from '../../../utils/';
import FileMessage from '../FileMessage';
import { hasAttachmentData } from '../attachment';
import { handleMessageFilePreview } from '../MessageToolbar';
import './index.less';

export interface ImageMessageProps {
  message: ChatMessage;
  session: ChatSession;
  messageLength?: number | undefined;
}
export interface ImageMessageState {
  loading: boolean;
  previewUrl: string;
  isError: boolean;
}
export default class ImageMessage extends Component<ImageMessageProps, ImageMessageState> {
  declare _isMounted: boolean | undefined;

  constructor(props: ImageMessageProps) {
    super(props);
    this.state = {
      loading: false,
      previewUrl: '',
      isError: false,
    };
  }
  override componentDidMount() {
    const { session, message, messageLength } = this.props;
    const files = message.msg?.files;
    if (!hasAttachmentData(files)) return;
    const previewUrl = String(message.kcFile ? files.url : _.get(files, 'thumbs.web_1') || files.url);
    this._isMounted = true;
    this.handleLoadImage(previewUrl)
      .then(() => {
        if (!this._isMounted) {
          return;
        }

        this.setState(
          {
            loading: true,
            previewUrl,
          },
          () => {
            utils.scrollEnd(session.id, messageLength !== undefined && messageLength <= Config.MSG_LENGTH_MORE);
          },
        );
      })
      .catch(() => {
        this.setState({ isError: true });
      });
  }
  override componentWillUnmount() {
    this._isMounted = false;
  }
  handleLoadImage(url: string) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
  }
  handleMessageFilePreview() {
    const { message, session } = this.props;
    const files = message.msg?.files;
    if (!hasAttachmentData(files)) return;

    if (session.accountId && !session.isContact) {
      return;
    }

    if (files.isEmotion) {
      return;
    } else if (message.kcFile) {
      previewAttachments(
        {
          attachments: [message.kcFile],
          callFrom: 'kc',
          hideFunctions: ['editFileName'],
        },
        {},
      );
    } else {
      handleMessageFilePreview.call(this);
    }
  }
  override render() {
    const { loading, previewUrl, isError } = this.state;
    const { message, session } = this.props;
    const files = message.msg?.files;

    if (isError || !hasAttachmentData(files)) {
      return <FileMessage message={message} session={session} />;
    }

    return (
      <div
        className={cx('Message-image', { 'Message-emotion-image': files.isEmotion, 'Message-image-loading': !loading })}
        onClick={this.handleMessageFilePreview.bind(this)}
      >
        {loading && message.kcFile ? (
          <Tooltip title={_l('来自知识中心')}>
            <div className="Message-image-kcIcon">
              <i className="icon icon-knowledge1" />
            </div>
          </Tooltip>
        ) : undefined}
        {loading ? (
          <img className={cx('Message-image-layer', { emotion: files.isEmotion })} src={previewUrl} alt={files.name} />
        ) : (
          <LoadDiv size="small" />
        )}
      </div>
    );
  }
}
