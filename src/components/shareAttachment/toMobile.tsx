import doT from 'dot';
import _ from 'lodash';
import qs from 'query-string';
import Dialog from 'ming-ui/components/Dialog';
import attachmentController from 'src/api/attachment';
import { pathCompletion } from 'src/utils/common';
import defineMethods from 'src/utils/defineMethods';
import { ATTACHMENT_TYPE } from './enum';
import mobileDialogHtml from './tpl/mobileDialog.htm';
import './style.less';

var dialogTpl = doT.template(mobileDialogHtml);

/** 「发到手机」二维码弹层（shareAttachment 的 sendToMobile 用；那个入口在模板里目前是注释掉的）。
 *  file 由 sendToMobile 按附件类型拼：普通附件给 fileID，知识 / 工作表给 shareUrl，七牛给 qiniuPath + name/ext/size。 */
interface ToMobileDialogFields {
  options: {
    sendToType: number;
    attachmentType: number;
    file: {
      fullName?: string;
      fileID?: string;
      shareUrl?: string;
      qiniuPath?: string;
      name?: string;
      ext?: string;
      size?: number;
    };
  };
  $dialog: JQuery;
  $QRCode: JQuery;
}

function ToMobileDialog(this: ToMobileDialogInstance, options) {
  var DEFAULTS = {
    sendToType: 1,
    attachmentType: 1,
    file: {},
  };
  this.options = _.assign({}, DEFAULTS, options);
  this.openDialog();
}

const toMobileDialogMethods = defineMethods<ToMobileDialogFields>()({
  getTip(type) {
    switch (type) {
      case ATTACHMENT_TYPE.COMMON:
        return _l('发送文件副本');
      case ATTACHMENT_TYPE.KC:
        return _l('发送文件分享链接');
      case ATTACHMENT_TYPE.WORKSHEET:
        return _l('发送工作表分享链接');
      case ATTACHMENT_TYPE.WORKSHEETROW:
        return _l('发送工作表记录分享链接');
      default:
        return '';
    }
  },
  getTargetText(type) {
    switch (type) {
      case 3:
        return _l('微信扫码');
      case 6:
        return _l('手机QQ扫码');
      default:
        return _l('扫描二维码');
    }
  },
  openDialog: function () {
    var TMD = this;
    var options = TMD.options;
    Dialog.confirm({
      dialogClasses: 'sendToMobile',
      width: 540,
      title: _l('分享'),
      children: (
        <div
          dangerouslySetInnerHTML={{
            __html: dialogTpl({
              tip: TMD.getTip(options.attachmentType),
              targetText: TMD.getTargetText(options.sendToType),
              attachmentType: options.attachmentType,
              fileName: options.file.fullName,
            }),
          }}
        ></div>
      ),
      noFooter: true,
    });

    setTimeout(() => {
      TMD.$dialog = $('.sendToMobile');
      TMD.$QRCode = TMD.$dialog.find('.urlQrCode');
      this.renderQR();
    }, 200);
  },
  renderQR() {
    var TMD = this;
    var options = TMD.options;
    var attachmentType = options.attachmentType;
    var img;
    var urlPromise;
    switch (attachmentType) {
      case ATTACHMENT_TYPE.COMMON:
        urlPromise = attachmentController.getShareLocalAttachmentUrl({
          fileID: options.file.fileID,
        });
        break;
      case ATTACHMENT_TYPE.KC:
        urlPromise = options.file.shareUrl;
        break;
      case ATTACHMENT_TYPE.QINIU:
        urlPromise = TMD.genQiniuFileShareUrl();
        break;
      case ATTACHMENT_TYPE.WORKSHEET:
      case ATTACHMENT_TYPE.WORKSHEETROW:
        urlPromise = options.file.shareUrl;
        break;
      default:
        break;
    }

    Promise.all([urlPromise])
      .then(function ([url]) {
        var imgUrl = TMD.getQRCodeLink(url);
        img = TMD.getImg(imgUrl, function () {
          TMD.$QRCode.empty().append($('<p class="loadError">加载二维码失败</p>'));
        });
        TMD.$QRCode.empty().append(img);
      })
      .catch(function () {
        TMD.$QRCode.empty().append($('<p class="loadError">加载二维码失败</p>'));
      });
  },
  genQiniuFileShareUrl: function () {
    var TMD = this;
    var options = TMD.options;
    var file = options.file;

    return new Promise(resolve => {
      attachmentController
        .getShareLocalAttachmentUrl({
          filePath: options.file.qiniuPath,
          hours: 48,
        })
        .then(function (url) {
          var qiniuParams = qs.parse(url.slice(url.indexOf('?') + 1));
          url = url.slice(0, url.indexOf('?') > 0 ? url.indexOf('?') : undefined);
          var urlParams = qs.stringify({
            qiniuPath: url,
            qiniutoken: qiniuParams.token,
            e: qiniuParams.e,
            name: file.name,
            ext: file.ext,
            size: file.size,
            genTime: new Date().getTime(),
          });
          attachmentController
            .getShortUrl({
              url: escape(pathCompletion('/apps/kc/shareLocalAttachment.aspx?' + urlParams)),
            })
            .then(function (result) {
              resolve(result.shortUrl || result);
            });
        });
    });
  },
  getQRCodeLink: function (url) {
    return md.global.Config.AjaxApiUrl + 'code/CreateQrCodeImage?url=' + encodeURIComponent(url);
  },
  getImg: function (src, errorCallback) {
    var img = document.createElement('img');
    img.setAttribute('src', src);
    img.addEventListener(
      'error',
      function () {
        if (errorCallback) {
          errorCallback();
        }
      },
      false,
    );
    return img;
  },
});

ToMobileDialog.prototype = toMobileDialogMethods;
type ToMobileDialogInstance = ToMobileDialogFields & typeof toMobileDialogMethods;

export default function (options) {
  return new ToMobileDialog(options);
}
