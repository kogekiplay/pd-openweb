import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Popup } from 'antd-mobile';
import { LoadDiv } from 'ming-ui';
import { Modal } from 'ming-ui/antd-components';
import useFunctionWrapComponent from 'ming-ui/hooks/useFunctionWrapComponent';
import agentAjax from 'src/api/agent';
import { browserIsMobile } from 'src/utils/common';
import { isUnauthorizedError } from 'src/utils/services/request/error';

interface Props {
  traceId: string;
  projectId: string;
  onClose: () => void;
}
const DISPLAY_PARAMS: Readonly<Record<string, string>> = {
  bg: 'no',
  header: 'no',
  footer: 'no',
  submit: 'right',
  submitbottom: '20',
  hotkey: 'yes',
};
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
export function withFeedbackDisplayParams(url: string): string {
  const parsed = new URL(url);
  Object.entries(DISPLAY_PARAMS).forEach(([key, value]) => parsed.searchParams.set(key, value));
  return parsed.toString();
}
function errorText(error?: unknown): string {
  const code = record(record(error)?.['data'])?.['errorCode'];
  if (code === 'feedback_form_not_found') return _l('反馈入口暂未开放');
  if (code === 'trace_not_found' || code === 'invalid_request') return _l('当前请求暂不可反馈');
  if (code === 'feedback_form_invalid') return _l('反馈服务暂不可用，请稍后重试');
  return _l('打开反馈页面失败，请稍后重试');
}
export function AgentFeedback({ traceId, projectId, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [formUrl, setFormUrl] = useState('');
  const [failure, setFailure] = useState('');
  const mobile = browserIsMobile();
  useEffect(() => {
    let cancelled = false;
    agentAjax
      .getAgentFeedbackFormUrl({ traceId, projectId }, { silent: true })
      .then((value: unknown) => {
        if (cancelled) return undefined;
        const url = record(record(value)?.['data'])?.['url'];
        if (typeof url !== 'string' || !url) {
          setFailure(errorText());
          return undefined;
        }
        try {
          setFormUrl(withFeedbackDisplayParams(url));
        } catch {
          setFailure(errorText());
        }
        return undefined;
      })
      .catch((error: unknown) => {
        if (!cancelled && !isUnauthorizedError(error)) setFailure(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [traceId, projectId]);
  useEffect(() => {
    if (!formUrl) return undefined;
    const origin = new URL(formUrl).origin;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== origin ||
        event.source !== frameRef.current?.contentWindow ||
        record(event.data)?.['type'] !== 'PUBLIC_WORKSHEET_SUBMITTED'
      )
        return;
      onClose();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [formUrl, onClose]);
  const style: CSSProperties = {
    display: 'block',
    width: '100%',
    height: mobile ? '70vh' : 'min(553px,70vh)',
    border: 0,
  };
  const content = failure ? (
    <div className="flexRow alignItemsCenter justifyContentCenter textTertiary" style={style}>
      {failure}
    </div>
  ) : formUrl ? (
    <iframe ref={frameRef} src={formUrl} title={_l('反馈')} style={style} />
  ) : (
    <div className="flexRow alignItemsCenter justifyContentCenter" style={style}>
      <LoadDiv />
    </div>
  );
  return mobile ? (
    <Popup visible className="mobileModal topRadius" onMaskClick={onClose}>
      <div className="flexRow pAll16">
        <strong className="flex">{_l('反馈')}</strong>
        <button type="button" className="ming Button Button--link" onClick={onClose}>
          {_l('关闭')}
        </button>
      </div>
      {content}
    </Popup>
  ) : (
    <Modal open width={640} title={_l('反馈')} keyboard mask={{ closable: true }} footer={null} onCancel={onClose}>
      {content}
    </Modal>
  );
}
export default function useAgentFeedback() {
  return useFunctionWrapComponent(AgentFeedback);
}
