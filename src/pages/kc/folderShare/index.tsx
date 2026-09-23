import { renderToString } from 'react-dom/server';
import doT from 'dot';
import _ from 'lodash';
import qs from 'query-string';
import { Dialog, LoadDiv } from 'ming-ui';
import shareajax from 'src/api/share';
import shareFolderAjax from 'src/api/shareFolder';
import preall from 'src/common/preall';
import saveToKnowledge from 'src/components/kc/saveToKnowledge/saveToKnowledge';
import previewAttachments from 'src/components/previewAttachments/previewAttachments';
import { browserIsMobile, downloadFile, getClassNameByExt, pathCompletion } from 'src/utils/common';
import defineMethods from 'src/utils/defineMethods';
import RegExpValidator from 'src/utils/expression';
import MobileSharePreview from '../shareMobile/shareMobile';
import fileItemHtml from './tpl/fileItem.html';
import frameTplHtml from './tpl/frame.html';
import './css/style.less';

var frameTpl = doT.template(frameTplHtml);
var fileItemTpl = doT.template(fileItemHtml);

const loading = renderToString(<LoadDiv />);

/** 公开共享文件夹页（/apps/kcshareFolder/:shareId，访客可匿名打开）。节点都是接口原样返回的知识节点 */
interface ShareFolderFields {
  data: {
    currentFolderId: string;
    isLoadingMore: boolean;
    page: number;
    pageNum: number;
    /** 当前文件夹已加载的节点（翻页时累加） */
    list: ApiPayload[];
    listCount: number;
    isTouching?: boolean;
    startPos?: { x: number; y: number };
  };
  urlParams: ReturnType<typeof qs.parse>;
  options: { isMobile: boolean };
  $container: JQuery;
  /** getShareFolder 的返回：node 是被分享的根文件夹，active 为假表示分享已关闭 */
  sourceData: ApiPayload;
  rootNode: ApiPayload;
  $fileList: JQuery;
  $previewCon?: JQuery;
  $globalLoading?: JQuery;
  $alert?: JQuery;
  alertTimer?: ReturnType<typeof setTimeout>;
}

