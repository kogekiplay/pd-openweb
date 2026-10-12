import { isFileRecord } from './AppBuilder/fileTypes';
import type { PlanFiles } from './AppBuilder/planTypes';

export interface BuilderOpenEvent {
  artifactId: string;
  versionId: string;
  name: string;
  versionLabel: string;
  source: string;
  appId: string;
  built: boolean | undefined;
  appIcon: string;
  appColor: string;
}
export interface BuilderEdit {
  module?: string | undefined;
  card?: string | undefined;
  text: string;
}
export interface PendingAgentEdit extends BuilderEdit {
  id: string;
}
export interface PromptEvent {
  text: string;
}
export interface PlanMetaEvent {
  artifactId: string;
  versionId: string;
  appIcon: string;
  appColor: string;
  appName: string;
}
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const optionalText = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
export function decodeBuilderOpenEvent(payload: unknown): BuilderOpenEvent | null {
  if (!isFileRecord(payload)) return null;
  return {
    artifactId: text(payload['artifactId']),
    versionId: text(payload['versionId']),
    name: text(payload['name']),
    versionLabel: text(payload['versionLabel']),
    source: text(payload['source']),
    appId: text(payload['appId']),
    built: typeof payload['built'] === 'boolean' ? payload['built'] : undefined,
    appIcon: text(payload['appIcon']),
    appColor: text(payload['appColor']),
  };
}
export function decodePromptEvent(payload: unknown): PromptEvent | null {
  if (!isFileRecord(payload) || typeof payload['text'] !== 'string') return null;
  return { text: payload['text'] };
}
export function decodeBuilderEdit(payload: unknown): BuilderEdit | null {
  if (!isFileRecord(payload) || typeof payload['text'] !== 'string') return null;
  return { module: optionalText(payload['module']), card: optionalText(payload['card']), text: payload['text'] };
}
export function decodeAskReply(payload: unknown): { answers: unknown[] } | null {
  if (!isFileRecord(payload) || !Array.isArray(payload['answers'])) return null;
  const answers: unknown[] = payload['answers'];
  return { answers };
}
export function isAgentPlanFiles(value: unknown): value is PlanFiles {
  return (
    isFileRecord(value) &&
    Object.values(value).every(
      file => isFileRecord(file) && (!('content' in file) || typeof file['content'] === 'string'),
    )
  );
}
export function decodeFilesEvent(payload: unknown): { files: PlanFiles } | null {
  if (!isFileRecord(payload) || !isAgentPlanFiles(payload['files'])) return null;
  return { files: payload['files'] };
}
export function decodeGenerateEvent(payload: unknown): { files: PlanFiles | undefined; source: string } | null {
  if (!isFileRecord(payload)) return null;
  const files = payload['files'];
  if (files && !isAgentPlanFiles(files)) return null;
  return { files: isAgentPlanFiles(files) ? files : undefined, source: text(payload['source']) };
}
export function decodeAppNameEvent(payload: unknown): { name: string; versionLabel: string } | null {
  if (!isFileRecord(payload)) return null;
  return { name: text(payload['name']), versionLabel: text(payload['versionLabel']) };
}
export function decodePlanMetaEvent(payload: unknown): PlanMetaEvent | null {
  if (!isFileRecord(payload)) return null;
  return {
    artifactId: text(payload['artifactId']),
    versionId: text(payload['versionId']),
    appIcon: text(payload['appIcon']),
    appColor: text(payload['appColor']),
    appName: text(payload['appName']),
  };
}
