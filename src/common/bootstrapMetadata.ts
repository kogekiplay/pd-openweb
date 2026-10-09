/** Only fields consumed by the common page bootstrap are claimed here; other metadata stays unknown. */
export interface BootstrapProject {
  projectId?: string | undefined;
  companyName?: string | undefined;
}
export interface BootstrapProjectLanguage {
  langType?: number | undefined;
  projectId?: string | undefined;
  data?: Array<{ value?: string | undefined }> | undefined;
}
interface BootstrapAccount {
  accountId: string;
  isPortal?: boolean | undefined;
  appId?: string | undefined;
  lang?: string | undefined;
  langModified?: boolean | undefined;
  projects?: BootstrapProject[] | undefined;
}
interface BootstrapConfig {
  ProductCode: string;
  WebUrl?: string | undefined;
  DefaultLang?: string | undefined;
  DefaultConfig?:
    | {
        initialCountry?: string | undefined;
        preferredCountries?: string[] | undefined;
      }
    | undefined;
}
export interface BootstrapMetadata {
  Account: BootstrapAccount;
  Config: BootstrapConfig;
  SysSettings: { forbidSuites?: string | undefined };
  ProjectLangs?: BootstrapProjectLanguage[] | undefined;
}
export interface BootstrapReply {
  config?: Window['config'] | undefined;
  'md.global': Record<string, unknown>;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const optionalString = (value: unknown) => value === undefined || typeof value === 'string';
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
export function metadataRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError('Invalid bootstrap metadata object');
  return value;
}
function isProject(value: unknown): value is BootstrapProject {
  return isRecord(value) && optionalString(value['projectId']) && optionalString(value['companyName']);
}
function isAccount(value: unknown): value is BootstrapAccount {
  return (
    isRecord(value) &&
    typeof value['accountId'] === 'string' &&
    optionalBoolean(value['isPortal']) &&
    optionalString(value['appId']) &&
    optionalString(value['lang']) &&
    optionalBoolean(value['langModified']) &&
    (value['projects'] === undefined || (Array.isArray(value['projects']) && value['projects'].every(isProject)))
  );
}
function isConfig(value: unknown): value is BootstrapConfig {
  if (
    !isRecord(value) ||
    typeof value['ProductCode'] !== 'string' ||
    !optionalString(value['WebUrl']) ||
    !optionalString(value['DefaultLang'])
  )
    return false;
  const defaults = value['DefaultConfig'];
  return (
    defaults === undefined ||
    (isRecord(defaults) &&
      optionalString(defaults['initialCountry']) &&
      (defaults['preferredCountries'] === undefined ||
        (Array.isArray(defaults['preferredCountries']) &&
          defaults['preferredCountries'].every((country: unknown) => typeof country === 'string'))))
  );
}
function isProjectLanguage(value: unknown): value is BootstrapProjectLanguage {
  return (
    isRecord(value) &&
    optionalString(value['projectId']) &&
    (value['langType'] === undefined || typeof value['langType'] === 'number') &&
    (value['data'] === undefined ||
      (Array.isArray(value['data']) &&
        value['data'].every((item: unknown) => isRecord(item) && optionalString(item['value']))))
  );
}
function isMetadata(value: unknown): value is BootstrapMetadata {
  return (
    isRecord(value) &&
    isAccount(value['Account']) &&
    isConfig(value['Config']) &&
    isRecord(value['SysSettings']) &&
    optionalString(value['SysSettings']['forbidSuites']) &&
    (value['ProjectLangs'] === undefined ||
      (Array.isArray(value['ProjectLangs']) && value['ProjectLangs'].every(isProjectLanguage)))
  );
}
export function decodeBootstrapMetadata(value: unknown): BootstrapMetadata {
  if (!isMetadata(value)) throw new TypeError('Invalid bootstrap metadata fields');
  return value;
}
function isReply(value: unknown): value is BootstrapReply {
  if (!isRecord(value) || !isRecord(value['md.global'])) return false;
  const config = value['config'];
  return (
    config === undefined ||
    (isRecord(config) &&
      optionalBoolean(config['SocketPolling']) &&
      ['FilePath', 'AttrPath', 'SERVER_NAME', 'containerId'].every(key => optionalString(config[key])))
  );
}
export function decodeBootstrapReply(value: unknown): BootstrapReply {
  if (!isReply(value)) throw new TypeError('Invalid bootstrap reply');
  return value;
}
