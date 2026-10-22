import React, { Fragment } from 'react';
import type { MouseEvent } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, LoadDiv, ScrollView } from 'ming-ui';
import departmentController from 'src/api/department';
import type { DepartmentNode } from '../types';

const DepartmentTreeWrapper = styled.div`
  border-right: 1px solid var(--color-background-disabled);
  height: 100%;
  .subs {
    margin-left: 10px;
  }
`;

const Department = styled.div`
  width: 100%;
  padding: var(--space-1);
  &:hover {
    background-color: var(--color-background-hover);
  }
  &.active {
    background-color: var(--color-primary-transparent);
    .icon,
    div {
      color: var(--color-primary) !important;
    }
  }
  .iconArrow {
    display: flex;
    padding: 7px 0px 5px 2px;
    border-radius: var(--radius-sm);
    &:hover {
      background-color: var(--color-background-hover);
    }
  }
`;


/** 父容器（`ProjectContacts`）传入的 props */
interface ProjectContactListProps {
  /** 父容器传入但本组件未消费的字段（保留以匹配调用方） */
  selectedAccountId?: unknown;
  list?: unknown;
  /**
   * 历史 prop 名：父容器实际传的是 `list`，本组件却在 `renderListContent` 里读 `department`，
   * 运行期恒为 undefined（走 `= []` 默认值）；如实声明，不改调用方也不改行为。
   */
  department?: DepartmentNode[];
  isLoading: boolean;
  loadNextPage: () => void;
  departmentLoading?: boolean | undefined;
  isMore?: boolean | undefined;
  departmentsList?: DepartmentNode[] | undefined;
  projectId?: string | null | undefined;
  groupId?: string | undefined;
  selectCurrentDepartment: (id: string, name: string) => void;
}

interface ProjectContactListState {
  selects: (string | null | undefined)[];
  department: DepartmentNode[] | undefined;
  departmentLoading: boolean | undefined;
}

export default class ProjectContactList extends React.Component<ProjectContactListProps, ProjectContactListState> {
  constructor(props: ProjectContactListProps) {
    super(props);
    const project = _.find(md.global.Account.projects, { projectId: props.projectId });
    this.state = {
      selects: [project.projectId],
      // 擦除标记：父容器首屏可能还没拉到部门列表（state 里按数组使用，原 any 直接赋）。
      department: props.departmentsList,
      departmentLoading: false,
    };
  }

  override componentDidUpdate(prevProps: ProjectContactListProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (!_.isEqual(prevProps.departmentsList, this.props.departmentsList)) {
        this.setState({
          // 擦除标记：该分支只在父容器已给出 departmentsList/projectId 后进入（原 any 直接赋）。
          department: this.props.departmentsList,
          selects: [this.props.projectId],
        });
      }

      if (!_.isEqual(prevProps.departmentLoading, this.props.departmentLoading)) {
        this.setState({
          departmentLoading: this.props.departmentLoading,
        });
      }
    }
  }

  renderListContent() {
    const { department = [], isLoading } = this.props;
    if (!department.length && isLoading) return <LoadDiv className="mTop10" />;
    return <React.Fragment>{this.renderDepartmentTree()}</React.Fragment>;
  }

  updateTreeData = (list: DepartmentNode[], key: string | undefined, subs: DepartmentNode[]): DepartmentNode[] => {
    return list.map((node: DepartmentNode) => {
      if (node.departmentId === key) {
        return { ...node, subs };
      }

      if (node.subs) {
        return { ...node, subs: this.updateTreeData(node.subs, key, subs) };
      }

      return node;
    });
  };

  expandNext = (id: string | undefined) => {
    const { projectId } = this.props;
    let { department } = this.state;
    this.setState({ departmentLoading: true });
    departmentController
      .pagedDepartmentTrees({
        projectId,
        pageIndex: 1,
        pageSize: 100,
        parentId: id,
      })
      .then((res: DepartmentNode[]) => {
        let data = (res ?? []).map((item: DepartmentNode) => ({ ...item, subs: [] }));
        this.setState({ department: this.updateTreeData(department!, id, data), departmentLoading: false });
      });
  };

  renderDepartment(item: DepartmentNode) {
    const { groupId = '' } = this.props;
    const { selects } = this.state;
    const subVisible = selects.includes(item.departmentId);
    return (
      <Fragment key={item.departmentId}>
        <Department
          className={cx('flexRow valignWrapper pointer', { active: groupId === item.departmentId })}
          onClick={() => {
            // 擦除标记：渲染出的部门节点必带 id/name（原 any 直接传）。
            this.props.selectCurrentDepartment(item.departmentId as string, item.departmentName as string);
          }}
        >
          <Icon
            icon={subVisible ? 'arrow-down' : 'arrow-right-tip'}
            className={cx('textSecondary iconArrow', { Visibility: !item.haveSubDepartment })}
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              this.expandNext(item.departmentId);
              const { selects } = this.state;

              if (selects.includes(item.departmentId)) {
                this.setState({
                  selects: selects.filter((id: string | null | undefined) => id !== item.departmentId),
                });
              } else {
                this.setState({
                  selects: selects.concat(item.departmentId),
                });
              }
            }}
          />
          <Icon className="textTertiary Font16 mLeft2 mRight5" icon="folder" />
          <div className="ellipsis Font13">{item.departmentName}</div>
        </Department>
        {/* 擦除标记：展开的节点才有 `subs`（原 any 直接 map）；缺省时原实现抛原生 TypeError。 */}
        {subVisible && <div className="subs">{item.subs!.map((item: DepartmentNode) => this.renderDepartment(item))}</div>}
      </Fragment>
    );
  }

  renderDepartmentTree() {
    const { projectId } = this.props;
    const { department = [], departmentLoading } = this.state;
    const project = _.find(md.global.Account.projects, { projectId });
    return (
      <DepartmentTreeWrapper>
        <ScrollView
          className="h100 asdsad"
          onScrollEnd={() => {
            if (!departmentLoading && this.props.isMore) {
              this.props.loadNextPage();
            }
          }}
        >
          {this.renderDepartment({
            departmentId: project.projectId,
            departmentName: project.companyName,
            subs: department.length ? department : [],
            haveSubDepartment: department.length ? true : false,
          })}
          {departmentLoading && <LoadDiv />}
        </ScrollView>
      </DepartmentTreeWrapper>
    );
  }
  onScrollEnd = () => {};

  override render() {
    return <div className="h100">{this.renderListContent()}</div>;
  }
}
