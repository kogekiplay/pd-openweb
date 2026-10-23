import React from 'react';
import { createRoot } from 'react-dom/client';
import _ from 'lodash';
import styled from 'styled-components';
import { Button, Dialog } from 'ming-ui';
import { SelectGroupTrigger } from 'ming-ui/functions/quickSelectGroup';
import PostMarkdownEditor from 'src/components/comment/PostMarkdownEditor';
import { fromStoredMessage, toSyntaxMessage } from 'src/components/comment/utils/markdownMessageSyntax';
import type { FeedAttachment, FeedEditRequest, FeedPost, FeedScope } from '../../../types';
import type { GroupSelectionValue } from 'src/ming-ui/functions/quickSelectGroup/types';
import type { AppDispatch } from 'src/redux/types';
import UploadFiles from 'src/components/UploadFiles';
import RegExpValidator from 'src/utils/expression';
import { edit } from '../../../redux/postActions';

const FooterWrap = styled.div`
  display: flex;
  align-items: center;
`;

export interface EditPostDialogProps {
  postItem: FeedPost;
  dispose(): void;
  editPost(args: FeedEditRequest, success: () => void, failure: () => void): void;
}
interface EditPostDialogState {
  visible: boolean;
  kcAttachmentData: FeedAttachment[];
  temporaryData: FeedAttachment[];
  isUploadComplete: boolean;
  submitting: boolean;
  showUploads: boolean;
  markdownValue: string;
  scope: FeedScope | undefined;
}
export default class EditPostDialog extends React.Component<EditPostDialogProps, EditPostDialogState> {
  declare uploadFilesRef: Pick<UploadFiles, 'addFiles'> | null | undefined;

  static show(postItem: FeedPost, dispatch: AppDispatch) {
    const div = document.createElement('div');

    document.body.appendChild(div);

    const root = createRoot(div);

    const dispose = () => {
      setTimeout(() => {
        root.unmount();
        document.body.removeChild(div);
      }, 100);
    };

    root.render(
      <EditPostDialog postItem={postItem} dispose={() => dispose()} editPost={(args, success, failure) => dispatch(edit(args, success, failure))} />,
    );
  }

  override state: EditPostDialogState = {
    visible: true,
    kcAttachmentData: [],
    temporaryData: [],
    isUploadComplete: true,
    submitting: false,
    showUploads: false,
    markdownValue: fromStoredMessage(this.props.postItem.message, this.props.postItem),
    scope: {
      shareProjectIds: _.map(this.props.postItem.scope.shareProjects, p => p.projectId),
      shareGroupIds: _.map(this.props.postItem.scope.shareGroups, g => g.groupId),
    },
  };

  constructor(props: EditPostDialogProps) {
    super(props);
    const { postItem } = props;

    if (postItem.attachments && postItem.attachments.length) {
      _.forEach(postItem.attachments, attachment => {
        if (attachment.refId) {
          this.state.kcAttachmentData.push(attachment);
        } else {
          this.state.temporaryData.push(attachment);
        }
      });
    }
  }
  formatAttachment(attachment: FeedAttachment): FeedAttachment {
    if (attachment.twice) {
      attachment = _.assign({}, attachment.twice, attachment);
      delete attachment.twice;
    }

    attachment = _.assign(
      {
        isEdit: !!attachment.docVersionID,
        fileExt: attachment.ext,
        fileSize: attachment.filesize,
      },
      attachment,
      {
        originalFileName: attachment.originalFileName || attachment.originalFilename,
        originalFilename: attachment.originalFileName || attachment.originalFilename,
      },
    );
    if (RegExpValidator.fileIsPicture(attachment.fileExt)) {
      if (!attachment.refType) {
        attachment.allowDown = true;
      }
    } else {
      attachment.allowDown = !!attachment.allowDown;
    }

    return attachment;
  }
  submit() {
    if (this.state.submitting) return;
    if (!this.state.isUploadComplete) {
      alert(_l('文件上传中，请稍等'), 3);
      return;
    }

    const { scope } = this.state;
    const { postItem } = this.props;
    const { postID } = postItem;
    const submitPost = (postMsg: string) => {

      if (!postMsg || !(postMsg || '').trim()) {
        alert(_l('发表内容不能为空'), 3);
        return false;
      } else if (postMsg.length > 6000) {
        alert(_l('发表内容过长，最多允许6000个字符'), 3);
        return false;
      }

      if (!scope) {
        alert(_l('请选择群组'), 3);
        return undefined;
      }

      this.setState({ submitting: true });

      this.props.editPost(
        {
          postType: ['0', '2', '3', '9'].indexOf(String(postItem.postType)) > -1 ? '0' : postItem.postType, // 后台判断
          postMsg,
          scope,
          postId: postID,
          oldPostMsg: postItem.message,
          attachments:
            this.state.temporaryData && this.state.temporaryData.length
              ? JSON.stringify(this.state.temporaryData.map(this.formatAttachment))
              : undefined,
          knowledgeAttach:
            this.state.kcAttachmentData && this.state.kcAttachmentData.length
              ? JSON.stringify(this.state.kcAttachmentData.map(this.formatAttachment))
              : undefined,
        },
        () => {
          this.setState({ visible: false }, () => {
            this.props.dispose();
          });
        },
        () => {
          this.setState({ submitting: false });
        },
      );
      return undefined;
    };
    submitPost(toSyntaxMessage(this.state.markdownValue));
  }

