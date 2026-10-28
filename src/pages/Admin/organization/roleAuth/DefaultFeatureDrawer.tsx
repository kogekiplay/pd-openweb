import { useEffect, useState } from 'react';
import { Drawer } from 'antd';
import styled from 'styled-components';
import { Button, Icon, LoadDiv } from 'ming-ui';
import projectSettingController from 'src/api/projectSetting';
import { alertIfNotUnauthorized } from 'src/utils/services/request/error';
import PermissionList from './createEditRole/PermissionList';
import { hasPermissionEditChanged } from './utils';

/**
 * 「全员默认功能」抽屉。
 *
 * 语义来自上游 7.5.3 的同名组件：把「仅管理员可用」这类开关按**全员默认拥有**的口径呈现 ——
 * 勾选 = 全员可用，取消勾选 = 仅管理员/被授权角色可用。存储仍走原有 ProjectSetting.SetOnlyManager，
 * 因此**不改变任何后端授权模型**，只是给同一批开关换一个入口与口径。
 *
 * 本文件刻意只声明真正消费到的视图：
 *  - 权限树节点固定四类字段（id / 名称 / 子节点 / 说明），与 createEditRole/PermissionList 的入参一致；
 *  - 可持久化键收敛成有限联合 PersistedFeatureKey，**不引入开放索引**。
 */

/** 与 SetOnlyManager 参数一一对应的可持久化功能键。这是本文件唯一的键域。 */
type PersistedFeatureKey =
  | 'onlyManagerCreateApp'
  | 'onlyManagerDeleteApp'
  | 'apiIntgOnlyManager'
  | 'pluginsOnlyManager'
  | 'dataPipeOnlyManager'
  | 'mingoAppBuild'
  | 'mingoDataQueryAndAnalysis'
  | 'mingoAppOthers'
  | 'superSearchOnlyManager';

const PERSISTED_FEATURE_KEYS: PersistedFeatureKey[] = [
  'onlyManagerCreateApp',
  'onlyManagerDeleteApp',
  'apiIntgOnlyManager',
  'pluginsOnlyManager',
  'dataPipeOnlyManager',
  'mingoAppBuild',
  'mingoDataQueryAndAnalysis',
  'mingoAppOthers',
  'superSearchOnlyManager',
];

const isPersistedFeatureKey = (permissionId: string): permissionId is PersistedFeatureKey =>
  PERSISTED_FEATURE_KEYS.some(key => key === permissionId);

type OnlyManagerSettings = HapApi.MD.Web.Ajax.ResultModel.Project.OnlyManagerSettingsModel;

/** 抽屉里的一棵权限树节点；叶子是 PersistedFeatureKey，父节点只是分组标识。 */
interface FeaturePermissionNode {
  permissionId: string;
  permissionName: string;
  subPermission: FeaturePermissionNode[];
  description?: string;
}

const createLeafPermission = (permissionId: string, permissionName: string): FeaturePermissionNode => ({
  permissionId,
  permissionName,
  subPermission: [],
});

const createDescribedLeafPermission = (
  permissionId: string,
  permissionName: string,
  description: string,
): FeaturePermissionNode => ({
  permissionId,
  permissionName,
  subPermission: [],
  description,
});

const DEFAULT_ONLY_MANAGER_SETTINGS: OnlyManagerSettings = {
  apiIntgOnlyManager: false,
  dataPipeOnlyManager: false,
  pluginsOnlyManager: false,
  superSearchOnlyManager: false,
  allowMingoAgentCharge: false,
};

/** 读取接口返回里本文件真正会用的键，逐键显式映射 —— 不做动态取键、不引入索引签名。 */
const readOnlyManagerSettings = (
  settings: OnlyManagerSettings,
): Record<PersistedFeatureKey, boolean | undefined> => ({
  onlyManagerCreateApp: settings.onlyManagerCreateApp,
  onlyManagerDeleteApp: settings.onlyManagerDeleteApp,
  apiIntgOnlyManager: settings.apiIntgOnlyManager,
  pluginsOnlyManager: settings.pluginsOnlyManager,
  dataPipeOnlyManager: settings.dataPipeOnlyManager,
  mingoAppBuild: settings.mingoAppBuild,
  mingoDataQueryAndAnalysis: settings.mingoDataQueryAndAnalysis,
  mingoAppOthers: settings.mingoAppOthers,
  superSearchOnlyManager: settings.superSearchOnlyManager,
});

