import React, { Component, Fragment } from 'react';
import copy from 'src/utils/copyToClipboard';
import _ from 'lodash';
import Trigger from '@rc-component/trigger';
import styled from 'styled-components';
import { Button, Dialog, Icon, Input, LoadDiv } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import application from 'src/api/application';
import PageTableCon from 'src/pages/Admin/components/PageTableCon';
import { handleMask } from 'src/pages/Admin/util';
import { getToken } from 'src/utils/common';
import createUploader from 'src/utils/createUploader';
import RegExpValidator from 'src/utils/expression';

const UploadContent = styled.div`
  align-items: flex-end;
  #uploadAppIcon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    border: 1px dashed var(--color-border-primary);
    border-radius: 2px;
    cursor: pointer;
    margin-right: 10px;
  }
  .MdLoader-path {
    stroke: var(--color-text-tertiary);
  }
  .avatarUrl {
    width: 88%;
    border-radius: 4px;
  }
`;

const ThirdPartyAppWrapper = styled.div`
  border-radius: 4px;
  background-color: var(--color-background-primary);
  .avatarUrl {
    width: 20px;
    margin-right: 10px;
    border-radius: 2px;
  }

  .width80 {
    width: 80px;
    text-align: center;
    justify-content: center;
  }
`;

const ApplicationTriggerWrapper = styled.div`
  background-color: var(--color-background-primary);
  .item {
    width: 130px;
    padding: 10px 24px;
    &:hover {
      color: var(--color-white);
      background-color: var(--color-primary);
    }
  }
`;

class Moreop extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      menuVisible: false,
    };
  }
  render() {
    return (
      <Trigger
        action={['click']}
        popupVisible={this.state.menuVisible}
        onPopupVisibleChange={visible => {
          this.setState({ menuVisible: visible });
        }}
        popup={
          <ApplicationTriggerWrapper className="pTop10 pBottom10 z-depth-2">
            <div
              className="item pointer"
              onClick={() => {
                this.setState({ menuVisible: false });
                this.props.onEdit();
              }}
            >
              {_l('编辑')}
            </div>
            <div
              className="item pointer"
              onClick={() => {
                this.setState({ menuVisible: false });
                this.props.onDelete();
              }}
            >
              {_l('删除')}
            </div>
          </ApplicationTriggerWrapper>
        }
        popupAlign={{
          points: ['tr', 'br'],
          offset: [0, 10],
          overflow: { adjustX: true, adjustY: true },
        }}
      >
        <Icon className="pointer Font17 textSecondary" icon="moreop" />
      </Trigger>
    );
  }
}

class Upload extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      uploadAvatarUrl: '',
      uploadAvatar: '',
    };
  }
  componentDidMount() {
    this.uploadFile();
  }
  uploadFile() {
    const _this = this;

    // 【原来这里是直接 new plupload.Uploader】自己取凭证、自己拼 multipart_params，
    // 做的正是 createUploader 已经封好的那两件事。换成统一实现之后：
    //   · 取凭证交给 createUploader（bucket: 2 / type: 6 与原来的 getToken 调用一致）
    //   · x: 自定义变量由 x_vars 开关打开，内容与原来手拼的完全一样
    //   · filters.mime_types 换成原生 accept
    const uploader = createUploader({
      browse_button: this.uploadFileEl,
      multi_selection: false,
      max_file_size: '10mb',
      accept: '.gif,.png,.jpg,.jpeg,.bmp',
      bucket: 2,
      type: 6,
      x_vars: {},
      init: {
        FilesAdded() {
          _this.setState({ loading: true });
        },
        FileUploaded(up, file, res) {
          // 【这里不再 JSON.parse】plupload 给的是原始响应字符串，
          // createUploader 给的是已经解析并补好字段的对象。
          const data = res.response;
          _this.setState({
            uploadAvatar: `${data.fileName}${data.fileExt}`,
            uploadAvatarUrl: `${data.serverName}${data.key}`,
          });
        },
        UploadComplete() {
          const { uploadAvatar, uploadAvatarUrl } = _this.state;
          _this.setState({ loading: false });
          _this.props.update({ uploadAvatar, uploadAvatarUrl });
        },
      },
    });
    uploader.init();
  }
  render() {
    const { avatarUrl } = this.props;
    const { uploadAvatarUrl } = this.state;
    return (
      <UploadContent className="flexRow">
        <div id="uploadAppIcon" ref={el => { this.uploadFileEl = el; }}>
          {this.state.loading ? (
            <LoadDiv size="small" />
          ) : uploadAvatarUrl || avatarUrl ? (
            <img src={uploadAvatarUrl || avatarUrl} className="avatarUrl" />
          ) : (
            <Fragment>
              <Icon icon="add" className="Font22 textTertiary" />
              <div className="ant-upload-text textTertiary mTop10">{_l('上传')}</div>
            </Fragment>
          )}
        </div>
        <span className="textTertiary">{_l('推荐尺寸')}</span>
        <span className="textTertiary">{'240*240px'}</span>
      </UploadContent>
    );
  }
}

