import _ from 'lodash';
import api from 'src/api/homeApp';
import { getSuffix } from 'src/pages/AuthService/portalAccount/util';
import { navigateToLogout } from 'src/router/navigateTo';
import { pathCompletion } from 'src/utils/common';

export const compatibleWorksheetRoute = (worksheetId: string, rowId: string, viewId?) => {
  //工作表老路由id补齐
  api.getAppSimpleInfo({ workSheetId: worksheetId }).then(({ appId, appSectionId, workSheetId }) => {
    if (appId) {
      let url = '';

      if (rowId) {
        url = `/app/${appId}/${workSheetId}/row/${rowId}`;
      } else if (viewId) {
        url = `/app/${appId}/${appSectionId}/${workSheetId}/${viewId}${location.search}`;
      } else if (appSectionId) {
        url = `/app/${appId}/${appSectionId}/${workSheetId}`;
      }

      location.href = pathCompletion(url);
    }
  });
};

export function formatPortalHref(props) {
  // The Router compatibility wrapper supplies match; computedMatch was a v4-only prop.
  const params = _.get(props, 'match.params') || _.get(props, 'computedMatch.params') || {};
  // 外部门户 并且应用id对应不上 自定义域名后缀也对应不上
  if (
    md.global.Account.isPortal &&
    ![md.global.Account.appId, md.global.Account.addressSuffix].includes(params.appId) &&
    getSuffix(location.href) !== md.global.Account.addressSuffix
  ) {
    if (location.href.indexOf('worksheet/') >= 0 && params.worksheetId) {
      compatibleWorksheetRoute(params.worksheetId, params.rowId, params.viewId);
    } else {
      navigateToLogout();
    }
  }
}
