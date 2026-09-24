import { Fragment, lazy, Suspense, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Trigger from '@rc-component/trigger';
import cx from 'classnames';
import { Icon, Menu, MenuItem } from 'ming-ui';
import chatbotIcon from 'worksheet/common/WorkSheetLeft/assets/chatbot.png';
import customPageIcon from 'worksheet/common/WorkSheetLeft/assets/dashboard.png';
import worksheetIcon from 'worksheet/common/WorkSheetLeft/assets/worksheet.png';
import CreateNew from 'worksheet/common/WorkSheetLeft/CreateNew';
import { addFirstAppSection, createAppItem, getSheetList } from 'worksheet/redux/actions/sheetList';
import { getAppSectionRef } from 'src/pages/PageHeader/AppPkgHeader/LeftAppGroup';
import { CREATE_ITEM_LIST } from 'src/pages/worksheet/common/WorkSheetLeft/enum';
import type { RootState } from 'src/redux/types';
import { findSheet } from 'src/utils/worksheet';

const LoadableDialogImportExcelCreate = lazy(() => import('worksheet/components/DialogImportExcelCreate'));

const iconMaps = {
  worksheet: worksheetIcon,
  customPage: customPageIcon,
  chatbot: chatbotIcon,
};

function CreateAppItem(props) {
  const { isCharge, projectId, appId, groupId, worksheetId, children, appPkg } = props;
  const { appSectionDetail } = props;
  const { addFirstAppSection } = props;
  const { workflowAgentFeatureType } = appPkg;
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const [createType, setCreateType] = useState('');
  const [dialogImportExcel, setDialogImportExcel] = useState(false);
  const singleRef = getAppSectionRef(groupId);
  const appItem = findSheet(worksheetId, appSectionDetail);
  /* 【原先这里是个三元，五处都写成 `appItem ? appItem.parentGroupId || appItem.parentId : groupId`】
     只要在某张表里点「+ 新建」，appItem 就找得到，于是走三元的【真】分支；
     可 findSheet 是直接从 sheetList.appSectionDetail 里原样捞出来的后端对象，
     一级分组下的表【既没有 parentGroupId 也没有 parentId】（实测 keys 里压根没这两项，
     全仓也没有任何地方给 appSectionDetail 的条目补过 parentId），
     结果 groupId 变成 undefined -> AddWorkSheet 少了必填的 appSectionId ->
     后端回 {"state":2,"exception":"参数错误"}，前端建不了表。
     （parentGroupId 只有二级分组下的表才有，那条路径原来就是对的，要保住。）
     改成一路兜底：有父级信息就用父级，没有就退回地址栏里的当前分组。 */
  const targetGroupId = (appItem && (appItem.parentGroupId || appItem.parentId)) || groupId;

  useEffect(() => {
    window.__worksheetLeftReLoad = () => {
      singleRef.dispatch(getSheetList({ appId, appSectionId: targetGroupId }));
    };

    return () => {
      delete window.__worksheetLeftReLoad;
    };
  }, []);

  const handleCreate = (type, args) => {
    if (singleRef) {
      singleRef.dispatch(
        createAppItem({
          appId,
          groupId: targetGroupId,
          firstGroupId: appItem && appItem.parentGroupId ? groupId : undefined,
          type,
          ...args,
        }),
      );
    }

    setCreateType('');
  };

  const handleSwitchCreateType = (type: string) => {
    if (type === 'importExcel') {
      setCreateMenuVisible(false);
      setDialogImportExcel(true);
      return;
    }

    if (type === 'group') {
      addFirstAppSection();
      setCreateMenuVisible(false);
      return;
    }

    setCreateType(type);
    setCreateMenuVisible(false);
  };

  return (
    <Fragment>
      {isCharge && (
        <Trigger
          forceRender={true}
          popupVisible={createMenuVisible}
          onPopupVisibleChange={setCreateMenuVisible}
          action={['click']}
          popupAlign={{
            points: ['tl', 'bl'],
            offset: [-10, 0],
            overflow: {
              adjustX: true,
              adjustY: true,
            },
          }}
          popup={
            <div className="createNewMenu">
              <Menu>
                {CREATE_ITEM_LIST.filter(item => {
                  if (item.createType === 'chatbot') {
                    return workflowAgentFeatureType === '1' && !md.global?.SysSettings?.hideAIBasicFun;
                  }

                  return true;
                }).map((item, index) => (
                  <Fragment key={index}>
                    {item.createType === 'group' && <div className="spaceLine mTop4 mBottom4"></div>}
                    <MenuItem
                      key={item.createType}
                      onClick={() => {
                        handleSwitchCreateType(item.createType);
                      }}
                    >
                      {iconMaps[item.createType] ? (
                        <img className="createIcon" src={iconMaps[item.createType]} />
                      ) : (
                        <Icon
                          icon={item.icon}
                          className={cx('Font18', {
                            Visibility: ['worksheet', 'importExcel'].includes(item.createType),
                          })}
                        />
                      )}
                      <span className={item.className}>{item.text}</span>
                      {item.createType === 'chatbot' && (
                        <Icon
                          icon="auto_awesome"
                          className="Font15 mLeft5"
                          style={{ color: 'var(--color-mingo-light)' }}
                        />
                      )}
                    </MenuItem>
                  </Fragment>
                ))}
              </Menu>
            </div>
          }
        >
          {children}
        </Trigger>
      )}
      {!!createType && (
        <CreateNew
          type={createType}
          onImportExcel={() => {
            handleSwitchCreateType('importExcel');
            setCreateType('');
          }}
          onCreate={handleCreate}
          onCancel={() => handleSwitchCreateType('')}
        />
      )}
      {dialogImportExcel && (
        <Suspense fallback={null}>
          <LoadableDialogImportExcelCreate
            projectId={projectId}
            appId={appId}
            groupId={targetGroupId}
            onCancel={() => setDialogImportExcel(false)}
            createType="worksheet"
            refreshPage={() => {
              singleRef.dispatch(getSheetList({ appId, appSectionId: targetGroupId }));
            }}
          />
        </Suspense>
      )}
    </Fragment>
  );
}

export default connect(
  (state: RootState) => ({
    appSectionDetail: state.sheetList.appSectionDetail,
  }),
  dispatch =>
    bindActionCreators(
      {
        addFirstAppSection,
      },
      dispatch,
    ),
)(CreateAppItem);
