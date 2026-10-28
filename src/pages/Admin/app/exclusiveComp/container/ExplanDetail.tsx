import { Fragment, useEffect, useRef, useState } from 'react';
import { ConfigProvider, Empty, Select, Table } from 'antd';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import _ from 'lodash';
import moment from 'moment';
import styled from 'styled-components';
import { Button, Icon, UserHead } from 'ming-ui';
import Confirm from 'ming-ui/components/Dialog/Confirm';
import appManagement from 'src/api/appManagement';
import projectAjax from 'src/api/project';
import resourceApi from 'src/pages/workflow/api/resource';
import Search from 'src/pages/workflow/components/Search';
import { START_APP_TYPE } from 'src/pages/workflow/WorkflowList/utils';
import { navigateTo } from 'src/router/navigateTo';
import withRouter from '../../../../../router/withRouter';
import IsAppAdmin from '../../../components/IsAppAdmin';
import PaginationWrap from '../../../components/PaginationWrap';
import { alertIfNotUnauthorized } from 'src/utils/services/request/error';
import AddWorkflowDialog from '../component/AddWorkflowDialog';
import HistoryWorkflowTable from '../component/HistoryWorkflowTable';
import MoveWorkflowDialog from '../component/MoveWorkflowDialog';
import WorkflowConflictDialog from '../component/WorkflowConflictDialog';
import { COMPUTING_INSTANCE_STATUS, TYPE_LIST } from '../config';
import {
  canShowComputingInstanceHistory,
  checkHistoryWorkflowConflicts,
  getAllHistoryWorkflowIds,
  getHistoryWorkflowMoveIds,
  getHistoryWorkflowRequestParams,
  isHistoryComputingRoute,
  normalizeHistoryWorkflowResult,
} from '../historyWorkflow';
import type { ComputingInstanceSnapshot, HistoryWorkflowConflict, HistoryWorkflowItem } from '../historyWorkflow';
import '../index.less';

const ActionOpWrap = styled.ul`
  background: var(--color-background-card);
  box-shadow: var(--shadow-sm);
  border-radius: var(--radius-sm) var(--radius-sm) var(--radius-sm) var(--radius-sm);
  width: 160px;
  font-size: var(--font-sm);
  color: var(--color-text-title);
  padding: var(--space-1) 0;
  li {
    line-height: 36px;
    padding: 0 var(--space-6);
    cursor: pointer;
    &:hover {
      background-color: var(--color-primary-solid);
      color: var(--color-white);
    }
  }
`;

const PAGE_SIZE = 10;

const renderEmpty = () => {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={_l('暂无数据')}></Empty>;
};

