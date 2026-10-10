import React, { useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useSetState } from 'react-use';
import { useClickAway } from 'react-use';
import cx from 'classnames';
import _ from 'lodash';
import { Icon, LoadDiv, ScrollView } from 'ming-ui';
import NoData from 'ming-ui/functions/dialogSelectUser/GeneralSelect/NoData';
import { checkPermission } from 'src/components/checkPermission';
import { PERMISSION_ENUM } from 'src/pages/Admin/enum';
import styled from 'src/utils/typedStyled';
import dialogSelectDept from '../dialogSelectDept';
import {
  departmentTree as decodeTree,
  departmentChoices,
  rangeId,
  requestDepartments,
  requestIds,
  rootResult,
} from '../dialogSelectDept/boundary';
import type { DepartmentChoice, DepartmentRequest, DepartmentTree } from '../dialogSelectDept/types';
import type { AbortableRequest } from '../dialogSelectUser/GeneralSelect/types';
import type { QuickDepartmentHandle, QuickDepartmentOptions, QuickDepartmentState } from './types';

const PAGE_SIZE = 100;

const DeptSelectWrap = styled.div`
  overflow: hidden;
  width: 360px;
  background-color: var(--color-background-card);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  .searchRoleWrap {
    padding: 0 var(--space-4);
    line-height: 40px;
    height: 40px;
    border-bottom: 1px solid var(--color-border-secondary);
    overflow: hidden;
    input {
      outline: none;
      border: none;
      margin-right: var(--space-3);
    }
  }
  .selectDepartmentContent {
    padding: var(--space-1) var(--space-2);
    .quick-department {
      height: 36px;
      display: flex;
      align-items: center;
      padding: 0 var(--space-1);
      box-sizing: border-box;
      border-radius: var(--radius-sm);
      &.active {
        .quick-department_content {
          background: color-mix(in srgb, var(--color-primary) 10%, transparent) !important;
        }
      }
      .rotateDept {
        transform: rotate(-90deg);
      }
      .expendWrap {
        width: 20px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 2px;
        border-radius: var(--radius-sm);
        &:hover {
          background: var(--color-background-hover);
        }
        &.transparent {
          opacity: 0;
        }
      }
      .quick-department_content {
        height: 100%;
        border-radius: var(--radius-sm);
        &:hover {
          background: var(--color-background-hover);
        }
      }
    }
  }
`;

const getDepartmentTree = (data: DepartmentTree[], parentId?: string): DepartmentTree[] => {
  return data.map(item => {
    let { departmentId, departmentName, userCount, haveSubDepartment, subDepartments = [] } = item;
    return {
      departmentId,
      departmentName,
      userCount,
      haveSubDepartment,
      open: subDepartments.length > 0,
      subDepartments,
      parentId,
    };
  });
};