export default class SelfBuiltThirdPartyApp extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      applicationList: [],
      dialogVisible: false,
      loading: true,
      appName: '',
      about: '',
      appUrl: '',
      callbackUrl: '',
      avatarUrl: '',
      uploadAvatarUrl: '',
      currentAppItem: null,
      requestLoading: false,
      imageLoading: false,
      hoveredSecretId: null,
    };
  }
  componentDidMount() {
    this.getProjectApplicationList();
  }
  getColumns = () => {
    return [
      {
        title: _l('应用名称'),
        dataIndex: 'appName',
        className: 'flex minWidth0',
        ellipsis: true,
        render: (text, item) => {
          return (
            <div className="appName overflow_ellipsis flexRow valignWrapper">
              <img className="avatarUrl" src={item.avatarUrl} />
              <span>{item.appName}</span>
            </div>
          );
        },
      },
      {
        title: _l('简介'),
        dataIndex: 'about',
        className: 'flex minWidth0',
        ellipsis: true,
        render: (text, item) => {
          return <div className="about overflow_ellipsis">{item.about || '-'}</div>;
        },
      },
      {
        title: _l('App Key'),
        dataIndex: 'appKey',
        width: 150,
        className: 'flex minWidth0 pRight12 overflow_ellipsis',
      },
      {
        title: _l('App Secret'),
        dataIndex: 'appSecret',
        width: 330,
        ellipsis: true,
        render: (text, item) => {
          const { appSecretVisible } = item;
          const isHovered = this.state.hoveredSecretId === item.appId;

          return (
            <div
              className="flexRow valignWrapper"
              onMouseEnter={() => this.setState({ hoveredSecretId: item.appId })}
              onMouseLeave={() => this.setState({ hoveredSecretId: null })}
            >
              <Tooltip title={item.appSecret}>
                <div className="overflow_ellipsis mRight10">{handleMask(item.appSecret, !appSecretVisible)}</div>
              </Tooltip>
              <Icon
                className="pointer flexShrink0"
                icon={appSecretVisible ? 'visibility_off' : 'eye'}
                onClick={() => this.handleSetAppSecretVisible(item)}
              />
              {isHovered && (
                <Icon
                  className="pointer mLeft8 flexShrink0 textSecondary"
                  icon="content_copy"
                  onClick={() => this.handleCopyAppSecret(item)}
                />
              )}
            </div>
          );
        },
      },
      {
        title: _l('应用地址'),
        dataIndex: 'appUrl',
        width: 180,
        ellipsis: true,
        className: 'flex minWidth0 pRight12 overflow_ellipsis',
      },
      {
        title: _l('回调地址'),
        dataIndex: 'callbackUrl',
        ellipsis: true,
        width: 180,
      },
      {
        title: _l('操作'),
        dataIndex: 'operation',
        width: 60,
        fixed: 'right',
        render: (text, record) => {
          return <Moreop onEdit={() => this.handleEdit(record)} onDelete={() => this.handleDelete(record)} />;
        },
      },
    ];
  };
  getProjectApplicationList() {
    const { projectId } = this.props;

    if (!application.getProjectApplicationList) {
      return;
    }

    application
      .getProjectApplicationList({
        projectId,
      })
      .then(result => {
        this.setState({
          loading: false,
          applicationList: result.map(item => ({ ...item, appSecretVisible: false })),
        });
      });
  }
  handleSetAppSecretVisible = item => {
    const { appId } = item;
    const { applicationList } = this.state;
    const newApplicationList = applicationList.map(item => {
      if (item.appId === appId) {
        item.appSecretVisible = !item.appSecretVisible;
      }

      return item;
    });
    this.setState({
      applicationList: newApplicationList,
    });
  };
  handleCopyAppSecret = item => {
    copy(item.appSecret);
    alert(_l('复制成功'), 1);
  };
  handleCreateApp = () => {
    const { projectId } = this.props;
    const {
      appName,
      about,
      appUrl,
      callbackUrl,
      applicationList,
      currentAppItem,
      uploadAvatar,
      uploadAvatarUrl,
      avatarUrl,
    } = this.state;

    if (_.isEmpty(appName)) {
      alert(_l('请输入应用名称'), 3);
      return;
    }

    if (_.isEmpty(appUrl)) {
      alert(_l('请输入应用地址'), 3);
      return;
    } else if (!RegExpValidator.isUrlRequest(appUrl)) {
      alert(_l('请正确的 url 地址'), 3);
      return;
    }

    if (_.isEmpty(callbackUrl)) {
      alert(_l('请输入回调地址'), 3);
      return;
    } else if (!RegExpValidator.isUrlRequest(callbackUrl)) {
      alert(_l('请正确的 url 地址'), 3);
      return;
    }

    const params = {
      appName,
      about,
      appUrl,
      callbackUrl,
    };
    this.setState({ requestLoading: true });
    if (uploadAvatar) {
      params.avatar = uploadAvatar;
      params.avatarUrl = uploadAvatarUrl;
    } else {
      params.avatar = avatarUrl.replace(/.*\//g, '');
      params.avatarUrl = avatarUrl;
    }

    if (currentAppItem) {
      application
        .editApplication({
          appId: currentAppItem.appId,
          projectId,
          ...params,
        })
        .then(result => {
          this.setState({ requestLoading: false });
          if (result) {
            alert(_l('修改成功'));
            this.handleHideDialog();
            this.setState({
              applicationList: applicationList.map(item => {
                if (item.appId === currentAppItem.appId) {
                  return {
                    ...item,
                    ...params,
                  };
                }

                return item;
              }),
            });
          } else {
            alert(_l('修改失败'), 2);
          }
        });
    } else {
      application
        .addApplication({
          projectId,
          ...params,
        })
        .then(result => {
          this.setState({ requestLoading: false });
          if (result) {
            this.handleHideDialog();
            this.setState(
              {
                loading: true,
              },
              this.getProjectApplicationList,
            );
          } else {
            alert(_l('创建失败'), 2);
          }
        });
    }
  };
  handleEdit = item => {
    this.setState({
      dialogVisible: true,
      currentAppItem: item,
      appName: item.appName,
      about: item.about,
      appUrl: item.appUrl,
      callbackUrl: item.callbackUrl,
      avatarUrl: item.avatarUrl,
    });
  };
  handleDelete = item => {
    const { projectId } = this.props;
    const { applicationList } = this.state;

    Dialog.confirm({
      title: _l('确认删除 %0 ?', item.appName),
      onOk: () => {
        return application
          .removeApplication({
            appId: item.appId,
            projectId,
          })
          .then(result => {
            if (result) {
              alert(_l('删除成功'));
              this.setState({
                applicationList: applicationList.filter(n => n.appId !== item.appId),
              });
            } else {
              alert(_l('删除失败'), 2);
            }
          });
      },
    });
  };
  handleHideDialog = () => {
    this.setState({
      dialogVisible: false,
      currentAppItem: null,
      appName: '',
      about: '',
      appUrl: '',
      callbackUrl: '',
      avatarUrl: '',
    });
  };

  renderDialog() {
    const { dialogVisible, appName, about, appUrl, callbackUrl, currentAppItem, requestLoading, avatarUrl } =
      this.state;
    return (
      <Dialog
        overlayClosable={!requestLoading}
        title={<span className="bold">{currentAppItem ? _l('编辑应用') : _l('新建应用')}</span>}
        visible={dialogVisible}
        onCancel={this.handleHideDialog}
        footer={
          <Fragment>
            <Button onClick={this.handleHideDialog} type="link">
              {_l('取消')}
            </Button>
            <Button onClick={this.handleCreateApp} loading={requestLoading}>
              {_l('确定')}
            </Button>
          </Fragment>
        }
      >
        {currentAppItem && (
          <Fragment>
            <div className="mBottom24">
              <div className="mBottom5 textSecondary Font13">{_l('App Key')}</div>
              <div>{currentAppItem.appKey}</div>
            </div>
            <div className="mBottom24 mTop24">
              <div className="mBottom5 textSecondary Font13">{_l('App Secret')}</div>
              <div>{currentAppItem.appSecret}</div>
            </div>
          </Fragment>
        )}
        <div className="mBottom24 mTop24">
          <div className="mBottom12">{_l('应用图标')}</div>
          <Upload
            avatarUrl={avatarUrl}
            update={data => {
              this.setState({
                uploadAvatar: data.uploadAvatar,
                uploadAvatarUrl: data.uploadAvatarUrl,
              });
            }}
          />
        </div>
        <div className="mBottom24 mTop24">
          <div className="mBottom12">{_l('应用名称')}</div>
          <Input
            className="w100"
            value={appName}
            onChange={value => {
              this.setState({ appName: value });
            }}
          />
        </div>
        <div className="mBottom24">
          <div className="mBottom12">{_l('应用简介')}</div>
          <Input
            className="w100"
            value={about}
            onChange={value => {
              this.setState({ about: value });
            }}
          />
        </div>
        <div className="mBottom24">
          <div className="mBottom12">{_l('应用地址')}</div>
          <Input
            className="w100"
            value={appUrl}
            onChange={value => {
              this.setState({ appUrl: value });
            }}
          />
        </div>
        <div className="mBottom24">
          <div className="mBottom12">{_l('回调地址')}</div>
          <Input
            className="w100"
            value={callbackUrl}
            onChange={value => {
              this.setState({ callbackUrl: value });
            }}
          />
        </div>
      </Dialog>
    );
  }

  handleCreate = () => {
    this.setState({ dialogVisible: true });
  };

  render() {
    const { applicationList, loading } = this.state;
    return (
      <ThirdPartyAppWrapper className="orgManagementContent pBottom20">
        <PageTableCon
          className="flex"
          dataSource={applicationList}
          loading={loading}
          columns={this.getColumns()}
          emptyInfo={{ emptyContent: _l('暂无数据') }}
          getDataSource={this.getProjectApplicationList}
        />

        {this.renderDialog()}
      </ThirdPartyAppWrapper>
    );
  }
}
