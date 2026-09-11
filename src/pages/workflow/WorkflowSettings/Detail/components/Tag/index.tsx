import React from 'react';
import cx from 'classnames';
import { Tooltip } from 'ming-ui/antd-components';
import { getIcons } from '../../../utils';
import './index.less';

// props 标成 any：这个组件从来没有真正的 props 契约，
// 不标的话 TS 会从解构模式反推 —— 凡是没写默认值的参数一律算【必填】，
// 于是 6 个调用点各自漏传不同的 prop（className / controlId / isSourceApp）就全报 TS2741。
// 这些「必填」是推断的产物、不是设计意图（线上一直这么调且工作正常）。
// 与本仓其它 JS 遗留组件的处理一致（Component<any, any> 那套）。
export default ({
  flowNodeType,
  appType,
  actionId,
  nodeName,
  controlId,
  controlName,
  className,
  onClick = () => {},
  isSourceApp,
  actualityValue = '',
  errorMessage = '',
}: any) => {
  const errorClass = !nodeName || !controlName ? 'error' : '';

  if (isSourceApp) {
    return (
      <Tooltip title={controlName || !controlId ? null : errorMessage || `ID：${controlId}`}>
        <div className="flowDetailTagBox">
          <div
            className={cx('flowDetailMemberNodeName ellipsis bold', errorClass)}
            style={{ paddingLeft: 13, paddingRight: 13, borderRadius: 26, borderRightWidth: 1 }}
            title={controlName || ''}
          >
            {controlName || '- -'}
          </div>
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={controlName || !controlId ? null : errorMessage || `ID：${controlId}`}>
      <div className={cx('flowDetailTagBox', className)} onClick={onClick}>
        <div className={cx('flowDetailMemberNodeName ellipsis bold', errorClass)} title={nodeName || _l('节点删除')}>
          <i
            className={cx('Font14 mRight5', getIcons(parseInt(flowNodeType), parseInt(appType), actionId), {
              textSecondary: !!nodeName && !!controlName,
            })}
          />
          {nodeName || _l('节点删除')}
        </div>
        <div className={cx('flowDetailMemberArrow1', errorClass)} />
        <div className={cx('flowDetailMemberArrow2', errorClass)} />
        <div className={cx('flowDetailMemberFieldName ellipsis bold', errorClass)} title={controlName}>
          {controlName || '- -'}
          {actualityValue && ` = ${actualityValue}`}
        </div>
      </div>
    </Tooltip>
  );
};