export function DeptSelect(props: QuickDepartmentOptions) {
  const {
    projectId = '',
    unique = true,
    fromAdmin = false,
    isAnalysis,
    returnCount,
    checkIncludeChilren = false,
    minHeight = 358,
    allPath,
    departrangetype = '0',
    appointedDepartmentIds = [],
    appointedUserIds = [],
    immediate = true,
    onClose = () => {},
    selectFn = () => {},
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const conRef = useRef<HTMLDivElement>(null);
  const [
    {
      loading,
      keywords,
      selectedDepartment,
      departmentMoreIds,
      list,
      rootPageIndex,
      rootPageAll,
      rootLoading,
      allList,
      loadError,
    },
    setState,
  ] = useSetState<QuickDepartmentState>({
    rootPageIndex: 1,
    rootPageAll: false,
    rootLoading: false,
    loading: true,
    keywords: '',
    selectedDepartment: departmentChoices(props.selectedDepartment || []),
    departmentMoreIds: [],
    showProjectAll: false,
    activeIds: [],
    activeIndex: 0,
  });

  const projectInfo =
    ((md.global.Account.projects || []).filter(project => project.projectId === props.projectId).length &&
      md.global.Account.projects.filter(project => project.projectId === props.projectId)[0]) ||
    {};
  const promiseRef = useRef<AbortableRequest<unknown> | null>(null);
  const versionRef = useRef(0);
  const mounted = useRef(true);
  const childRequests = useRef(new Set<AbortableRequest<unknown>>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      versionRef.current++;
      promiseRef.current?.abort?.();
      childRequests.current.forEach(request => request.abort?.());
    };
  }, []);

  useClickAway(conRef, () => {
    onSelect();
    onClose(true);
  });

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    debouncedSearch();

    return () => {
      debouncedSearch.cancel();
    };
  }, [keywords]);

  useEffect(() => {
    if (!rootLoading) return;
    fetchData();
  }, [rootLoading]);

  const getDepartmentPath = (dept: DepartmentChoice) => {
    const pathData = getParentId(list, dept.departmentId) || [];

    return pathData
      .filter(item => item.departmentId !== dept.departmentId)
      .map((item, index: number) => ({
        departmentId: item.departmentId,
        departmentName: item.departmentName,
        depth: index + 1,
      }));
  };

  const onSelect = (value?: DepartmentChoice[]) => {
    const selected = value || selectedDepartment;
    selectFn.call(
      null,
      _.map(
        selected.filter(o => !o.checkIncludeChilren || o.departmentId.indexOf('orgs_') > -1),
        dept => ({
          departmentId: dept.departmentId,
          departmentName: dept.departmentName,
          haveSubDepartment: dept.haveSubDepartment,
          userCount: dept.userCount,
          ...(allPath ? { departmentPath: getDepartmentPath(dept) } : {}),
        }),
      ),
      checkIncludeChilren
        ? _.map(
            selected.filter(o => o.checkIncludeChilren && o.departmentId.indexOf('orgs_') < 0),
            dept => ({
              departmentId: dept.departmentId,
              departmentName: dept.departmentName,
              haveSubDepartment: dept.haveSubDepartment,
              userCount: dept.userCount,
              ...(allPath ? { departmentPath: getDepartmentPath(dept) } : {}),
            }),
          )
        : null,
    );
  };

  const getSearchDepartmentTree = (data: DepartmentTree[]): DepartmentTree[] => {
    return data.map(item => {
      let { departmentId, departmentName, userCount, haveSubDepartment, subDepartments = [] } = item;

      if (subDepartments.length) {
        subDepartments = getSearchDepartmentTree(subDepartments);
      }

      return {
        departmentId,
        departmentName,
        userCount,
        haveSubDepartment,
        open: subDepartments && subDepartments.length,
        subDepartments,
      };
    });
  };

  const fetchData = () => {
    const version = ++versionRef.current;
    setState({ loading: true, loadError: false });
    const isAdmin = projectId && checkPermission(projectId, PERMISSION_ENUM.DEPARTMENT) && fromAdmin;

    promiseRef.current?.abort?.();

    let getTree;

    if (keywords) {
      getTree = getSearchDepartmentTree;
    } else {
      getTree = getDepartmentTree;
    }

    let param: DepartmentRequest = {
      projectId: projectId,
      returnCount: returnCount,
      [isAnalysis && departrangetype === '0' ? 'keyword' : 'keywords']: keywords.trim(),
      includeDisabled: false,
    };
    let usePageDepartment = !keywords;

    if (usePageDepartment) {
      param.pageIndex = rootPageIndex;
      param.pageSize = PAGE_SIZE;
    }

    try {
      if (departrangetype !== '0') {
        param.appointedDepartmentIds = requestIds(appointedDepartmentIds);
        param.appointedUserIds = requestIds(appointedUserIds);
        param.rangeTypeId = rangeId(departrangetype);
      }
    } catch {
      setState({ loading: false, rootLoading: false, loadError: true });
      return Promise.resolve();
    }

    promiseRef.current = requestDepartments(
      departrangetype !== '0'
        ? 'appointedDepartment'
        : isAnalysis && isAdmin
          ? 'pagedProjectDepartmentTrees'
          : isAnalysis
            ? 'pagedDepartmentTrees'
            : isAdmin
              ? 'searchProjectDepartment2'
              : 'searchDepartment2',
      param,
    );
    return promiseRef.current
      .then((response: unknown) => {
        if (!mounted.current || version !== versionRef.current) return;
        const { departments: data, showProjectAll } = rootResult(
          response,
          !(isAnalysis || departrangetype !== '0' || isAdmin),
        );
        if (usePageDepartment && rootPageIndex > 1 && !list) throw new TypeError('Missing paged departments');

        let _list = !usePageDepartment
          ? getTree(data)
          : usePageDepartment && rootPageIndex <= 1
            ? getTree(data)
            : (list || []).concat(getTree(data));

        if (departrangetype === '3') {
          _list = _list.map(l => ({ ...l, disabled: appointedDepartmentIds.includes(l.departmentId) }));
        }

        let states = !keywords
          ? {
              allList: _list,
            }
          : {
              rootPageIndex: 1,
              departmentMoreIds: [],
            };

        setState({
          list: _list,
          activeIds: _list[0] ? [_list[0].departmentId] : [],
          loading: false,
          rootLoading: false,
          rootPageAll: usePageDepartment && (_list.length % PAGE_SIZE > 0 || data.length <= 0),
          showProjectAll,
          // selectedDepartment: selectedDepartment.concat()
          ...states,
        });
      })
      .catch(() => {
        if (!mounted.current || version !== versionRef.current) return;
        setState({
          loading: false,
          rootLoading: false,
          loadError: true,
        });
      });
  };

  const debouncedSearch = useCallback(_.debounce(fetchData, 500), [fetchData]);

  const getDepartmentById = (departmentTree: DepartmentTree[] | undefined, id: string): DepartmentTree | undefined => {
    for (let i = 0; i < (departmentTree || []).length; i++) {
      const department = departmentTree?.[i];
      if (!department) continue;

      if (department.departmentId === id) {
        return department;
      } else if (department.subDepartments?.length) {
        let oDepartment = getDepartmentById(department.subDepartments, id);

        if (oDepartment) {
          return getDepartmentById(department.subDepartments, id);
        }
      }
    }
    return undefined;
  };

  const fetchSubDepartment = (id: string) => {
    let departmentTree = [...(list || [])];
    let department = getDepartmentById(departmentTree, id);
    if (!department) throw new TypeError('Unknown department');
    const { subDepartments = [] } = department;

    if (!department.haveSubDepartment) {
      return false;
    }

    let isForMore = !!localStorage.getItem('parentId');

    if (!department.open || isForMore) {
      if (subDepartments.length && !isForMore) {
        department.open = true;
      } else {
        let param: DepartmentRequest = {
          projectId: projectId,
          includeDisabled: false,
        };
        let moreData = departmentMoreIds.find(o => o.departmentId === department.departmentId);
        let pageIndex = moreData ? moreData.pageIndex + 1 : 1;
        param =
          location.href.indexOf('admin') > -1
            ? {
                ...param,
                pageIndex,
                pageSize: PAGE_SIZE,
                parentId: department.departmentId,
              }
            : {
                ...param,
                pageIndex,
                pageSize: PAGE_SIZE,
                departmentId: department.departmentId,
                returnCount: returnCount,
              };

        const version = versionRef.current;
        const request = requestDepartments(
          isAnalysis && location.href.indexOf('admin') > -1
            ? 'pagedProjectDepartmentTrees'
            : isAnalysis
              ? 'pagedDepartmentTrees'
              : location.href.indexOf('admin') > -1
                ? 'pagedSubDepartments'
                : 'getProjectSubDepartmentByDepartmentId',
          param,
        );
        childRequests.current.add(request);
        void request
          .then((response: unknown) => {
            if (!mounted.current || version !== versionRef.current) return;
            const data = decodeTree(response);
            localStorage.removeItem('parentId');
            department.subDepartments =
              pageIndex > 1
                ? (department.subDepartments || []).concat(getDepartmentTree(data, department.departmentId))
                : getDepartmentTree(data, department.departmentId);
            department.open = true;
            setMoreList(department.departmentId, data.length < PAGE_SIZE);
            setState({
              list: departmentTree,
            });
          })
          .catch((error: unknown) => {
            if (mounted.current && version === versionRef.current) console.error(error);
          })
          .finally(() => childRequests.current.delete(request));
        return false;
      }
    } else {
      department.open = false;
    }

    setState({
      list: departmentTree,
    });
    return undefined;
  };

  const setMoreList = (departmentId: string, isDelete: boolean) => {
    let moreData = departmentMoreIds.find(o => o.departmentId === departmentId);

    if (isDelete) {
      setState({
        departmentMoreIds: departmentMoreIds.filter(o => o.departmentId !== departmentId),
      });
    } else {
      if (moreData) {
        setState({
          departmentMoreIds: departmentMoreIds.map(o => {
            if (o.departmentId !== departmentId) {
              return o;
            } else {
              return { ...o, pageIndex: moreData.pageIndex + 1 };
            }
          }),
        });
      } else {
        setState({
          departmentMoreIds: departmentMoreIds.concat({ departmentId: departmentId, pageIndex: 1 }),
        });
      }
    }
  };

  const getParentId = (list: DepartmentTree[] | undefined, id: string): DepartmentTree[] | undefined => {
    for (const item of list || []) {
      if (item.departmentId == id) {
        return [item];
      }

      if (item.subDepartments) {
        let node = getParentId(item.subDepartments, id);

        if (node !== undefined) {
          return node.concat(item);
        }
      }
    }
    return undefined;
  };

  const toggle = (department: DepartmentChoice, notIncludeChilren?: boolean) => {
    const departmentIndex = _.findIndex(list, { departmentId: department.departmentId });

    if (!_.isUndefined(departmentIndex)) {
      setState({
        activeIndex: departmentIndex,
        activeIds: [department.departmentId],
      });
    }

    department = checkIncludeChilren
      ? {
          ...department,
          checkIncludeChilren:
            notIncludeChilren === true
              ? false
              : department.checkIncludeChilren === undefined
                ? true
                : department.checkIncludeChilren,
        }
      : department;
    if (selectedDepartment.filter(dept => dept.departmentId === department.departmentId).length) {
      immediate && selectFn(unique ? [] : [department], true);
      setState({
        selectedDepartment: unique
          ? []
          : _.filter(selectedDepartment, dept => dept.departmentId !== department.departmentId),
      });
    } else {
      if (unique) {
        setState({
          selectedDepartment: [department],
        });
        onSelect([department]);
        onClose(true);
      } else {
        let selectedDepartments = _.cloneDeep(selectedDepartment);

        if (checkIncludeChilren) {
          if (department.departmentId === 'orgs_' + projectInfo.projectId) {
            //选中的是组织
            selectedDepartments = [];
          } else {
            selectedDepartment.map(o => {
              const l = (getParentId(allList, o.departmentId) || []).map(it => it.departmentId);
              if (l.includes(department.departmentId)) {
                selectedDepartments = selectedDepartments.filter(it => it.departmentId !== o.departmentId);
              }
            });
          }
        }

        immediate && onSelect([department]);
        setState({
          selectedDepartment: selectedDepartments.concat([department]),
        });
      }
    }
  };

  const handleSearch = (evt: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
    versionRef.current++;
    promiseRef.current?.abort?.();
    setState({ keywords: evt.target.value });
  };

  const getIsIncludesByParent = (department: DepartmentChoice) => {
    let _list = (getParentId(list, department.departmentId) || []).map(o => o.departmentId);
    let isIncludesByParent = selectedDepartment.filter(
      o =>
        (_list.includes(o.departmentId) || o.departmentId.indexOf('orgs_') > -1) &&
        o.checkIncludeChilren &&
        o.departmentId !== department.departmentId,
    );
    return !!isIncludesByParent.length;
  };

  const getChecked = (department: DepartmentChoice) => {
    let selectedDepartmentData = selectedDepartment.filter(item => item.departmentId === department.departmentId);
    return !!selectedDepartmentData.length || (checkIncludeChilren && getIsIncludesByParent(department));
  };

  const openDialog = () => {
    onClose();
    dialogSelectDept({
      ..._.pick(props, [
        'className',
        'title',
        'width',
        'unique',
        'projectId',
        'returnCount',
        'allPath',
        'selectFn',
        'showCreateBtn',
        'includeProject',
        'showCurrentUserDept',
        'allProject',
        'checkIncludeChilren',
        'isAnalysis',
        'fromAdmin',
        'departrangetype',
        'appointedDepartmentIds',
        'appointedUserIds',
        'onClose',
      ]),
    });
  };

  const onExpend = (item: DepartmentTree) => {
    if (!item.haveSubDepartment) return;
    fetchSubDepartment(item.departmentId);
  };

  const toogleDepargmentSelect = (item: DepartmentTree) => {
    if (item.disabled) return;
    toggle(item);
  };

  const renderList = (data: DepartmentTree[] | undefined): React.ReactNode => {
    return (
      <div className="QSelect-departmentList">
        {(data || []).map((item, index) => {
          const checked = getChecked(item);
          return (
            <React.Fragment key={index}>
              <div className={cx('quick-department', { active: checked, disabled: !!item.disabled })}>
                {departrangetype !== '1' && (
                  <div
                    className={cx('quick-arrow', {
                      'GSelect-arrow--transparent': !item.haveSubDepartment,
                      pointer: item.haveSubDepartment,
                    })}
                  >
                    <span
                      className={cx('expendWrap', { transparent: !item.haveSubDepartment })}
                      onClick={() => onExpend(item)}
                    >
                      <Icon
                        icon="task_custom_btn_unfold"
                        className={cx('textTertiary Hand Font12', { rotateDept: !item.open })}
                      />
                    </span>
                  </div>
                )}
                <div
                  className="flex valignWrapper Hand quick-department_content overflow_ellipsis"
                  onClick={() => toogleDepargmentSelect(item)}
                >
                  <div className={cx('quick-department__name mLeft4 overflow_ellipsis w100')}>
                    {item.departmentName}
                  </div>
                  {checked && <Icon icon="done" className="colorPrimary Font13 mRight13" />}
                </div>
              </div>
              {!item.haveSubDepartment || !item.open ? null : (
                <div className="mLeft12">{renderList(item.subDepartments)}</div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    if (loading && rootPageIndex <= 1) {
      return <LoadDiv />;
    } else if (loadError) {
      return (
        <div role="alert">
          {_l('加载失败，请重试')}
          <button onClick={() => void fetchData()}>{_l('重试')}</button>
        </div>
      );
    } else if (list && list.length) {
      return (
        <React.Fragment>
          {renderList(list)}
          {!keywords && !rootPageAll && (
            <span
              className="mLeft24 Hand moreBtn"
              onClick={() => {
                setState({
                  rootPageIndex: rootPageIndex + 1,
                  rootLoading: true,
                });
              }}
            >
              {rootLoading && <LoadDiv size="small" />}
              {rootLoading ? _l('加载中') : _l('更多')}
            </span>
          )}
        </React.Fragment>
      );
    } else {
      return <NoData>{keywords ? _l('搜索无结果') : _l('无结果')}</NoData>;
    }
  };

  return (
    <DeptSelectWrap id="quickSelectDept" ref={conRef}>
      <div className="searchRoleWrap valignWrapper">
        <Icon icon="search" className="searchIcon textTertiary mRight8 Font18" />
        <input
          name="functionsQuickSelectDept"
          autoComplete="off"
          type="text"
          className="flex"
          ref={inputRef}
          value={keywords}
          placeholder={_l('搜索')}
          onChange={handleSearch}
        />
        {keywords && (
          <Icon
            icon="cancel"
            className="Font16 mLeft4 textTertiary hand"
            onClick={() => {
              versionRef.current++;
              promiseRef.current?.abort?.();
              setState({ keywords: '' });
            }}
          />
        )}
        {departrangetype === '0' && (
          <Icon icon="department" className="Hand textSecondary hoverColorPrimary Font18" onClick={openDialog} />
        )}
      </div>
      <ScrollView className="quickDeptContent" style={{ height: minHeight }}>
        <div className="selectDepartmentContent">{renderContent()}</div>
      </ScrollView>
    </DeptSelectWrap>
  );
}

export default function quickSelectDept(target: unknown, props: QuickDepartmentOptions = {}): QuickDepartmentHandle {
  const panelWidth = 360;
  const minHeight = props.minHeight || 358;
  const panelHeight = typeof minHeight === 'string' ? '41' + minHeight : 41 + minHeight;
  let targetLeft;
  let targetTop;
  let x = 0;
  let y = 0;
  let height = 0;
  const { offset = { top: 0, left: 0 }, zIndex = 1001 } = props;
  const $con = document.createElement('div');

  function setPosition() {
    if (target && (typeof target === 'object' || typeof target === 'function')) {
      const getRect: unknown = Reflect.get(target, 'getBoundingClientRect');
      if (typeof getRect !== 'function') return;
      const method: unknown = Reflect.get(target, 'getBoundingClientRect');
      if (typeof method !== 'function') throw new TypeError('Invalid department popup rectangle method');
      const rect: unknown = Reflect.apply(method, target, []);
      if (!rect || (typeof rect !== 'object' && typeof rect !== 'function'))
        throw new TypeError('Invalid department popup rectangle');
      const rectHeight: unknown = Reflect.get(rect, 'height');
      const rectX: unknown = Reflect.get(rect, 'x');
      const rectY: unknown = Reflect.get(rect, 'y');
      if (typeof rectHeight !== 'number' || typeof rectX !== 'number' || typeof rectY !== 'number')
        throw new TypeError('Invalid department popup coordinates');
      height = rectHeight;
      targetLeft = rectX;
      targetTop = rectY;
      x = targetLeft + (offset.left || 0);
      y = targetTop + height + (offset.top || 0);
      if (x + panelWidth > window.innerWidth) {
        x = targetLeft - 10 - panelWidth;
      }

      if (Number(typeof panelHeight === 'string' ? String(y) + panelHeight : y + panelHeight) > window.innerHeight) {
        y = targetTop - Number(panelHeight) - 4;
        if (y < 0) {
          y = 0;
        }

        if (targetTop < Number(panelHeight)) {
          x = targetLeft - 10 - panelWidth;
          if (x < panelWidth) {
            x = targetLeft + 10 + 36;
          }
        }
      }

      $con.style.position = 'absolute';
      $con.style.left = x + 'px';
      $con.style.top = y + 'px';
      $con.style.zIndex = String(zIndex);
    }
  }

  setPosition();
  document.body.appendChild($con);
  const root = createRoot($con);

  function destory() {
    root.unmount();
    if ($con && $con.parentNode === document.body && document.body.contains($con)) {
      document.body.removeChild($con);
    }
  }

  root.render(
    <DeptSelect
      {...props}
      onClose={force => {
        if (!force && props.isDynamic) {
          setTimeout(setPosition, 100);
          return;
        }

        if (_.isFunction(props.onClose)) {
          props.onClose();
        }

        destory();
      }}
    />,
  );

  return {
    destory,
  };
}
