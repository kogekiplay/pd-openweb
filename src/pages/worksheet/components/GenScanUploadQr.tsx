import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import Trigger from '@rc-component/trigger';
import PropTypes from 'prop-types';
import { LoadDiv, Qr } from 'ming-ui';
import attachmentAjax from 'src/api/attachment';
import RecordInfoContext from 'worksheet/common/recordInfo/RecordInfoContext';
import { UPLOAD_TYPE } from 'worksheet/constants/enum';
import { getTemporaryAttachmentFromUrl } from 'src/utils/common';
import type { TemporaryAttachment } from 'src/utils/commonRequestTypes';
import styled from 'src/utils/typedStyled';
import { decodeScanId, decodeScanResponse, scanFlags } from './scanUploadBoundary';

const Popup = styled.div`
  position: relative;
  background-color: var(--color-background-card);
  padding: var(--space-3) var(--space-5) var(--space-5);
  width: 240px;
  box-shadow: var(--shadow-xl);
  border-radius: 6px;
  .error {
    color: var(--color-error-text);
    text-align: center;
    line-height: 200px;
  }
  .expired {
    position: absolute;
    bottom: 20px;
    left: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    background-color: rgba(255, 255, 255, 0.95);
    &.error {
      line-height: 1.5;
    }
    .icon {
      color: var(--color-primary);
    }
    .qrExpired {
      font-size: var(--font-sm);
      color: var(--color-text-primary);
      margin-top: 6px;
    }
    .refresh {
      padding: var(--space-1) var(--space-5);
      border-radius: 45px;
      background: var(--color-primary-solid);
      color: var(--color-white);
      &:hover {
        background: var(--color-primary);
      }
    }
  }
  .tip {
    font-size: var(--font-md);
    color: var(--color-text-primary);
    font-weight: bold;
    text-align: center;
  }
  .danger {
    font-size: var(--font-md);
    color: var(--color-error-text);
    margin: 3px 0 10px;
    text-align: center;
  }
  .loadingCon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 200px;
    height: 200px;
  }
  &::before {
    content: '';
    position: absolute;
    width: 0px;
    height: 0px;
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    border-bottom: 11px solid var(--color-border-secondary);
    top: -11px;
    left: calc(50% - 12px);
  }
  &::after {
    content: '';
    position: absolute;
    width: 0px;
    height: 0px;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-bottom: 10px solid var(--color-white);
    top: -10px;
    left: calc(50% - 10px);
  }
  &.top {
    &::before {
      border-bottom: none;
      border-top: 11px solid var(--color-border-secondary);
      top: auto;
      bottom: -11px;
    }
    &::after {
      border-bottom: none;
      border-top: 10px solid var(--color-white);
      top: auto;
      bottom: -10px;
    }
  }
`;

function getUrlNoSearch(url: string): string {
  const urlObj = new URL(url);
  return urlObj.origin + urlObj.pathname;
}

const UPDATE_ATTACHMENT_INTERVAL = 1000;

export type ScanAttachment = TemporaryAttachment;

interface ScanCache {
  appendedAttachmentIds: string[];
  timer?: ReturnType<typeof setInterval> | undefined;
  scanId?: string | undefined;
  active: boolean;
  generation: number;
}

export interface GenScanUploadQrProps {
  type?: number | undefined;
  from?: string | undefined;
  worksheetId?: string | undefined;
  viewId?: string | undefined;
  controlId?: string | undefined;
  rowId?: string | undefined;
  children: React.ReactElement<{ className?: string | undefined; ref?: React.Ref<HTMLElement> | undefined }>;
  onScanResultUpdate?: ((files: ScanAttachment[]) => void) | undefined;
}

interface QrPopupProps extends Omit<GenScanUploadQrProps, 'children' | 'onScanResultUpdate'> {
  popupPosition: 'top' | 'bottom';
  onScanResultUpdate: (files: ScanAttachment[]) => void;
  setPopupVisible: (visible: boolean) => void;
}

function stopScan(scanId: string): void {
  void attachmentAjax.stopAttachmentScanUrl({ scanId }).catch(() => {});
}

