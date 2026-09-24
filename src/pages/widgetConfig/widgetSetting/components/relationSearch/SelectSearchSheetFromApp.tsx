import { Fragment, useEffect, useRef } from 'react';
import { useSetState } from 'react-use';
import { Button, ConfigProvider } from 'antd';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import update from 'immutability-helper';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, LoadDiv, Dropdown as MDDropdown, SvgIcon } from 'ming-ui';
import appManagementAjax from 'src/api/appManagement';
import homeAppAjax from 'src/api/homeApp';
import syncTaskApi from 'src/pages/integration/api/syncTask';
import { pathCompletion } from 'src/utils/common';
import { VersionProductType } from 'src/utils/enum';
import { getFeatureStatus } from 'src/utils/project';
import { DropdownPlaceholder } from '../../../styled';

const SelectItem = styled.div`
  .title {
    margin: var(--space-6) 0 6px 0;
  }
`;

const SelectSheetWrap = styled.div`
  background: var(--color-background-primary);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  .tabNav {
    display: flex;
    padding-left: var(--space-5);
    border-bottom: 1px solid --color-background-disabled;
  }
  .navItem {
    margin-bottom: 0 !important;
    padding: var(--space-3) 0;
    color: var(--color-text-primary);
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: var(--font-md);
    font-weight: bold;
    &:hover {
      color: var(--color-primary-text);
    }
    &.active {
      color: var(--color-primary-text);
      border-bottom-color: var(--color-primary);
    }
    &:last-child {
      margin-left: var(--space-8);
    }
  }
  .searchWrap {
    padding: var(--space-2) 10px var(--space-2) var(--space-5);
    border-bottom: 1px solid var(--color-border-primary);
    input {
      border: none;
      &::placeholder {
        color: var(--color-text-disabled);
      }
    }
  }
  .workSheetListWrap {
    padding: 6px 0;
    height: 300px;
    overflow-y: auto;
    .sheetItem {
      padding: 10px;
      &:hover {
        background-color: var(--color-background-hover);
      }
    }
    .svgIconWrap div {
      display: flex;
      align-items: center;
    }
    .icon-aggregate_table {
      color: rgb(76, 175, 80) !important;
    }
  }
  .iconWrap {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    justify-content: center;
    background: var(--color-background-secondary);
  }
`;

const initConfig = [
  { text: _l('工作表'), value: '0' },
  { text: _l('聚合表'), value: '1' },
];

