import { Component } from 'react';
import cx from 'classnames';
import moment from 'moment';
import LoadDiv from 'ming-ui/components/LoadDiv';
import previewAttachments from 'src/components/previewAttachments/previewAttachments';
import { getClassNameByExt } from 'src/utils/common';
import RegExpValidator from 'src/utils/expression';
import { dateConvertToUserZone } from 'src/utils/project';
import * as utils from '../../utils';
import * as ajax from '../../utils/ajax';
import Constant from '../../utils/constant';
import type { ChatFileWire } from 'src/api/chatTypes';
import type { ChatSession } from '../../redux/types';
import './index.less';
/**
 * 文件回执行（`Chat/GetGroupFileList` / `Chat/GetUserFileList` 的 `list` 元素）。
 *
 * 【生产 → 变换 → 消费】
 * - 生产：`utils/ajax.getFileList({groupId|withUser, pageIndex, pageSize, keywords?, ...})` 返回 `{ list }`；
 * - 变换：`splitFiles` **原地**写入派生字段 `previewUrl`/`$date`/`$size`/`iconClass`/`splitTime`；
 * - 消费：`FileItem.renderFile` 读 `previewUrl`/`type`/`createAccount.fullname`/`iconClass`/`name`/`$date`；
 *   `FileItem.render` 另读 `splitTime`/`fileId`；`handlePreview` 读 `fileId`/`name`/`url`/`size`。
 *
 * 【两层分开】wire 原有字段与 `splitFiles` 写入的派生字段分组声明，不混为一层。
 * 本类型**不带根索引**：该路径没有调用方按任意键读取；`previewAttachments` 的 `options` 是
 * chat 外的未类型化入参，附件对象在调用处就地构造，不经本类型透传。
 */
export interface ChatFileItem extends ChatFileWire {
  /* ── `splitFiles` 写入的派生字段 ── */
  /** 仅 `type === 2` 时写入 */
  previewUrl?: string | undefined;
  /** `formatMsgDate(dateConvertToUserZone(time))` */
  $date?: string | undefined;
  /** `formatFileSize(size)` */
  $size?: string | undefined;
  /** `getClassNameByExt(ext)` */
  iconClass?: string | undefined;
  /** 分组标题（今天/最近七天/本月/`M月`/`YYYY年M月`） */
  splitTime?: string | undefined;
}

/** React DOM targets may be Elements or text nodes; the optional capability is read without an HTMLElement assertion. */
export interface FilePreviewTarget extends EventTarget { readonly tagName?: unknown; }
export interface FilePreviewEvent { readonly target: FilePreviewTarget; }
function fileCreatorName(account: ChatFileWire['createAccount']): string | undefined {
  return account?.fullname;
}

/** `FileItem` 的 props */
export interface FileItemProps {
  item: ChatFileItem;
  /** `2` = 图片网格布局；其余走文件行布局 */
  fileType?: number | undefined;
}

export interface FilesProps {
  session: ChatSession;
  /** 面板显隐（render 无条件读取「所有文件」入口，故必填） */
  onSetPanelVisible: (visible: boolean) => void;
}

export interface FilesState {
  files: ChatFileItem[];
  loading: boolean;
}

export const splitFiles = (list: ChatFileItem[]): ChatFileItem[] => {
  const ranges: Record<string, readonly [moment.Moment, moment.Moment]> = {};
  ranges[_l('今天')] = [moment().startOf('day'), moment().endOf('day')];
  ranges[_l('最近七天')] = [moment().subtract(6, 'days').startOf('day'), moment().endOf('day')];
  ranges[_l('本月')] = [moment().startOf('month'), moment().endOf('day')];
  const oSplit: Record<string, boolean> = {};
    list.forEach((file: ChatFileItem) => {
    if (file.type === 2) {
      file.previewUrl = `${file.url}&imageView2/0/w/100/h/100/q/90`;
    }

    file.$date = utils.formatMsgDate(dateConvertToUserZone(file.time));
    file.$size = utils.formatFileSize(file.size);
    file.iconClass = getClassNameByExt(`.${RegExpValidator.getExtOfFileName(file.name)}`);
    const fileTime = moment(file.time);
    let i;
    let sTime;
    const keys = Object.keys(ranges);

    for (i = 0; i < keys.length; i++) {
        // 擦除标记：`ranges` 的键由上方 `_l(...)` 逐个写入，循环键取自同一 `Object.keys(ranges)`，
        // 故此处两项必然存在（原 any 直接下标访问）；断言被 babel 擦除，产物与原实现字节相同。
        if (fileTime.isAfter(ranges[keys[i]!]![0]) && fileTime.isBefore(ranges[keys[i]!]![1])) {
        if (!oSplit[keys[i]!]) {
          file.splitTime = keys[i]!;
          oSplit[keys[i]!] = true;
        }

        return;
      }
    }

    if (fileTime.isAfter(moment().startOf('year'))) {
      sTime = fileTime.format('M月');
    } else {
      sTime = fileTime.format('YYYY年M月');
    }

    if (!oSplit[sTime]) {
      file.splitTime = sTime;
      oSplit[sTime] = true;
    }
  });
  return list;
};

