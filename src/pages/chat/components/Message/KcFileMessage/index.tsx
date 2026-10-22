import type { ChatMessage, ChatSession } from '../../../redux/types';
import type { KcNodeReply } from 'src/api/kcTypes';
import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import kc from 'src/api/kc';
import RegExpValidator from 'src/utils/expression';
import FileMessage from '../FileMessage';
import ImageMessage from '../ImageMessage';

export interface KcFileMessageProps {
  message: ChatMessage;
  session: ChatSession;
  onUpdateKcFile: (message: ChatMessage) => void;
}
export default class KcFileMessage extends Component<KcFileMessageProps, Record<string, never>> {
  private requestVersion = 0;
  constructor(props: KcFileMessageProps) {
    super(props);
  }
  override componentDidMount() {
    this.getNodeDetail();
  }

  override componentDidUpdate(prevProps: KcFileMessageProps) {
    if (!shallowEqual(prevProps, this.props)) {
      this.getNodeDetail();
    }
  }
  override componentWillUnmount() {
    this.requestVersion += 1;
  }
  getNodeDetail() {
    const { message } = this.props;
    const card = message.card;
    if (card === null || card === undefined) {
      this.requestVersion += 1;
      return;
    }
    const { entityid } = card;
    const requestVersion = ++this.requestVersion;

    if (!message.kcFile) {
      kc.getNodeDetail({
        id: entityid,
        actionType: 14,
      }).then(result => {
        if (requestVersion !== this.requestVersion) return;
        if (result) {
          this.props.onUpdateKcFile(this.format(result));
        }
      });
    }
  }
  format(kcFile?: KcNodeReply) {
    const { message } = this.props;
    const body = message.msg ?? (message.msg = {});
    body.files = {
      name: message.card?.title,
      size: kcFile ? kcFile.size : 0,
      url: kcFile ? kcFile.viewUrl : '',
    };
    message.kcFile = kcFile;
    return message;
  }
  override render() {
    const { message, session } = this.props;
    const { title } = message.card ?? {};
    const isPicture = RegExpValidator.fileIsPicture(`.${RegExpValidator.getExtOfFileName(title)}`);
    const msg = message.kcFile ? message : this.format();
    return isPicture && message.kcFile ? (
      <ImageMessage message={msg} session={session} />
    ) : (
      <FileMessage message={msg} session={session} />
    );
  }
}