export default function SelectSheetFromApp(props) {
  const { onChange, globalSheetInfo = {}, fromCustomEvent } = props;
  const { appId: currentAppId, projectId, worksheetId: sourceId } = globalSheetInfo;
  const [data, setData] = useSetState({
    appId: currentAppId,
    sheetId: '',
    ..._.pick(props, ['appId', 'sheetId']),
    app: [],
    sheet: [],
    aggregationSheets: [],
    queryType: props.queryType || '0',
    visible: false,
    searchValue: '',
    loading: false,
  });
  const {
    appId,
    sheetId,
    app = [],
    sheet = [],
    queryType,
    visible,
    searchValue,
    loading,
    aggregationSheets = [],
  } = data;
  const appDelete = appId && app.length && !_.find(app, a => a.value === appId);
  const selectSheet = _.find(sheet.concat(aggregationSheets), s => s.value === sheetId);
  const sheetDelete = sheetId && !loading && app.length && !selectSheet;
  const $ref = useRef(null);

  const renderWorkSheetItem = item => {
    return (
      <div
        className="sheetItem pointer flexRow alignItemsCenter pLeft20"
        key={item.value}
        onClick={() => {
          setData({ sheetId: item.value, visible: false, searchValue: '' });
          onChange({ sheetId: item.value, queryType });
        }}
      >
        {queryType === '0' ? (
          <SvgIcon className="svgIconWrap" url={item.iconUrl} fill="var(--color-text-tertiary)" size={18} />
        ) : (
          <Icon className="Font20" icon="aggregate_table" />
        )}
        <span className="bold mLeft8 ellipsis">{item.text}</span>
      </div>
    );
  };

  const getCurrentSheets = key => {
    return key === '0' ? sheet : aggregationSheets;
  };

  const selectSheetMenu = () => {
    const curSheets = getCurrentSheets(queryType);
    return (
      <SelectSheetWrap>
        <div className="tabNav">
          {initConfig.map(({ value, text }, index) => {
            return (
              <div
                key={index}
                className={cx('navItem', { active: queryType === value })}
                onClick={() => {
                  const currentSheets = getCurrentSheets(value);
                  if (!currentSheets.length) getList(value);
                  setData({ queryType: value, searchValue: '' });
                }}
              >
                {text}
              </div>
            );
          })}
        </div>
        <div className="searchWrap flexRow alignItemsCenter">
          <Icon className="Font18 textTertiary mRight3" icon="search" />
          <input
            name="relationSearchSelectSearchSheetFromApp"
            autoComplete="off"
            className="w100"
            placeholder={_l('搜索')}
            autoFocus
            value={searchValue}
            onChange={e => {
              console.log(e);
              setData({ searchValue: e.target.value });
            }}
          />
        </div>
        <div className="workSheetListWrap">
          {loading ? (
            <LoadDiv className="mTop10 mBottom10" />
          ) : curSheets.length ? (
            curSheets.filter(item => item.text.includes(searchValue)).map(item => renderWorkSheetItem(item))
          ) : queryType === '0' ? (
            <div className="flexColumn alignItemsCenter justifyContentCenter h100">{_l('无内容')}</div>
          ) : (
            <div className="flexColumn alignItemsCenter justifyContentCenter h100">
              <Icon className="Font50 textTertiary" icon="aggregate_table" />
              <span className="Font14 textTertiary mTop12 ">{_l('将工作表数据预处理为聚合结果')}</span>
              <span className="Font14 textTertiary mBottom24">{_l('在表单、流程、统计中作为数据源使用')}</span>
              {getFeatureStatus(projectId, VersionProductType.aggregation) == '1' && (
                <ConfigProvider button={{ autoInsertSpace: false }}>
                  <Button
                    type="primary"
                    onClick={() => {
                      window.open(pathCompletion(`/app/${appId}/settings/aggregations`));
                    }}
                    style={{ borderRadius: 20 }}
                  >
                    {_l('创建')}
                  </Button>
                </ConfigProvider>
              )}
            </div>
          )}
        </div>
      </SelectSheetWrap>
    );
  };

  useEffect(() => {
    appManagementAjax.getAppForManager({ projectId, type: 0 }).then(res => {
      let selectAppId = '';

      const getFormatApps = () => {
        const currentIndex = _.findIndex(res, item => item.appId === currentAppId);
        // 当前应用排到第一个。原来没找到时补的是 []（下拉里多出一个空选项），
        // 同时 $splice 的起点是 -1，会把列表最后一个应用删掉
        const appList =
          currentIndex > -1 ? [res[currentIndex]].concat(update(res, { $splice: [[currentIndex, 1]] })) : res;
        if (appList.length < 1) return [];
        if (sheetId) {
          appList.forEach(i => {
            if (_.find(i.workSheetInfo || [], w => w.workSheetId === sheetId)) {
              selectAppId = i.appId;
            }
          });
        }

        return appList.map(({ appName, appId }) =>
          appId === currentAppId
            ? { text: _l('%0  (本应用)', appName), value: appId }
            : { text: appName, value: appId },
        );
      };

      setData({ app: getFormatApps(), appId: selectAppId || appId });
    });
  }, []);

  const getList = (key?: string | undefined) => {
    if (!appId || loading) return;
    const currentType = key || queryType;
    setData({ loading: true });
    // 配置成聚合表
    if (currentType === '1') {
      syncTaskApi
        .list(
          {
            projectId,
            appId,
            pageNo: 0,
            pageSize: 9999,
            taskType: 1,
          },
          {
            isAggTable: true,
          },
        )
        .then(data => {
          const { content } = data;
          setData({
            aggregationSheets: content
              .filter(n => n.aggTableTaskStatus !== 0 && n.taskStatus !== 'ERROR')
              .map(({ name, worksheetId }: { name?: string; worksheetId?: string; [key: string]: any }) => ({
                text: name,
                value: worksheetId,
              })),
            loading: false,
          });
        });
      return;
    }

    homeAppAjax.getWorksheetsByAppId({ appId, type: 0 }).then(res => {
      setData({
        sheet: res.map(({ workSheetId: value, workSheetName: text, iconUrl }) =>
          value === sourceId ? { text: _l('%0  (本表)', text), value, iconUrl } : { text, value, iconUrl },
        ),
        loading: false,
      });
    });
  };

  useEffect(() => {
    getList();
  }, [appId]);

  return (
    <Fragment>
      <SelectItem>
        <div className={cx('title Bold', { mTop0: fromCustomEvent })}>{_l('应用')}</div>
        <MDDropdown
          className="w100"
          value={appId || undefined}
          border
          openSearch
          isAppendToBody
          placeholder={appDelete ? <span className="Red">{_l('已删除')}</span> : _l('请选择')}
          data={app}
          onChange={value => {
            if (value === appId) return;
            setData({
              appId: value,
              sheetId: '',
              queryType: '0',
              searchValue: '',
              visible: false,
              sheet: [],
              aggregationSheets: [],
            });
            onChange({ appId: value, sheetId: '', queryType: '0' });
          }}
        />
      </SelectItem>
      <SelectItem>
        <div className="title Bold">{_l('查询表')}</div>
        <Trigger
          popupVisible={visible}
          popupStyle={{ width: 554 }}
          onPopupVisibleChange={visible => setData({ visible })}
          action={['click']}
          getPopupContainer={() => $ref.current}
          popup={() => selectSheetMenu()}
          popupAlign={{
            points: ['tr', 'br'],
          }}
        >
          <DropdownPlaceholder ref={$ref}>
            <span className={cx('breakAll', { Red: sheetDelete })}>
              {sheetId && !loading ? (
                sheetDelete ? (
                  _l('已删除')
                ) : (
                  _.get(selectSheet, 'text')
                )
              ) : (
                <span className="textDisabled">{_l('请选择')}</span>
              )}
            </span>
            <div className="ming Icon icon icon-arrow-down-border mLeft8 textTertiary" />
          </DropdownPlaceholder>
        </Trigger>
      </SelectItem>
    </Fragment>
  );
}
