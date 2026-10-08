import { BgIconButton, Support } from 'ming-ui';
import { Modal } from 'ming-ui/antd-components';
import ShareUrl from 'worksheet/components/ShareUrl';
import { SHARE_SCOPE, updatePublicShareStatus } from 'src/pages/worksheet/components/Share/controller';
import { browserIsMobile, emitter } from 'src/utils/common';
import { createSessionShare, SESSION_SHARE_SCOPE } from '../agentService';

export function openCustomerService(url?: string): void {
  if (window['md_js']?.customerService) {
    window['md_js'].customerService(url ? { message: url } : {});
    return;
  }
  emitter.emit('SET_MINGO_VISIBLE', { mingoVisible: false });
  window['mdCustomerServiceOpen']?.();
}
export async function fetchHelpSessionShareUrl(sessionId: string): Promise<string> {
  const result = await updatePublicShareStatus({
    from: 'mingoHistory',
    sourceId: sessionId,
    isPublic: true,
    scope: SHARE_SCOPE.PUBLIC,
    createShareSource: () => createSessionShare({ sessionId, scope: SESSION_SHARE_SCOPE.PUBLIC }),
  });
  return result?.shareLink || '';
}
export function HelpComposerBar({ onTransfer = () => {} }: { onTransfer?: (() => void) | undefined }) {
  return (
    <div className="flexRow alignItemsCenter mBottom8">
      <Support href="https://help.mingdao.com">
        <BgIconButton icon="book" text={_l('帮助文档')} />
      </Support>
      <div className="flex" />
      <BgIconButton icon="support_agent" tooltip={_l('人工客服')} popupPlacement="top" onClick={onTransfer} />
    </div>
  );
}
export function TransferHumanDialog({ url, onClose = () => {} }: { url: string; onClose?: (() => void) | undefined }) {
  return (
    <Modal open width={660} title={_l('分享')} mask={{ closable: true }} keyboard onCancel={onClose}>
      <div className="mBottom10 textTertiary">{_l('将当前会话链接分享给人工客服')}</div>
      <ShareUrl
        theme="light"
        copyShowText
        url={url}
        copyText={browserIsMobile() ? _l('复制并前往') : _l('复制')}
        qrVisible={false}
        allowSendToChat={false}
        getCopyContent={(copyUrl: string) => {
          onClose();
          openCustomerService(copyUrl);
          return copyUrl;
        }}
      />
    </Modal>
  );
}
