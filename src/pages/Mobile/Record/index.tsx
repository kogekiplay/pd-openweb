import React, { useEffect, useMemo, useState } from 'react';
import { Provider } from 'react-redux';
import cx from 'classnames';
import functionWrap from 'ming-ui/components/FunctionWrap';
import MobilePopup from 'ming-ui/components/MobilePopup';
import Back from 'mobile/components/Back';
import RecordInfo from 'mobile/components/RecordInfo/RecordInfo';
import workflowPushSoket from 'mobile/components/socket/workflowPushSoket';
import { RECORD_INFO_FROM } from 'worksheet/constants/enum';
import { configureStore } from 'src/redux/configureStore';

const RecordInfoPage = props => {
  const { params } = props.match;
  let { appId, worksheetId, viewId, rowId, from } = params;

  if (rowId.indexOf('-') === -1 && params.rowId === '21') {
    rowId = params.viewId;
    viewId = null;
    from = Number(params.rowId);
  }

  useEffect(() => {
    workflowPushSoket();
  }, []);

  return (
    <RecordInfo
      className="recordInfoPage"
      appId={appId}
      worksheetId={worksheetId}
      viewId={viewId}
      recordId={rowId}
      from={from || RECORD_INFO_FROM.WORKSHEET_ROW_LAND}
      getDataType={from}
      isLandPage
    />
  );
};

export default RecordInfoPage;

// 【原先包了 forwardRef 但渲染函数只有一个形参】React 会报
//   forwardRef render functions accept exactly two parameters: props and ref.
//   Did you forget to use the ref parameter?
// 实测三个调用点（MobileForm 的 RelateRecordCards / RelationSearch、
// worksheet 的 RelateRecordCards）都没有传 ref，包这一层没有任何作用，直接去掉。
export const RecordInfoModal = (props: any) => {
  const {
    rowId,
    appId,
    worksheetId,
    viewId,
    getDataType,
    from,
    getDraftData = () => {},
    notModal = false,
    editable,
    hideOtherOperate,
    allowEmptySubmit,
    updateSuccess,
    updateRow,
  } = props;
  const { className, visible, onClose } = props;
  const store = useMemo(configureStore, []);
  const [isEditable, setIsEditable] = useState(false);

  if (!visible) return null;

  const Content = (
    <Provider store={store}>
      <RecordInfo
        {...props}
        isModal={true}
        from={from}
        appId={appId}
        worksheetId={worksheetId}
        viewId={viewId}
        recordId={rowId}
        onClose={onClose}
        getDataType={getDataType}
        getDraftData={getDraftData}
        editable={editable}
        hideOtherOperate={hideOtherOperate}
        allowEmptySubmit={allowEmptySubmit}
        updateSuccess={updateSuccess}
        updateEditStatus={isEditable => setIsEditable(isEditable)}
        updateRow={updateRow}
      />
    </Provider>
  );

  if (notModal) {
    return Content;
  }

  return (
    <MobilePopup
      mask={false}
      position="bottom"
      className={cx('mobileModal RecordInfoModal', className)}
      layerId={rowId}
      bodyStyle={{ backgroundColor: 'var(--color-background-primary)!important' }}
      onClose={onClose}
      visible={visible}
    >
      {rowId && Content}

      {!isEditable && (
        <Back
          icon="back"
          className="Fixed"
          style={{ bottom: window.isWxWork ? 130 : 120 }}
          onClick={onClose}
          filterWxWork={true}
        />
      )}
    </MobilePopup>
  );
};

export const openMobileRecordInfo = props => functionWrap(RecordInfoModal, { ...props });
