import moment from 'moment';
import { Button, Dialog } from 'ming-ui';
import { formatFileSize, getClassNameByExt } from 'src/utils/common';
import defineMethods from 'src/utils/defineMethods';
import RegExpValidator from 'src/utils/expression';
import './style.less';

/** 聊天里发文件前的确认弹层（可改名）。由 SendToolbar 的 recurShowFileConfirm 逐个文件调起：
 *  yesFn 之后弹下一个、全部确认完才 up.start()；noFn 把这个文件移出上传队列再弹下一个。 */
interface FileConfirmFields {
  /** plupload 的文件对象（唯一的调用方 SendToolbar 传的是 FilesAdded 里的文件）；图片预览时取 getNative() 拿原生 File */
  file: { name: string; size: number; getNative: () => Blob };
  callback: { yesFn?: (file: FileConfirmFields['file']) => void; noFn?: (file: FileConfirmFields['file']) => void };
  /** 扩展名（小写、不带点）；文件名里没有点时为 undefined */
  ext?: string;
  dialogBoxID: string;
  $dialog: JQuery;
  dialogEle: {
    $fileIcon: JQuery;
    $fileSize: JQuery;
    $thumbnailCon: JQuery;
    $thumbnail: JQuery;
    $fileName: JQuery;
  };
  /** 回调只许触发一次：yesFn 成功后置 false，防止连点重复上传 */
  first: boolean;
  /** 这个弹层是否已经收过尾（确认或取消）。见 init 里 onCancel 的说明 */
  settled: boolean;
}

function FileConfirm(this: FileConfirmInstance, file, callback) {
  var FC = this;
  FC.file = file;
  FC.callback = callback;
  this.init();
}

