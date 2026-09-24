import { Component } from 'react';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import _ from 'lodash';
import { Tooltip } from 'ming-ui/antd-components';
import chatAjax from 'src/api/chat';
import { SOURCE_TYPE } from 'src/components/comment/config';
import Emotion from 'src/components/emotion/emotion';
import MentionsInput from 'src/components/MentionsInput';
import type { MentionsInputElement } from 'src/components/MentionsInput';
import { setCaretPosition } from 'src/utils/common';
import createUploader from 'src/utils/createUploader';
import RegExpValidator from 'src/utils/expression';
import { UploadError } from 'src/utils/uploader/constants';
import * as utils from '../../utils';
import config from '../../utils/config';
import Constant from '../../utils/constant';
import fileConfirm from '../fileConfirm/fileConfirm';
import './index.less';

const recurShowFileConfirm = (up, files, i: number, length, cb) => {
  if (i >= length) {
    // 最后一次调用时启动重新开始上传
    up.start();
    return false;
  }

  const file = files[i];

  fileConfirm(file, {
    yesFn() {
      if (i < length) {
        // 防止快速点击上传
        const timer = setTimeout(() => {
          recurShowFileConfirm(up, files, ++i, length, cb);
          clearTimeout(timer);
        }, 300);
      }

      const message = {
        type: Constant.MSGTYPE_FILE,
        file,
      };
      cb && cb(message);
    },
    noFn() {
      up.removeFile(file);
      if (i < length) {
        // 防止快速点击上传
        var timer = setTimeout(() => {
          recurShowFileConfirm(up, files, ++i, length, cb);
          clearTimeout(timer);
        }, 100);
      }
    },
  });
  return undefined;
};

export default class SendToolbar extends Component<any, any> {
  declare at: HTMLDivElement | null | undefined;

  // 这些原来都是隐式挂上去的，TS 下不声明就是 TS2339
  emotion;
  uploadFile;

