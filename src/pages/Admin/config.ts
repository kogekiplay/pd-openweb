import _ from 'lodash';
import AdminController from 'src/api/adminManage';
import { getCurrentProject } from 'src/utils/project';

const Config = {
  params: null, // parameters from url， eg: /admin/:routeType/:projectId
  projectId: null, // current projectId
  project: null, // current project info (from `md.global`)
};

Config.AdminController = AdminController;

Config.getParams = function () {
  const reqArray = location.pathname.split('/');
  const controlIndex = _.indexOf(reqArray, 'admin');
  let arr = [];

  reqArray.forEach(function (item, index) {
    if (index >= controlIndex) {
      arr.push(item);
    }
  });

  Config.params = arr;
  Config.projectId = Config.params[2];
};

/**
 * 从 pathname 里取 projectId，与 Config.getParams() 的算法一致（admin 段之后第 2 个）。
 *
 * 为什么需要它：路由迁到 v7 后，Admin 的父路由从 '/admin/:routeType/:projectId'
 * 改成了 '/admin/*' —— 只有这样内层的子路由才有剩余段可匹配（v7 的嵌套 Routes
 * 匹配的是父消费后剩下的那段，而原来父子深度相同，父会把整个 URL 吃光）。
 * 代价是父路由不再提供 projectId 参数，所以改从路径直接取。
 * 与 Config.params[2] 同值，但不依赖 Config.getParams() 是否已经调用过。
 */
export const getProjectIdFromPath = (pathname = location.pathname) => {
  const arr = pathname.split('/');
  const i = arr.indexOf('admin');

  return i >= 0 ? arr[i + 2] : undefined;
};

Config.setPageTitle = function (prefix) {
  document.title = Config.getTitle(prefix);
};

Config.getTitle = function (prefix) {
  const project = getCurrentProject(Config.projectId, true);
  const companyName = project?.companyName;
  return _.filter([_l('组织管理'), prefix, companyName]).join(' - ');
};

Config.DATE_FILTER = [
  { id: 'today', text: _l('今天') },
  { id: 'currentWeek', text: _l('最近七天') },
  { id: 'currentMonth', text: _l('本月') },
  { id: 'prevMonth', text: _l('上月') },
  { id: 'custom', text: _l('自定义日期') },
];

export default Config;
