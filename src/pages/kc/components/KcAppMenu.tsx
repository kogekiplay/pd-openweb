/* 更多操作下拉项*/
import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import ClickAway from 'ming-ui/components/ClickAway';
import Icon from 'ming-ui/components/Icon';
import Menu from 'ming-ui/components/Menu';
import MenuItem from 'ming-ui/components/MenuItem';
import { NODE_OPERATOR_TYPE, NODE_STATUS, NODE_TYPE, NODE_VIEW_TYPE } from '../constant/enum';
import UploadNewVersion from './UploadNewVersion';

/** 节点（文件夹 / 文件）来自接口；这里只列出菜单读到的字段，其余原样带着 */
interface KcMenuNode {
  /** NODE_TYPE */
  type: number;
  /** NODE_VIEW_TYPE */
  viewType: number;
  isStared?: boolean | undefined;
  canEdit?: boolean | undefined;
  isAdmin?: boolean | undefined;
  canDownload?: boolean | undefined;
  rootId?: string | undefined;
  [key: string]: unknown;
}

interface KcAppMenuProps {
  item: KcMenuNode;
  /** 参数是 NODE_STATUS */
  removeNode: (status: number) => void;
  /** 第一个参数是 NODE_OPERATOR_TYPE；移动时非管理员限定在本根目录下 */
  moveOrCopyClick: (type: number, rootId?: string | null) => void;
  updateNodeName: (item: KcMenuNode) => void;
  /** 上传新版本成功后的回调，原样交给 UploadNewVersion（参数是接口返回的新节点） */
  updateNodeItem?: ((data: ApiPayload) => void) | undefined;
  onShareNode: (item: KcMenuNode) => void;
  onStarNode: (item: KcMenuNode) => void;
  download: (item: KcMenuNode) => void;
  permission?: number | undefined;
  onAddLinkFile: (isEdit: boolean, item: KcMenuNode) => void;
  isCreateUser?: boolean | undefined;
  isList?: boolean | undefined;
  onClickAway?: (() => void) | undefined;
  /** 交给 Menu 的定位容器选择器 */
  con?: string | undefined;
  showDetail?: (() => void) | undefined;
  // ClickAway.wrap 包出来的组件还收 onClickAwayExceptions 等
  [key: string]: unknown;
}

let KcAppMenu = class KcAppMenu extends React.Component<KcAppMenuProps> {
  static override propTypes = {
    item: PropTypes.object,
    removeNode: PropTypes.func,
    moveOrCopyClick: PropTypes.func,
    updateNodeName: PropTypes.func,
    updateNodeItem: PropTypes.func,
    onShareNode: PropTypes.func,
    onStarNode: PropTypes.func,
    download: PropTypes.func,
    permission: PropTypes.number,
    onAddLinkFile: PropTypes.func,
  };

  override render() {
    const item = this.props.item;
    const isFolder = item.type === NODE_TYPE.FOLDER;
    const isUrl = item.viewType === NODE_VIEW_TYPE.LINK;
    const isStared = item.isStared;
    const canEdit = item.canEdit;
    const isAdmin = item.isAdmin;
    const isCreateUser = this.props.isCreateUser;
    const isList = this.props.isList || false;
    const isMulti = false;
    return (
      <Menu onClick={this.props.onClickAway} con={this.props.con}>
        {!isFolder && !isMulti && isUrl && canEdit && (
          <MenuItem icon={<Icon icon="edit" />} onClick={() => this.props.onAddLinkFile(true, item)}>
            {_l('编辑')}
          </MenuItem>
        )}
        {!isList && (isAdmin || (canEdit && item.canDownload) || item.canDownload || isMulti) && (
          <MenuItem icon={<Icon icon="kc-hover-download" />} onClick={() => this.props.download(item)}>
            {_l('下载')}
          </MenuItem>
        )}
        <MenuItem
          className={cx('menuLine', {
            hide: isList,
          })}
        />
        <MenuItem
          icon={<Icon icon="task-star" />}
          className={cx({
            hide: isFolder || isMulti,
          })}
          onClick={() => this.props.onStarNode(item)}
        >
          {isStared ? _l('取消标星') : _l('标星')}
        </MenuItem>
        <MenuItem
          icon={<Icon icon="calendar-task" />}
          className={cx({
            hide: isMulti || isList,
          })}
          onClick={() => this.props.onShareNode(item)}
        >
          {_l('分享')}
        </MenuItem>
        <MenuItem
          className={cx('menuLine', {
            hide: isFolder || isMulti,
          })}
        />
        {(isAdmin || canEdit) && (
          <MenuItem
            icon={<Icon icon="edit" />}
            className={cx({
              hide: isMulti,
            })}
            onClick={() => this.props.updateNodeName(item)}
          >
            {_l('重命名')}
          </MenuItem>
        )}
        {!isUrl && (isAdmin || canEdit) && (
          <MenuItem
            icon={<Icon icon="attachment" />}
            className={cx({
              hide: isFolder || isMulti,
            })}
          >
            <span>
              {_l('上传新版本')}
              <UploadNewVersion item={this.props.item} callback={this.props.updateNodeItem} />
            </span>
          </MenuItem>
        )}
        {canEdit && (
          <MenuItem
            icon={<Icon icon="task-replace" />}
            onClick={() => this.props.moveOrCopyClick(NODE_OPERATOR_TYPE.MOVE, isAdmin ? null : item.rootId)}
          >
            {_l('移动到…')}
          </MenuItem>
        )}
        {(isAdmin || (canEdit && item.canDownload) || item.canDownload || isMulti) && (
          <MenuItem
            icon={<Icon icon="knowledge-more-folder" />}
            onClick={() => this.props.moveOrCopyClick(NODE_OPERATOR_TYPE.COPY)}
          >
            {_l('复制到…')}
          </MenuItem>
        )}
        {(isAdmin || (isCreateUser && canEdit) || isMulti) && (
          <MenuItem icon={<Icon icon="trash" />} onClick={() => this.props.removeNode(NODE_STATUS.RECYCLED)}>
            {_l('删除')}
          </MenuItem>
        )}
        <MenuItem icon={<Icon icon="info" />} onClick={this.props.showDetail}>
          {_l('属性')}
        </MenuItem>
      </Menu>
    );
  }
};
KcAppMenu = ClickAway.wrap(KcAppMenu);
export default KcAppMenu;
