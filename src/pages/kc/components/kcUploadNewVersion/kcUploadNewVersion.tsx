import doT from 'dot';
import { Button, Dialog } from 'ming-ui';
import kcAjax from 'src/api/kc';
import { formatFileSize, getClassNameByExt } from 'src/utils/common';
import defineMethods from 'src/utils/defineMethods';
import RegExpValidator from 'src/utils/expression';
import { getUrlByBucketName } from '../../utils';
import mainTpl from './tpl/main.html';
import './style.less';

/** 知识中心「上传新版本」弹层。上传由调用方驱动：进度走 setProcess、传完调 uploaded，这里只管确认和提交 */
interface UploadNewVersionFields {
  /** 要追加版本的那个知识节点 */
  item: { id: string };
  /** plupload 的文件对象 */
  file: { name: string; size?: number; getNative: () => Blob };
  callback?: (data: ApiPayload) => void;
  /** 扩展名（小写、不带点）；文件名里没有点时为 undefined */
  ext?: string;
  name: string;
  dialogBoxID: string;
  /** 传完之后的文件地址；没有它不许提交 */
  filePath?: string;
  $dialog: JQuery;
  $fileIcon: JQuery;
  $fileSize: JQuery;
  $thumbnail: JQuery;
  $process: JQuery;
  $processContent: JQuery;
  $processPercent: JQuery;
  $newVersionFileName: JQuery;
  $newVersionFileDetail: JQuery;
}

function UploadNewVersion(this: UploadNewVersionInstance, item, file, callback) {
  var NV = this;
  NV.item = item;
  NV.file = file;
  NV.callback = callback;
  this.init();
}

const uploadNewVersionMethods = defineMethods<UploadNewVersionFields>()({
  init: function () {
    var NV = this;
    NV.dialog();
  },
  dialog: function () {
    var NV = this;
    var fullname = NV.file.name;
    if (fullname.lastIndexOf('.') > -1) {
      NV.ext = fullname.slice(fullname.lastIndexOf('.') + 1).toLowerCase();
      NV.name = fullname.slice(0, fullname.lastIndexOf('.'));
    } else {
      NV.name = fullname;
    }

    var html = doT.template(mainTpl)();
    NV.dialogBoxID = 'uploadNewVersion_' + Math.random().toString(16).slice(2);

    Dialog.confirm({
      dialogClasses: `${NV.dialogBoxID} uploadNewVersion darkHeader`,
      width: 540,
      title: _l('上传新版本'),
      children: <div dangerouslySetInnerHTML={{ __html: html }}></div>,
      footer: (
        <div className="Dialog-footer-btns">
          <Button type="link" onClick={() => $(`.${NV.dialogBoxID}`).parent().remove()}>
            {_l('取消')}
          </Button>
          <Button
            type="primary"
            onClick={() => {
              let sign = NV.addAsNewVersion();
              if (sign === false) return;
              $(`.${NV.dialogBoxID}`).parent().remove();
            }}
          >
            {_l('确认')}
          </Button>
        </div>
      ),
    });

    setTimeout(() => {
      NV.$dialog = $('.' + NV.dialogBoxID);
      NV.$fileIcon = NV.$dialog.find('.fileIcon');
      NV.$fileSize = NV.$dialog.find('.fileSize');
      NV.$thumbnail = NV.$dialog.find('.thumbnail');
      NV.$process = NV.$dialog.find('.process');
      NV.$processContent = NV.$dialog.find('.processContent');
      NV.$processPercent = NV.$dialog.find('.processPercent');
      NV.$newVersionFileName = NV.$dialog.find('#newVersionFileName');
      NV.$newVersionFileDetail = NV.$dialog.find('#newVersionFileDetail');
      NV.$newVersionFileName.val(NV.name);
    }, 20);
  },
  uploaded: function (qiniuInfo) {
    let server = getUrlByBucketName(qiniuInfo.bucket);
    this.filePath = server + qiniuInfo.key;
    this.hideProcess();
  },
  addAsNewVersion: function () {
    var NV = this;
    var versionDes = NV.$newVersionFileDetail ? String(NV.$newVersionFileDetail.val() ?? '').trim() : '';
    var versionName = NV.$newVersionFileName ? String(NV.$newVersionFileName.val() ?? '').trim() : '';
    if (!NV.filePath) {
      alert(_l('正在上传中，无法执行此操作'), 3);
      return false;
    }

    if (!versionName) {
      alert(_l('请输入新版本文件名'), 3);
      return false;
    }

    if (!NV.validate(versionName) || !NV.validate(versionDes)) {
      return false;
    }

    kcAjax
      .addMultiVersionFile({
        id: NV.item.id,
        name: versionName,
        ext: NV.ext ? '.' + NV.ext : undefined,
        versionDes: versionDes,
        filePath: NV.filePath,
        size: NV.file.size || 0,
      })
      .then(function (data) {
        alert(_l('已上传为新版本'));
        if (NV.callback) {
          NV.callback(data);
        }
      });
    return undefined;
  },
  setProcess: function (percent) {
    var NV = this;
    NV.$processContent.css({ width: percent + '%' });
    NV.$processPercent.text(Math.ceil(percent) + '%');
  },
  hideProcess: function () {
    var NV = this;
    NV.$process.hide();
    if (RegExpValidator.fileIsPicture('.' + NV.ext) && FileReader) {
      NV.loadPicture();
    } else {
      NV.loadDocIcon();
    }
  },
  loadDocIcon: function () {
    var NV = this;
    var fileIconClass = getClassNameByExt('.' + NV.ext);
    NV.$fileIcon.addClass(fileIconClass).show();
    NV.$fileSize.text(formatFileSize(NV.file.size).replace(/ /g, ''));
  },
  loadPicture: function () {
    var NV = this;
    var reader = new FileReader();
    var img = document.createElement('img');
    img.addEventListener(
      'error',
      function () {
        NV.$thumbnail.hide();
        NV.loadDocIcon();
      },
      false,
    );
    reader.addEventListener(
      'load',
      function () {
        img.src = reader.result as string; // readAsDataURL 的结果一定是字符串
      },
      false,
    );
    if (NV.file) {
      reader.readAsDataURL(NV.file.getNative());
    }

    NV.$thumbnail.append(img).show();
  },
  validate: function (str) {
    var illegalChars = /[/\\:*?"<>|]/g;
    var valid = illegalChars.test(str);
    if (valid) {
      alert(_l('名称和详情描述里不能包含以下字符：') + '\\ / : * ? " < > |', 3);
      return false;
    }

    return true;
  },
});

UploadNewVersion.prototype = uploadNewVersionMethods;
type UploadNewVersionInstance = UploadNewVersionFields & typeof uploadNewVersionMethods;

export default function (item, file, callback) {
  var uploadNewVersion = new UploadNewVersion(item, file, callback);
  return uploadNewVersion;
}
// });