function ExplanDetail(props) {
  const { projectId, id, history, location } = props;
  /** 历史模式由 URL 的 ?mode=history 决定（与官方 3da 的入口一致）。 */
  const isHistoryMode = isHistoryComputingRoute(location?.search);

  const [workflowData, setWorkflowData] = useState<{ count: number; list: HistoryWorkflowItem[] }>({
    count: 0,
    list: [],
  });
  const [appList, setAppList] = useState([{ label: _l('全部应用'), value: '' }]);
  const [filters, setFilters] = useState({
    apkId: '',
    workflowType: '',
    search: '',
    pageIndex: 1,
  });
  const [actionOp, setActionOp] = useState(-1);
  const [selectKeys, setSelectKeys] = useState([]);
  const [moveWorkflowDialog, setMoveWorkflowDialog] = useState<{
    visible: boolean;
    ids: string[];
    isHistory?: boolean;
  }>({
    visible: false,
    ids: [],
  });
  const [addWorkflowDialog, setAddWorkflowDialog] = useState({
    visible: false,
  });
  const [explanInfo, setExplanInfo] = useState<ComputingInstanceSnapshot | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [historyConflictDialog, setHistoryConflictDialog] = useState<{
    visible: boolean;
    list: HistoryWorkflowConflict[];
    checked: string[];
    workflowIds: string[];
    targetResourceId: string;
  }>({ visible: false, list: [], checked: [], workflowIds: [], targetResourceId: '' });
  const [historyIdsLoading, setHistoryIdsLoading] = useState(false);
  const [historyMoveSubmitting, setHistoryMoveSubmitting] = useState(false);
  const historyMovePending = useRef(false);
  const historyWorkflowCount = (explanInfo || {}).workflowCount || 0;
  const showHistoryInfo = canShowComputingInstanceHistory(isHistoryMode, explanInfo);
  const showHistoryWorkflowActions = showHistoryInfo && historyWorkflowCount > 0;
  const historyWorkflowActionDisabled =
    historyIdsLoading || historyMoveSubmitting || historyConflictDialog.visible;

  useState(() => {
    // 历史模式下实例快照来自历史工作流接口的 instance 字段，不再单独取详情。
    if (isHistoryMode) return;
    projectAjax
      .getComputingInstanceDetail({
        projectId: projectId,
        id: id,
      })
      .then(res => {
        setExplanInfo(res);
        getProcessList(res.resourceId);
      });
  }, [id]);

  useEffect(() => {
    getProcessList();
  }, [filters.search, filters.pageIndex, filters.apkId, filters.workflowType]);

  const getProcessList = (resourceId?: string) => {
    setLoading(true);

    if (isHistoryMode) {
      projectAjax
        .getComputingInstanceHistoryWorkflows(
          getHistoryWorkflowRequestParams({ projectId, id, filters, pageSize: PAGE_SIZE }),
        )
        .then(normalizeHistoryWorkflowResult)
        .then(result => {
          setLoading(false);
          setWorkflowData({ list: result.list, count: result.count });
          if (result.instance) {
            setExplanInfo(result.instance);
          }
        });
      return;
    }

    let _resourceId = resourceId || (explanInfo || {}).resourceId;
    if (!_resourceId) return;
    let promiseList = Promise.all([
      resourceApi.getProcessList({
        keyword: filters.search,
        pageIndex: filters.pageIndex,
        pageSize: PAGE_SIZE,
        resourceId: _resourceId,
        apkId: filters.apkId,
        processListType: filters.workflowType,
      }),
      resourceApi.getCountByResourceId({
        keyword: filters.search,
        resourceId: _resourceId,
        apkId: filters.apkId,
        processListType: filters.workflowType,
      }),
    ]);
    promiseList.then(([res, count]) => {
      setLoading(false);
      setWorkflowData({
        list: res,
        count: count,
      });
    });
  };

  const getAppList = () => {
    const keyword = '';
    appManagement
      .getAppsForProject({
        projectId,
        status: '',
        order: 3,
        pageIndex: 1,
        pageSize: 100000,
        keyword: keyword.trim(),
      })
      .then(({ apps }) => {
        const newAppList = apps.map(item => {
          return {
            label: item.appName,
            value: item.appId,
          };
        });
        setAppList(appList.concat(newAppList));
      });
  };

  const removeWorkflow = (
    ids: string[],
    targetResourceId?: string,
    options: { showSuccess?: boolean } = {},
  ): Promise<boolean> => {
    if (!ids || ids.length === 0) return Promise.resolve(false);

    const { showSuccess = true } = options;
    const request = isHistoryMode
      ? projectAjax.moveComputingInstanceHistoryWorkflows({
          projectId,
          id,
          targetResourceId,
          workflowIds: ids,
        })
      : resourceApi.moveProcess({
          moveToResourceId: targetResourceId || '',
          processIds: ids,
          resourceId: (explanInfo || {}).resourceId,
          companyId: projectId,
        });

    return request.then((res: boolean) => {
      if (res) {
        if (showSuccess) alert(_l('移动成功'));

        getProcessList();
      } else {
        alert(_l('移动失败'), 2);
      }

      return res;
    });
  };

  const openHistoryWorkflowDialog = () => {
    if (historyIdsLoading || historyMoveSubmitting || historyConflictDialog.visible) return;

    setHistoryIdsLoading(true);
    getAllHistoryWorkflowIds({
      request: params => projectAjax.getComputingInstanceHistoryWorkflows(params),
      projectId,
      id,
    })
      .then(workflowIds => {
        if (!workflowIds.length) {
          alert(_l('暂无可添加的历史工作流'), 3);
          return;
        }

        setMoveWorkflowDialog({
          visible: true,
          ids: workflowIds,
          isHistory: true,
        });
      })
      .catch((requestError: unknown) => alertIfNotUnauthorized(requestError, _l('获取历史工作流失败'), 2))
      .finally(() => setHistoryIdsLoading(false));
  };

  const resetHistoryConflictDialog = () => {
    setHistoryConflictDialog({ visible: false, list: [], checked: [], workflowIds: [], targetResourceId: '' });
  };

  const prepareHistoryWorkflowMove = (workflowIds: string[], targetResourceId: string) => {
    if (historyMovePending.current) return;

    historyMovePending.current = true;
    setHistoryMoveSubmitting(true);
    return checkHistoryWorkflowConflicts({
      request: params => projectAjax.checkMoveComputingInstanceHistoryWorkflows(params),
      projectId,
      id,
      targetResourceId,
      workflowIds,
    })
      .then(conflicts => {
        if (!conflicts.length) {
          return removeWorkflow(workflowIds, targetResourceId);
        }

        setHistoryConflictDialog({
          visible: true,
          list: conflicts,
          checked: conflicts.map(item => item.id),
          workflowIds,
          targetResourceId,
        });
        return undefined;
      })
      .catch((requestError: unknown) => alertIfNotUnauthorized(requestError, _l('检查工作流冲突失败'), 2))
      .finally(() => {
        historyMovePending.current = false;
        setHistoryMoveSubmitting(false);
      });
  };

  const submitHistoryWorkflowMove = (checkedConflictIds: string[]) => {
    if (historyMovePending.current) return;

    const conflictIds = historyConflictDialog.list.map(item => item.id);
    const workflowIds = getHistoryWorkflowMoveIds({
      workflowIds: historyConflictDialog.workflowIds,
      conflictIds,
      checkedConflictIds,
    });

    if (!workflowIds.length) {
      resetHistoryConflictDialog();
      return;
    }

    historyMovePending.current = true;
    setHistoryMoveSubmitting(true);
    return removeWorkflow(workflowIds, historyConflictDialog.targetResourceId, {
      showSuccess: checkedConflictIds.length > 0,
    })
      .then(res => {
        if (res) {
          resetHistoryConflictDialog();
        }
      })
      .finally(() => {
        historyMovePending.current = false;
        setHistoryMoveSubmitting(false);
      });
  };

  const COLUMNS = [
    {
      title: _l('工作流'),
      dataIndex: 'id',
      render: (value, record) => {
        return (
          <div className="workfloeRowName flexRow alignItemsCenter">
            <IsAppAdmin
              className="workflowCheckWrap"
              appId={record.app ? record.app.id : undefined}
              desc={record.app ? record.app.name : undefined}
              appName={record.process.name}
              defaultIcon={
                (START_APP_TYPE[record.process.child ? 'subprocess' : record.process.startAppType] || {}).iconName
              }
              iconColor={
                (START_APP_TYPE[record.process.child ? 'subprocess' : record.process.startAppType] || {}).iconColor
              }
              createType={2}
              ckeckSuccessCb={() => {
                navigateTo(`/workflowedit/${value}`);
              }}
            />
          </div>
        );
      },
    },
    {
      title: _l('类型'),
      dataIndex: 'id',
      width: 150,
      render: (_value, record) => {
        return (
          <div className="columnType">
            {(START_APP_TYPE[record.process.child ? 'subprocess' : record.process.startAppType] || {}).text}
          </div>
        );
      },
    },
    {
      title: _l('添加时间'),
      dataIndex: 'createDate',
      width: 300,
    },
    {
      title: _l('添加人'),
      dataIndex: 'id',
      width: 300,
      render: (_value, record) => {
        return (
          <div className="flexRow textSecondary">
            <UserHead
              size={28}
              user={{ userHead: record.createBy.avatar, accountId: record.createBy.accountId }}
              projectId={projectId}
            />
            <div className="mLeft12 ellipsis flex LineHeight28">{record.createBy.fullName}</div>
          </div>
        );
      },
    },
    {
      title: '',
      width: 50,
      dataIndex: 'id',
      render: (_value, record, index: number) => {
        return (
          <Trigger
            popupVisible={actionOp === index}
            onPopupVisibleChange={visible => setActionOp(visible ? index : -1)}
            action={['click']}
            popup={
              <ActionOpWrap>
                <li
                  onClick={() => {
                    setActionOp(-1);
                    setMoveWorkflowDialog({
                      visible: true,
                      ids: [record.id],
                    });
                  }}
                >
                  {_l('移动到')}
                </li>
                <li
                  onClick={() => {
                    setActionOp(-1);
                    removeWorkflow([record.id]);
                  }}
                >
                  {_l('移出')}
                </li>
              </ActionOpWrap>
            }
            popupAlign={{ points: ['tr', 'bc'], offset: [15, 0] }}
          >
            <Icon icon="moreop" className="Font18 textTertiary hoverColorPrimaryLight Hand" />
          </Trigger>
        );
      },
    },
  ];

  return (
    <Fragment>
      <div className="exclusiveCompHeader explanDetailHeader">
        <span className="icon-backspace Font22 hoverColorPrimary" onClick={() => history.go(-1)}></span>
        <span className="explanDetailLabel">{_l('管理算力')}</span>
        <span className="explanDetailName textSecondary">
          {explanInfo && `${explanInfo.name}（${explanInfo.resourceId}）`}
        </span>
        <span className="flex"></span>
        {explanInfo && moment(explanInfo.expirationDatetime).add(1, 'd').isBefore(new Date()) && (
          <span className="" style={{ color: 'var(--color-error-text)' }}>
            {_l('服务已过期')}
          </span>
        )}
      </div>
      <div className="explanDetailContent flex">
        {showHistoryInfo && explanInfo && (
          <div className="historyWorkflowNotice flexRow alignItemsCenter">
            <Icon icon="info_outline" className="Font18 mRight10" />
            <span className="bold">
              {_l(
                '本专属算力已于 %0 到期',
                explanInfo.expirationDatetime
                  ? moment(explanInfo.expirationDatetime).format(_l('YYYY-MM-DD'))
                  : '_',
              )}
              {showHistoryWorkflowActions &&
                _l('，以下 %0 条工作流为到期前的历史记录，已自动释放。', historyWorkflowCount)}
            </span>
            {showHistoryWorkflowActions && (
              <Fragment>
                <span className="flex" />
                <span
                  className={cx('addHistoryWorkflow', { disabled: historyWorkflowActionDisabled })}
                  onClick={openHistoryWorkflowDialog}
                >
                  {_l('添加到其他算力')}
                </span>
              </Fragment>
            )}
          </div>
        )}
        <div className="actionCon flexRow">
          <Select
            className="selectItem"
            showSearch={{
              filterOption: (inputValue, option) =>
                appList
                  .find(item => item.value === option.value)
                  .label.toLowerCase()
                  .indexOf(inputValue.toLowerCase()) > -1,
              /* 这里原先还有 onSearch: _.debounce(val => this.setState({ keyword: val }, () => getAppList()), 500)。
                 函数组件里 this 是 undefined，每输入一次（防抖后）就是一条未捕获的 TypeError；就算能执行也不对 ——
                 getAppList 的 keyword 写死为空、结果是 concat 到现有列表上，再拉一次只会让每个应用重复一遍。
                 筛选一直是上面的 filterOption 在前端做的（一次拉全量），去掉之后用户看到的行为不变。 */
            }}
            defaultValue={filters.apkId}
            options={appList}
            onFocus={() => appList.length === 1 && getAppList()}
            suffixIcon={<Icon icon="arrow-down-border Font14" />}
            notFoundContent={<span className="textTertiary">{_l('无搜索结果')}</span>}
            onChange={value =>
              setFilters({
                ...filters,
                apkId: value,
              })
            }
          />
          <Select
            className="selectItem"
            defaultValue={filters.workflowType}
            options={TYPE_LIST}
            suffixIcon={<Icon icon="arrow-down-border Font14" />}
            onChange={value =>
              setFilters({
                ...filters,
                workflowType: value,
              })
            }
          />
          <Search
            placeholder={_l('工作流名称')}
            handleChange={_.debounce(value => {
              setFilters({
                ...filters,
                pageIndex: 1,
                search: value,
              });
            }, 500)}
          />
          <div className="flex"></div>
          {!isHistoryMode && (
            <Fragment>
              <span
                className={cx('actionBtn mRight20', { disabled: selectKeys.length === 0 })}
                onClick={() => {
                  if (selectKeys.length === 0) return;
                  setMoveWorkflowDialog({
                    ...workflowData,
                    visible: true,
                    ids: selectKeys,
                  });
                }}
              >
                {_l('移动到')}
              </span>
              <span
                className={cx('actionBtn mRight20', { disabled: selectKeys.length === 0 })}
                onClick={() => {
                  if (selectKeys.length === 0) return;
                  Confirm({
                    className: '',
                    title: selectKeys.length === 1 ? _l('移出工作流') : _l('移出%0个工作流', selectKeys.length),
                    okText: _l('移出'),
                    buttonType: 'danger',
                    cancelText: _l('取消'),
                    onOk: () => {
                      removeWorkflow(selectKeys);
                    },
                  });
                }}
              >
                {_l('移出')}
              </span>
              <Button
                type="primary"
                icon="add"
                className="addBtn"
                size="small"
                disabled={explanInfo && explanInfo.status !== COMPUTING_INSTANCE_STATUS.Running}
                onClick={() => {
                  setAddWorkflowDialog({
                    visible: true,
                  });
                }}
              >
                {_l('工作流')}
              </Button>
            </Fragment>
          )}

        </div>
        <div className="listCon flex">
          {isHistoryMode ? (
            <HistoryWorkflowTable loading={loading} list={workflowData.list} projectId={projectId} />
          ) : (
            <ConfigProvider renderEmpty={renderEmpty}>
              <Table
              loading={loading}
              className="workflowTable"
              rowClassName="workflowTableTitleRow"
              rowSelection={{
                selectedRowKeys: selectKeys,
                onChange: value => {
                  setSelectKeys(value);
                },
              }}
              columns={COLUMNS}
              dataSource={workflowData.list}
              rowKey={record => record.id}
                pagination={false}
              />
            </ConfigProvider>
          )}
        </div>
        <PaginationWrap
          total={workflowData.count}
          pageIndex={filters.pageIndex}
          pageSize={PAGE_SIZE}
          onChange={(index: number) => {
            setFilters({
              ...filters,
              pageIndex: index,
            });
          }}
        />
      </div>
      {explanInfo && moveWorkflowDialog.visible && (
        <MoveWorkflowDialog
          visible={moveWorkflowDialog.visible}
          projectId={projectId}
          sourceResourceId={explanInfo.resourceId}
          title={
            moveWorkflowDialog.isHistory
              ? _l('将 %0 个历史工作流添加到其他专属算力', moveWorkflowDialog.ids.length)
              : undefined
          }
          okText={moveWorkflowDialog.isHistory ? _l('确认') : undefined}
          onOk={(value: string) => {
            const { isHistory, ids: workflowIds = [] } = moveWorkflowDialog;
            setMoveWorkflowDialog({
              visible: false,
              ids: [],
            });
            if (isHistory) {
              prepareHistoryWorkflowMove(workflowIds, value);
            } else {
              removeWorkflow(workflowIds, value);
            }
          }}
          onCancel={() => {
            setMoveWorkflowDialog({
              visible: false,
              ids: [],
            });
          }}
        />
      )}
      {explanInfo && addWorkflowDialog.visible && (
        <AddWorkflowDialog
          projectId={projectId}
          visible={addWorkflowDialog.visible}
          resourceId={explanInfo.resourceId}
          onOk={() => {
            setAddWorkflowDialog({
              visible: false,
            });
            getProcessList();
          }}
          onCancel={() => {
            setAddWorkflowDialog({
              visible: false,
            });
          }}
        />
      )}
      <WorkflowConflictDialog
        visible={historyConflictDialog.visible}
        list={historyConflictDialog.list}
        totalCount={historyConflictDialog.workflowIds.length}
        checked={historyConflictDialog.checked}
        submitting={historyMoveSubmitting}
        onCheckedChange={checked => setHistoryConflictDialog({ ...historyConflictDialog, checked })}
        onMove={() => {
          if (!historyConflictDialog.checked.length) return;
          submitHistoryWorkflowMove(historyConflictDialog.checked);
        }}
        onNotMove={() => submitHistoryWorkflowMove([])}
      />
    </Fragment>
  );
}

export default withRouter(ExplanDetail);
