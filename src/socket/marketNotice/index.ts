import { notification } from 'antd';
import displayMarketNotice from './displayMarketNotice';
import displaySysNotice from './displaySysNotice';

export default function marketNotice() {
  const { socket } = window.IM || {};

  if (socket) {
    socket.on('notice message', data => {
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

      if ([1, 2].includes(data.type)) {
        displaySysNotice(data);
        return;
      }

      displayMarketNotice(data);
    });
  }
}
