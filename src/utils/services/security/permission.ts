export { hasPermission, getMyPermissions, checkPermission } from 'src/components/checkPermission/index';

export const FEATURE_PERMISSION = {
  CREATE_APP: 'cannotCreateApp', DELETE_APP: 'cannotDeleteApp', API_INTEGRATION: 'allowAPIIntegration',
  DATA_PIPELINE: 'allowDataPipeline', PLUGIN: 'allowPlugin', SUPER_SEARCH: 'allowSuperSearch',
  MINGO_BUILD_APP: 'allowMingoAppBuild', MINGO_DATA_QUERY: 'allowMingoDataQueryAndAnalysis', MINGO_OTHER_ASSISTANT: 'allowMingoAppOthers',
} as const;
type FeaturePermission = typeof FEATURE_PERMISSION[keyof typeof FEATURE_PERMISSION];
export const hasFeaturePermission = (projectId: string | null | undefined, feature: string): boolean => {
  if (!projectId || !(Object.values(FEATURE_PERMISSION) as string[]).includes(feature)) return false;
  const projects = md.global.Account.projects as Array<{ projectId: string } & Partial<Record<FeaturePermission, boolean>>>;
  const project = (projects || []).find(item => item.projectId === projectId);
  if (!project) return false;
  const allowed = project[feature as FeaturePermission];
  return feature === FEATURE_PERMISSION.CREATE_APP || feature === FEATURE_PERMISSION.DELETE_APP ? !allowed : Boolean(allowed);
};
