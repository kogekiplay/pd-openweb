import styled from 'styled-components';
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

// 服务工单中心外部门户：明道 SaaS、Nocoly、私有部署统一使用该地址（Nocoly 已下线转人工，改由提交工单兜底反馈）
const SERVICE_TICKET_URL = 'https://www.theportal.cn/mduc';

// 移动端（含 APP webview）当前页打开，避免 window.open 被拦截；PC 新窗口打开，不打断当前会话
export function openServiceTicket() {
  if (browserIsMobile()) {
    window.location.href = SERVICE_TICKET_URL;
    return;
  }

  window.open(SERVICE_TICKET_URL, '_blank', 'noopener,noreferrer');
}

const BarWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

// 帮助会话输入框上方常驻栏（对齐老帮助中心 sendHeader）：左「帮助文档」跳帮助站点，
// 右「转人工客服」（仅国内，Nocoly 已下线人工客服）+「提交服务工单」（打开工单中心）。
// 首页（无会话）与对话态共用；转人工的具体行为（取链接弹分享层 / 直接开客服窗口）由调用方决定。
export function HelpComposerBar({ onTransfer = () => {} }: { onTransfer?: (() => void) | undefined }) {
  return (
    <BarWrap>
      <Support href="https://help.mingdao.com">
        <BgIconButton icon="book" text={_l('帮助文档')} />
      </Support>
      <BgIconButton.Group gap={4}>
        {!window.platformENV?.isOverseas && (
          <BgIconButton
            icon="support_agent"
            tooltip={_l('转人工客服')}
            popupPlacement="top"
            onClick={() => onTransfer()}
          />
        )}
        <BgIconButton icon="send" tooltip={_l('提交服务工单')} popupPlacement="top" onClick={openServiceTicket} />
      </BgIconButton.Group>
    </BarWrap>
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
