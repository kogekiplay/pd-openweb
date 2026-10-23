import { createRoot, type Root } from 'react-dom/client';
import createThemedRoot from 'src/common/theme/createRootWithAntdConfig';
import CreateFeedContent, { type CreateFeedContentHandle } from './CreateFeedContent';
import type { ConfirmClose } from 'ming-ui/components/Dialog/types';
import type { FeedAttachment, FeedPost, FeedScope } from '../../types';
import type { FeedLinkPreview } from '../linkView/types';
import type { MentionDraftData } from 'src/components/MentionsInput';
import type { GroupSelectionValue } from 'src/ming-ui/functions/quickSelectGroup/types';
import { toSyntaxMessage } from 'src/components/comment/utils/markdownMessageSyntax';
import doT from 'dot';
import _ from 'lodash';
import Dialog from 'ming-ui/components/Dialog';
import { SelectGroupTrigger } from 'ming-ui/functions/quickSelectGroup';
import postAjax from 'src/api/post';
import 'src/components/autoTextarea/autoTextarea';
import createShare from 'src/components/createShare/createShare';
import Emotion from 'src/components/emotion/emotion';
import MentionsInput from 'src/components/MentionsInput';
import UploadFiles from 'src/components/UploadFiles';
import { pathCompletion } from 'src/utils/common';
import LinkView from '../linkView/linkView';
import VoteUpdater from '../voteUpdater/voteUpdater';
import tpl from './s.html';
import './style.css';
import type { MentionsInputElement } from 'src/components/MentionsInput';

var langUploadFiles = _l('上传附件');
var langShareLink = _l('分享网站') + '...';
var langVoteQuestion = _l('请输入投票问题') + '...';

interface CreatorOptionsState {
  postType: { post: number; link: number; vote: number; attachment: number };
  defaultPostType: string | number;
  showType: string[];
  showToFeed: boolean;
  knowledge: boolean;
  appId: string | undefined;
  uploadObj: unknown;
  isUploadComplete: boolean;
  attachmentData: FeedAttachment[];
  kcAttachmentData: FeedAttachment[];
  defaultAttachmentData: FeedAttachment[];
  defaultKcAttachmentData: FeedAttachment[];
  linkViewData: FeedLinkPreview | null;
  selectGroupOptions: { maxHeight?: number | undefined; isAll?: boolean | undefined; isMe?: boolean | undefined; defaultValue?: string | undefined; projectId?: string | null | undefined };
  callback: ((post: FeedPost) => unknown) | null | undefined;
  createShare: boolean;
  scope: FeedScope | undefined;
  postMsg?: string | undefined;
  filesRender?: boolean | undefined;
}
export type CreateFeedOptions = Partial<CreatorOptionsState>;
interface CreatorWireFields {
  // Native jQuery form carrier; validation/serialization remains at the existing API boundary.
  postType: string | number | string[] | undefined;
  postMsg: string;
  showType?: number | undefined;
  linkUrl?: string | undefined;
  linkTitle?: string | undefined;
  linkDesc?: string | undefined;
  linkThumb?: string | undefined;
  attachments?: string | undefined;
  knowledgeAttach?: string | undefined;
  voteOptions?: string | undefined;
  voteOptionFiles?: string | undefined;
  voteLastTime?: string | undefined;
  voteLastHour?: string | number | string[] | undefined;
  voteAvailableNumber?: number | undefined;
  voteAnonymous?: boolean | undefined;
  voteVisble?: boolean | undefined;
  appId?: string | undefined;
  scope?: {
    radioProjectIds?: string[] | '' | undefined;
    shareGroupIds?: string[] | undefined;
    shareProjectIds?: Array<string | null | undefined> | undefined;
  } | undefined;
}