  constructor(props) {
    super(props);
    this.state = {
      visible: true,
      isHidden: true,
    };
  }
  override componentDidMount() {
    const { isGroup } = this.props.session;
    // 表情
    this.initEmotion();
    // 本地文件上传
    setTimeout(() => {
      this.initUpload();
    }, 500);
    // AT
    isGroup && this.initKeyAT();
  }
  override componentWillUnmount() {
    const { session } = this.props;
    const textarea = $(`#ChatPanel-${session.id}`).find('.ChatPanel-textarea textarea').get(0) as MentionsInputElement;
    textarea && textarea.destroy && textarea.destroy();
  }
  initEmotion() {
    const { id } = this.props.session;
    const isFileTrsnsfer = id === 'file-transfer';

    new Emotion(this.emotion, {
      historySize: 30,
      autoHide: false,
      mdBear: true,
      showAru: true,
      offset: isFileTrsnsfer ? 313 : 263,
      relatedLeftSpace: isFileTrsnsfer ? -304 : -264,
      onMDBearSelect: (name: string, _src, targetEmotionSrc) => {
        // 注意：ft 这个字段是作为七牛文件存储的类型判断的，所以要注意加上这个字段
        // 1.图片 2.附件 3.音频
        name = name == 'null' ? null : name;
        const bearFile = {
          ft: 1,
          hash: '',
          key: targetEmotionSrc.replace(/.*images\//, ''),
          name: name ? name : `[${_l('表情')}]`,
          size: 0,
          aid: md.global.Account.accountId,
          isEmotion: true,
        };
        const message = {
          file: bearFile,
          type: Constant.MSGTYPE_EMOTION,
        };
        this.props.onSendEmotionPicMsg(message);
      },
      onSelect: (name: string, _value, emotionText) => {
        this.props.onSendEmotionTextMsg(emotionText || name);
      },
    });
  }
  initUpload() {
    const { session, socketState = 0 } = this.props;
    const _this = this;
    const { fileUploadLimitSize } = _.get(md, 'global.SysSettings') || {};

    // 【原来这里是直接 new plupload.Uploader】改走 createUploader（内部是 qiniu-js）。
    //
    // 【为什么能原样保留"逐个确认完再上传"的交互】createUploader 的 start() 现在
    // 支持在凭证返回【之前】被调用：它记下"已请求开始"，凭证到位时把等着的文件接上。
    // 本组件只有一个文件时，recurShowFileConfirm 会同步走到 up.start()，
    // 正是撞这个时序的场景，所以既不用改交互、也不用给门面加专用钩子。
    //
    // 取凭证也交给 createUploader 了（bucket: 1 与原来手写的一致，type 用默认 0，
    // 与原来的 getToken(tokenFiles) 相同），所以下面的 FilesAdded 里不再自己取。
    const uploader = createUploader({
      browse_button: this.uploadFile,
      multi_selection: true,
      drop_element: `ChatPanel-${session.id}`,
      paste_element: `ChatPanel-${session.id}`,
      max_file_size: fileUploadLimitSize ? `${fileUploadLimitSize}m` : undefined,
      auto_start: false,
      bucket: 1, // chat 上传都用 bucket: 1
      x_vars: {},
      init: {
        FilesAdded(uploader, files) {
          let count = 0;
          const emptyFile = 0;
          const tokenFiles = [];

          for (let j = 0; j < files.length; j++) {
            if (RegExpValidator.validateFileExt('.' + RegExpValidator.getExtOfFileName(files[j].name))) {
              count++;
            } else {
              uploader.removeFile(files[j]);
            }

            let fileExt = `.${RegExpValidator.getExtOfFileName(files[j].name)}`;

            tokenFiles.push({ bucket: 1, ext: fileExt }); //chat 上传都用 bucket: 1
          }

          const emptyFiles = files => {
            files.forEach(item => {
              uploader.removeFile(item);
            });
          };

          if (socketState) {
            emptyFiles(files);
            return false;
          }

          if (count != files.length) {
            alert(_l('含有不支持格式的文件'), 3);
            emptyFiles(files);
            return false;
          }

          if (emptyFile > 0) {
            alert(_l('您上传的文件有问题，请重试，如果是QQ图片请重新打开图片进行复制粘贴'), 3);
            emptyFiles(files);
            return false;
          }

          if (files.length > 10) {
            alert(_l('同时最多只能上传10份文件'), 3);
            emptyFiles(files);
            return false;
          }

          // 【不再自己取凭证】createUploader 会在本回调返回后去取，
          // 并把 token/key/serverName/fileName 挂到同一批文件对象上。
          // 确认流程本身不需要凭证，最后那次 up.start() 也不怕早于凭证（见上面的说明）。
          recurShowFileConfirm(uploader, files, 0, files.length, _this.props.onPrepareUpload.bind(this));
          return undefined;
        },
        BeforeUpload(uploader, file) {
          const fileExt = `.${RegExpValidator.getExtOfFileName(file.name)}`;
          uploader.settings.multipart_params = { token: file.token };
          uploader.settings.multipart_params.key = file.key;
          uploader.settings.multipart_params['x:serverName'] = window.config.FilePath; //chat 上传都用 window.config.FilePath
          uploader.settings.multipart_params['x:filePath'] = file.key ? file.key.replace(file.fileName, '') : '';
          uploader.settings.multipart_params['x:fileName'] = (file.fileName || '').replace(/\.[^.]*$/, '');
          uploader.settings.multipart_params['x:originalFileName'] = encodeURIComponent(
            file.name.indexOf('.') > -1 ? file.name.split('.').slice(0, -1).join('.') : file.name,
          );
          uploader.settings.multipart_params['x:fileExt'] = fileExt;
          const cb = window[`chatBeforeUpload${file.id}`];
          cb && cb(uploader);
        },
        UploadProgress(_uploader, file) {
          const uploadPercent = ((file.loaded / file.size) * 100).toFixed(1);
          const cb = window[`chatUploadProgress${file.id}`];
          cb && cb(uploadPercent);
        },
        FileUploaded(_uploader, file, response) {
          // 【不再 JSON.parse】plupload 给的是原始响应字符串，createUploader 给的是
          // 已解析并补好 fileExt/fileName/filePath/serverName 的对象。
          const uploadFile = response.response;
          const ext = uploadFile.fileExt;
          const isPicture = RegExpValidator.fileIsPicture(ext);
          const isVideoFile = RegExpValidator.isVideo(ext);
          const msg = isPicture ? `[${_l('图片')}]` : isVideoFile ? `[${_l('视频')}]` : `[${_l('文件')}] ${file.name}`;
          const type = isPicture
            ? Constant.MSGTYPE_PIC
            : isVideoFile
              ? Constant.MSGTYPE_APP_VIDEO
              : Constant.MSGTYPE_FILE;
          uploadFile.id = file.id;
          uploadFile.name = file.name;
          uploadFile.ft = isPicture ? 1 : 2;

          _this.props.onSendFileMsg({ file: uploadFile, type }, msg);
        },
        Error(_uploader, error) {
          if (error.code === UploadError.FILE_SIZE_ERROR) {
            alert(_l('单个文件大小超过%0MB，无法支持上传', fileUploadLimitSize), 2);
          } else {
            alert(_l('上传失败，请稍后再试。'), 2);
          }
        },
      },
    });

    uploader.init();

    this.setState(
      {
        visible: false,
      },
      () => {
        this.setState({
          isHidden: false,
        });
      },
    );
  }
  initKeyAT() {
    const { session } = this.props;
    const textarea = $(`#ChatPanel-${session.id}`).find('.ChatPanel-textarea textarea');
    MentionsInput({
      input: textarea.get(0),
      sourceType: SOURCE_TYPE.CHAT,
      isAddressBookSelect: false,
      defaultMaxHeight: 380,
      getPopupContainer: () => textarea.get(0).parentNode,
      chatParas: {
        groupId: session.id,
        avatar: session.avatar,
      },
      onSelected: user => {
        this.props.onSelectedUser(`@${user}`);
      },
    });
  }
  handleOpenAt() {
    const { at } = this;
    const { session, onChangeValue } = this.props;
    const $textarea = $(`#ChatPanel-${session.id}`).find('.ChatPanel-textarea textarea');
    const $target = $(at);
    const $container = $(`#ChatPanel-${session.id}`).find('.mentionsAutocompleteList');

    if (!$target.data('open') || !$container.is(':visible')) {
      onChangeValue($textarea.val() + '@');
      setTimeout(() => {
        setCaretPosition($textarea.get(0), String($textarea.val() ?? '').length);
      }, 0);
      $target.data('open', true);
    } else {
      $textarea.blur();
      $target.data('open', false);
    }
  }
  handleChange(visible) {
    this.setState({
      visible,
    });
  }
  handleKnowledgeFile() {
    if (this.props.socketState) {
      return;
    }

    import('src/components/kc/folderSelectDialog/folderSelectDialog').then(selectNode => {
      selectNode
        .default({
          isFolderNode: 2,
          reRootName: true,
          dialogTitle: _l('选择路径'),
        })
        .then(result => {
          if (!result || !result.node) {
            throw new Error();
          }

          result.node.forEach(item => {
            this.handleSendCardToChat(item);
          });
        });
    });
    this.setState({ visible: false });
  }
  handleLocalFile() {
    this.setState({ visible: false });
  }
  handleIpcRenderer() {
    window.ipcRenderer && window.ipcRenderer.send('cutpic', 'O');
  }
  handleSendCardToChat(file) {
    const { session } = this.props;
    const params = {
      cards: [
        {
          entityId: file.id,
          cardType: 'kcfile',
          title: file.name + '.' + file.ext,
        },
      ],
      // message: `[${ _l('知识') }] ${ file.name }`,
      message: '',
      [session.isGroup ? 'toGroupId' : 'toAccountId']: session.id,
    };
    chatAjax
      .sendCardToChat(params)
      .then(() => {
        alert(_l('发送成功'));
      })
      .catch(() => {
        alert(_l('发送失败'), 2);
      });
  }
  handleRecord() {
    const { session } = this.props;
    utils.recordCursortPosition(session.id);
  }
  renderMenu() {
    const { id } = this.props.session;
    return (
      <div className="ChatPanel-addToolbar-menu ChatPanel-addToolbar-KnowledgeMenu">
        <div
          className="menuItem"
          onClick={this.handleLocalFile.bind(this)}
          ref={uploadFile => {
            this.uploadFile = uploadFile;
          }}
          id={`file-${id}`}
        >
          <i className="icon-local_file" />
          <div className="menuItem-text">{_l('本地文件')}</div>
        </div>
        <div className="menuItem" onClick={this.handleKnowledgeFile.bind(this)}>
          <i className="icon-knowledge_file" />
          <div className="menuItem-text">{_l('知识中心')}</div>
        </div>
      </div>
    );
  }
  renderFile() {
    const { visible, isHidden } = this.state;
    const { id } = this.props.session;
    return (
      <Trigger
        popupVisible={visible}
        onPopupVisibleChange={this.handleChange.bind(this)}
        popupClassName={cx('ChatPanel-Trigger', { Hidden: isHidden })}
        action={['click']}
        popupPlacement="top"
        builtinPlacements={config.builtinPlacements}
        popup={this.renderMenu()}
        popupAlign={{ offset: [id === 'file-transfer' ? -50 : -20, -20] }}
        getPopupContainer={() => document.querySelector('.ChatPanel-wrapper')}
      >
        <Tooltip title={_l('发送本地文件')}>
          <div className="icon-btn">
            <i className="icon-attachment" />
          </div>
        </Tooltip>
      </Trigger>
    );
  }
  override render() {
    const { session } = this.props;
    const { id } = session;

    return (
      <div className="ChatPanel-sendToolbar">
        <Tooltip title={_l('发表情')}>
          <div
            onClick={this.handleRecord.bind(this)}
            ref={emotion => {
              this.emotion = emotion;
            }}
            className="icon-btn"
          >
            <i className="icon-smilingFace" />
          </div>
        </Tooltip>
        {this.renderFile()}
        {session.isGroup ? (
          <Tooltip title={_l('@聊天成员，给ta发送一个抖动')} placement="topRight">
            <div
              onClick={this.handleOpenAt.bind(this)}
              ref={at => {
                this.at = at;
              }}
              className="icon-btn"
            >
              <i className="icon-chat-at" />
            </div>
          </Tooltip>
        ) : id === 'file-transfer' ? undefined : (
          <Tooltip title={_l('抖动ta的屏幕')}>
            <div onClick={this.props.onShake.bind(this)} className="icon-btn">
              <i className="icon-chat-shake" />
            </div>
          </Tooltip>
        )}
        <Tooltip title={_l('截屏')}>
          <div
            className={cx('icon-btn', { btnCapture: !window.isMDClient })}
            onClick={this.handleIpcRenderer.bind(this)}
          >
            <i className="icon-outil_capture" />
          </div>
        </Tooltip>
      </div>
    );
  }
}
