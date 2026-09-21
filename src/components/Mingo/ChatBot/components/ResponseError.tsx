import React, { useState } from 'react';
import { get } from 'lodash';
import styled from 'styled-components';
import aiServiceAjax from 'src/api/aIService';

const Con = styled.div`
  max-width: 100%;
  overflow: hidden;
  margin-top: 10px;
  height: 40px;
  font-size: var(--font-sm);
  color: var(--color-error);
  padding: 0 var(--space-3);
  background: rgba(244, 67, 54, 0.04);
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  .errorIcon {
    font-size: var(--font-lg);
    color: var(--color-error);
    margin-right: var(--space-2);
  }
  .errorIcon {
    font-size: var(--font-lg);
    color: var(--color-error);
    margin-right: var(--space-2);
  }
  .retry {
    margin-left: var(--space-5);
    font-size: var(--font-sm);
    color: var(--color-text-title);
    cursor: pointer;
    .icon {
      font-size: var(--font-lg);
      color: var(--color-text-secondary);
      margin-right: 2px;
    }
  }
  .feedback {
    margin-left: 10px;
    font-size: var(--font-sm);
    flex-shrink: 0;
  }
`;

export default function ResponseError({
  className,
  aiFeatureType,
  style = {},
  error,
  showRetry = false,
  onRetry,
  showFeedback = false,
}) {
  const [isFeedBacking, setIsFeedBacking] = useState(false);
  return (
    <Con className={className} style={style}>
      <i className="errorIcon icon icon-error" />
      <div className="ellipsis" title={error?.errorMsg || error}>
        {error?.errorMsg || error}
      </div>
      {showRetry && (
        <span className="t-flex t-items-center t-justify-center retry">
          <i className="icon icon-task-later" onClick={onRetry}></i>
          {_l('重试')}
        </span>
      )}
      {showFeedback && !!get(md, 'global.SysSettings.enableAIErrorPush') && (
        <a
          className="feedback"
          disabled={isFeedBacking}
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            if (isFeedBacking) return;
            setIsFeedBacking(true);
            aiServiceAjax
              .sendAIServiceErrorMsg({
                feature: aiFeatureType,
                errMsg: error?.sourceData || error,
              })
              .then(() => {
                alert(_l('反馈成功，平台将尽快解决'));
              })
              .finally(() => {
                // setTimeout(() => {
                //   setIsFeedBacking(false);
                // }, 3000);
              });
          }}
        >
          {_l('点击向平台反馈')}
        </a>
      )}
    </Con>
  );
}
