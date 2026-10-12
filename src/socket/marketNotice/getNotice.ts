import { get } from 'lodash';
import displayMarketNotice from './displayMarketNotice';
import displaySysNotice from './displaySysNotice';
import '../index.less';
import { decodeMarketNotice, isRecord } from '../socketTypes';

export default function getNotice() {
  const { accountId } = get(md, ['global', 'Account']);
  const { MdNoticeServer } = get(md, ['global', 'Config']);
  window
    .mdyAPI(
      '',
      '',
      {},
      {
        customParseResponse: true,
        ajaxOptions: {
          type: 'GET',
          url: `${MdNoticeServer}/notice/getUnread?accountId=${accountId}&types=1&types=3`,
        },
      },
    )
    .then((payload: unknown) => {
      if (!isRecord(payload)) return;
      if (payload['state'] === 1) {
        const { data = [] } = payload;

        if (Array.isArray(data) && data.length > 0) {
          data.forEach((item: unknown) => {
            const notice = isRecord(item) ? decodeMarketNotice(item['data']) : null;
            if (!notice) return;
            if ([1, 2].includes(notice.type || 0)) {
              displaySysNotice(notice);
              return;
            }

            displayMarketNotice(notice);
          });
        }
      } else {
        console.log(payload);
      }
    });
}
