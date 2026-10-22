import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import { LoadDiv, ScrollView } from 'ming-ui';
import { getClassNameByExt } from 'src/utils/common';
import RegExpValidator from 'src/utils/expression';
import * as utils from '../../utils/';
import * as ajax from '../../utils/ajax';
import { FileItem } from '../Files';
import type { ChatFileItem } from '../Files';
import type { ChatSession } from '../../redux/types';

/**
 * 文件搜索回执与格式化视图行**复用** `Files/index.tsx` 已导出的 `ChatFileItem`
 * （仓库内该形态的唯一合同；本文件不另建同形第二份）。
 *
 * 【生产/消费依据】`utils/ajax.getFileList` 回执经 `format` 原地写入
 * `$date`/`$size`/`iconClass`/`previewUrl`（`ChatFileItem` 已声明这四个派生字段），
 * 再交给 `FileItem` 渲染（读 `previewUrl`/`type`/`createAccount`/`iconClass`/`name`/`$date`/`fileId`）。
 */

export interface SearchFilesProps {
  session: ChatSession;
  /** 搜索关键词（父级 `ChatPanelSessionInfo` 的 `searchText: string` 透传） */
  searchText: string;
}

export interface SearchFilesState {
  loading: boolean;
  pageIndex: number;
  files: ChatFileItem[];
}

const format = (res: ChatFileItem[]): ChatFileItem[] => {
    // 原地在 wire 行上写入派生字段后返回（原实现即如此），故参数按 ChatFileItem 声明
    return res.map((file: ChatFileItem): ChatFileItem => {
    file.$date = utils.formatMsgDate(file.time);
    file.$size = utils.formatFileSize(file.size);
    file.iconClass = getClassNameByExt(`.${RegExpValidator.getExtOfFileName(file.name)}`);
    if (file.type === 2) {
      file.previewUrl = `${file.url}&imageView2/0/w/100/h/100/q/90`;
    }

    return file;
  });
};

export default class Files extends Component<SearchFilesProps, SearchFilesState> {
  constructor(props: SearchFilesProps) {
    super(props);
    this.state = {
      loading: false,
      pageIndex: 1,
      files: [],
    };
  }
  override componentDidMount() {
    const { searchText } = this.props;
    this.updateFiles(searchText);
  }

  override componentDidUpdate(prevProps: SearchFilesProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.searchText !== prevProps.searchText) {
        this.setState(
          {
            loading: false,
            pageIndex: 1,
            files: [],
          },
          () => {
            this.updateFiles(this.props.searchText);
          },
        );
      }
    }
  }
    updateFiles(searchText: string) {
    const { session } = this.props;
    const { loading, pageIndex, files } = this.state;

    if (loading || !pageIndex) {
      return;
    }

    this.setState({
      loading: true,
    });
    const param = {
      keywords: searchText,
      pageIndex,
      pageSize: 16,
      [session.isGroup ? 'groupId' : 'withUser']: session.id,
    };
    ajax.getFileList(param).then(result => {
      const { list } = result;
      this.setState({
        pageIndex: list && list.length >= 16 ? pageIndex + 1 : 0,
        loading: false,
        files: files.concat(format(list || [])),
      });
    });
  }
  handleScrollEnd() {
    const { searchText } = this.props;
    this.updateFiles(searchText);
  }
  override render() {
    const { files, loading } = this.state;
    return (
      <ScrollView
        className="ChatPanel-SearchPanelContent ChatPanel-SearchPanel-Files"
        onScrollEnd={this.handleScrollEnd.bind(this)}
      >
        {files.map((item, index: number) => (
          <FileItem item={item} key={item.fileId || index} />
        ))}
        <LoadDiv className={cx('loading', { Hidden: !loading })} size="small" />
        {!loading && !files.length ? (
          <div className="nodata-wrapper">
            <div className="nodata-img" />
            <p>{_l('无匹配结果')}</p>
          </div>
        ) : undefined}
      </ScrollView>
    );
  }
}
