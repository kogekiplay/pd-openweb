import { addSubPathOfRoutes } from 'src/utils/common';

export const PAGE_HEADER_ROUTE_CONFIG = addSubPathOfRoutes({
  home: {
    path: ['/dashboard', '/app/my/group/:projectId?/:groupType?/:groupId?',
      '/app/my/owned/:projectId?/:groupType?/:groupId?',
      '/app/my/:projectId?/:groupType?/:groupId?', '/favorite', '/app/lib/'],
    component: () => import('src/pages/PageHeader/AppCenterHeader'),
  },
  appLogs: {
    path: '/app/:appId/logs/:projectId',
    component: () => import('src/pages/PageHeader/AppPkgSimpleHeader'),
  },
  analytics: {
    path: '/app/:appId/analytics/:projectId',
    component: () => import('src/pages/PageHeader/AppPkgSimpleHeader'),
  },
  appSettings: {
    path: '/app/:appId/settings/:navTab?',
    component: () => import('src/pages/PageHeader/AppPkgSimpleHeader'),
  },
  appPkg: {
    path: '/app/:appId/:groupId?/:worksheetId?/:viewId?',
    component: () => import('src/pages/PageHeader/AppPkgHeader'),
  },
  worksheetRecord: {
    path: '/worksheet/:worksheetId/row/:rowId',
    component: () => import('src/pages/PageHeader/NetManageHeader'),
  },
  worksheetWithView: {
    path: '/worksheet/:worksheetId/view/:viewId',
    component: () => import('src/pages/PageHeader/AppPkgHeader'),
  },
  worksheet: {
    path: '/worksheet/:worksheetId?',
    component: () => import('src/pages/PageHeader/AppPkgHeader'),
  },
  feed: {
    path: '/feed',
    component: () => import('src/pages/PageHeader/NativeHeader'),
  },
  feeddetail: {
    path: '/feeddetail',
    component: () => import('src/pages/PageHeader/NativeHeader'),
  },
  user: {
    // v4 原路径是 ['/user', '/user_:userId?']。v7 表达不了段内静态前缀，只能退化成
    // 根级的 '/:userSeg' —— 而它会吃掉【所有】没被更具体路由接住的 URL。
    // 主路由表里同样的退化靠守卫跳 404 兜住；这里【不能跳 404】：顶栏只是页面的一个
    // 部件，让它把整页跳走就是把「不该显示顶栏」升级成「整页打不开」。
    // 所以用 emptyFallback —— 不匹配就什么都不渲染，与 v4 下 <Switch> 一条都没命中、
    // <header> 里空着完全同效。
    // 漏了这个守卫的后果实测过：/myprocess、/apps/taskcenter 这些本该没有顶栏的页面，
    // 顶上凭空多出一条写着「个人资料」的条。
    path: ['/user', '/:userSeg'],
    component: () => import('src/pages/PageHeader/NetManageHeader'),
    guard: { param: 'userSeg', prefix: 'user_', allowExact: ['user'], emptyFallback: true },
  },
  group: {
    path: '/group/groupValidate',
    component: () => import('src/pages/PageHeader/NetManageHeader'),
  },
  task: {
    path: '/apps/task',
    component: () => import('src/pages/PageHeader/NativeHeader'),
  },
  calendar: {
    path: '/apps/calendar',
    component: () => import('src/pages/PageHeader/NativeHeader'),
  },
  kc: {
    path: '/apps/kc',
    component: () => import('src/pages/PageHeader/NativeHeader'),
  },
  personal: {
    path: '/personal',
    component: () => import('src/pages/PageHeader/NetManageHeader'),
  },
  appInstallSetting: {
    path: '/appInstallSetting',
    component: () => import('src/pages/PageHeader/NetManageHeader'),
  },
  admin: {
    path: '/admin/:roleType/:projectId',
    component: () => import('src/pages/PageHeader/NetManageHeader'),
  },
  dingAppCourse: {
    path: '/dingAppCourse/:projectId?/:apkId?',
    component: () => import('src/pages/PageHeader/AppNameHeader'),
  },
  dingSyncCourse: {
    path: '/dingSyncCourse/:projectId?',
    component: () => import('src/pages/PageHeader/NetManageHeader'),
  },
  wxappSyncCourse: {
    path: '/wxappSyncCourse/:projectId?',
    component: () => import('src/pages/PageHeader/NetManageHeader'),
  },
  welinkSyncCourse: {
    path: '/welinkSyncCourse/:projectId?',
    component: () => import('src/pages/PageHeader/NetManageHeader'),
  },
  feishuSyncCourse: {
    path: '/feishuSyncCourse/:projectId?',
    component: () => import('src/pages/PageHeader/NetManageHeader'),
  },
  weixinAppCourse: {
    path: '/weixinAppCourse/:projectId?/:apkId?',
    component: () => import('src/pages/PageHeader/AppNameHeader'),
  },
  search: {
    path: '/search',
    component: () => import('src/pages/PageHeader/GlobalSearchHeader'),
  },
  integration: {
    path: '/integration',
    component: () => import('src/pages/PageHeader/HubAndPluginHeader'),
  },
  plugin: {
    path: '/plugin',
    component: () => import('src/pages/PageHeader/HubAndPluginHeader'),
  },
});
