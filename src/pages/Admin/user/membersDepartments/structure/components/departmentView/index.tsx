import React, { Fragment } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import { Tree } from 'antd';
import _ from 'lodash';
import Trigger from '@rc-component/trigger';
import { Icon, LoadDiv } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import departmentController from 'src/api/department';
import { updateCursor } from '../../actions/current';
import {
  departmentUpdate,
  expandedKeysUpdate,
  loadDepartments,
  loadUsers,
  sortDepartmentsFn,
  updateImportType,
  updateShowExport,
} from '../../actions/entities';
import { getParentsId } from '../../modules/util';
import DiaActionTree from './diaActionTree';
import './departmentTree.less';

const loop = (data, key, callback) => {
  data.forEach((item, index: number, arr) => {
    if (item.departmentId === key) {
      return callback(item, index, arr);
    }

    if (item.subDepartments) {
      return loop(item.subDepartments, key, callback);
    }
  });
};

const { DirectoryTree } = Tree;
class DepartmentTree extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      newDepartments: _.cloneDeep(props.newDepartments) || [],
      expandedKeys: props.expandedKeys || [],
      showAction: false,
      selectedKeys: !this.props.departmentId ? [] : [this.props.departmentId],
      autoExpandParent: true,
      moreIds: [],
      pageSize: 100,
      rootIsAll: false,
      moreIdLoading: '',
      height: 600,
    };
    this.timer = null;
    this.handleResize = _.throttle(() => this.getHeight(), 500);

    this.handleTreeSwitcherMouseOver = e => {
      $(e.target).closest('.ant-tree-treenode').addClass('hoverParentStyle');
    };

    this.handleTreeSwitcherMouseLeave = e => {
      $(e.target).closest('.ant-tree-treenode').removeClass('hoverParentStyle');
    };
  }

  componentDidMount() {
    this.init();
    this.lisentHover();
    window.addEventListener('resize', this.handleResize);
  }

  lisentHover() {
    $(document).on('mouseover', '.ant-tree-switcher', this.handleTreeSwitcherMouseOver);
    $(document).on('mouseleave', '.ant-tree-switcher', this.handleTreeSwitcherMouseLeave);
  }

  unBindHover() {
    $(document).off('mouseover', '.ant-tree-switcher', this.handleTreeSwitcherMouseOver);
    $(document).off('mouseleave', '.ant-tree-switcher', this.handleTreeSwitcherMouseLeave);
  }

  componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (
        !_.isEqual(prevProps.newDepartments, this.props.newDepartments) ||
        !_.isEqual(prevProps.expandedKeys, this.props.expandedKeys) ||
        prevProps.departmentId !== this.props.departmentId ||
        !this.props.departmentId
      ) {
        this.setState({
          newDepartments: _.cloneDeep(this.props.newDepartments),
          expandedKeys: this.props.expandedKeys || [],
          selectedKeys: !this.props.departmentId ? [] : [this.props.departmentId],
        });
      } else {
        this.setState({
          newDepartments: _.cloneDeep(this.props.newDepartments),
        });
      }

      if (!_.isEqual(prevProps.newDepartments, this.props.newDepartments)) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.getHeight(), 200);
      }
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
    window.removeEventListener('resize', this.handleResize);
    this.handleResize.cancel();
    this.unBindHover();
  }

  init = () => {
    const { loadDepartments = () => {}, newDepartments = [] } = this.props;

    // 从导入/导出返回时组件会重新挂载；若 Redux 中已有完整部门树（含已展开的子节点），
    // 不可再请求根级分页数据覆盖，否则会清空 subDepartments 并导致展开状态与树结构错乱。
    if (_.isEmpty(newDepartments)) {
      loadDepartments('', 1, this.getHeight);
    } else {
      this.getHeight();
    }
  };

  getHeight = () => {
    const $wrap = document.querySelector('.departmentTreeBox');
    this.setState({
      height: $wrap ? $wrap.offsetHeight - 20 : this.state.height,
    });
  };

  onDragEnter = info => {
    this.props.expandedKeysUpdate(info.expandedKeys);
  };

  onDrop = info => {
    let sortedDepartmentIds = []; //拖拽后排序
    let moveToParentId = '';
    /* 【treeData 下 info.node 就是数据节点，key / pos / expanded 直接挂在上面】
       实测（在 loadData 里打过节点）顶层字段包含 key、pos、expanded、以及 {...item}
       摊进去的部门字段。

       要说清楚的是：antd 同时还留了一个【非枚举的 .props 兼容层】（Object.keys 列不出来，
       但 node.props.eventKey 取得到），所以原来的 info.node.props.eventKey 写法
       【并没有坏】—— 这次改成直接取顶层字段是跟着 treeData 一起做的现代化，
       不是在修一个已存在的 bug，别把它当成修复记。 */
    const dropKey = info.node.key; //拖dao ID
    const dragKey = info.dragNode.key; //拖动的ID
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);
    let data = [..._.cloneDeep(this.state.newDepartments)];

    // Find dragObject
    let dragObj;
    loop(data, dragKey, (item, index: number, arr) => {
      arr.splice(index, 1);
      dragObj = item;
    });

    if (!dragObj) return;

    if (!info.dropToGap) {
      sortedDepartmentIds = [];
      // Drop on the content
      loop(data, dropKey, item => {
        item.subDepartments = item.subDepartments || [];
        // where to insert 示例添加到尾部，可以是随意位置
        item.subDepartments.unshift(dragObj);
        sortedDepartmentIds = item.subDepartments.map(it => it.departmentId);
      });
      moveToParentId = dropKey;
    } else if (
      (info.node.subDepartments || []).length > 0 && // Has children subDepartments
      info.node.expanded && // Is expanded
      dropPosition === 1 // On the bottom gap
    ) {
      sortedDepartmentIds = [];
      loop(data, dropKey, item => {
        item.subDepartments = item.subDepartments || [];
        // where to insert 示例添加到头部，可以是随意位置
        item.subDepartments.unshift(dragObj);
        sortedDepartmentIds = item.subDepartments.map(it => it.departmentId);
        moveToParentId = item.departmentId;
      });
    } else {
      sortedDepartmentIds = [];
      let ar;
      let i;
      loop(data, dropKey, (item, index: number, arr) => {
        ar = arr;
        i = index;
      });
      let list = getParentsId(data, dropKey);
      moveToParentId = list[1];
      if (dropPosition === -1) {
        ar.splice(i, 0, dragObj);
      } else {
        ar.splice(i + 1, 0, dragObj);
      }

      sortedDepartmentIds = ar.map(it => it.departmentId);
    }

    this.props.sortDepartmentsFn(data, dragKey, sortedDepartmentIds, moveToParentId, data =>
      this.setState({ newDepartments: data }),
    );
  };

  /* 【treeData 下这里收到的是数据对象，不是 React 元素】原先写的是
     `const { props = {} } = treeNode`，靠 <TreeNode {...item}> 把部门字段摊在 props 上。
     现在 antd 传进来的就是 treeData 里那个节点本身，直接用即可；
     「更多」按钮手工调用时传的也是同一形状（根级传 undefined，走下面的默认值）。 */
  /* node 标 any：treeData 里的节点是「antd 的 DataNode + 我们摊进去的部门字段」，
     没有现成类型可用；isMore 必须是可选参数，否则这个两参函数无法赋给 antd
     单参的 loadData 签名（TS2322）。 */
  loadDataFn = (node: any = {}, isMore?: boolean) => {
    const { projectId } = this.props;
    const props = node || {};
    return new Promise(resolve => {
      if (props.subDepartments && !isMore) {
        resolve();
        return;
      }

      let moreIdData = this.state.moreIds.find(o => (o.departmentId || '') === (props.departmentId || ''));
      let pageIndex = !props.departmentId && !moreIdData ? 2 : moreIdData ? moreIdData.pageIndex + 1 : 1;
      this.setState({
        moreIdLoading: props.departmentId,
      });
      departmentController
        .pagedSubDepartments({
          projectId,
          parentId: props.departmentId,
          pageIndex,
          pageSize: this.state.pageSize,
        })
        .then(data => {
          this.setState({
            moreIdLoading: '',
          });
          if (data.length >= this.state.pageSize) {
            this.setState({
              moreIds:
                pageIndex > 1 && moreIdData
                  ? this.state.moreIds.map(o => {
                      if (o.departmentId === props.departmentId) {
                        return {
                          ...o,
                          pageIndex,
                        };
                      } else {
                        return o;
                      }
                    })
                  : this.state.moreIds.concat({
                      departmentId: props.departmentId,
                      pageIndex,
                    }),
            });
          } else {
            this.setState({
              moreIds: this.state.moreIds.filter(o => o.departmentId !== props.departmentId),
              rootIsAll: !props.departmentId ? true : this.state.rootIsAll,
            });
          }

          // 原先是 props.dataRef.subDepartments —— dataRef 和 {...item} 摊进来的是同一个对象，
          // treeData 下直接从节点上取。
          let { subDepartments = [] } = props;
          subDepartments = isMore ? subDepartments.concat(data) : data;
          let list = [..._.cloneDeep(this.state.newDepartments)];

          if (!props.departmentId) {
            list = list.concat(subDepartments);
          } else {
            loop(list, props.departmentId, (item, index: number, arr) => {
              arr[index].subDepartments = subDepartments;
            });
          }

          this.props.departmentUpdate(list, subDepartments, props.departmentId);
          resolve();
        });
    });
  };

  onSelect = (selectedKeys = []) => {
    let id = selectedKeys[0];

    if (!id || id.indexOf('more_') >= 0) {
      return;
    }

    this.setState({ selectedKeys });
    this.props.updateCursor(id);
    this.props.loadUsers(id);
  };

  /* 【从 TreeNode children 迁到 treeData】antd 6 起 <Tree> 的 children 写法已废弃
     （"`children` of Tree is deprecated. Please use `treeData` instead."）。

     这次不是纯机械替换：原先 <TreeNode {...item} dataRef={item}> 把整个部门对象摊在
     节点上，而下游是从【React 元素的 props】上读回来的 ——
       onDrop      读 info.node.props.eventKey / pos / subDepartments / expanded
       loadDataFn  读 treeNode.props.departmentId / subDepartments / dataRef
       DiaActionTree 收的是 parentData.props
     换成 treeData 之后这些回调拿到的是【数据对象本身】，没有 .props 这一层，
     所以上面三处的取值口径同步改了（各自就地有注释）。
     dataRef 这个字段可以一并去掉：它和 {...item} 摊进来的是同一个对象。 */
  getTreeData = (data, hasMore?, parentItem?) => {
    const { expandedKeys, showDisabledDepartment, hasDepartmentAuth } = this.props;
    const { showAction } = this.state;

    let htmlDiv = () => {
      // 原先是在 map 里 return null，靠 React 忽略空子元素；treeData 是纯数据，
      // 必须先过滤掉，否则数组里会混进 null。
      return data
        .filter(item => !(item.disabled && !showDisabledDepartment))
        .map(item => {
          const subDepartments = item.subDepartments || [];

          return {
            ...item,
            // item.disabled 的含义是「部门被停用」，不是 antd 的「节点不可选」。
            // 原实现就是 disabled={false} + 另起一个 disabledDepartment，这里保持，
            // draggable / allowDrop 两个回调读的正是 disabledDepartment。
            disabled: false,
            disabledDepartment: item.disabled,
            key: item.departmentId,
            title: (
              <React.Fragment>
                <span className="departmentName WordBreak">
                  <Tooltip title={item.departmentName}>
                    <span className="InlineBlock wMax100 ellipsis">{item.departmentName}</span>
                  </Tooltip>
                  <Trigger
                    action={['click']}
                    popupVisible={showAction && item.departmentId === this.props.cursor}
                    onPopupVisibleChange={visible => this.setState({ showAction: visible })}
                    popupAlign={{ points: ['tl', 'br'], overflow: { adjustX: true, adjustY: true } }}
                    popup={
                      <DiaActionTree
                        item={item}
                        /* 原先传的是 parentData.props（父节点那个 React 元素的 props）。
                           treeData 下父级就是数据对象本身，直接传。
                           DiaActionTree 只读它的 departmentId，形状对得上。 */
                        parentData={parentItem}
                        onClickAwayExceptions={[]}
                        closeAction={() => this.setState({ showAction: false })}
                        hasDepartmentAuth={hasDepartmentAuth}
                      />
                    }
                  >
                    <span
                      className="departmentAction"
                      onClick={e => {
                        localStorage.removeItem('columnsInfoData');
                        //当前departmentId===选中departmentId，阻止冒泡
                        if (item.departmentId === this.props.cursor) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      <Icon className="Font20 textTertiary treeNodeIcon" icon="moreop" />
                    </span>
                  </Trigger>
                </span>
              </React.Fragment>
            ),
            icon: (
              <Icon
                icon={item.disabled ? 'folder_off' : 'folder'}
                className={`Font16 textTertiary treeNodeIcon ${item.disabled ? 'disabledDepartmentIcon' : ''}`}
              />
            ),
            isLeaf: _.includes(expandedKeys, item.departmentId)
              ? !subDepartments.length
              : !item.haveSubDepartment && !subDepartments.length,
            // 没有子部门时【不能给 children: []】—— 空数组会让 antd 当成「已展开且为空」，
            // 与原来「不渲染子元素」的语义不同。保持 undefined。
            children: subDepartments.length
              ? this.getTreeData(
                  item.subDepartments,
                  this.state.moreIds.map(o => o.departmentId).includes(item.departmentId),
                  item,
                )
              : undefined,
          };
        });
    };

    const nodes = htmlDiv();

    /* 「更多 / 加载中」是混在同一层里的合成节点，key 仍沿用 more_<departmentId>，
       onSelect 里那句 id.indexOf('more_') 的短路判断才继续有效。 */
    if (
      (!this.props.searchValue && hasMore) ||
      (!parentItem && data.length >= this.state.pageSize && !this.state.rootIsAll)
    ) {
      nodes.push({
        key: `more_${_.get(parentItem, 'departmentId') || 'all'}`,
        isLeaf: true,
        icon: (
          <div className="mTop5 moreListIcon">
            {this.state.moreIdLoading && _.get(parentItem, 'departmentId') && <LoadDiv size="small" />}
          </div>
        ),
        title: (
          <div
            className="moreList Hand mLeft10"
            onClick={e => {
              e.stopPropagation();
              this.loadDataFn(parentItem, true);
            }}
          >
            {this.state.moreIdLoading === _.get(parentItem, 'departmentId') ? _l('加载中') : _l('更多')}
          </div>
        ),
      });
    }

    return nodes;
  };

  onExpand = expandedKeys => {
    this.props.expandedKeysUpdate(expandedKeys);
    this.setState({
      autoExpandParent: false,
    });
  };

  render() {
    const { hasDepartmentAuth } = this.props;
    const { newDepartments, expandedKeys, selectedKeys, autoExpandParent, height } = this.state;

    if (_.isEmpty(newDepartments)) {
      return (
        <div className="textTertiary Font13 mLeft24 mTop16">
          {_l('暂无部门')}
          {hasDepartmentAuth && (
            <Fragment>
              <span>{_l('，可')}</span>
              <span
                className="Hand mLeft3"
                style={{ color: 'var(--color-primary)' }}
                onClick={() => {
                  this.props.updateShowExport(true);
                  this.props.updateImportType('importDepartment');
                }}
              >
                {_l('批量导入')}
              </span>
            </Fragment>
          )}
        </div>
      );
    }

    return (
      <div className="departmentTreeBox">
        <DirectoryTree
          onExpand={this.onExpand}
          selectedKeys={selectedKeys}
          expandAction={false}
          selectable
          onSelect={this.onSelect}
          showIcon={true}
          className="departmentsTree"
          expandedKeys={expandedKeys} //（受控）展开指定的树节点
          loadedKeys={expandedKeys} //已经加载的节点，需要配合 loadData 使用
          autoExpandParent={autoExpandParent} //是否自动展开父节点
          /* 这两个回调拿到的是 treeData 的节点；disabledDepartment 是我们自己加的字段，
             不在 antd 的 DataNode 类型里，所以标 any。 */
          draggable={(node: any) => !node.disabledDepartment && hasDepartmentAuth}
          blockNode
          onDragEnter={this.onDragEnter}
          allowDrop={({ dropNode }: any) => !dropNode.disabledDepartment}
          onDrop={this.onDrop}
          loadData={this.loadDataFn}
          height={height}
          treeData={this.getTreeData(newDepartments)}
        />
      </div>
    );
  }
}

const mapStateToProps = (state, ownProps) => {
  const {
    current: { departmentId, projectId },
    pagination: { userList },
    entities: { departments = [], newDepartments = [], expandedKeys = [], showDisabledDepartment },
    search: { searchValue },
  } = state;
  const department = departments[ownProps.id];
  const subDepartments = _.filter(departments, dept => dept.parentDepartment === ownProps.id);
  return {
    ...department,
    ...ownProps,
    subDepartments: _.map(subDepartments, dept => dept.departmentId),
    cursor: departmentId,
    departmentId,
    projectId,
    pageIndex: userList && userList.pageIndex,
    newDepartments: newDepartments,
    expandedKeys,
    searchValue,
    showDisabledDepartment,
  };
};

const ConnectedNode = connect(mapStateToProps, {
  loadDepartments,
  loadUsers,
  departmentUpdate,
  expandedKeysUpdate,
  updateShowExport,
  updateImportType,
  updateCursor,
  sortDepartmentsFn,
})(DepartmentTree);

export default ConnectedNode;