interface CreatorUi {
  editor?: CreateFeedContentHandle | undefined;
  editorRoot?: ReturnType<typeof createThemedRoot> | undefined;
  uploadRoot?: Root | undefined;
  groupRoot?: Root | undefined;
  uploader?: Pick<UploadFiles, 'addFiles'> | undefined;
  close?: ConfirmClose | undefined;
  textarea?: MentionsInputElement | undefined;
  initTimer?: ReturnType<typeof setTimeout> | undefined;
  focusTimer?: ReturnType<typeof setTimeout> | undefined;
  disposed: boolean;
  posting: boolean;
  posted: boolean;
  pendingFiles: File[][];
  draft?: MentionDraftData | undefined;
  hasDraft: boolean;
}
export default function (options?: CreateFeedOptions) {
  const ui: CreatorUi = { disposed: false, posting: false, posted: false, pendingFiles: [], hasDraft: false };
  const isPlaceholder = (value: string) => [langUploadFiles, langShareLink, langVoteQuestion, _l('知会工作是一种美德') + '...'].includes(value);
  const getPlaceholder = () => {
    const type = Number($('#MDUpdater_hidden_UpdaterType').val());
    return type === 9 ? langUploadFiles : type === 1 ? langShareLink : type === 7 ? langVoteQuestion : _l('知会工作是一种美德') + '...';
  };
  function disposeCreator(posted = false) {
    if (ui.disposed) return;
    ui.disposed = true;
    try { if (!posted) ui.editor?.storeDraft(); }
    finally {
      clearTimeout(ui.initTimer); clearTimeout(ui.focusTimer);
      const editorRoot = ui.editorRoot, uploadRoot = ui.uploadRoot, groupRoot = ui.groupRoot;
      ui.editorRoot = undefined; ui.uploadRoot = undefined; ui.groupRoot = undefined; ui.editor = undefined; ui.uploader = undefined;
      ui.pendingFiles.length = 0;
      queueMicrotask(() => { try { editorRoot?.unmount(); } finally { try { uploadRoot?.unmount(); } finally { groupRoot?.unmount(); } } });
      ui.textarea?.destroy?.();
    }
  }

  const initialOptions: CreatorOptionsState = {
      postType: {
        post: 0,
        link: 1,
        vote: 7,
        attachment: 9,
      },
      defaultPostType: 0, // 默认是动态
      showType: ['post', 'link', 'vote', 'attachment'],
      showToFeed: false,
      knowledge: true,
      appId: undefined,
      uploadObj: null,
      isUploadComplete: true,
      attachmentData: [],
      kcAttachmentData: [],
      defaultAttachmentData: [], // uploadAttachment的默认普通附件参数
      defaultKcAttachmentData: [], // uploadAttachment的默认知识附件参数
      linkViewData: null, // 链接预览数据
      selectGroupOptions: {
        maxHeight: 270,
        isAll: true,
        isMe: true,
        defaultValue: '',
      },
      callback: null,
      createShare: true,
      scope: undefined,
    };
  var MDUpdater = {
    options: initialOptions,
    handleOpen() {
      let $Attachment_updater = $('[targetdiv="#MDUpdater_Attachment_updater"]');

      if (!$Attachment_updater.hasClass('colorPrimary')) {
        $Attachment_updater.click();
        MDUpdater.options.filesRender = true;
      }
    },
    handleUploadComplete(bool: boolean) {
      MDUpdater.options.isUploadComplete = bool;
      let $textarea = $('#MDUpdater_textarea_Updater');
      let value = $textarea.val();

      if (
        bool &&
        (!value || value == _l('知会工作是一种美德') + '...' || value == _l('上传附件')) &&
        (MDUpdater.options.attachmentData.length || MDUpdater.options.kcAttachmentData.length)
      ) {
        $textarea.val(
          MDUpdater.options.attachmentData.length
            ? MDUpdater.options.attachmentData[0]!.originalFileName ?? ''
            : MDUpdater.options.kcAttachmentData[0]!.originalFileName ?? '',
        );
        $textarea.focus();
      }
    },
    render() {
      const host = document.getElementById('MDUpdater_Attachment_updater');
      if (!host || ui.disposed) return;
      const root = ui.uploadRoot || (ui.uploadRoot = createRoot(host));

      root.render(
        <UploadFiles
          manualRef={(instance: UploadFiles | null) => {
            ui.uploader = instance || undefined;
            if (instance && !ui.disposed) { const batches = ui.pendingFiles.splice(0); batches.forEach(batch => instance.addFiles(batch)); }
          }}
          dropPasteElement="MDUpdater_textarea_Updater"
          onDropPasting={() => this.handleOpen()}
          arrowLeft={4}
          isInitCall={true}
          temporaryData={MDUpdater.options.attachmentData}
          kcAttachmentData={MDUpdater.options.kcAttachmentData}
          onTemporaryDataUpdate={(result: FeedAttachment[]) => {
            MDUpdater.options.attachmentData = result;
          }}
          onKcAttachmentDataUpdate={(result: FeedAttachment[]) => {
            MDUpdater.options.kcAttachmentData = result;
          }}
          onUploadComplete={(bool: boolean) => {
            this.handleUploadComplete(bool);
            if (bool && MDUpdater.options.filesRender) {
              MDUpdater.options.filesRender = undefined;
              this.render();
            }
          }}
        />,
      );
    },
    bindUploadEvent: function () {
      let defaultAttachmentData = MDUpdater.options.defaultAttachmentData;
      let defaultKcAttachmentData = MDUpdater.options.defaultKcAttachmentData;

      if (defaultAttachmentData.length) {
        MDUpdater.options.attachmentData = defaultAttachmentData;
      }

      if (defaultKcAttachmentData.length) {
        MDUpdater.options.kcAttachmentData = defaultKcAttachmentData;
      }

      if (MDUpdater.options.defaultPostType === 0 || defaultAttachmentData.length || defaultKcAttachmentData.length) {
        this.render();
      }
    },
    resetUpdater: function (options?: CreateFeedOptions | null, clearCallback?: boolean) {
      if (!options) {
        options = {};
      }

      if (clearCallback) {
        MDUpdater.options.callback = function () {};
      }

      var $mdUpdaterTextareaUpdater = $('#MDUpdater_textarea_Updater');

      if ($mdUpdaterTextareaUpdater) {
        var msg = $mdUpdaterTextareaUpdater.val();
        if (!msg || msg == langUploadFiles || msg == langShareLink || msg == langVoteQuestion) {
          $mdUpdaterTextareaUpdater.val(_l('知会工作是一种美德') + '...').addClass('textTertiary');
        }
      }

      if (MDUpdater.options.defaultPostType !== 9) {
        $('#MDUpdater_hidden_UpdaterType').val(MDUpdater.options.postType.post);
      }

      $("div.MDUpdater a[targetdiv='#MDUpdater_Attachment_updater']")
        .removeClass('colorPrimary')
        .addClass('textPlaceholder');
      $("div.MDUpdater a[targetdiv='#MDUpdater_Link_updater']").removeClass('colorPrimary').addClass('textPlaceholder');
      $("div.MDUpdater a[targetdiv='#MDUpdater_Vote_updater']").removeClass('colorPrimary').addClass('textPlaceholder');
      $('#MDUpdater_Attachment_updater,#MDUpdater_Link_updater,#MDUpdater_Vote_updater').hide();

      // 附件
      MDUpdater.options.attachmentData = new Array();
      MDUpdater.options.kcAttachmentData = new Array();
      // this.render();

      // 链接
      var $mdUpdaterLinkUpdater = $('#MDUpdater_Link_updater');
      $mdUpdaterLinkUpdater.find('.updaterLinkView').empty();
      $mdUpdaterLinkUpdater.find('.textLinkUrl').val('http://').addClass('textPlaceholder');
      MDUpdater.options.linkViewData = null;
      $('#MDUpdater_button_Share').prop('disabled', false).removeClass('Disabled');
      $('#MDUpdater_Link_updater .linkBtn').val(_l('预览')).prop('disabled', false).removeClass('Disabled');

      // 投票
      VoteUpdater.reset($('#MDUpdater_Vote_updater'));

      // 关闭按钮
      $('#mdUpdateCloseContainer').hide();
    },
    // 发布动态
    postUpdater: function (obj: HTMLElement | undefined) {
      if (ui.disposed || ui.posting) return;
      var $mdUpdaterTextareaUpdater = $('#MDUpdater_textarea_Updater');
      const mdUpdaterTextareaUpdaterEl = document.querySelector<MentionsInputElement>('textarea#MDUpdater_textarea_Updater');
      if (!mdUpdaterTextareaUpdaterEl) return;
      var handlePost = (data?: string) => {
        var postMsg = data || '';
        if (
          !postMsg.trim() ||
          postMsg == _l('知会工作是一种美德') + '...' ||
          postMsg == langUploadFiles ||
          postMsg == langShareLink ||
          postMsg == langVoteQuestion
        ) {
          alert(_l('内容不能为空'), 3);
          return false;
        } else if (postMsg.length > 6000) {
          alert(_l('发表内容过长，最多允许6000个字符'), 3);
          return false;
        }

        var postType = $('#MDUpdater_hidden_UpdaterType').val();
        var isToFeed = $('#isToFeed').prop('checked');
        var rData: CreatorWireFields = { postType: postType, postMsg: postMsg };
        // 不在动态更新显示
        if (!isToFeed) {
          rData.showType = 1;
        }

        // 链接类型
        if (postType == MDUpdater.options.postType.link) {
          // 验证链接是否有效
          var linkUrl = $('#MDUpdater_text_LinkUrl').val();

          if (!linkUrl || linkUrl == 'http://') {
            alert(_l('请输入链接'), 3);
            return false;
          }

          if (MDUpdater.options.linkViewData) {
            var linkViewData = MDUpdater.options.linkViewData;
            rData.linkUrl = linkViewData.url;
            rData.linkTitle = linkViewData.title;
            rData.linkDesc = linkViewData.desc;
            rData.linkThumb = linkViewData.img;
          } else {
            alert(_l('请预览链接'), 3);
            return false;
          }
                  // 原来这里还有一项 `MDUpdater != 'undefined'` —— 那是把对象跟字符串 'undefined'
          // 比较，恒为真（作者本意应是 typeof）。MDUpdater 是本作用域的局部对象，一定存在，
          // 所以这一项怎么写都恒真，去掉运行期不变。
        } else if (postType == MDUpdater.options.postType.attachment) {
          if (typeof MDUpdater.options.isUploadComplete != 'undefined' && !MDUpdater.options.isUploadComplete) {
            alert(_l('文件上传中，请稍等'), 3);
            return false;
          }

          if (MDUpdater.options.attachmentData.length == 0 && MDUpdater.options.kcAttachmentData.length == 0) {
            alert(_l('请选择要上传的附件'), 3);
            return false;
          }

          var tempAttachments = MDUpdater.options.attachmentData.filter(function (item) {
            return item.inEdit;
          });
          if (tempAttachments.length > 0) {
            alert(_l('请先保存文件名'), 3);
            return false;
          }

          rData.attachments = JSON.stringify(MDUpdater.options.attachmentData);
          rData.knowledgeAttach = JSON.stringify(MDUpdater.options.kcAttachmentData);
          // 如果发布内容与原文件名称一致，需要用户确认
          if (MDUpdater.options.attachmentData[0] && postMsg == MDUpdater.options.attachmentData[0].originalFileName) {
            if (!confirm(_l('确认要以原始图片名作为发布动态内容？'))) return false;
          }
        } else if (postType == MDUpdater.options.postType.vote) {
          var voteData = VoteUpdater.getData($('#MDUpdater_Vote_updater'));
          if (voteData.invalid) {
            alert(_l('投票项内容不能为空'), 3);
            return undefined;
          }

          // 验证投票是否有选项
          rData.voteOptions = voteData.voteOptions;
          rData.voteOptionFiles = voteData.voteOptionFiles;
          rData.voteLastTime = voteData.voteLastTime;
          rData.voteLastHour = voteData.voteLastHour;
          rData.voteAvailableNumber = voteData.voteAvailableNumber;
          rData.voteAnonymous = voteData.voteAnonymous;
          rData.voteVisble = voteData.voteVisble;
        }

        rData.appId = MDUpdater.options.appId;

        // 判断群组
        if (MDUpdater.options.scope) {
          rData.scope = MDUpdater.options.scope;
        } else if (!isToFeed) {
          rData.scope = {
            radioProjectIds: '',
            shareGroupIds: [],
            shareProjectIds: [MDUpdater.options.selectGroupOptions.projectId],
          };
        } else {
          alert(_l('请选择群组'), 3);
          return undefined;
        }

        // 知识门户
        ui.posting = true;
        $(obj ?? []).attr('disabled', 'disabled').addClass('Disabled');

        postAjax
          .addPost(rData)
          .then(function (result) {
            if (!result.success) {
              alert(_l('发布动态失败'), 2);
              return undefined;
            }

            ui.posted = true;
            const isFeedPage = MDUpdater.options.createShare && window.location.pathname.indexOf('/feed') > -1;
            if (isFeedPage) alert(_l('发布成功'));
            else {
              if (MDUpdater.options.createShare) createShare({
                linkURL: pathCompletion('/feeddetail?itemID=' + result.post.postID), content: _l('动态创建成功'),
              });
              if (MDUpdater.options.callback) MDUpdater.options.callback(result.post);
              else alert(_l('分享成功'));
            }

            if (ui.disposed) return undefined;
            $mdUpdaterTextareaUpdater.val('');

            if (_.isFunction(mdUpdaterTextareaUpdaterEl.reset)) {
              mdUpdaterTextareaUpdaterEl.reset();
              mdUpdaterTextareaUpdaterEl.clearStore?.();
            }

            ui.editor?.resetMarkdown();
            MDUpdater.resetUpdater(null, true);
            MDUpdater.renderSelectGroup(MDUpdater.options.selectGroupOptions);
            return undefined;
          })
          .finally(function () {
            ui.posting = false;
            if (!ui.disposed) $(obj ?? []).removeAttr('disabled').removeClass('Disabled');
            if (ui.posted && !ui.disposed) { disposeCreator(true); ui.close?.(false); }
          });
        return undefined;
      };

      const markdown = ui.editor?.getMarkdownState();
      if (markdown?.isMarkdown) handlePost(toSyntaxMessage(markdown.value));
      else if (_.isFunction(mdUpdaterTextareaUpdaterEl.val)) {
        mdUpdaterTextareaUpdaterEl.val(handlePost);
      } else {
        handlePost(mdUpdaterTextareaUpdaterEl.value);
      }
    },
    // 【删除了 dialogChooseGroup（"拦截层选群组"）】
    // 它的函数体调用 `$(el).dialogSelectGroup({...})`，而 dialogSelectGroup 这个
    // jQuery 插件【在本仓从来不存在】—— 全仓（含 git 全历史）搜下来只有那一个调用点，
    // 没有任何地方定义过 $.fn.dialogSelectGroup。真被调到就是
    // TypeError: $(...).dialogSelectGroup is not a function。
    // 而 dialogChooseGroup 本身也【没有任何调用点】，所以它是一段不可达的坏代码。
    // 是给 `$` 标上真实类型之后 TS2339 报出来的。
    showUpdaterDivForDocCenter: function (options?: CreateFeedOptions | null) {
      if (options) {
        $.extend(MDUpdater.options, options);
      }

      ui.close = Dialog.confirm({
        onCancel: () => disposeCreator(false),
        dialogClasses: 'easyDialogBoxMDUpdater',
        width: 640,
        noFooter: true,
        children: <div dangerouslySetInnerHTML={{ __html: doT.template(tpl)() }}></div>,
      });

      ui.initTimer = setTimeout(() => {
        if (ui.disposed) return;
        if (MDUpdater.options.postMsg) {
          $('#MDUpdater_textarea_Updater').val(MDUpdater.options.postMsg);
        }

        MDUpdater.bindEvent();
        MDUpdater.renderEditor();
      }, 200);
    },
    renderEditor() {
      const textarea = document.querySelector<MentionsInputElement>('textarea#MDUpdater_textarea_Updater');
      const host = document.getElementById('MDUpdater_markdownEditor');
      const target = document.querySelector<HTMLElement>('.MDUpdater .msgExpandDiv');
      const plain = document.getElementById('MDUpdater_plainText');
      const face = document.querySelector<HTMLElement>('.MDUpdater .msgExpandDiv .faceBtn');
      if (!textarea || !host || !target || !plain || ui.disposed) return;
      ui.textarea = textarea;
      const root = ui.editorRoot || (ui.editorRoot = createThemedRoot(host));
      root.render(<CreateFeedContent textarea={textarea} modeButtonContainer={target} initialValue={MDUpdater.options.postMsg || ''}
        projectId={MDUpdater.options.selectGroupOptions.projectId}
        getPlaceholder={getPlaceholder} isPlaceholder={isPlaceholder}
        onModeChange={markdown => { plain.style.display = markdown ? 'none' : ''; if (face) face.style.display = markdown ? 'none' : ''; }}
        onPost={() => MDUpdater.postUpdater(document.getElementById('MDUpdater_button_Share') || undefined)}
        onUploadFiles={files => {
          if (!files.length || ui.disposed) return;
          MDUpdater.handleOpen();
          if (ui.uploader) ui.uploader.addFiles(files);
          else { ui.pendingFiles.push(files); MDUpdater.render(); }
        }}
        ref={controller => {
          ui.editor = controller || undefined;
          if (controller && ui.hasDraft) { ui.hasDraft = false; controller.restoreDraft(ui.draft); }
        }} />);
    },
    bindEvent: function () {
      MDUpdater.bindUploadEvent();
      ui.focusTimer = setTimeout(function () {
        if (!ui.disposed) document.querySelector<HTMLTextAreaElement>('textarea#MDUpdater_textarea_Updater')?.focus();
      }, 10);

      // 分享范围
      MDUpdater.renderSelectGroup(MDUpdater.options.selectGroupOptions);

      // 分享按钮
      $('#MDUpdater_button_Share').val(_l('分享'));

      $('#MDUpdater_hidden_UpdaterType').val(MDUpdater.options.defaultPostType);

      if (MDUpdater.options.showToFeed) {
        $('#divIsToFeed').show();
      }

      if (!MDUpdater.options.knowledge) {
        $('#MDUpdater_Div_JoinKnowledge').remove();
      }

      var $mdUpdaterTextareaUpdater = $('#MDUpdater_textarea_Updater');
      const mdUpdaterTextareaUpdaterEl = document.querySelector<MentionsInputElement>('textarea#MDUpdater_textarea_Updater');
      if (!mdUpdaterTextareaUpdaterEl) return;
      ui.textarea = mdUpdaterTextareaUpdaterEl;

      $mdUpdaterTextareaUpdater
        .focus(function () {
          var msg = $mdUpdaterTextareaUpdater.val();
          if (
            msg == _l('知会工作是一种美德') + '...' ||
            msg == langUploadFiles ||
            msg == langShareLink ||
            msg == langVoteQuestion
          ) {
            $mdUpdaterTextareaUpdater.val('');
          }

          $mdUpdaterTextareaUpdater.removeClass('textTertiary');
        })
        .blur(function (this: HTMLElement) {
          if (_.isFunction(mdUpdaterTextareaUpdaterEl.store)) {
            mdUpdaterTextareaUpdaterEl.store();
          }

          if (!String($(this).val() ?? '').trim()) {
            $mdUpdaterTextareaUpdater.val(_l('知会工作是一种美德') + '...').addClass('textTertiary');
          }
        });

      if (typeof $mdUpdaterTextareaUpdater.autoTextarea === 'function') {
        $mdUpdaterTextareaUpdater.autoTextarea({
          maxHeight: 150,
          minHeight: 72,
        });
      }

      MentionsInput({
        input: mdUpdaterTextareaUpdaterEl,
        submitBtn: 'MDUpdater_button_Share',
        showCategory: true,
        cacheKey: 'updatertext',
        reset: false,
        initCallback: () => {
          if (!MDUpdater.options.postMsg) {
            mdUpdaterTextareaUpdaterEl.restore?.((success, draft) => {
              if (success) {
                ui.draft = draft; ui.hasDraft = true;
                if (ui.editor) { ui.hasDraft = false; ui.editor.restoreDraft(draft); }
                $mdUpdaterTextareaUpdater.removeClass('textTertiary');
                $('#myupdaterOP').show();
              } else {
                if (!MDUpdater.options.postMsg) {
                  $mdUpdaterTextareaUpdater.val(_l('知会工作是一种美德') + '...').addClass('textTertiary');
                }
              }
            });
          }
        },
      });

      if (_.includes(MDUpdater.options.showType, 'post')) {
        // 右上角关闭
        $('.Updater_Textpanel span.update_close').on('click', function () {
          MDUpdater.resetUpdater();
          if ($mdUpdaterTextareaUpdater) {
            if (!String($mdUpdaterTextareaUpdater.val() ?? '').trim()) {
              $mdUpdaterTextareaUpdater.val(_l('知会工作是一种美德') + '...').addClass('textTertiary');
            }
          }
        });
      } else {
        $('.Updater_Textpanel span.update_close').css('display', 'none');
      }

      if (_.includes(MDUpdater.options.showType, 'attachment'))
        $("[targetdiv='#MDUpdater_Attachment_updater']").removeAttr('style');
      if (_.includes(MDUpdater.options.showType, 'link'))
        $("[targetdiv='#MDUpdater_Link_updater']").removeAttr('style');
      if (_.includes(MDUpdater.options.showType, 'vote'))
        $("[targetdiv='#MDUpdater_Vote_updater']").removeAttr('style');
      if (_.includes(MDUpdater.options.showType, 'video'))
        $("[targetdiv='#MDUpdater_Video_updater']").removeAttr('style');

      $('#isToFeed').on('change', function (this: HTMLElement) {
        if ($(this).prop('checked')) {
          $('#divIsToFeedToggle').removeClass('textPlaceholder').addClass('colorPrimary');
          $('.Updater_Textpanel').find('.groupSelect').show();
        } else {
          $('#divIsToFeedToggle').removeClass('colorPrimary').addClass('textPlaceholder');
          $('.Updater_Textpanel').find('.groupSelect').hide();
        }
      });

      $('div.MDUpdater a[targetDiv]').on('click', function (this: HTMLElement) {
        var targetDivID = $(this).attr('targetDiv');
        if (targetDivID == '#MDUpdater_Attachment_updater') {
          if (
            MDUpdater.options.attachmentData.length == 0 &&
            MDUpdater.options.kcAttachmentData.length == 0 &&
            $('#MDUpdater_Attachment_updater').is(':visible')
          ) {
            MDUpdater.resetUpdater();
            return;
          } else if ($('#MDUpdater_Attachment_updater').is(':visible')) {
            return;
          }
        }

        // 链接
        if (targetDivID == '#MDUpdater_Link_updater') {
          if (
            (String($('#MDUpdater_Link_updater').val() ?? '').trim() == 'http://' ||
              String($('#MDUpdater_Link_updater').val() ?? '').trim() == '') &&
            $('#MDUpdater_Link_updater').is(':visible')
          ) {
            MDUpdater.resetUpdater();
            return;
          } else if ($('#MDUpdater_Link_updater').is(':visible')) {
            return;
          }
        }

        if (
          targetDivID == '#MDUpdater_Vote_updater' &&
          $('div.MDUpdater .voteOptions li').eq(0).find('input').val() == _l('请输入投票项') &&
          $('div.MDUpdater .voteOptions li').eq(1).find('input').val() == _l('请输入投票项') &&
          $('#MDUpdater_Vote_updater').is(':visible')
        ) {
          MDUpdater.resetUpdater();
          return;
        } else if (targetDivID == '#MDUpdater_Vote_updater' && $('#MDUpdater_Vote_updater').is(':visible')) {
          return;
        }

        MDUpdater.resetUpdater();
        // MDUpdater.bindUploadEvent();

        if (targetDivID == '#MDUpdater_Attachment_updater') {
          $('#MDUpdater_Attachment_updater').show(0, function () {
            // MDUpdater.options.uploadObj.getPluploadObj().refresh();
          });
          $(this).removeClass('textPlaceholder').addClass('colorPrimary');
          $('#MDUpdater_hidden_UpdaterType').val(MDUpdater.options.postType.attachment);
          if (
            $('#MDUpdater_textarea_Updater') &&
            (String($('#MDUpdater_textarea_Updater').val() ?? '').trim() == '' ||
              String($('#MDUpdater_textarea_Updater').val() ?? '').trim() == _l('知会工作是一种美德') + '...')
          ) {
            $('#MDUpdater_textarea_Updater').val(langUploadFiles).addClass('textTertiary');
          }

          MDUpdater.render();
        } else if (targetDivID == '#MDUpdater_Link_updater') {
          $('#MDUpdater_Link_updater').show();
          $('#MDUpdater_hidden_UpdaterType').val(MDUpdater.options.postType.link);
          $(this).removeClass('textPlaceholder').addClass('colorPrimary');
          if (
            $('#MDUpdater_textarea_Updater') &&
            (String($('#MDUpdater_textarea_Updater').val() ?? '').trim() == '' ||
              String($('#MDUpdater_textarea_Updater').val() ?? '').trim() == _l('知会工作是一种美德') + '...')
          ) {
            $('#MDUpdater_textarea_Updater').val(langShareLink).addClass('textTertiary');
          }

          $('#MDUpdater_Link_updater .textLinkUrl').on('keydown', function (e) {
            var key = window.event ? e.keyCode : e.which;
            if (key == 13) {
              $('#MDUpdater_Link_updater .linkBtn').click();
            }
          });
        } else if (targetDivID == '#MDUpdater_Vote_updater') {
          $('#MDUpdater_hidden_UpdaterType').val(MDUpdater.options.postType.vote);

          $(this).removeClass('textPlaceholder').addClass('colorPrimary');
          if (
            $('#MDUpdater_textarea_Updater') &&
            (String($('#MDUpdater_textarea_Updater').val() ?? '').trim() == '' ||
              String($('#MDUpdater_textarea_Updater').val() ?? '').trim() == _l('知会工作是一种美德') + '...')
          ) {
            $('#MDUpdater_textarea_Updater').val(langVoteQuestion).addClass('textTertiary');
          }

          var index = $("a[targetDiv='#MDUpdater_Vote_updater']").prevAll(':visible').length;
          $('#MDUpdater_Vote_updater').attr('left', index * 36 + 3);
          VoteUpdater.init($('#MDUpdater_Vote_updater'));
        } else {
          $('#MDUpdater_hidden_UpdaterType').val(MDUpdater.options.postType.post);
        }

        ui.editor?.refreshPlaceholder();
        $(targetDivID ?? '').show(0, function () {});
        // 关闭按钮
        if (targetDivID != '#MDUpdater_Video_updater') $('#mdUpdateCloseContainer').show();
      });

      // 上传音视频
      if ($("[targetdiv='#MDUpdater_Video_updater']").length > 0) {
        MDUpdater.showUploadPageForVideoCenter("[targetdiv='#MDUpdater_Video_updater']");
      }

      Reflect.construct(Emotion, ['div.MDUpdater .faceBtn', {
        input: '#MDUpdater_textarea_Updater',
        placement: 'right bottom',
        mdBear: false,
        relatedLeftSpace: 22,
        onSelect: function () {
          const textBox = ui.textarea;
          if (!textBox || ui.disposed) return;
          if (
            textBox.value === _l('知会工作是一种美德') + '...' ||
            textBox.value === langUploadFiles ||
            textBox.value === langShareLink ||
            textBox.value === langVoteQuestion
          ) {
            textBox.value = '';
          }
        },
      }]);

      // 链接预览
      $('#MDUpdater_Link_updater .linkBtn').on('click', function (this: HTMLElement) {
        var linkUrl = String($('#MDUpdater_text_LinkUrl').val() ?? '').trim();
        if (!linkUrl || linkUrl == 'http://') {
          alert(_l('请输入链接'), 3);
          return false;
        }

        var $el = $(this);
        $el.val(_l('提取中...')).prop('disabled', true).addClass('Disabled');

        var $btnShare = $('#MDUpdater_button_Share');
        $btnShare.prop('disabled', true).addClass('Disabled');

        LinkView($('#MDUpdater_Link_updater .updaterLinkView'), {
          viewUrl: linkUrl,
          callback: function (data: FeedLinkPreview) {
            let preview: FeedLinkPreview | null = data;
            if (data.errorCode != '1') {
              alert(_l('链接提取失败'), 3);
              preview = null;
            }

            MDUpdater.options.linkViewData = preview;
            $el.val(_l('预览')).prop('disabled', false).removeClass('Disabled');
            $btnShare.prop('disabled', false).removeClass('Disabled');
          },
        });
        return undefined;
      });

      // 发布
      $('#MDUpdater_button_Share').on('click', function () {
        MDUpdater.postUpdater(this);
      });

      // 默认触发点击哪个
      if (MDUpdater.options.defaultPostType == MDUpdater.options.postType.vote) {
        $("div.MDUpdater a[targetDiv='#MDUpdater_Vote_updater']").click();
      }

      if (MDUpdater.options.defaultAttachmentData.length + MDUpdater.options.defaultKcAttachmentData.length) {
        // $("div.MDUpdater a[targetDiv='#MDUpdater_Attachment_updater']").click();
        $('#MDUpdater_hidden_UpdaterType').val(9);
        $('#MDUpdater_Attachment_updater').show();
        $("div.MDUpdater a[targetdiv='#MDUpdater_Attachment_updater']")
          .addClass('colorPrimary')
          .removeClass('textPlaceholder');
      }
    },
    renderSelectGroup: (options: CreatorOptionsState['selectGroupOptions']) => {
      if (options.defaultValue) {
        MDUpdater.options.scope = {
          shareGroupIds: [options.defaultValue],
          shareProjectIds: [],
          radioProjectIds: [],
        };
      }

      const ele = document.getElementById('createFeedGroupSelect');

      if (!ele) return;

      const root = ui.groupRoot || (ui.groupRoot = createRoot(ele));

      root.render(
        <SelectGroupTrigger
          {...options}
          defaultValue={
            options.defaultValue
              ? {
                  shareGroupIds: [options.defaultValue],
                }
              : undefined
          }
          onChange={(value: GroupSelectionValue) => {
            MDUpdater.options.scope =
              !value.isMe &&
              !(value.shareGroupIds || []).length &&
              !(value.shareProjectIds || []).length &&
              !(value.radioProjectIds || []).length
                ? undefined
                : _.pick(value, ['radioProjectIds', 'shareGroupIds', 'shareProjectIds']);
          }}
          getPopupContainer={() => document.body}
        />,
      );
    },
    showVideoUpload: function () {
      var dialogHeight = 450;
      var dialogWidth = 660;
      var dialogTop = (window.screen.height - dialogHeight) / 2 - 50;
      var dialogLeft = (window.screen.width - dialogWidth) / 2 - 7;
      var url = pathCompletion('/apps/videos/uploadpage/fileupload');
      var features =
        'top=' +
        dialogTop +
        'px,' +
        'left=' +
        dialogLeft +
        'px,' +
        'width=' +
        dialogWidth +
        'px,' +
        'height=' +
        dialogHeight +
        'px,' +
        'toolbar=no,menubar=no,scrollbars=no,resizable=no,location=no,status=no';
      window.open(url, '_blank', features);
    },
    showUploadPageForVideoCenter: function (element: string) {
      $(element).click(function () {
        MDUpdater.showVideoUpload();
      });
    },
  };
  if (
    $('#dialogSendMessage').is(':visible') ||
    $('.easyDialogBoxMDUpdater').is(':visible') ||
    $('#createCalendar').is(':visible') ||
    $('#createTask').is(':visible')
  ) {
    return;
  }

  MDUpdater.showUpdaterDivForDocCenter(options);
}
