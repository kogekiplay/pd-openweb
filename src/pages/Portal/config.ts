import { addSubPathOfRoutes } from 'src/utils/common';

export const ROUTE_CONFIG_PORTAL = addSubPathOfRoutes({
  printForm: {
    path: '/printForm/:appId/:printType/:type/:from/:key?',
    component: () => import('src/pages/Print'),
  },
  worksheet: {
    // v4 这条是非精确匹配，/worksheet/xxx 下的任何深度都由它接住（渲染应用外壳，
    // 由外壳内部继续路由）。v7 换成按具体度排序后，下面 worksheetDetailNoView 的
    // '/:appId/:worksheetId/row/:rowId'（四段全匹配）会把 /worksheet/x/row/y 抢走 ——
    // 那条本意是「无 /app 前缀的旧书签兜底」，不该盖住这里。
    // 显式补一条同形状的路径，让它按具体度平手后由静态段 'worksheet' 胜出。
    // 用 splat 而不是具名的 :rowId —— 这条路由的组件（应用外壳）不读 rowId，
    // 写成具名参数只会凭空多给它一个 v4 时代没有的 param。
    path: ['/worksheet/:worksheetId', '/worksheet/:worksheetId/row/*'],
    component: () => import('src/router/Application'),
    title: _l('应用'),
  },
  // 工作表
  newRecord: {
    path: ['/app/:appId/newrecord/:worksheetId/:viewId/', '/:appId/newrecord/:worksheetId/:viewId/'],
    component: () => import('src/pages/NewRecord'),
  },
  // 工作表
  worksheetDetailNoView: {
    path: ['/app/:appId/:worksheetId/row/:rowId', '/:appId/:worksheetId/row/:rowId'],
    component: () => import('src/pages/worksheet/pages/WorksheetRowLand'),
  },
  // 工作表
  worksheetDetail: {
    path: ['/app/:appId/:worksheetId/:viewId/row/:rowId', '/:appId/:worksheetId/:viewId/row/:rowId'],
    component: () => import('src/pages/worksheet/pages/WorksheetRowLand'),
  },
  gunterExport: {
    path: ['/app/:appId/:worksheetId/:viewId/gunterExport', '/:appId/:worksheetId/:viewId/gunterExport'],
    component: () => import('src/pages/worksheet/views/GunterView/components/GunterExport'),
    title: _l('正在导出，请稍候...'),
  },
  app: {
    path: ['/app/:appId', '/:appId'],
    component: () => import('src/router/Application'),
    title: _l('应用'),
  },
});

const withoutHeaderPathList = [
  'worksheet/worksheetshare',
  'worksheet/public/query',
  'workflowEdit',
  'workflow/checksheet',
  'worksheet/field/edit',
  'worksheet/form/edit',
  'worksheet/form/preview',
  'worksheet/formSet',
  'worksheet/uploadTemplateSheet',
  'gunterExport',
  'printForm',
];
// 原来是 v4 的路径正则 `/(.*)(片段1|片段2|...)` —— 实际语义是「pathname 里
// 出现过其中任一片段」的【子串匹配】。v7 的路径语法表达不了它（* 只能在末尾、
// 也没有交替组），而且用「某条路由是否匹配」去表达「要不要渲染另一个东西」
// 本来就绕。直接改成谓词函数，语义等价且一眼能懂。
export const withoutHeaderUrl = (pathname = location.pathname) =>
  withoutHeaderPathList.some(p => pathname.includes(p));
