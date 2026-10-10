import { Component } from 'react';
import type { MouseEvent } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Checkbox, LoadDiv, Radio } from 'ming-ui';
import type { DepartmentListProps, SelectDepartment } from './types';
import './css/department.less';

const Wrap = styled.div`
  .onlySelf {
    display: none;
  }
  &:hover {
    .onlySelf {
      display: inline-block;
    }
  }
`;

export default class DepartmentList extends Component<DepartmentListProps> {
  static override propTypes = {
    selectedDepartment: PropTypes.array,
    toogleDepargmentSelect: PropTypes.func,
    onChangeSelectedOnly: PropTypes.func,
    toggleDepartmentList: PropTypes.func,
    data: PropTypes.array,
    keywords: PropTypes.string,
    showUserCount: PropTypes.bool,
    checkIncludeChilren: PropTypes.bool,
    unique: PropTypes.bool,
  };
  getParentId = (list: SelectDepartment[], id: string): SelectDepartment[] | undefined => {
    for (const department of list) {
      if (department.departmentId == id) {
        return [department];
      }

      if (department.subDepartments) {
        let node = this.getParentId(department.subDepartments, id);

        if (node !== undefined) {
          return node.concat(department);
        }
      }
    }
    return undefined;
  };
  getIsIncludesByParent = (department: SelectDepartment) => {
    let list = (this.getParentId(this.props.treeData || this.props.data, department.departmentId) || []).map(
      o => o.departmentId,
    );
    let isIncludesByParent = this.props.selectedDepartment.filter(
      o =>
        (list.includes(o.departmentId) || o.departmentId.indexOf('orgs_') > -1) &&
        o.checkIncludeChilren &&
        o.departmentId !== department.departmentId,
    );
    return !!isIncludesByParent.length;
  };
  getChecked = (department: SelectDepartment) => {
    let selectedDepartmentData = this.props.selectedDepartment.filter(
      item => item.departmentId === department.departmentId,
    );
    return (
      !!selectedDepartmentData.length || (!!this.props.checkIncludeChilren && this.getIsIncludesByParent(department))
    );
  };
  getDisable = (department: SelectDepartment) => {
    return this.props.checkIncludeChilren && this.getIsIncludesByParent(department);
  };
  override render() {
    const { activeIds = [] } = this.props;
    let departments = this.props.data;

    if (departments && departments.length) {
      return (
        <div className="GSelect-departmentList">
          {departments.map((department, index: number) => {
            return (
              <Department
                data={this.props.data}
                active={_.includes(activeIds, department.departmentId)}
                key={department.departmentId + index}
                department={department}
                selectedDepartment={this.props.selectedDepartment}
                toogleDepargmentSelect={this.props.toogleDepargmentSelect}
                onChangeSelectedOnly={this.props.onChangeSelectedOnly}
                toggleDepartmentList={this.props.toggleDepartmentList}
                checked={this.getChecked(department)}
                isIncludesByParent={this.getIsIncludesByParent(department)}
                keywords={this.props.keywords}
                showUserCount={this.props.showUserCount}
                unique={this.props.unique}
                departmentMoreIds={this.props.departmentMoreIds}
                treeData={this.props.treeData}
                checkIncludeChilren={this.props.checkIncludeChilren}
              />
            );
          })}
        </div>
      );
    }

    return null;
  }
}

class Department extends Component<
  DepartmentListProps & {
    department: SelectDepartment;
    active?: boolean | undefined;
    checked: boolean;
    isIncludesByParent: boolean;
  },
  { moreIdLoading: string | undefined }