  handleEditorUploadFiles = (files: File[]) => {
    if (!files || !files.length) return;
    const provider = this.uploadFilesRef;
    if (provider) { provider.addFiles(files); return; }
    // Plain text posts have no initial file provider. Mount it before handing over the original native batch.
    this.setState({ showUploads: true, isUploadComplete: false }, () => {
      this.uploadFilesRef?.addFiles(files);
    });
  };

  handleChangeGroup = (value: GroupSelectionValue) => {
    this.setState({
      scope:
        !value.isMe &&
        !(value.shareGroupIds || []).length &&
        !(value.shareProjectIds || []).length &&
        !(value.radioProjectIds || []).length
          ? undefined
          : _.pick(value, ['radioProjectIds', 'shareGroupIds', 'shareProjectIds']),
    });
  };

  override render() {
    const { postItem } = this.props;

    if (!postItem) return false;

    return (
      <Dialog
        className="editUpdaterDialog"
        type="scroll"
        overlayClosable={false}
        width={640}
        visible={this.state.visible}
        title={_l('编辑动态')}
        footer={
          <FooterWrap className="footer">
            <span className="flex"></span>
            <SelectGroupTrigger
              defaultValue={{
                shareProjectIds: _.map(postItem.scope.shareProjects, p => p.projectId),
                shareGroupIds: _.map(postItem.scope.shareGroups, g => g.groupId),
                isMe: !postItem.scope.shareProjects.length && !postItem.scope.shareGroups.length,
              }}
              onChange={this.handleChangeGroup}
            />
            <Button
              id={`textareaUpdaterEdit_${this.props.postItem.postID}`}
              loading={this.state.submitting}
              onClick={() => this.submit()}
            >
              {_l('确定')}
            </Button>
          </FooterWrap>
        }
        onCancel={() => this.props.dispose()}
      >
        <PostMarkdownEditor
          value={this.state.markdownValue}
          minHeight={120}
          maxHeight={320}
          projectId={postItem.projectIds?.[0]}
          onChange={markdownValue => this.setState({ markdownValue })}
          onUploadFiles={this.handleEditorUploadFiles}
          onSubmit={() => this.submit()}
        />
        {(this.state.showUploads || postItem.postType == 2 || postItem.postType == 3 || postItem.postType == 9) && (
          <UploadFiles
            manualRef={(instance: UploadFiles | null) => { this.uploadFilesRef = instance; }}
            dropPasteElement="textarea_Updater_Edit"
            className="mTop10"
            isUpload
            isInitCall
            column={4}
            temporaryData={this.state.temporaryData}
            kcAttachmentData={this.state.kcAttachmentData}
            onTemporaryDataUpdate={(result: FeedAttachment[]) => {
              this.setState({ temporaryData: result });
            }}
            onKcAttachmentDataUpdate={(result: FeedAttachment[]) => {
              this.setState({ kcAttachmentData: result });
            }}
            onUploadComplete={(bool: boolean) => {
              this.setState({ isUploadComplete: bool });
            }}
          />
        )}
      </Dialog>
    );
  }
}
