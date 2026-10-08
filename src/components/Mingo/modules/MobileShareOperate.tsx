import { getChatbotShareLink, copyChatbotShareLink } from './chatbotShare';
import { Fragment, useEffect, useState } from 'react';
import { isEmpty, isEqual } from 'lodash';
import styled from 'styled-components';
import { Checkbox, MobileConfirmPopup } from 'ming-ui';

const MobileShareOperateWrap = styled.div`
  margin-bottom: -12px;
  width: 100%;
  height: 68px;
  background: var(--color-background-primary);
  border-top: 1px solid var(--color-border-primary);
`;

const WidthWrap = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  margin: 0 auto;
  padding: 0 var(--space-6);
  justify-content: space-between;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
`;

const Divider = styled.div`
  width: 1px;
  height: 16px;
  background: var(--color-border-primary);
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  .basicBtn {
    width: 70px;
    height: 36px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: var(--radius-sm);
    &.cancel {
      color: var(--color-text-primary);
    }
    &.success {
      color: var(--color-white);
      background: var(--color-success-solid);
    }
  }
`;

const MobileShareOperate = ({
  from = 'chatbot',
  appId,
  chatbotId,
  conversationId,
  isSelectAll = false,
  messages,
  maxWidth,
  selectedMessageIds,
  setShareMode = () => {},
  setSelectedMessageIds = () => {},
  setIsSelectAll = () => {},
}) => {
  const selectedCount = Math.floor(selectedMessageIds.length / 2);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const handleShare = async () => {
    try {
      const shareLink = await getChatbotShareLink({ from, appId, chatbotId, conversationId, selective: !isSelectAll, messageIds: selectedMessageIds.filter((id: string) => id?.length === 24) });
      if (!shareLink) { alert(_l('分享失败'), 2); return; }
      setShareUrl(shareLink); setConfirmVisible(true);
    } catch (error) { console.error(error); alert(_l('分享失败'), 2); }
  };
  const copyShareUrl = () => copyChatbotShareLink(shareUrl);

  useEffect(() => {
    if (!isSelectAll && isEmpty(selectedMessageIds)) {
      setShareMode(false);
    }
  }, [isSelectAll, selectedMessageIds]);
  if (!isSelectAll && isEmpty(selectedMessageIds)) {
    return null;
  }

  return (
    <MobileShareOperateWrap>
      <WidthWrap style={{ maxWidth }}>
        <LeftSection>
          <Checkbox
            text={_l('全选')}
            checked={isSelectAll || selectedMessageIds.length === messages.length}
            onClick={() => {
              if (isSelectAll) {
                setIsSelectAll(false);
              } else {
                if (
                  isEqual(
                    selectedMessageIds,
                    messages.map(message => message.modelMessageId),
                  )
                ) {
                  setSelectedMessageIds([]);
                } else {
                  setSelectedMessageIds(messages.map(message => message.modelMessageId));
                }
              }
            }}
            className="textPrimary"
          />
          {!isSelectAll && !!selectedCount && (
            <Fragment>
              <Divider />
              <span className="Font13 textPrimary">{_l('已选择 %0 组对话', selectedCount)}</span>
            </Fragment>
          )}
        </LeftSection>
        <RightSection>
          <div
            className="basicBtn cancel"
            onClick={() => {
              setSelectedMessageIds([]);
              setShareMode(false);
            }}
          >
            {_l('取消')}
          </div>
          <div className="basicBtn success" onClick={handleShare}>
            <i className="icon icon-share Font16 mRight6"></i>
            {_l('分享')}
          </div>
        </RightSection>
      </WidthWrap>
      <MobileConfirmPopup
        visible={confirmVisible}
        title={_l('对外公开分享')}
        subDesc={_l('获得链接的所有人都可以查看')}
        confirmText={_l('分享')}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          setConfirmVisible(false);
          copyShareUrl();
        }}
      />
    </MobileShareOperateWrap>
  );
};

export default MobileShareOperate;