const fileConfirmMethods = defineMethods<FileConfirmFields>()({
  init: function () {
    var FC = this;
    var name: string | undefined;
    var file = FC.file;
    var fullname = file.name;
    if (fullname.lastIndexOf('.') > -1) {
      FC.ext = fullname.slice(fullname.lastIndexOf('.') + 1).toLowerCase();
      name = fullname.slice(0, fullname.lastIndexOf('.'));
    } else {
      name = fullname;
    }

    if (name === '剪切板贴图') {
      name = moment().format('上传于YYYY-MM-DD HH时mm分');
    }

    FC.dialogBoxID = 'fileConfirmDialog_' + Math.random().toString(16).slice(2);
    FC.settled = false;
    const closeDialog = () => document.querySelector<HTMLElement>(`.${FC.dialogBoxID} .mui-dialog-close-btn`).click();
    // 取消：把文件移出上传队列、接着弹下一个（SendToolbar 的 noFn），并解掉回车上传的快捷键
    const cancel = () => {
      FC.settled = true;
      $(document).off('keyup.fileConfirm.upload');
      if (FC.callback && typeof FC.callback.noFn === 'function') {
        FC.callback.noFn(FC.file);
      }
    };

    Dialog.confirm({
      dialogClasses: `${FC.dialogBoxID} fileConfirmDialog darkHeader`,
      width: 540,
      title: _l('上传文件'),
      /* 【× 原先什么都不收】取消 / 上传 / 回车 / Esc 各自收尾，唯独右上角 × 直接关掉弹层：
         document 上的回车快捷键不解绑 —— 之后在聊天框按回车发消息，它去读已被移除的文件名输入框，
         弹「名称不能为空」并拦掉这次回车，而且因为校验永远失败，它永远不会自己解绑；
         noFn 也不触发 —— 这个文件留在上传队列里，同批剩下的文件不再弹确认，
         下次再发文件走到 up.start() 时它们会被一起传上去、当消息发出去。
         现在 × 按取消处理。取消 / 上传两个按钮也是靠点 × 关弹层的，所以它们先置 settled，这里就不再重复收尾。 */
      onCancel: () => {
        if (!FC.settled) cancel();
      },
      children: (
        <div className="fileConfirmDialogContainer">
          <div className="filePreview">
            <div className="fileIcon">
              <span className="fileSize"></span>
            </div>
            <div className="thumbnailCon">
              <div className="thumbnail"></div>
            </div>
          </div>
          <div className="dList">
            <div className="dItem">
              <div className="itemLabel">{_l('名称')}</div>
              <div className="itemContent">
                <input type="text" id="fileName" placeholder={_l('名称')} />
              </div>
            </div>
          </div>
        </div>
      ),
      footer: (
        <div className="Dialog-footer-btns">
          <Button
            type="link"
            onClick={() => {
              cancel();
              closeDialog();
            }}
          >
            {_l('取消')}
          </Button>
          <Button
            type="primary"
            onClick={() => {
              if (FC.yesFn()) {
                FC.settled = true;
                $(document).off('keyup.fileConfirm.upload');
                closeDialog();
              }
            }}
          >
            {_l('上传')}
          </Button>
        </div>
      ),
    });

    setTimeout(() => {
      FC.$dialog = $('.' + FC.dialogBoxID);
      FC.dialogEle = {
        $fileIcon: FC.$dialog.find('.fileIcon'),
        $fileSize: FC.$dialog.find('.fileSize'),
        $thumbnailCon: FC.$dialog.find('.thumbnailCon'),
        $thumbnail: FC.$dialog.find('.thumbnail'),
        $fileName: FC.$dialog.find('#fileName'),
      };
      FC.dialogEle.$fileName.val(name);
      FC.dialogEle.$fileName.focus();
      $(document).on('keyup.fileConfirm.upload', function (e) {
        e.stopPropagation();
        if (e.keyCode === 13) {
          if (FC.yesFn()) {
            FC.settled = true;
            $(document).off('keyup.fileConfirm.upload');
            closeDialog();
            $('.chatMessage-textarea textarea').focus();
          } else {
            return false;
          }
        }

        if (e.keyCode === 27) {
          cancel();
        }
        return undefined;
      });
      FC.previewFile();
      FC.first = true;
    }, 200);
  },
  yesFn: function () {
    var FC = this;
    var fileName = String(FC.dialogEle?.$fileName?.val() ?? '');
    if (fileName.trim() === '') {
      alert(_l('名称不能为空'), 3);
      return false;
    }

    if (!FC.validate(fileName)) {
      return false;
    }

    if (FC.callback && typeof FC.callback.yesFn === 'function' && FC.first) {
      FC.file.name = FC.getFullFileName();
      FC.callback.yesFn(FC.file);
      FC.first = false;
      return true;
    }
    return undefined;
  },
  previewFile: function () {
    var FC = this;
    if (RegExpValidator.fileIsPicture('.' + FC.ext) && FileReader) {
      FC.loadPicture();
    } else {
      FC.loadDocIcon();
    }
  },
  loadDocIcon: function () {
    var FC = this;
    FC.dialogEle.$fileIcon.show();
    var fileIconClass = getClassNameByExt('.' + FC.ext);
    FC.dialogEle.$fileIcon.addClass(fileIconClass).show();
    FC.dialogEle.$fileSize.text(formatFileSize(FC.file.size).replace(/ /g, ''));
  },
  loadPicture: function () {
    var FC = this;
    FC.dialogEle.$thumbnailCon.show();
    var reader = new FileReader();
    var img = document.createElement('img');
    img.addEventListener(
      'error',
      function () {
        FC.dialogEle.$thumbnail.hide();
        FC.loadDocIcon();
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
    if (FC.file) {
      // 原先还有「没有 getNative 就把 file 本身当 Blob 读」的兜底：plupload 文件一定有 getNative，那一支走不到
      reader.readAsDataURL(FC.file.getNative());
    }

    FC.dialogEle.$thumbnail.append(img).show();
  },
  getFullFileName: function () {
    var FC = this;
    return FC.dialogEle.$fileName.val() + (FC.ext ? '.' + FC.ext : '');
  },
  validate: function (str) {
    const illegalSet = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
    const illegalChars = new RegExp(`[${illegalSet.map(c => '\\' + c).join('')}]`, 'g');

    if (illegalChars.test(str)) {
      alert(_l('名称不能包含以下字符:') + ' ' + illegalSet.join(' '), 3);
      return false;
    }

    return true;
  },
});

FileConfirm.prototype = fileConfirmMethods;
type FileConfirmInstance = FileConfirmFields & typeof fileConfirmMethods;

export default function (file, callback) {
  // 原先 return fileConfirm.dialog —— 实例上从来没有 dialog 这个字段，一直返回 undefined；唯一的调用方也不用返回值
  new FileConfirm(file, callback);
}