/** 与原实现同序同条件：平台版才有「创建应用」，集成/插件各自被对应开关隐藏。 */
const getFeaturePermissions = (): FeaturePermissionNode[] => {
  const { hideIntegration, hidePlugin, hideAIBasicFun } = md.global.SysSettings;

  const appPermissions: FeaturePermissionNode[] = [
    ...(window.platformENV.isPlatform ? [createLeafPermission('onlyManagerCreateApp', _l('创建应用'))] : []),
    createLeafPermission('onlyManagerDeleteApp', _l('删除应用')),
    ...(!hideIntegration ? [createLeafPermission('apiIntgOnlyManager', _l('创建 API 连接'))] : []),
    ...(!hidePlugin ? [createLeafPermission('pluginsOnlyManager', _l('创建插件'))] : []),
    // 创建同步任务权限改由组织角色的 CREATE_SYNC_TASK_FEATURE / CREATE_SYNC_TASK 控制，暂不在全员默认功能中展示。
  ];

  const permissions: FeaturePermissionNode[] = [
    {
      permissionId: 'appDevelopment',
      permissionName: _l('应用开发'),
      subPermission: appPermissions,
    },
    ...(!hideAIBasicFun
      ? [
          {
            permissionId: 'mingoAI',
            permissionName: _l('Mingo AI 功能'),
            subPermission: [
              createLeafPermission('mingoAppBuild', _l('应用规划与搭建')),
              createLeafPermission('mingoDataQueryAndAnalysis', _l('数据查询')),
              createDescribedLeafPermission(
                'mingoAppOthers',
                _l('其他应用辅助功能'),
                _l(
                  '除应用规划与搭建、数据查询外的其他 Mingo AI 辅助功能，包含：创建工作表、创建记录、优化名称和图标、生成示例数据等。',
                ),
              ),
            ],
          },
        ]
      : []),
    {
      permissionId: 'other',
      permissionName: _l('其他'),
      subPermission: [createLeafPermission('superSearchOnlyManager', _l('超级搜索（搜索记录）'))],
    },
  ];

  // 分组下没有任何可见叶子时整组不展示（与上游一致）。
  return permissions.filter(item => item.subPermission.length);
};

/**
 * 由「接口返回的开关值」反推初始勾选：开关为假 ⇒ 全员拥有 ⇒ 勾选。
 * 叶子全部勾选时父分组也勾上（与上游一致）。
 */
const getInitialSelectedIds = (
  permissions: FeaturePermissionNode[],
  settings: Record<PersistedFeatureKey, boolean | undefined>,
): string[] => {
  const selectedIds: string[] = [];

  permissions.forEach(permission => {
    permission.subPermission.forEach(item => {
      const onlyManagerEnabled = isPersistedFeatureKey(item.permissionId)
        ? settings[item.permissionId]
        : undefined;

      if (!onlyManagerEnabled) {
        selectedIds.push(item.permissionId);
      }
    });

    if (permission.subPermission.every(item => selectedIds.includes(item.permissionId))) {
      selectedIds.push(permission.permissionId);
    }
  });

  return selectedIds;
};

const DefaultFeatureDrawerWrapper = styled(Drawer)`
  .ant-drawer-header {
    border: none;
    .ant-drawer-close {
      display: none;
    }
  }
  .ant-drawer-body {
    padding: var(--space-2) var(--space-6) var(--space-4) var(--space-6);
  }
  .ant-drawer-footer {
    padding: var(--space-3) var(--space-6);
    border: none;
  }
`;

interface DefaultFeatureDrawerProps {
  projectId: string;
  onClose: () => void;
}

export default function DefaultFeatureDrawer(props: DefaultFeatureDrawerProps) {
  const { projectId, onClose } = props;
  const [permissions] = useState<FeaturePermissionNode[]>(getFeaturePermissions);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialSelectedIds, setInitialSelectedIds] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    projectSettingController.getOnlyManagerSettings({ projectId }).then(data => {
      if (cancelled) return;

      const nextSelectedIds = getInitialSelectedIds(
        permissions,
        readOnlyManagerSettings(data || DEFAULT_ONLY_MANAGER_SETTINGS),
      );

      setSelectedIds(nextSelectedIds);
      setInitialSelectedIds(nextSelectedIds);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [permissions, projectId]);

  const hasUnsavedChanges = hasPermissionEditChanged({ selectedIds: initialSelectedIds }, { selectedIds });

  const onSave = async () => {
    // 只提交真正渲染出来、且落在开关键域内的键；未展示的键保持后端原值（SetOnlyManager 对空值不设置）。
    const persistedKeys = permissions
      .flatMap(permission => permission.subPermission.map(item => item.permissionId))
      .filter(isPersistedFeatureKey);

    const settings: Partial<Record<PersistedFeatureKey, boolean>> = {};

    persistedKeys.forEach(key => {
      settings[key] = !selectedIds.includes(key);
    });

    setSaving(true);

    try {
      const succeeded = await projectSettingController.setOnlyManager({ projectId, ...settings });

      if (!succeeded) {
        alert(_l('设置失败'), 2);
        return;
      }

      alert(_l('设置成功'));
      onClose();
    } catch (requestError) {
      alertIfNotUnauthorized(requestError, _l('设置失败'), 2);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DefaultFeatureDrawerWrapper
      open={true}
      size={600}
      mask={{ closable: !hasUnsavedChanges }}
      title={_l('全员默认功能')}
      extra={<Icon icon="close" className="Font20 textTertiary Hand" onClick={onClose} />}
      footer={
        <div className="flexRow alignItemsCenter">
          <Button type="primary" loading={saving} disabled={loading} onClick={onSave}>
            {_l('确定')}
          </Button>
          <Button type="link" className="mLeft12" disabled={saving} onClick={onClose}>
            {_l('取消')}
          </Button>
        </div>
      }
      onClose={onClose}
    >
      {loading && <LoadDiv />}
      {!loading && (
        <PermissionList
          projectId={projectId}
          permissions={permissions}
          selectedIds={selectedIds}
          onChangePermission={setSelectedIds}
        />
      )}
    </DefaultFeatureDrawerWrapper>
  );
}
