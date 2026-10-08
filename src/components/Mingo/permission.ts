import { getCurrentAppId } from 'src/components/Agent/buildContext';
import store from 'src/redux/configureStore';
import { FEATURE_PERMISSION } from 'src/utils/services/security/permission';

export const MINGO_FEATURE = {
  BUILD_APP: FEATURE_PERMISSION.MINGO_BUILD_APP,
  DATA_QUERY: FEATURE_PERMISSION.MINGO_DATA_QUERY,
  OTHERS: FEATURE_PERMISSION.MINGO_OTHER_ASSISTANT,
};
type MingoFeature = (typeof MINGO_FEATURE)[keyof typeof MINGO_FEATURE];
interface MingoProject {
  projectId: string;
  companyName?: string;
  allowMingoAppBuild?: boolean;
  allowMingoDataQueryAndAnalysis?: boolean;
  allowMingoAppOthers?: boolean;
}
const features: MingoFeature[] = Object.values(MINGO_FEATURE);
const projects = (): MingoProject[] => md.global.Account.projects as MingoProject[];
const aiHidden = (): boolean => Boolean(md.global.SysSettings.hideAIBasicFun);
const readFeature = (project: MingoProject, feature: MingoFeature): boolean =>
  project[feature] === undefined || Boolean(project[feature]);
const getProject = (projectId: string): MingoProject | undefined =>
  projects().find(project => project.projectId === projectId) ||
  (md.global.Account.externalProjects as MingoProject[] | undefined)?.find(project => project.projectId === projectId);
export const getMingoDisabledTip = (): string => _l('当前组织已禁止使用MingoAI功能');
export function getMingoContextProjectId(): string {
  const state = store.getState() as { appPkg?: { projectId?: string } };
  if (getCurrentAppId() && state.appPkg?.projectId) return state.appPkg.projectId;
  const cached = localStorage.getItem('currentProjectId') || '';
  return projects().some(project => project.projectId === cached) ? cached : projects()[0]?.projectId || '';
}
export function isMingoFeatureAllowed(feature: MingoFeature, projectId = getMingoContextProjectId()): boolean {
  const project = getProject(projectId);
  return !aiHidden() && Boolean(project && readFeature(project, feature));
}
export const canBuildAppWithMingo = (projectId?: string): boolean =>
  isMingoFeatureAllowed(MINGO_FEATURE.BUILD_APP, projectId);
export const canQueryDataWithMingo = (projectId?: string): boolean =>
  isMingoFeatureAllowed(MINGO_FEATURE.DATA_QUERY, projectId);
export const canUseMingoOtherAssistant = (projectId?: string): boolean =>
  isMingoFeatureAllowed(MINGO_FEATURE.OTHERS, projectId);
export function isProjectMingoEnabled(projectId: string): boolean {
  const project = getProject(projectId);
  return !aiHidden() && Boolean(project && features.some(feature => readFeature(project, feature)));
}
export function getMingoEnabledProjects(): MingoProject[] {
  return aiHidden() ? [] : projects().filter(project => features.some(feature => readFeature(project, feature)));
}
export function getDefaultMingoProjectId(preferProjectId?: string): string {
  return preferProjectId && isProjectMingoEnabled(preferProjectId)
    ? preferProjectId
    : getMingoEnabledProjects()[0]?.projectId || preferProjectId || '';
}
export function canShowMingoEntry(): boolean {
  return (
    !aiHidden() &&
    (getCurrentAppId() ? isProjectMingoEnabled(getMingoContextProjectId()) : Boolean(getMingoEnabledProjects().length))
  );
}
