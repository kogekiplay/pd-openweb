import doT from 'dot';
import moment from 'moment';
import qs from 'query-string';
import attachmentAjax from 'src/api/attachment';
import chatAjax from 'src/api/chat';
import shareajax from 'src/api/share';
import weixinAjax from 'src/api/weixin';
import saveToKnowledge from 'src/components/kc/saveToKnowledge/saveToKnowledge';
import { ATTACHMENT_TYPE } from 'src/components/shareAttachment/enum';
import { downloadFile, formatFileSize, getClassNameByExt, pathCompletion } from 'src/utils/common';
import defineMethods from 'src/utils/defineMethods';
import RegExpValidator from 'src/utils/expression';
import mobileShareHtml from './tpl/mobileShare.htm';
import './css/mobileShare.less';

let mobileShareTpl = doT.template(mobileShareHtml);

let RENDER_BY_SERVICE_TYPE = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'pdf'];

$('html').addClass('AppKc AppKcShare');
function urlAddParams(originurl, value) {
  if (!originurl) return '';
  // 如果是带 token 的链接，换参数会导致 token 失效。所以直接返回
  if (originurl.indexOf('token=') > -1) return originurl;
  const origin = originurl.split('?')[0];
  const query = qs.parse(originurl.replace(origin, '').slice(1));
  return origin + '?' + qs.stringify(Object.assign(query, value)).replace(/=&/g, '&').replace(/=$/g, '');
}

/** 实例上动态挂的字段，按构造函数与各方法里真实的赋值写全。
 *  不用 [key: string]: any 兜底 —— 那样 noImplicitThis 就白开了：这个文件打开它的当天
 *  就抓到一个名字对不上的定时器（见 alert 方法）。 */
interface MobileSharePreviewFields {
  /** 两个调用方：folderShare 传 { node, container: '#previewCon', shareFolderId }，shareMobile/index 传 { projectId } */
  options: { container?: string; node?: ApiPayload; shareFolderId?: string; projectId?: string };
  $container: JQuery;
  urlParams: ReturnType<typeof qs.parse>;
  /** 知识中心分享节点或附件信息，接口原样返回 */
  nodeData?: ApiPayload;
  sourceData?: ApiPayload;
  isIOS?: boolean;
  /** 截止时间：普通附件取接口给的，七牛附件按 genTime + 48 小时算 */
  deadLine?: Date | string;
  /** ATTACHMENT_TYPE 的取值 */
  attachmentType?: number;
  file?: Record<string, any>;
  preview?: { width?: number; height: number };
  $html?: JQuery;
  $footer?: JQuery;
  $saveToMingDao?: JQuery;
  $downloadBtn?: JQuery;
  $openAPP?: JQuery;
  $filePreview?: JQuery;
  $openIniOS?: JQuery;
  $imageLink?: JQuery;
  $image?: JQuery;
  $alert?: JQuery;
  alertTimer?: ReturnType<typeof setTimeout>;
}

const MobileSharePreview = function (this: MobileSharePreviewInstance, options) {
  let MSP = this;
  this.options = Object.assign({}, options);
  this.$container = $(this.options.container || '#app');
  MSP.urlParams = qs.parse(unescape(unescape(window.location.search.slice(1))));
  let shareId;

  try {
    shareId = location.pathname.match(/.*\/apps\/kcshare\/(\w+)/)[1];
  } catch (err) {
    console.log(err);
  }

  if (MSP.options.node) {
    MSP.nodeData = MSP.options.node;
    MSP.init();
    return;
  }

  if (shareId) {
    shareajax.getShareNode({ shareId }).then(data => {
      if (data.node) {
        MSP.nodeData = data.node;
        MSP.init();
      } else {
        if (data.actionResult === 2) {
          window.nativeAlert(_l('请先登录'));
          location.href = pathCompletion('/login?ReturnUrl=' + location.href);
        } else {
          window.nativeAlert(_l('当前文件不存在或您没有查看权限'));
        }
      }
    });
  } else if (MSP.urlParams.fileID) {
    shareajax.getShareLocalAttachment({ fileId: MSP.urlParams.fileID }).then(data => {
      if (data.attachment) {
        MSP.nodeData = data.attachment;
        MSP.nodeData.deadLine = data.deadLine;
        MSP.nodeData.isValid = data.isValid;
        MSP.init();
      } else {
        window.nativeAlert(_l('当前文件不存在或您没有查看权限'));
      }
    });
  } else {
    MSP.init();
  }
};