function QrPopup({
  type,
  from,
  worksheetId,
  viewId,
  controlId,
  rowId,
  popupPosition,
  onScanResultUpdate,
  setPopupVisible,
}: QrPopupProps) {
  const cache = useRef<ScanCache>({ appendedAttachmentIds: [], active: false, generation: 0 });
  const [loading, setLoading] = useState(true);
  const [scanId, setScanId] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const callbacks = useRef({ onScanResultUpdate, setPopupVisible });
  callbacks.current = { onScanResultUpdate, setPopupVisible };
  const { fromIsDraft, fromIsWorkflow } = scanFlags(useContext(RecordInfoContext));
  const clearPolling = useCallback(() => {
    if (cache.current.timer !== undefined) {
      clearInterval(cache.current.timer);
      cache.current.timer = undefined;
    }
  }, []);

  const listenScan = useCallback(
    (newScanId: string, generation: number) => {
      clearPolling();
      let pending = false;
      const isCurrent = () => cache.current.active && cache.current.generation === generation;
      const run = async () => {
        // A slow poll must finish before another can deliver the same attachments.
        if (pending || !isCurrent()) return;
        pending = true;
        try {
          const raw: unknown = await attachmentAjax.getScanAttachments({ scanId: newScanId });
          if (!isCurrent()) return;
          const response = decodeScanResponse(raw);
          if (response.status !== 1) {
            setExpired(true);
            clearPolling();
            return;
          }
          const newAttachments = response.attachments.filter(
            item => !cache.current.appendedAttachmentIds.includes(getUrlNoSearch(item.fileUrl)),
          );
          if (newAttachments.length) {
            const attachments = newAttachments.map(item => getTemporaryAttachmentFromUrl(item));
            callbacks.current.onScanResultUpdate(attachments);
            if (!isCurrent()) return;
            cache.current.appendedAttachmentIds.push(...newAttachments.map(item => getUrlNoSearch(item.fileUrl)));
            if (type === UPLOAD_TYPE.SIGNATURE) {
              clearPolling();
              callbacks.current.setPopupVisible(false);
            }
          }
        } catch {
          if (isCurrent()) {
            clearPolling();
            setError(_l('获取扫码附件失败'));
          }
        } finally {
          pending = false;
        }
      };
      cache.current.timer = setInterval(() => void run(), UPDATE_ATTACHMENT_INTERVAL);
    },
    [clearPolling, type],
  );

  const genScanId = useCallback(async () => {
    const current = cache.current;
    const generation = ++current.generation;
    clearPolling();
    if (current.scanId) stopScan(current.scanId);
    current.scanId = undefined;
    setLoading(true);
    setError('');
    setExpired(false);
    const isCurrent = () => current.active && current.generation === generation;
    try {
      const raw: unknown = await attachmentAjax.getAttachmentScanUrl({
        sourceType: !worksheetId ? 3 : from === 'worksheet' ? 1 : 2,
        getType: fromIsDraft ? 21 : fromIsWorkflow ? 9 : undefined,
        fileType: type,
        worksheetId,
        controlId,
        viewId,
        // Scan uploads historically use an empty row identifier.
        rowId: '',
      });
      const generatedScanId = decodeScanId(raw);
      if (!isCurrent()) {
        if (current.scanId !== generatedScanId) stopScan(generatedScanId);
        return;
      }
      current.scanId = generatedScanId;
      setScanId(generatedScanId);
      listenScan(generatedScanId, generation);
    } catch {
      if (isCurrent()) setError(_l('获取扫码链接失败'));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [clearPolling, from, worksheetId, controlId, type, viewId, fromIsDraft, fromIsWorkflow, listenScan]);

  useEffect(() => {
    cache.current.active = true;
    cache.current.appendedAttachmentIds = [];
    void genScanId();
    return () => {
      cache.current.active = false;
      ++cache.current.generation;
      clearPolling();
      if (cache.current.scanId) stopScan(cache.current.scanId);
      cache.current.scanId = undefined;
    };
  }, [genScanId, clearPolling, rowId]);

  return (
    <Popup className={popupPosition}>
      <div className="tip">{_l('使用手机扫描二维码输入')}</div>
      <div className="danger">{_l('上传时请勿关闭此浮层')}</div>
      {!error &&
        (loading ? (
          <div className="loadingCon">
            <LoadDiv size="small" />
          </div>
        ) : (
          <Qr
            content={`${md.global.Config.WebUrl}recordfileupload/${scanId}?sys_lang=${window.getCurrentLang()}`}
            width={200}
            height={200}
            style={{ height: 200 }}
          />
        ))}
      {(expired || error) && (
        <div className={error ? 'expired error' : 'expired'}>
          <i className="icon icon-error1 Font48"></i>
          <p className="qrExpired">{expired ? _l('当前二维码已过期') : error}</p>
          <span className="refresh Hand" onClick={() => void genScanId()}>
            {_l('刷新')}
          </span>
        </div>
      )}
    </Popup>
  );
}

QrPopup.propTypes = {
  type: PropTypes.number,
  from: PropTypes.string,
  worksheetId: PropTypes.string,
  controlId: PropTypes.string,
  rowId: PropTypes.string,
  popupPosition: PropTypes.string,
  onScanResultUpdate: PropTypes.func,
  setPopupVisible: PropTypes.func,
};

export default function GenScanUploadQr({
  type = UPLOAD_TYPE.ATTACHMENT,
  from = 'worksheet',
  rowId,
  worksheetId,
  viewId,
  controlId,
  children,
  onScanResultUpdate = () => {},
}: GenScanUploadQrProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState<'top' | 'bottom'>('bottom');

  const child = React.Children.only(children);

  return (
    <Trigger
      popupVisible={popupVisible}
      onPopupVisibleChange={newVisible => {
        if (newVisible) {
          const element = ref.current;
          if (!element) return;
          const { bottom } = element.getBoundingClientRect();
          setPopupPosition(bottom + 290 > window.innerHeight ? 'top' : 'bottom');
        }

        setPopupVisible(newVisible);
      }}
      popupAlign={{
        offset: [0, popupPosition === 'bottom' ? 13 : -13],
        points: popupPosition === 'bottom' ? ['tc', 'bc'] : ['bc', 'tc'],
      }}
      popup={
        <QrPopup
          type={type}
          from={from}
          worksheetId={worksheetId}
          viewId={viewId}
          controlId={controlId}
          rowId={rowId}
          popupPosition={popupPosition}
          onScanResultUpdate={onScanResultUpdate}
          setPopupVisible={setPopupVisible}
        />
      }
      autoDestroy
      action={['click']}
    >
      {React.cloneElement(child, {
        ref,
        className: `${children.props.className || ''} ${popupVisible ? 'active' : ''}`,
      })}
    </Trigger>
  );
}

GenScanUploadQr.propTypes = {
  type: PropTypes.number,
  from: PropTypes.string,
  rowId: PropTypes.string,
  worksheetId: PropTypes.string,
  viewId: PropTypes.string,
  controlId: PropTypes.string,
  children: PropTypes.element.isRequired,
  onScanResultUpdate: PropTypes.func,
};
