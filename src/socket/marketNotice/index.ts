import { notification } from 'antd';
import displayMarketNotice from './displayMarketNotice';
import displaySysNotice from './displaySysNotice';
import { decodeMarketNotice } from '../socketTypes';

export default function marketNotice() {
  const { socket } = window.IM || {};

  if (socket) {
    (socket as { on(event: 'notice message', handler: (data: unknown) => void): unknown }).on('notice message', rawData => {
      const data = decodeMarketNotice(rawData);
      if (!data) return;
      // 多页面通知同步关闭
      if (data.type === 99) {
        const { noticeId } = data;
        // antd 5 把 notification.close 改名成 destroy（与 message 统一），传 key 仍是关单条
        notification.destroy(noticeId);
        // 如果存在通知弹窗 则通过引用关闭
        const modalRef = window[`marketModal-${noticeId}`];

        if (modalRef && modalRef.destroy) {
          modalRef.destroy();
          // 清除引用
          Reflect.deleteProperty(window, `marketModal-${noticeId}`);
        }

        return;
      }

      if (data.type === 1 || data.type === 2) {
        displaySysNotice(data);
        return;
      }

      displayMarketNotice(data);
    });
  }
}