const mobileSharePreviewMethods = defineMethods<MobileSharePreviewFields>()({
  init: function () {
    let MSP = this;
    MSP.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    MSP.sourceData = MSP.nodeData && MSP.nodeData.data ? MSP.nodeData.data : MSP.nodeData;
    this.setAttachmentType();
    if (MSP.attachmentType === ATTACHMENT_TYPE.COMMON) {
      MSP.deadLine = MSP.nodeData.deadLine;
    } else if (MSP.attachmentType === ATTACHMENT_TYPE.QINIU) {
      MSP.deadLine = new Date(parseInt(String(MSP.urlParams.genTime), 10) + 3600 * 1000 * 48);
    }

    if (!MSP.checkValid()) {
      MSP.renderOverDue();
      return;
    }

    this.file = this.formatToFile();
    if (window.isWeiXin) {
      MSP.loadWeiXinShare();
    }

    if (MSP.nodeData && MSP.nodeData.name) {
      document.title = `${MSP.nodeData.name}.${MSP.nodeData.ext}`;
    }

    MSP.render();
  },
  checkValid: function () {
    let MSP = this;

    if (MSP.attachmentType === ATTACHMENT_TYPE.KC) {
      return true;
    } else if (MSP.attachmentType === ATTACHMENT_TYPE.COMMON) {
      return MSP.nodeData.isValid;
    } else if (MSP.attachmentType === ATTACHMENT_TYPE.QINIU) {
      return (new Date().getTime() - Number(MSP.urlParams.genTime)) / (3600 * 1000) < 48;
    }
  },
  setAttachmentType: function () {
    let MSP = this;
    let sourceData = MSP.sourceData;
    let urlParams = MSP.urlParams;

    if ((sourceData && sourceData.fileID) || (MSP.nodeData && MSP.nodeData.deadLine)) {
      MSP.attachmentType = ATTACHMENT_TYPE.COMMON;
    } else if (sourceData && sourceData.id) {
      MSP.attachmentType = ATTACHMENT_TYPE.KC;
    } else if (urlParams.qiniuPath) {
      MSP.attachmentType = ATTACHMENT_TYPE.QINIU;
    }
  },
  formatToFile: function () {
    let MSP = this;
    let sourceData = MSP.sourceData;
    let file: Record<string, any> = {};

    switch (MSP.attachmentType) {
      case ATTACHMENT_TYPE.COMMON:
        file.fileID = sourceData.fileID;
        file.name = sourceData.originalFilename;
        file.ext = !sourceData.ext ? '' : sourceData.ext.slice(1);
        file.size = sourceData.filesize;
        file.canDownload = sourceData.allowDown;
        file.downloadUrl = sourceData.downloadUrl;
        break;
      case ATTACHMENT_TYPE.KC:
        file.id = sourceData.id;
        file.name = sourceData.name;
        file.ext = sourceData.ext;
        file.size = sourceData.size;
        file.canDownload = sourceData.canDownload;
        file.downloadUrl = sourceData.downloadUrl;
        file.viewUrl = sourceData.viewUrl;
        break;
      case ATTACHMENT_TYPE.QINIU:
        let urlParams = MSP.urlParams;
        file.name = urlParams.name;
        file.ext = urlParams.ext;
        file.size = parseInt(String(urlParams.size), 10);
        file.canDownload = true;
        file.downloadUrl = urlParams.qiniuPath + '?e=' + urlParams.e + '&token=' + urlParams.qiniutoken;
        file.qiniuPath = urlParams.qiniuPath;
        break;
      default:
        break;
    }

    if (RegExpValidator.fileIsPicture('.' + file.ext)) {
      file.imageSrc = MSP.getImageLink();
      if (!file.downloadUrl) {
        file.downloadUrl = file.imageSrc.match(/.*(?=\?)|.*/)[0];
      }
    }

    return file;
  },
  formatTime: function (date) {
    return moment(date).format('YYYY-MM-DD HH:mm:ss');
  },
  renderOverDue: function () {
    let MSP = this;
    MSP.$html = $(
      mobileShareTpl({
        overDue: true,
        deadLineStr: MSP.deadLine ? MSP.formatTime(MSP.deadLine) : undefined,
      }),
    );
    MSP.$container.empty().append(MSP.$html);
  },
  render: function () {
    let MSP = this;
    MSP.$html = $(
      mobileShareTpl({
        deadLineStr: MSP.deadLine ? MSP.formatTime(MSP.deadLine) : undefined,
        isPicture: RegExpValidator.fileIsPicture('.' + MSP.file.ext),
        canPreview: RENDER_BY_SERVICE_TYPE.indexOf(MSP.file.ext.toLowerCase()) > -1,
        isIOS: MSP.isIOS,
        node: MSP.file,
        iconClass: getClassNameByExt('.' + MSP.file.ext),
        size: formatFileSize(MSP.file.size),
        hideOpenApp: !!MSP.options.shareFolderId || MSP.attachmentType === ATTACHMENT_TYPE.COMMON,
      }),
    );
    MSP.$container.empty().append(MSP.$html);
    MSP.$footer = MSP.$html.find('.footer');
    MSP.$saveToMingDao = MSP.$html.find('.saveToMingDao');
    MSP.$downloadBtn = MSP.$html.find('.downloadBtn');
    MSP.$openAPP = MSP.$html.find('.openAPP');
    MSP.$filePreview = MSP.$html.find('.fileIcon');
    MSP.$openIniOS = MSP.$html.find('.openIniOS');
    MSP.preview = {
      width: $('.mobileShareCon').width(),
      height: $('.mobileShareCon').height() - 50 - 112 - (MSP.deadLine ? 30 : 0),
    };
    MSP.bindEvent();
    if (RegExpValidator.fileIsPicture('.' + MSP.file.ext)) {
      MSP.renderImage();
    }
  },
  bindEvent: function () {
    let MSP = this;
    MSP.$saveToMingDao.on('click', function () {
      if (!md.global.Account || !md.global.Account.accountId) {
        MSP.alert(_l('请先登录'));
        setTimeout(function () {
          window.location = pathCompletion(
            '/login?ReturnUrl=' + encodeURIComponent(window.location.href.replace('checked=login', '')),
          );
        }, 1000);
      } else if (!MSP.file.canDownload) {
        MSP.alert(_l('您权限不足，无法保存。请联系文件夹管理员或文件上传者'));
      } else {
        MSP.saveToKnowledge();
      }
    });
    MSP.$downloadBtn.on('click', function () {
      let attachmentType = MSP.attachmentType;
      let canDownload = MSP.file.canDownload || RegExpValidator.fileIsPicture('.' + MSP.file.ext);

      if (window.isWeiXin) {
        MSP.openMask();
      } else if (!canDownload) {
        MSP.alert(_l('您权限不足，无法下载。请联系文件夹管理员或文件上传者'));
      } else if (attachmentType === ATTACHMENT_TYPE.QINIU) {
        MSP.downloadFile(MSP.file.downloadUrl);
      } else {
        let url =
          MSP.file.downloadUrl +
          (MSP.attachmentType === ATTACHMENT_TYPE.KC && MSP.options.shareFolderId
            ? '&shareFolderId=' + MSP.options.shareFolderId
            : '');
        window.open(downloadFile(url));
      }
    });
    if (MSP.$filePreview[0] && RENDER_BY_SERVICE_TYPE.indexOf(MSP.file.ext) > -1) {
      MSP.$filePreview.on('click', function () {
        if (MSP.isIOS && window.isWeiXin) {
          MSP.openMask();
          return;
        }

        MSP.previewFile();
      });
    }

    MSP.$openIniOS.on('click', function () {
      let needService = RENDER_BY_SERVICE_TYPE.indexOf(MSP.file.ext.toLowerCase()) > -1;

      if (!needService && MSP.isIOS && window.isWeiXin) {
        MSP.openMask();
        return;
      }

      MSP.previewFile();
    });
    MSP.$openAPP.on('click', function () {
      if (window.isWeiXin) {
        MSP.openMask();
        return;
      }

      let file = MSP.file;
      console.log('open ', 'mingdao://kcshare/' + file.id);
      window.open('mingdao://kcshare/' + file.id);
    });
  },
  downloadFile: function (url) {
    let a = document.createElement('a');
    /* 原先是 setAttribute('download', true)：download 属性的值是【建议的文件名】，
       于是同源下载、且响应没带 Content-Disposition 文件名时，文件真的会被存成叫 true 的文件。
       空串才是「用服务端 / URL 给的文件名」的意思。 */
    a.setAttribute('download', '');
    a.href = url;
    a.click();
  },
  previewFile: async function () {
    let promise;
    let MSP = this;
    let needService = RENDER_BY_SERVICE_TYPE.indexOf(MSP.file.ext.toLowerCase()) > -1;
    let file = MSP.file;
    let attachmentType = MSP.attachmentType;

    if (attachmentType === ATTACHMENT_TYPE.COMMON) {
      promise = needService ? MSP.getCommonPreviewLink(file) : file.downloadUrl;
    } else if (attachmentType === ATTACHMENT_TYPE.KC) {
      promise = MSP.isIOS
        ? file.ext === 'txt' || !file.canDownload || window.isWeiXin
          ? file.viewUrl
          : file.downloadUrl
        : file.viewUrl;
    } else if (attachmentType === ATTACHMENT_TYPE.QINIU) {
      const fetchPromise = chatAjax.getPreviewLink({
        id: Math.random().toString(16).slice(2),
        path: file.qiniuPath,
      });
      promise = needService
        ? MSP.isIOS && !window.isWeiXin
          ? { viewUrl: file.downloadUrl }
          : fetchPromise
        : { viewUrl: file.downloadUrl };
    }

    Promise.all([promise]).then(function ([data]) {
      let viewUrl = attachmentType === ATTACHMENT_TYPE.QINIU ? data.viewUrl : data;

      if (!viewUrl) {
        MSP.alert(_l('获取预览链接失败'));
        return;
      }

      if (attachmentType === ATTACHMENT_TYPE.QINIU && viewUrl === file.qiniuPath) {
        let urlParams = MSP.urlParams;
        viewUrl = urlAddParams(viewUrl, {
          e: urlParams.e,
          token: urlParams.qiniutoken,
        });
      }

      /* 【这里原先是 data.indexOf('owa' > -1)，括号放错了，但千万别「顺手改成」indexOf('owa') > -1】
         'owa' > -1 先算出 false，实际执行的是 data.indexOf(false)：在链接里找 "false"，
         找不到返回 -1，而 -1 是真值 —— 于是只要在共享文件夹里，所有预览链接都会带上 shareFolderId。
         而这恰恰是对的：桌面端同一个功能（kc/common/AttachmentsPreview/attachmentsPreview.tsx）
         就是对共享文件夹里【所有】知识中心文件的预览链接都加 shareFolderId，没有任何 owa 条件。
         照字面意思修正括号，会让移动端非 Office 文件的共享预览突然不带这个参数。
         所以改成它实际在做、也本该做的事。顺带：七牛附件那一路 data 是 { viewUrl } 对象，
         原写法在它身上调 .indexOf 会直接抛错（只是 shareFolderId 与七牛附件不会同时出现）。 */
      if (MSP.options.shareFolderId) {
        viewUrl = urlAddParams(viewUrl, {
          shareFolderId: MSP.options.shareFolderId,
        });
      }

      window.location = viewUrl;
    });
  },
  saveToKnowledge: function () {
    let MSP = this;
    let sourceData: Record<string, any> = {};
    let kcPath = {
      type: 1,
      node: {
        id: null,
        name: _l('我的文件'),
      },
    };
    let attachmentType = MSP.attachmentType;

    if (attachmentType === ATTACHMENT_TYPE.COMMON) {
      sourceData.fileID = MSP.file.fileID;
    } else if (attachmentType === ATTACHMENT_TYPE.KC) {
      sourceData.nodeId = MSP.file.id;
    } else if (attachmentType === ATTACHMENT_TYPE.QINIU) {
      sourceData.name = MSP.file.name + (MSP.file.ext ? '.' + MSP.file.ext : '');
      sourceData.filePath = MSP.file.qiniuPath;
    }

    sourceData.isShareFolder = !!MSP.options.shareFolderId;
    saveToKnowledge(attachmentType, sourceData, {
      createShare: false,
    })
      .save(kcPath)
      .then(function () {
        MSP.alert(_l('已存入 知识“我的文件” 中'));
      })
      .catch(function () {
        MSP.alert(_l('保存失败'));
      });
  },
  renderImage: function () {
    let MSP = this;
    MSP.$imageLink = MSP.$html.find('.previewImage');
    MSP.$image = MSP.$html.find('.previewImage img');
    if (MSP.$imageLink[0]) {
      MSP.$imageLink.attr('href', MSP.file.imageSrc.match(/.*(?=\?)|.*/)[0]);
    }

    if (MSP.$image[0]) {
      MSP.$image.attr('src', MSP.getPreviewUrl(MSP.file.imageSrc));
    }
  },
  getImageLink: function () {
    let MSP = this;
    let attachmentType = MSP.attachmentType;
    let result;

    if (MSP.attachmentType === ATTACHMENT_TYPE.COMMON) {
      result = MSP.sourceData.thumbnailPath + MSP.sourceData.thumbnailName;
    } else if (attachmentType === ATTACHMENT_TYPE.KC) {
      result = MSP.sourceData.viewUrl;
    } else if (attachmentType === ATTACHMENT_TYPE.QINIU) {
      result = MSP.urlParams.qiniuPath;
    }

    return result;
  },
  getPreviewUrl: function (url) {
    let MSP = this;
    return `${url}|imageView2/2/w/${MSP.preview.width - 32}/h/${MSP.preview.height - 32}`;
  },
  getCommonPreviewLink: function (file) {
    let MSP = this;
    return attachmentAjax.getPreviewLink({
      fileID: file.fileID,
      ext: file.ext ? '.' + file.ext : '',
      attachmentType: MSP.sourceData.attachmentType,
    });
  },
  openMask: function () {
    let $mask = $('<div class="mobileSharemask ' + (this.isIOS ? 'ios' : 'android') + '"></div>');
    this.$container.append($mask);
    $mask.on('click', function () {
      $mask.remove();
    });
  },
  alert: function (str, time?) {
    let MSP = this;
    /* 原先清的是 MSP.timer —— 从来没被赋过值，而下面设的是 MSP.alertTimer。
       于是 3 秒内连弹两次时，第一个定时器清不掉，到点后执行 MSP.$alert.remove()，
       而那时 MSP.$alert 已经指向第二个提示 —— 第二个提示只显示 2 秒就被提前抹掉。 */
    clearTimeout(MSP.alertTimer);
    if (MSP.$alert) {
      MSP.$alert.remove();
    }

    MSP.$alert = $('<div class="mobileAlertDialog" ><div class="alertDialog">' + str + '</div></div>');
    $('body').append(MSP.$alert);
    MSP.alertTimer = setTimeout(function () {
      MSP.$alert.remove();
    }, time || 3000);
  },
  loadWeiXinShare: function () {
    let MSP = this;
    weixinAjax
      .getWeiXinConfig({
        url: encodeURI(location.href),
      })
      .then(function (data) {
        if (data.code === 1) {
          wx.config({
            debug: false,
            appId: 'wx26fcef87aadb6001',
            timestamp: data.data.timestamp,
            nonceStr: data.data.nonceStr,
            signature: data.data.signature,
            jsApiList: ['onMenuShareAppMessage', 'onMenuShareTimeline'],
          });
          wx.onMenuShareAppMessage({
            title: MSP.file.name,
            link: location.href,
            desc: location.href,
            success: function () {},
          });
          wx.onMenuShareTimeline({
            title: MSP.file.name,
            link: location.href,
            success: function () {},
          });
        }
      });
  },
});

MobileSharePreview.prototype = mobileSharePreviewMethods;
type MobileSharePreviewInstance = MobileSharePreviewFields & typeof mobileSharePreviewMethods;

md.global.Config.disableKf5 = true;

export default MobileSharePreview;
