import { Fragment, useRef } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import { Button } from 'ming-ui';
import { dialogSelectUser } from 'ming-ui/functions';
import projectAjax from 'src/api/project';
import { pathCompletion } from 'src/utils/common';
import copy from 'src/utils/copyToClipboard';

const TYPE_CONFIG: Record<string, { title: string; explain: string; text: string }> = {
  desktop: {
    title: _l('安装桌面客户端'),
    explain: _l('为您的成员安装桌面客户端，支持MAC或者Windows系统'),
    text: _l('将链接分享给你的成员'),
  },
  app: {
    title:
      window.platformENV.isPlatform && !window.platformENV.isOverseas && !window.platformENV.isLocal
        ? _l('安装明道云手机移动客户端')
        : _l('安装手机移动客户端'),
    explain: _l('为您的成员安装App（支持IOS或者Andriod)'),
    text: _l('扫描二维码，将页面发送给您的好友'),
  },
};
const InstallDialog = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: var(--color-background-primary);
  transition: all 0.75s;
  visibility: hidden;
  opacity: 0;
  &.desktop,
  &.app {
    visibility: visible;
    opacity: 0.9;
  }
  z-index: 3;

  .title {
    font-size: 36px;
  }
  .explain {
    font-size: var(--font-xl);
    margin-top: 6px;
  }
  .copyBtn {
    margin: var(--space-8) auto;
  }
  .shareContent {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: var(--space-8);
    .iconWrap {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background-color: var(--color-border-secondary);
      text-align: center;
      line-height: 76px;
      font-size: 32px;
    }
    .line {
      width: 160px;
      margin: 0 var(--space-4);
      border-top: 4px dashed var(--color-border-secondary);
    }
  }
  .text {
    margin: var(--space-8);
    font-size: var(--font-xl);
    color: var(--color-text-tertiary);
  }
  .selectUser {
    span {
      color: var(--color-primary-text);
      margin-left: var(--space-1);
      cursor: pointer;
    }
  }
`;

export default ({ projectId, type, onClose }: { projectId?: string; [key: string]: any }) => {
  const { title, explain, text } = TYPE_CONFIG[type] || {};
  const { AjaxApiUrl } = _.get(md, ['global', 'Config']);
  const isDesktop = type === 'desktop';
  const $ref = useRef(null);
  const $copy = useRef<Button | null>(null);
  const downloadUrl = pathCompletion('/download');

  const handleSelectUser = () => {
    dialogSelectUser({
      fromAdmin: true,
      SelectUserSettings: {
        projectId, // 默认取哪个网络的用户 为空则表示默认加载全部
        filterAccountIds: [md.global.Account.accountId], // 不发自己
        filterAll: true, // 过滤全部
        filterFriend: true, // 是否过滤好友
        filterOthers: true, // 是否过滤其他协作关系
        filterOtherProject: true, // 当对于 true,projectId不能为空，指定只加载某个网络的数据
        filterResigned: false,
        dataRange: 2, // reference to dataRangeTypes 和 projectId 配合使用
        allowSelectNull: false, // 是否允许选择列表为空
        callback: function (data) {
          projectAjax
            .pushInstallClientMsg({
              projectId: projectId,
              accountIds: _.map(data, function (user) {
                return user.accountId;
              }),
              clientType: type === 'app' ? 0 : 1,
            })
            .then(function () {
              alert(_l('发送成功'), 1);
            });
        },
      },
    });
  };

  return (
    <InstallDialog
      ref={$ref}
      className={type}
      type={type}
      onClick={e => {
        if (e.target.isEqualNode($ref.current)) {
          onClose();
        }
      }}
    >
      <div className="title">{title}</div>
      <div className="explain">{explain}</div>
      <div className="shareContent">
        {isDesktop ? (
          <Fragment>
            <div className="iconWrap">
              <i className="icon-link" />
            </div>
            <div className="line" />
            <div className="iconWrap">
              <i className="icon-group" />
            </div>
          </Fragment>
        ) : (
          <img src={`${AjaxApiUrl}code/CreateQrCodeImage?url=${encodeURIComponent(downloadUrl)}`} />
        )}
      </div>
      <div className="text">{text}</div>
      {isDesktop && (
        <Button
          ref={$copy}
          className="copyBtn"
          onClick={() => {
            copy(downloadUrl);
            alert(_l('已经复制到粘贴板，你可以使用Ctrl+V 贴到需要的地方去了哦'));
          }}
        >
          {_l('复制邀请链接')}
        </Button>
      )}
      <div className="selectUser">
        {_l('或')}
        <span onClick={handleSelectUser}>{_l('从通讯录中选择')}</span>
      </div>
    </InstallDialog>
  );
};