export class FileItem extends Component<FileItemProps> {
  constructor(props: FileItemProps) {
    super(props);
  }
  handlePreview(item: ChatFileItem, event: FilePreviewEvent) {
      // 擦除标记：React 的 `target` 是 `EventTarget`，`tagName` 只在 `HTMLElement` 上；
      // 既有实现依赖真实 DOM 事件，此处按真实元素类型标注。
      if (event.target.tagName === 'A') return;
    const res = [
      {
        fileid: item.fileId,
        name: item.name,
        path: item.url,
        size: item.size,
        previewAttachmentType: 'QINIU',
      },
    ];
    previewAttachments(
      {
        attachments: res,
        callFrom: 'chat',
        hideFunctions: ['editFileName'],
      },
      {},
    );
  }
  renderFile() {
    const { item } = this.props;
    const { previewUrl, type, createAccount } = item;
    const isPicture = type === Constant.MSGTYPE_PIC;
    return (
      <div className="ChatPanel-File-item" onClick={this.handlePreview.bind(this, item)}>
        <div className={cx('thumbnail', { withBorder: isPicture })}>
          {isPicture ? <img src={previewUrl} /> : <i className={item.iconClass} />}
        </div>
        <div className="info">
          <div className="name colorPrimary" title={item.name}>
            {item.name}
          </div>
          <div className="time" title={item.$date}>
            {item.$date}
          </div>
            {/* 上传者缺失时保留空字段。 */}
            <div className="creator" title={fileCreatorName(createAccount)}>
              {fileCreatorName(createAccount)}
          </div>
        </div>
        {/* <a href={$downUrl} className="download icon-download colorPrimary" target="_blank" title={_l('下载')} /> */}
      </div>
    );
  }
  override render() {
    const { fileType, item } = this.props;

    if (fileType === 2) {
      return [
        item.splitTime ? (
          <div key="splitTime" className="splitTime">
            {item.splitTime}
          </div>
        ) : undefined,
        <div className="ChatPanel-Image-item" key={item.fileId} onClick={this.handlePreview.bind(this, item)}>
          <div className="image">
            <img src={item.previewUrl} />
          </div>
            <div className="name">{fileCreatorName(item.createAccount)}</div>
        </div>,
      ];
    } else {
      return (
        <div>
          {item.splitTime ? (
            <div>
              <div className="splitTime">{item.splitTime}</div>
              {this.renderFile()}
            </div>
          ) : (
            this.renderFile()
          )}
        </div>
      );
    }
  }
}

export default class Files extends Component<FilesProps, FilesState> {
  constructor(props: FilesProps) {
    super(props);
    this.state = {
      files: [],
      loading: true,
    };
  }
  override componentDidMount() {
    const { session } = this.props;
    ajax
      .getFileList({
        pageIndex: 1,
        pageSize: 3,
        [session.isGroup ? 'groupId' : 'withUser']: session.id,
      })
      .then(result => {
        const { list } = result;
        this.setState({
          loading: false,
          files: list && list.length ? splitFiles(list) : [],
        });
      });
  }
  override render() {
    const { loading, files } = this.state;
    const { session } = this.props;
    return (
      <div className="ChatPanel-Files ChatPanel-sessionInfo-item">
        <div className="ChatPanel-Files-hander ChatPanel-sessionInfo-hander">
          <span>{`${_l('文件')}`}</span>
          {files.length ? (
            <span
              onClick={this.props.onSetPanelVisible.bind(this, true)}
              className="ChatPanel-sessionInfo-hander-entry colorPrimary"
            >
              {_l('所有文件')}
              <i className="icon-arrow-right-border" />
            </span>
          ) : undefined}
        </div>
        <div className="ChatPanel-Files-body">
            {files.map((item: ChatFileItem, index: number) => (
            <FileItem item={item} key={item.fileId || index} />
          ))}
          {loading ? <LoadDiv size="small" /> : undefined}
          {!loading && !files.length ? (
            <div className="nodata">{session.isGroup ? _l('群组中暂无文件') : _l('该聊天中暂无文件')}</div>
          ) : undefined}
        </div>
      </div>
    );
  }
}
