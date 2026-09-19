import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import syncTaskApi from '../../../../api/syncTask';

const StatisticContent = styled.div`
  margin-top: 16px;

  .statisticPanel {
    display: flex;
    justify-content: space-between;

    .itemPanel,
    .firstItemPanel {
      display: flex;
      align-items: center;
      height: 88px;
      padding: 0 24px;
      background: var(--color-background-tertiary);
      border-radius: var(--radius-md);

      .titleText {
        color: var(--color-text-secondary);
        font-weight: 600;
      }
      .dataText {
        color: var(--color-text-title);
        font-size: 28px;
        font-weight: 600;
        line-height: 32px;

        &.running {
          color: var(--color-task);
        }
        &.error {
          color: var(--color-error);
        }
      }
    }

    .firstItemPanel {
      flex: 4;
      display: flex;
      align-items: center;
    }

    .flex3 {
      flex: 3;
    }
  }
`;

let ajaxPromise;

export default ({ projectId, flag }: { projectId?: string; [key: string]: any }) => {
  const [statisticData, setStatisticData] = useState({});

  useEffect(() => {
    if (ajaxPromise) ajaxPromise.abort();
    ajaxPromise = syncTaskApi.getStatistics({ projectId: projectId });
    ajaxPromise
      .then(res => {
        if (res) {
          setStatisticData(res);
          ajaxPromise = null;
        }
      })
      /* 必须兜 catch：上一行刚 abort 掉上一个请求，被 abort 的 promise 会以
         { errorCode: 1, errorMessage: '请求被取消' } 拒绝（见 src/common/global.ts
         里 textStatus === 'abort' 那段）。没有 catch 就是
         "Uncaught (in promise) {errorCode: 1, …}" 刷控制台。
         errorCode 1 = 主动取消，是预期行为，静默即可；其余错误照旧抛给全局处理。 */
      .catch(err => {
        if (!err || err.errorCode !== 1) throw err;
      });
  }, [flag]);

  return (
    <StatisticContent>
      <div className="statisticPanel">
        <div className="firstItemPanel mRight16">
          <div className="flex">
            <div className="titleText">{_l('运行中')}</div>
            <div className="dataText running">{statisticData.running || 0}</div>
          </div>
          <div className="flex">
            <div className="titleText">{_l('已停止')}</div>
            <div className="dataText">{statisticData.stopped || 0}</div>
          </div>
          <div className="flex">
            <div className="titleText">{_l('同步错误')}</div>
            <div className="dataText error">{statisticData.error || 0}</div>
          </div>
        </div>
        <div className="itemPanel flex3 mRight16">
          <div>
            <div className="titleText">{_l('今日读取记录行数')}</div>
            <div className="dataText">{statisticData.toDayReadRecord || 0}</div>
          </div>
        </div>
        <div className="itemPanel flex3">
          <div>
            <div className="titleText">{_l('今日写入记录行数')}</div>
            <div className="dataText">{statisticData.toDayWriteRecord || 0}</div>
          </div>
        </div>
      </div>
    </StatisticContent>
  );
};
