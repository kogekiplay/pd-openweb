import React from 'react';
import { Modal, notification } from 'antd';

export default function displayNotice({ noticeId, displayType, desc }) {
  const handleClose = () => {
    if (window.platformENV.isOverseas || window.platformENV.isLocal) return;
    window.mdyAPI(
      '',
      '',
      {
        accountId: md.global.Account.accountId,
        noticeId,
        type: 3,
      },
      {
        ajaxOptions: {
          type: 'GET',
          url: `${md.global.Config.MdNoticeServer}/notice/read`,
        },
      },
    );
  };

  if (desc) {
    if (displayType === 2) {
      const modal = Modal.info({
        className: 'marketModalContainer',
        width: 720,
        centered: true,
        closable: true,
        title: null,
        icon: null,
        content: <div className="contentWrap" dangerouslySetInnerHTML={{ __html: desc }}></div>,
        onCancel: handleClose,
      });
      // 保存引用 以便同步关闭
      window[`marketModal-${noticeId}`] = modal;
    } else {
      notification.open({
        className: 'marketNotificationContainer',
        message: null,
        key: noticeId,
        icon: null,
        placement: 'bottomLeft',
        // antd 5 起 notification 静态方法不再接受 bottom/top/getContainer 等实例级配置
        // （静态方法只有一个共享实例）。24 本就是默认值，去掉后位置不变。
        description: <div className="contentWrap" dangerouslySetInnerHTML={{ __html: desc }}></div>,
        duration: null,
        onClose: handleClose,
      });
    }
  }
}
