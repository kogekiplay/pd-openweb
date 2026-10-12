import { fileArray, isFileRecord } from '../fileTypes';
import type { PlanItem } from '../planTypes';

export type AppItemType = 'worksheet' | 'dashboard' | 'workspace' | 'aiAssistant';
export interface CardStyle {
  $color?: string | undefined;
  $bg?: string | undefined;
  $border?: string | undefined;
}
export interface IntentHint {
  label: string;
}
export type CompactItems = string | string[];
export interface PlanCardItem {
  name: string;
  title: string;
  worksheetName: string;
  dashboardName: string;
  assistantName: string;
  groupName: string;
  group: string;
  type: string;
  description: string;
  icon: string;
  color: string;
  fields: CompactItems;
  views: CompactItems;
  charts: CompactItems;
  components: CompactItems;
}
export interface RoleCardItem {
  name: string;
  roleName: string;
  roleId: string | number | undefined;
  roleScope: string;
  description: string;
  permissions: string[];
}
export interface ActionCardItem {
  name: string;
  type: string;
  description: string;
  targetWorksheet: string;
  intentHints: IntentHint[];
}
export interface ActionGroup {
  worksheet: string;
  actions: ActionCardItem[];
}
export interface WorkflowCardItem {
  name: string;
  description: string;
  trigger: { type: string; source: string; label: string };
  intentHints: IntentHint[];
}
export function panelText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function records(value: unknown): Record<string, unknown>[] {
  return fileArray(value).filter(isFileRecord);
}
function hints(value: unknown): IntentHint[] {
  return records(value).map(item => ({ label: panelText(item['label']) }));
}
function texts(value: unknown): string[] {
  return fileArray(value).filter((item): item is string => typeof item === 'string');
}
function compact(value: unknown): CompactItems {
  return typeof value === 'string' ? value : texts(value);
}
export function planCardItems(value: unknown): PlanCardItem[] {
  return records(value).map(item => ({
    name: panelText(item['name']),
    title: panelText(item['title']),
    worksheetName: panelText(item['worksheetName']),
    dashboardName: panelText(item['dashboardName']),
    assistantName: panelText(item['assistantName']),
    groupName: panelText(item['groupName']),
    group: panelText(item['group']),
    type: panelText(item['type']),
    description: panelText(item['description']),
    icon: panelText(item['icon']),
    color: panelText(item['color']),
    fields: compact(item['fields']),
    views: compact(item['views']),
    charts: compact(item['charts']),
    components: compact(item['components']),
  }));
}
export function roleCardItems(value: unknown): RoleCardItem[] {
  return records(value).map(item => {
    const roleId = item['roleId'];
    return {
      name: panelText(item['name']),
      roleName: panelText(item['roleName']),
      roleId:
        typeof roleId === 'string' || (typeof roleId === 'number' && Number.isFinite(roleId)) ? roleId : undefined,
      roleScope: panelText(item['roleScope']),
      description: panelText(item['description']),
      permissions: texts(item['permissions']),
    };
  });
}
export function actionGroups(value: unknown): ActionGroup[] {
  return records(value).map(group => ({
    worksheet: panelText(group['worksheet']),
    actions: records(group['actions']).map(item => ({
      name: panelText(item['name']),
      type: panelText(item['type']),
      description: panelText(item['description']),
      targetWorksheet: panelText(item['targetWorksheet']),
      intentHints: hints(item['intentHints']),
    })),
  }));
}
export function workflowCardItems(value: unknown): WorkflowCardItem[] {
  return records(value).map(item => {
    const trigger = isFileRecord(item['trigger']) ? item['trigger'] : {};
    return {
      name: panelText(item['name']),
      description: panelText(item['description']),
      trigger: {
        type: panelText(trigger['type']),
        source: panelText(trigger['source']),
        label: panelText(trigger['label']),
      },
      intentHints: hints(item['intentHints']),
    };
  });
}
// JSON type names must not resolve inherited entries such as __proto__ or constructor.
export function panelConfig<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
function exportItem(item: Record<string, unknown>): PlanItem {
  const trigger = isFileRecord(item['trigger']) ? item['trigger'] : {};
  return {
    label: panelText(item['label']),
    name: panelText(item['name']),
    title: panelText(item['title']),
    worksheetName: panelText(item['worksheetName']),
    dashboardName: panelText(item['dashboardName']),
    assistantName: panelText(item['assistantName']),
    groupName: panelText(item['groupName']),
    group: panelText(item['group']),
    roleName: panelText(item['roleName']),
    roleScope: panelText(item['roleScope']),
    description: panelText(item['description']),
    type: panelText(item['type']),
    worksheet: panelText(item['worksheet']),
    targetWorksheet: panelText(item['targetWorksheet']),
    fields: compact(item['fields']),
    views: compact(item['views']),
    charts: compact(item['charts']),
    components: compact(item['components']),
    permissions: compact(item['permissions']),
    intentHints: hints(item['intentHints']),
    trigger: {
      type: panelText(trigger['type']),
      source: panelText(trigger['source']),
      label: panelText(trigger['label']),
    },
  };
}
export function exportPlanItems(value: unknown): PlanItem[] {
  return records(value).map(item => ({ ...exportItem(item), actions: records(item['actions']).map(exportItem) }));
}