function ShareFolder(this: ShareFolderInstance, options?) {
  var SF = this;
  var DEFAULTS = {
    isMobile: browserIsMobile(),
  };
  this.data = {
    currentFolderId: '',
    isLoadingMore: false,
    page: 0,
    pageNum: 20,
    list: [],
    listCount: 0,
  };
  let urlsearch = location.search;

  if (!urlsearch && /^#\?token(.*)/.test(location.hash)) {
    urlsearch = location.hash.match(/^#(\?token.*)/)[1];
  }

  this.urlParams = qs.parse(unescape(unescape(urlsearch.slice(1))));
  this.options = _.assign({}, DEFAULTS, options);
  this.$container = $('#app');
  var shareId;
  try {
    shareId = location.pathname.match(/.*\/apps\/kcshareFolder\/(\w+)/)[1];
  } catch (err) {
    console.log(err);
  }

  if (shareId) {
    shareajax.getShareFolder({ shareId, token: this.urlParams.token }).then(data => {
      if (data.node) {
        SF.sourceData = data;
        if (data.accountInfo && md.global.Account) {
          md.global.Account = data.accountInfo;
        }

        SF.init();
      } else if (data.position) {
        location.href = pathCompletion('/apps/kc' + data.position);
      } else {
        SF.$container.text(_l('当前文件不存在或您没有查看权限'));
      }
    });
  }
}

const shareFolderMethods = defineMethods<ShareFolderFields>()({
  init: function () {
    var SF = this;
    this.renderFrame();
    if (this.sourceData.active) {
      this.rootNode = this.sourceData.node;
      this.data.currentFolderId = this.rootNode.id;
      var hashParams = this.getHashParams();
      var hashId = hashParams.folderId;
      if (hashId) {
        /* 【带 preview 的链接原先一打开就整页崩】这里原先调 shareFolderAjax.getNodeDetail 取要预览的文件：
           上游 5.2.0（2024-02）已经从 src/api/shareFolder 里删掉了这个接口，运行时是 undefined，
           抛 TypeError 之后下面的打开文件夹、bindEvent 全都没执行。移动端点开文件后刷新、或把这个地址发给别人，
           看到的就是一个空壳页。
           现在等文件夹列表加载完，从列表里取这个节点，走和在列表里点击完全相同的预览调用（shareFolderId 放在第二个
           参数里 —— 预览组件只从那里读，原先这里放在第一个参数里，是读不到的）。目标不在第一页里就只打开文件夹。 */
        this.openFolder(hashId).then(() => {
          if (!hashParams.preview) return;
          const node = SF.data.list.find(item => item.id === hashParams.preview);
          if (!node) return;
          if (SF.options.isMobile) {
            SF.preview(node);
          } else {
            previewAttachments(
              { callFrom: 'kc', attachments: [node], showThumbnail: true },
              { shareFolderId: SF.rootNode.id },
            );
          }
        });
      } else {
        this.renderList([this.rootNode]);
        this.$container.find('.path').text(_l('全部文件'));
      }

      $('title').text(this.rootNode.name);
    } else {
      this.renderStatus('closed');
    }

    this.bindEvent();
  },
  bindEvent: function () {
    var SF = this;
    this.$container.on('click', '.fileItem', function (this: HTMLElement) {
      var isFolder = $(this).data('type') == 1;
      var id = $(this).data('id');
      var index = parseInt($(this).data('index'), 10);
      var node = SF.data.list[index];
      if (isFolder) {
        SF.navigateByHash({
          folderId: id,
        });
      } else if (SF.options.isMobile) {
        SF.navigateByHash({
          folderId: SF.data.currentFolderId,
          preview: node.id,
        });
      } else {
        previewAttachments(
          {
            callFrom: 'kc',
            attachments: [node],
            showThumbnail: true,
          },
          {
            shareFolderId: SF.rootNode.id,
          },
        );
      }
    });
    $('.shareFolderCon .main').on('scroll', function (this: HTMLElement) {
      var conHeight = $(this).height();
      var scrollTop = $(this).scrollTop();
      var contentHeight = $('.shareFolderCon .main .fileList').height();
      var listCount = SF.data.listCount;
      var renderedCount = SF.data.list.length;
      if (contentHeight - scrollTop - conHeight < 30) {
        if (!SF.data.isLoadingMore && renderedCount < listCount) {
          SF.loadMoreNodes();
          var $loadingCon = $(
            '<div id="loadingCon"><div class="scaleBox"></div>' + loading + '<div class="scaleBox"></div></div>',
          );
          SF.$fileList.append($loadingCon);
        }
      }
    });
    this.$container.find('.main').on('touchmove', function (e) {
      if (SF.data.isTouching && SF.data.isLoadingMore) {
        var deltaY = Math.abs(e.touches[0].clientY - SF.data.startPos.y);
        $('.scaleBox').height((30 * deltaY) / 300);
      }
    });
    this.$container.find('.main').on('touchstart', function (e) {
      SF.data.isTouching = true;
      if (e.touches) {
        SF.data.startPos = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    });
    this.$container.find('.main').on('touchend', function () {
      SF.data.isTouching = false;
      $('.scaleBox').animate({ height: 0 }, 'fast');
    });
    this.$container.find('.btnLogin').on('click', function () {
      SF.login();
    });
    this.$container.find('.saveToMingDao').on('click', function () {
      if (!md.global.Account || !md.global.Account.accountId) {
        SF.alert(_l('请先登录'));
        setTimeout(function () {
          SF.login();
        }, 1000);
      } else {
        SF.saveToKnowledge();
      }
    });
    window.addEventListener(
      'hashchange',
      function () {
        var hashParams = SF.getHashParams();
        var id = hashParams.folderId;
        SF.$container.show();
        SF.$container.find('.footer').show();
        if (SF.$previewCon) {
          SF.$previewCon.remove();
        }

        if (hashParams.preview) {
          SF.preview();
        }

        if (id) {
          SF.openFolder(id);
        } else if (id === '') {
          SF.renderList([SF.rootNode]);
          SF.$container.find('.path').text(_l('全部文件'));
        }
      },
      false,
    );
    if (!SF.options.isMobile) {
      this.$container.find('.download').on('click', function () {
        if (SF.rootNode.canDownload) {
          window.open(downloadFile(SF.rootNode.downloadUrl + '&shareFolderId=' + SF.rootNode.id));
        } else {
          alert(_l('您权限不足，无法下载或保存。请联系文件夹管理员或文件上传者'), 3);
        }
      });
      this.$container.find('.share').on('click', function () {
        if (!md.global.Account || !md.global.Account.accountId) {
          SF.handleLogin();
          return;
        }

        var attachment = SF.rootNode;
        import('src/components/shareAttachment/shareAttachment').then(share => {
          var params: Record<string, any> = {
            attachmentType: 2,
            isKcFolder: true,
          };
          var isPicture = RegExpValidator.fileIsPicture('.' + attachment.ext.slice(attachment.ext.indexOf('.') + 1));
          params.id = attachment.id;
          params.name = attachment.name;
          params.ext = '.' + attachment.ext;
          params.size = attachment.size;
          params.imgSrc = isPicture
            ? attachment.previewUrl.indexOf('imageView2') > -1
              ? attachment.previewUrl.replace(/imageView2\/\d\/w\/\d+\/h\/\d+(\/q\/\d+)?/, 'imageView2/2/w/490')
              : `${attachment.previewUrl}&imageView2/2/w/490`
            : undefined;
          params.node = attachment;
          share.default(params, {
            performUpdateItem: visibleType => {
              if (visibleType) {
                SF.rootNode.visibleType = visibleType;
              }
            },
          });
        });
      });
      this.$container.find('.saveToKc').on('click', function () {
        if (!md.global.Account || !md.global.Account.accountId) {
          SF.handleLogin();
          return;
        }

        SF.saveToKnowledge();
      });
    }
  },
  /** 移动端预览。node 不传时按地址里的 preview 参数从已加载的列表里找 */
  preview: function (node?: ApiPayload) {
    var SF = this;
    var hashParams = SF.getHashParams();
    SF.$previewCon = $('<div id="previewCon"></div>');
    $('body').append(SF.$previewCon);
    SF.$container.hide();
    new MobileSharePreview({
      node:
        node ||
        SF.data.list.filter(function (item) {
          return item.id === hashParams.preview;
        })[0],
      container: '#previewCon',
      shareFolderId: SF.rootNode.id,
    });
  },
  loadMoreNodes: function () {
    var SF = this;
    var page = SF.data.page;
    var currentId = this.data.currentFolderId;
    page++;
    SF.data.isLoadingMore = true;
    SF.getNodes(currentId, page, 20)
      .then(function (data) {
        SF.$container.find('#loadingCon').remove();
        SF.data.list = SF.data.list.concat(data.list);
        SF.renderList(SF.data.list);
        SF.data.isLoadingMore = false;
        SF.data.page = page;
      })
      .catch(function () {});
  },
  renderFrame() {
    var SF = this;
    this.$container.html(
      frameTpl({
        isMobile: SF.options.isMobile,
        active: this.sourceData.active,
      }),
    );
    this.$fileList = this.$container.find('.fileList');
    const $logo = this.$container.find('.header .logo');
    $logo.html(`<img src="${_.get(md, 'global.SysSettings.brandLogoUrl') || _.get(md, 'global.Config.Logo')}" />`);
  },
  renderList: function (nodes) {
    var SF = this;
    if (nodes.length) {
      SF.$fileList.html(SF.getListHtml(nodes));
    } else {
      SF.renderStatus('empty');
    }
  },
  renderPath: function (pathArray) {
    var SF = this;
    pathArray.unshift({
      pathNodeId: '',
      pathNodeName: _l('全部文件'),
    });
    var $path;
    render(pathArray);
    if (getPathWidth() > getPathConWidth()) {
      SF.$container.find('.path').addClass('over');
      if (getPathWidth() > getPathConWidth()) {
        render(pathArray, true);
      }
    }

    function getPathConWidth() {
      return SF.$container.find('.path').width() - 32;
    }

    function getPathWidth() {
      return _.sum(
        $path.map(function (_index: number, ele) {
          return $(ele).width();
        }),
      );
    }

    function render(pathArray, cut?) {
      $path = $(
        _.compact(
          pathArray.map(function (path, index: number) {
            if (cut && index === 1) {
              return '<span class="ellipsis">...</span>';
            }

            if (cut && index > 1 && index < pathArray.length - 2) {
              return '';
            }

            return '<a class="ellipsis" href="' + '#folderId=' + path.pathNodeId + '">' + path.pathNodeName + '</a>';
          }),
        ).join('<span class="spliter">></span>'),
      );
      SF.$container.find('.path').html($path);
    }
  },
  getListHtml: function (nodes) {
    return nodes
      .map(function (node, index: number) {
        return fileItemTpl({
          index: index.toString(),
          isPicture: RegExpValidator.fileIsPicture('.' + node.ext),
          className: node.type === 1 ? 'fileIcon-folder' : getClassNameByExt('.' + node.ext),
          node: node,
        });
      })
      .join('');
  },
  /** 返回加载完成的 Promise（失败也会 resolve），init 里带 preview 的链接要等列表到了再预览 */
  openFolder: function (id) {
    var SF = this;
    this.data.currentFolderId = id;
    SF.globalLoading();
    return SF.getNodes(id, 0, 20)
      .then(function (data) {
        SF.data.list = data.list;
        SF.renderList(SF.data.list);
        SF.renderPath(data.position);
      })
      .catch(function () {});
  },
  getNodes: function (id, page, pageNum) {
    var SF = this;
    return shareFolderAjax
      .getNodesByShareFolderId({
        shareFolderId: SF.rootNode.id,
        rootType: 3,
        parentId: id,
        skip: page * pageNum,
        limit: pageNum,
      })
      .then(function (data) {
        SF.data.listCount = data.totalCount;
        return data;
      });
  },
  globalLoading: function () {
    var SF = this;
    if (SF.$globalLoading) {
      SF.$globalLoading.remove();
    }

    SF.$globalLoading = $('<div class="globalLoading">' + loading + '</div>');
    SF.$fileList.append(SF.$globalLoading);
  },
  renderStatus: function (status) {
    var SF = this;
    SF.$container.find('.footer').hide();
    SF.$fileList.html(
      '<div class="statusCon">' +
        '<span class="icon icon-' +
        (status || 'closed') +
        '"></span>' +
        '<p>' +
        {
          closed: _l('已删除或分享已关闭，无法预览'),
          error: _l('出错'),
          empty: _l('没有文件'),
        }[status] +
        '</p>' +
        '</div>',
    );
  },
  navigateByHash(data) {
    window.location.href =
      window.location.origin + window.location.pathname + window.location.search + '#' + qs.stringify(data);
  },
  getHashParams: function () {
    return Object.assign(qs.parse(window.location.hash.slice(1)));
  },
  saveToKnowledge: function () {
    var SF = this;
    var sourceData: Record<string, any> = {};
    var kcPath = {
      type: 1,
      node: {
        id: null,
        name: _l('我的文件'),
      },
    };
    sourceData.nodeId = SF.rootNode.id;
    sourceData.isShareFolder = true;
    saveToKnowledge(2, sourceData, {
      createShare: !SF.options.isMobile,
    })
      .save(kcPath)
      .then(function (message) {
        if (SF.options.isMobile) {
          SF.alert(message || _l('已存入 知识“我的文件” 中'));
        }
      })
      .catch(function (message) {
        SF.alert(message || _l('保存失败'));
      });
  },
  handleLogin() {
    Dialog.confirm({
      title: _l('保存到'),
      children: <div>{_l('请先登录')}</div>,
      okText: _l('登录'),
      onOk: () => {
        if (location.href.indexOf('.mingdao.net') > -1) {
          var newUrl =
            'https://www.mingdao.com/login?ReturnUrl=' +
            encodeURIComponent(window.location.href.replace(window.location.origin, 'https://www.mingdao.com'));
          window.location.href = newUrl;
        } else {
          window.location.href = pathCompletion('/login?ReturnUrl=' + encodeURIComponent(window.location.href));
        }
      },
    });
  },
  login() {
    if (location.href.indexOf('.mingdao.net') > -1) {
      var newUrl =
        'https://www.mingdao.com/login?ReturnUrl=' +
        encodeURIComponent(window.location.href.replace(window.location.origin, 'https://www.mingdao.com'));
      window.location.href = newUrl;
    } else {
      window.location.href = pathCompletion('/login?ReturnUrl=' + encodeURIComponent(window.location.href));
    }
  },
  alert: function (str, time?: number) {
    var SF = this;
    if (!SF.options.isMobile) {
      alert(str);
      return;
    }

    // 原先清的是 SF.timer（从没赋过值），设的却是 alertTimer：3 秒内连弹两次时，第一个定时器会把第二个提示提前抹掉。
    // 和 kc/shareMobile 里修过的是同一个问题（那个文件是这段的原型）
    clearTimeout(SF.alertTimer);
    if (SF.$alert) {
      SF.$alert.remove();
    }

    SF.$alert = $('<div class="mobileAlertDialog" ><div class="alertDialog">' + str + '</div></div>');
    $('body').append(SF.$alert);
    SF.alertTimer = setTimeout(function () {
      SF.$alert.remove();
    }, time || 3000);
  },
});

ShareFolder.prototype = shareFolderMethods;
type ShareFolderInstance = ShareFolderFields & typeof shareFolderMethods;

preall({ type: 'function' }, { allowNotLogin: true });
window.hello = new ShareFolder();
md.global.Config.disableKf5 = true;