> {
  static defaultProps = {
    showUserCount: true,
  };
  static override propTypes = {
    toogleDepargmentSelect: PropTypes.func,
    toggleDepartmentList: PropTypes.func,
    selectedDepartment: PropTypes.array,
    checked: PropTypes.bool,
    department: PropTypes.object,
    showUserCount: PropTypes.bool,
    unique: PropTypes.bool,
    checkIncludeChilren: PropTypes.bool,
    onChangeSelectedOnly: PropTypes.func,
  };
  constructor(props: Department['props']) {
    super(props);
    this.state = {
      moreIdLoading: '',
    };
  }

  override componentDidUpdate(prevProps: Department['props']) {
    if (!shallowEqual(prevProps, this.props)) {
      if (!_.isEqual(prevProps.departmentMoreIds, this.props.departmentMoreIds)) {
        this.setState({
          moreIdLoading: '',
        });
      }
    }
  }

  toogleDepargmentSelect = (event: MouseEvent) => {
    const {
      department: { disabled },
    } = this.props;
    event.stopPropagation();
    if (!disabled) {
      this.props.toogleDepargmentSelect(this.props.department);
    }
    // if (!open) {
    //   this.props.toggleDepartmentList(departmentId);
    // }
  };

  toggleDepartmentList = (event: MouseEvent) => {
    event.stopPropagation();
    this.props.toggleDepartmentList(this.props.department.departmentId);
  };
  override render() {
    const { moreIdLoading } = this.state;
    let { active, department, checked, keywords, isIncludesByParent, checkIncludeChilren } = this.props;
    let { haveSubDepartment, subDepartments = [], disabled, open, departmentName } = department;
    disabled = disabled || isIncludesByParent;
    let name = departmentName;
    let nameArr = [name];

    if (this.props.keywords) {
      let mt = name.match(keywords || '');
      let len = (keywords || '').length;

      if (mt) {
        nameArr = [];
        while (mt) {
          nameArr.push(name.slice(0, mt.index || 0));
          nameArr.push(name.slice(mt.index || 0, (mt.index || 0) + len));
          name = name.slice((mt.index || 0) + len);
          mt = name.match(keywords || '');
        }

        if (name) {
          nameArr.push(name);
        }
      }
    }

    return (
      <div className="GSelect-department">
        <div
          className={cx('GSelect-department-row flexRow', active ? 'focused' : '')}
          onClick={this.toggleDepartmentList}
        >
          <div
            className={cx('GSelect-arrow', {
              'GSelect-arrow--transparent': !haveSubDepartment,
              pointer: haveSubDepartment,
            })}
          >
            <i
              className={cx(
                'GSelect-arrow__arrowIcon',
                department.open ? 'GSelect-arrow__arrowIcon--open' : 'GSelect-arrow__arrowIcon--close',
              )}
            />
          </div>
          <Wrap
            className="flex flexRow GSelect-department-box pointer"
            onClick={(department: MouseEvent) => {
              if (disabled) {
                return;
              }

              this.toogleDepargmentSelect(department);
            }}
          >
            {this.props.unique ? (
              <Radio disabled={disabled} className="GSelect-department--checkbox" checked={checked} />
            ) : (
              <Checkbox
                disabled={disabled}
                className="GSelect-department--checkbox"
                styleType={
                  checked &&
                  checkIncludeChilren &&
                  !this.props.selectedDepartment.find(o => o.departmentId === department.departmentId)
                    ?.checkIncludeChilren
                    ? 'light'
                    : undefined
                }
                checked={checked}
              />
            )}
            <div className={cx('GSelect-department__name overflow_ellipsis')}>
              {nameArr.map((item, index) => {
                if (item === keywords) {
                  return (
                    <span key={item + index} className="GSelect-department__name--hightlight">
                      {item}
                    </span>
                  );
                }

                return <span key={item + index}>{item}</span>;
              })}
            </div>
            {this.props.showUserCount ? (
              <div className={cx('GSelect-department__count')}>{`（${department.userCount}人）`}</div>
            ) : null}
            {checkIncludeChilren && !disabled && (
              <span
                className="Hand onlySelf colorPrimary pRight5"
                onClick={e => {
                  e.stopPropagation();
                  this.props.onChangeSelectedOnly?.(department);
                }}
              >
                {_l('仅当前部门')}
              </span>
            )}
          </Wrap>
        </div>
        {!haveSubDepartment || !open ? null : (
          <DepartmentList
            selectedDepartment={this.props.selectedDepartment}
            onChangeSelectedOnly={this.props.onChangeSelectedOnly}
            toogleDepargmentSelect={this.props.toogleDepargmentSelect}
            toggleDepartmentList={this.props.toggleDepartmentList}
            data={subDepartments}
            checkIncludeChilren={this.props.checkIncludeChilren}
            keywords={this.props.keywords}
            showUserCount={this.props.showUserCount}
            unique={this.props.unique}
            departmentMoreIds={this.props.departmentMoreIds}
            treeData={this.props.treeData}
          />
        )}
        {open &&
        subDepartments[0]?.parentId &&
        (this.props.departmentMoreIds || []).find(o => o.departmentId === subDepartments[0]?.parentId) ? (
          <span
            className="mLeft60 Hand moreBtn"
            onClick={() => {
              safeLocalStorageSetItem('parentId', subDepartments[0]?.parentId || '');
              this.props.toggleDepartmentList(subDepartments[0]?.parentId || '');
              this.setState({
                moreIdLoading: subDepartments[0]?.parentId || '',
              });
            }}
          >
            {moreIdLoading === subDepartments[0]?.parentId && <LoadDiv size="small" />}
            {moreIdLoading === subDepartments[0]?.parentId ? _l('加载中') : _l('更多')}
          </span>
        ) : (
          ''
        )}
      </div>
    );
  }
}
