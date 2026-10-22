import type { ChatMessage, ChatSession } from '../../../redux/types';
import { Component } from 'react';
import previewAttachments from 'src/components/previewAttachments/previewAttachments';
import { formatFileSize, getClassNameByExt } from 'src/utils/common';
import RegExpValidator from 'src/utils/expression';
import Constant from '../../../utils/constant';
import { hasAttachmentData } from '../attachment';
import { handleMessageFilePreview } from '../MessageToolbar';
import './index.less';

export interface FileMessageState {
  progress: number;
  cancel: boolean;
  cancelShow: boolean;
}

export interface FileMessageProps {
  message: ChatMessage;
  session: ChatSession;
}
export default class FileMessage extends Component<FileMessageProps, FileMessageState> {
  declare iconClassName: string;
  declare uploader: { stop(): void; start(): void; removeFile(file: { id: string | number }): void } | null;
  declare uploadFileId: string | number | undefined;

  constructor(props: FileMessageProps) {
    super(props);
    this.state = {
      progress: 0,
      cancel: false,
      cancelShow: false,
    };
    this.uploader = null;
  }
  override componentDidMount() {
    const { message } = this.props;
    const files = message.msg?.files;

    if (!message.isPrepare || !hasAttachmentData(files) || !files.id || files.aid) return;

    this.uploadFileId = files.id;
    window[`chatBeforeUpload${files.id}`] = this.handleBeforeUpload;
    window[`chatUploadProgress${files.id}`] = this.handleUploadProgress;
  }
  override componentWillUnmount() {
    this.clearUploadCallbacks();
  }
  handleBeforeUpload = (uploader: FileMessage['uploader']) => {
    this.uploader = uploader;
  };
  handleUploadProgress = (progress: number | string) => {
    this.setState({
      progress: Number(progress),
      cancelShow: true,
    });
  };
  clearUploadCallbacks() {
    const id = this.uploadFileId;

    if (!id) return;

    if (window[`chatBeforeUpload${id}`] === this.handleBeforeUpload) {
      delete window[`chatBeforeUpload${id}`];
    }

    if (window[`chatUploadProgress${id}`] === this.handleUploadProgress) {
      delete window[`chatUploadProgress${id}`];
    }

    this.uploadFileId = undefined;
  }
  handleStopFile() {
    const { message } = this.props;
    const files = message.msg?.files;

    if (!message.isPrepare || !hasAttachmentData(files) || !files.id) return;

    if (this.uploader) {
      this.uploader.stop();
      this.uploader.removeFile({ id: files.id });
      this.uploader.start();
    }

    this.setState(
      {
        cancel: true,
      },
      () => {
        this.clearUploadCallbacks();
      },
    );
  }
  handleMessageFilePreview() {
    const { message } = this.props;
    const { type } = message;

    if (!hasAttachmentData(message.msg?.files)) return;

    if (type === Constant.SESSIONTYPE_CALENDAR) {
      if (message.kcFile) {
        previewAttachments(
          {
            attachments: [message.kcFile],
            callFrom: 'kc',
            hideFunctions: ['editFileName'],
          },
          {},
        );
      } else {
        alert(_l('权限不足或文件不存在，请联系文件夹管理员或文件上传者'), 3);
      }
    } else {
      if (message.isPrepare) return;
      handleMessageFilePreview.call(this);
    }
  }
  override render() {
    const { message } = this.props;
    const files = message.msg?.files;

    if (!hasAttachmentData(files)) {
      return (
        <div className="Message-file" aria-disabled={true}>
          <div className="Message-fileIcon">
            <i className={getClassNameByExt('')} />
          </div>
          <div className="Message-fileInfo">
            <div className="Message-fileName">{_l('附件信息缺失')}</div>
          </div>
        </div>
      );
    }

    const { progress, cancel, cancelShow } = this.state;
    const isKc = message.card ? message.card.md === 'kcfile' : false;
    const size = formatFileSize(files.fsize || files.size);
    return (
      <div className="Message-file" onClick={this.handleMessageFilePreview.bind(this)}>
        <div className="Message-fileIcon">
          <i className={getClassNameByExt(RegExpValidator.getExtOfFileName(files.name))} />
        </div>
        <div className="Message-fileInfo">
          <div className="Message-fileName">{files.name}</div>
          {message.isPrepare && !cancel ? (
            <div className="Message-fileProgress">
              <div className="Message-fileProgressBar" style={{ width: `${progress}%` }} />
            </div>
          ) : cancel ? (
            <div className="Message-fileError">{_l('您已取消发送')}</div>
          ) : (
            <div className="Message-fileSize ellipsis">{`${isKc ? _l('来自知识中心') : ''} ${size}`}</div>
          )}
        </div>
        {message.isPrepare && !cancel && cancelShow ? (
          <div className="Message-fileAction" onClick={this.handleStopFile.bind(this)}>
            <span className="btn btnCancel" title={_l('取消')}>
              <i className="icon-cancel" />
            </span>
          </div>
        ) : undefined}
      </div>
    );
  }
}
