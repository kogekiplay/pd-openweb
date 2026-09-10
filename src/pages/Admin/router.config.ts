import _ from 'lodash';
import { VersionProductType } from 'src/utils/enum';

export const menuList = [
  {
    title: '',
    key: 'home',
    subMenuList: [
      {
        name: _l('首页'),
        icon: 'icon-home_page',
        key: 'home',
        routes: [
          {
            path: 'home/:projectId',
            component: () => import('./homePage/index.jsx'),
          },
          {
            path: 'upgradeservice/:projectId/:vertionType?',
            component: () => import('./organization/billCenter/upgradeService'),
          },
          {
            path: 'waitingpay/*',
            component: () => import('./organization/billCenter/waitingPay'),
          },
          {
            path: 'expansionservice/*',
            component: () => import('./organization/billCenter/expansionService'),
          },
          {
            path: 'valueaddservice/*',
            component: () => import('./organization/billCenter/valueAddService'),
          },
        ],
      },
    ],
  },
  {
    title: _l('用户'),
    key: 'user',
    icon: 'icon-group',
    subMenuList: [
      {
        name: _l('成员与部门'),
        key: 'structure',
        routes: [
          {
            path: 'structure/*',
            component: () => import('./user/membersDepartments'),
          },
          {
            path: 'expansionserviceResign/*',
            component: () => import('./organization/billCenter/expansionService'),
          },
        ],
      },
      {
        name: _l('角色'),
        key: 'roles',
        routes: [
          {
            path: 'roles/:projectId',
            component: () => import('./user/roleManage'),
          },
        ],
      },
      {
        name: _l('汇报关系'),
        key: 'reportrelation',
        routes: [
          {
            path: 'reportrelation/*',
            component: () => import('./user/reportRelation'),
          },
        ],
      },
      {
        name: _l('待办委托'),
        key: 'delegation',
        routes: [
          {
            path: 'delegation/:projectId',
            component: () => import('src/pages/Admin/delegation'),
          },
        ],
      },
      {
        name: _l('群组'),
        key: 'groups',
        routes: [
          {
            path: 'groups/*',
            component: () => import('./user/groupDept/index.jsx'),
          },
        ],
      },
      {
        name: _l('外部用户'),
        key: 'external',
        menuPath: '/admin/external/:projectId',
        routes: [
          {
            path: 'external/:projectId',
            exact: true,
            component: () => import('./user/portal'),
          },
          {
            path: 'expansionservice/*',
            component: () => import('./organization/billCenter/expansionService'),
          },
        ],
      },
    ],
  },
  {
    title: _l('组织'),
    key: 'organization',
    icon: 'icon-business',
    subMenuList: [
      {
        name: _l('组织信息'),
        key: 'sysinfo',
        routes: [
          {
            path: 'sysinfo/*',
            component: () => import('./organization/systemSetting'),
          },
          {
            path: 'certinfo/*',
            component: () => import('./organization/systemSetting'),
          },
        ],
      },
      {
        name: _l('账务'),
        key: 'billinfo',
        routes: [
          {
            path: 'billinfo/:projectId/:type?',
            component: () => import('./organization/billCenter/billInfo'),
          },
          {
            path: 'valueaddservice/*',
            component: () => import('./organization/billCenter/valueAddService'),
          },
        ],
      },
      {
        name: _l('管理员'),
        key: 'sysroles',
        menuPath: '/admin/sysroles/:projectId',
        routes: [
          {
            path: 'sysroles/:projectId/:roleId?',
            component: () => import('./organization/roleAuth'),
          },
        ],
      },
      {
        name: _l('其他'),
        key: 'orgothers',
        routes: [
          {
            path: 'orgothers/:projectId',
            component: () => import('./organization/orgothers'),
          },
        ],
      },
    ],
  },
  {
    title: _l('应用管理'),
    key: 'apps',
    icon: 'icon-widgets',
    subMenuList: [
      {
        name: _l('使用分析%15003'),
        featureId: 17,
        key: 'analytics',
        routes: [
          {
            path: 'analytics/:projectId/:type?',
            component: () => import('./app/useAnalytics/index.js'),
          },
        ],
      },
      {
        name: _l('应用'),
        key: 'app',
        menuPath: '/admin/app/:projectId',
        routes: [
          {
            path: 'app/:projectId/:type?',
            exact: true,
            component: () => import('./app/appManagement'),
          },
        ],
      },
      {
        name: _l('工作流'),
        key: 'workflows',
        routes: [
          {
            path: 'workflows/:projectId',
            component: () => import('src/pages/workflow/WorkflowList/AdminWorkflowList'),
          },
          {
            path: 'expansionserviceWorkflow/*',
            component: () => import('./organization/billCenter/expansionService'),
          },
        ],
      },

      {
        name: _l('聚合表'),
        key: 'aggregationTable',
        hasBeta: false,
        featureId: VersionProductType.aggregation,
        routes: [
          {
            path: 'aggregationtable/:projectId',
            component: () => import('./app/aggregationTable'),
          },
          {
            path: 'expansionserviceAggregationtable/*',
            component: () => import('./organization/billCenter/expansionService'),
          },
        ],
      },
      {
        name: _l('全局变量'),
        key: 'variables',
        featureId: VersionProductType.globalVariable,
        routes: [
          {
            path: 'variables/:projectId',
            exact: true,
            component: () => import('./app/globalVariable/index.jsx'),
          },
        ],
      },
      {
        name: _l('额度管理'),
        key: 'quota',
        featureId: VersionProductType.quota,
        routes: [
          {
            path: 'quota/:projectId',
            exact: true,
            component: () => import('./app/quota'),
          },
        ],
      },
      {
        name: _l('专属资源'),
        featureIds: [VersionProductType.exclusiveResource, VersionProductType.dataBase],
        platformHiddenIds: [VersionProductType.dataBase],
        key: 'computing',
        hasBeta: false,
        routes: [
          {
            path: 'computing/:projectId/:explanId?',
            component: () => import('./app/exclusiveComp/index.jsx'),
          },
          {
            path: 'database/:projectId/:explanId?',
            component: () => import('./app/exclusiveComp/index.jsx'),
          },
          {
            path: 'expansionserviceComputing/*',
            component: () => import('./organization/billCenter/expansionService'),
          },
        ],
      },
      {
        name: _l('通用设置'),
        key: 'settings',
        routes: [
          {
            path: 'settings/:projectId/:type?',
            component: () => import('./settings'),
          },
        ],
      },
    ].filter(o => !(_.get(window, 'md.global.SysSettings.hideDataPipeline') && o.key === 'aggregationTable')),
  },
  {
    title: _l('支付与开票'),
    key: 'pay',
    icon: 'icon-payment3',
    subMenuList: [
      {
        name: _l('商户'),
        key: 'merchant',
        featureId: 40,
        menuPath: '/admin/merchant/:projectId',
        routes: [
          {
            path: 'merchant/:projectId',
            component: () => import('./pay/Merchant'),
          },
          {
            path: 'expansionservice/*',
            component: () => import('./organization/billCenter/expansionService'),
          },
        ],
      },
      {
        name: _l('订单'),
        key: 'transaction',
        featureId: 40,
        menuPath: '/admin/transaction/:projectId',
        routes: [
          {
            path: 'transaction/:projectId',
            component: () => import('./pay/OrderList'),
          },
          {
            path: 'refund/:projectId',
            component: () => import('./pay/OrderList'),
          },
        ],
      },
      {
        name: _l('开票'),
        key: 'invoice',
        featureId: VersionProductType.invoice,
        routes: [
          {
            path: 'invoice/:projectId/:type?',
            component: () => import('./pay/Invoice'),
          },
          {
            path: 'expansionservice/*',
            component: () => import('./organization/billCenter/expansionService'),
          },
        ],
      },
    ],
  },
  {
    title: _l('集成'),
    key: 'integration',
    icon: 'icon-device_hub',
    subMenuList: [
      {
        name: _l('企业身份'),
        key: 'platformintegration',
        menuPath: '/admin/platformintegration/:projectId',
        routes: [
          {
            path: 'platformintegration/:projectId/:type?',
            component: () => import('./integration/platformIntegration'),
          },
        ],
      },
      {
        name: _l('系统服务'),
        key: 'systemservice',
        menuPath: '/admin/systemservice/:projectId',
        routes: [
          {
            path: 'systemservice/:projectId',
            component: () => import('./integration/systemServices'),
          },
          {
            path: 'weixin/:projectId',
            component: () => import('./integration/systemServices'),
          },
          {
            path: 'cloudprint/:projectId',
            component: () => import('./integration/systemServices'),
          },
        ],
      },
      {
        name: _l('云服务'),
        key: 'cloudservice',
        featureId: VersionProductType.cloudService,
        routes: [
          {
            path: 'cloudservice/:projectId',
            component: () => import('./integration/cloudService'),
          },
        ],
      },
      {
        name: _l('OAuth 应用'),
        key: 'thirdapp',
        routes: [
          {
            path: 'thirdapp/:projectId/:type?',
            component: () => import('./integration/thirdpartyApp'),
          },
          {
            path: 'thirdapp/:projectId/:type?',
            component: () => import('./integration/thirdpartyApp'),
          },
        ],
      },
      {
        name: _l('其他'),
        key: 'integrationothers',
        routes: [
          {
            path: 'integrationothers/:projectId',
            component: () => import('./integration/others'),
          },
        ],
      },
    ],
  },
  {
    title: _l('安全'),
    key: 'security',
    icon: 'icon-security',
    subMenuList: [
      {
        name: _l('通讯录'),
        key: 'addressBook',
        routes: [
          {
            path: 'addressBook/:projectId',
            component: () => import('./security/account'),
          },
        ],
      },
      {
        name: _l('数据与访问'),
        key: 'dataAccess',
        routes: [
          {
            path: 'dataAccess/:projectId',
            exact: true,
            component: () => import('./security/data'),
          },
        ],
      },
      {
        name: _l('功能'),
        key: 'function',
        routes: [
          {
            path: 'function/:projectId',
            exact: true,
            component: () => import('./security/securityOthers'),
          },
        ],
      },
    ],
  },
  {
    title: _l('日志'),
    key: 'wysiwyg',
    icon: 'icon-wysiwyg',
    subMenuList: [
      {
        name: _l('应用'),
        featureId: 31,
        key: 'applog',
        menuPath: '/admin/applog/:projectId',
        routes: [
          {
            path: 'applog/:projectId',
            exact: true,
            component: () => import('./logs/AppLog'),
          },
        ],
      },
      {
        name: _l('登录'),
        key: 'loginlog',
        menuPath: '/admin/loginlog/:projectId',
        routes: [
          {
            path: 'loginlog/:projectId',
            exact: true,
            component: () => import('./logs/LoginLog'),
          },
        ],
      },
      {
        name: _l('组织管理'),
        key: 'orglog',
        menuPath: '/admin/orglog/:projectId',
        routes: [
          {
            path: 'orglog/:projectId',
            exact: true,
            component: () => import('./logs/orgLog'),
          },
        ],
      },
    ],
  },
];
