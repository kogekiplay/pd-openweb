import { Component } from 'react';
import copy from 'src/utils/copyToClipboard';
import { Dialog } from 'ming-ui';
import './shareFolderOrTask.less';

interface ShareFolderOrTaskProps {
  shareUrl?: string;
  shareMessage?: string;
  linkText?: string;
  onClose?: () => void;
  [key: string]: unknown;
}

export default class ShareFolderOrTask extends Component<ShareFolderOrTaskProps> {
  static defaultProps = {
    shareUrl: '',
    shareMessage: '',
    linkText: '',
  };

  override render() {
    const { shareUrl, shareMessage, linkText } = this.props;

    return (
      <Dialog
        visible
        dialogClasses="shareFolderOrTask"
        title={_l('获取链接与二维码')}
        showFooter={false}
        handleClose={() => {
          this.props.onClose ? this.props.onClose() : $('.shareFolderOrTask').parent().remove();
        }}
      >
        <div className="qrCode">
          <img src={md.global.Config.AjaxApiUrl + 'code/CreateQrCodeImage?url=' + shareUrl} />
        </div>
        <div className="createShareDesc Font16">{shareMessage}</div>
        <div className="createShareCopy Font14">
          <span
            data-clipboard-text={shareUrl}
            onClick={() => {
              // .attr() 的真实返回是 string | undefined；这个属性就在上一行由 shareUrl 写上去的，
              // 实际不会缺，?? '' 只是把兜底写出来。
              copy($('.createShareCopy span').attr('data-clipboard-text') ?? '');
              alert(_l('已经复制到粘贴板，你可以使用Ctrl+V 贴到需要的地方去了哦'));
            }}
          >
            <i />
            {linkText}
          </span>
        </div>
      </Dialog>
    );
  }
}
