import _ from 'lodash';
import certImg from 'staticfiles/images/cert.png';
import { Dialog } from 'ming-ui';
import certificationApi from 'src/api/certification';
import { browserIsMobile, pathCompletion } from 'src/utils/common';
import { getCurrentProject } from 'src/utils/project';
import './index.less';

export const identityInterception = (projectId: string, isPersonal) => {
  const isMobile = browserIsMobile();

  Dialog.confirm({
    title: '',
    className: 'identityDialogContainer',
    width: isMobile ? 320 : 480,
    description: (
      <div className="flexColumn justifyContentCenter alignItemsCenter">
        <img src={certImg} width={100} />
        <div className={`bold textPrimary TxtCenter LineHeight25 ${isMobile ? 'mTop32 Font16' : 'mTop40 Font20'}`}>
          {!isMobile
            ? isPersonal
              ? _l('无法使用此功能，请先完成个人认证')
              : _l('无法使用此功能，请先完成企业认证')
            : _l('无法使用此功能，请先前往Web端完成认证')}
        </div>
      </div>
    ),
    okText: !isMobile ? _l('立即认证') : _l('确定'),
    onOk: () => {
      if (!isMobile) {
        location.href = pathCompletion(isPersonal ? '/personal?type=information' : `/admin/certinfo/${projectId}`);
      }
    },
    removeCancelBtn: true,
  });
};

export const checkCertification = props => {
  const { projectId, checkSuccess, isPersonal, forceCheck = false, authType = 1 } = props;
  const paidProjects = (_.get(md, 'global.Account.projects') || []).filter(
    project => _.get(project, 'licenseType') === 1,
  );

  if (isPersonal ? !paidProjects.length : [0, 2].includes(getCurrentProject(projectId).licenseType) || forceCheck) {
    /* 【原先是同步 XHR】`{ ajaxOptions: { sync: true } }` —— 主线程同步请求已被废弃，
       控制台每次都报 "Synchronous XMLHttpRequest on the main thread is deprecated"，
       而且这一下会把主线程卡到请求回来为止。

       【为什么可以直接改异步】这个函数本来就是回调式的：全部 20 多个调用方都写成
       `checkCertification({ ..., checkSuccess })`，没有一处用它的返回值
       （它以前也只返回 undefined）。所以把分支挪进 then 里，对调用方完全透明。
       取不到结果时按「未认证」处理，和以前 isCert 为假值时一致。 */
    certificationApi
      .checkIsCert(isPersonal ? { certSource: 0, authType: 1 } : { certSource: 1, projectId, authType })
      .then(isCert => {
        isCert ? checkSuccess() : identityInterception(projectId, isPersonal);
      })
      .catch(() => identityInterception(projectId, isPersonal));
  } else {
    checkSuccess();
  }
};
