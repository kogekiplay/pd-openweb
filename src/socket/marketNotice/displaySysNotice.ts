import moment from 'moment';
import { mdNotification } from 'ming-ui/functions';
import type { MarketNoticeData } from '../socketTypes';

export default function sysNotice(data: MarketNoticeData): void {
  if (!md.global.Config.MdNoticeServer) return;

  if (data) {
    if (data.type === 1) {
      if (data.createTime && moment(data.createTime).toDate() < moment(md.global.Account.createTime).toDate()) return;
      const { title, desc, link, linkText, noticeId } = data;
      mdNotification.success({
        key: noticeId,
        removeReadType: true,
        title: title,
        description: desc,
        duration: null,
        btnList: link
          ? [
              {
                text: linkText || _l('查看详情'),
                onClick: () => window.open(link),
              },
            ]
          : [],
      });
    } else if (data.type === 2) {
      if (data.createTime && moment(data.createTime).toDate() < moment(md.global.Account.createTime).toDate()) return;
      const { noticeId } = data;
      mdNotification.success({
        key: noticeId,
        removeReadType: true,
        title: _l('检测到系统更新 🚀'),
        description: _l('为了不影响您的正常使用，建议刷新页面'),
        duration: null,
        btnList: [
          {
            text: _l('立即刷新'),
            onClick: () => location.reload(),
          },
        ],
      });
    } else {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('update');
      }
    }
  }
}
