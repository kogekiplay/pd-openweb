/**
 * 从后端 wwwapi 的 swagger 快照生成接口响应类型，并给 src/api 下各方法标上返回类型。
 *
 * 【为什么】src/api 的 1877 个方法原来一律返回 ApiResult（= Promise<any>），接口数据从源头就是 any：
 * 调用方 `.then(res => res.list.map(item => …))` 里的每个回调形参都拿不到上下文类型（终点口径下 TS7006 的大头），
 * 读错字段名也不会有任何提示。swagger 里 94% 的操作带响应 schema（契约质量见仓库外的
 * HAP-swagger-契约参考.md），是这些数据唯一的权威类型来源。
 *
 * 【产物】
 *   types/hap-api.d.ts   全局命名空间 HapApi 下的 schema 声明，名字照 .NET 全名分层
 *                        （HapApi.MD.Web.Ajax.ResultModel.App.AppModel）；只生成 src/api 实际用到的那部分
 *   src/api/*.ts         标准形状的方法 `(args: ApiArgs, options: ApiOptions = {})` 补上 `: ApiResultOf<…>`
 * 只动返回类型，参数（args）还是 ApiArgs —— 参数侧要逐个核对调用点，是下一步的事。
 *
 * 【映射规则】（swagger 描述的是 mdyAPI 解开信封之后 resolve 出来的 data，见 src/common/global.ts 的 mdyAPI）
 *   - 服务端【不输出值为 null 的属性】（实测：GetApp / GetWorksheetInfo / GetFilterRows 等，缺的键全是 nullable 的，
 *     一个 null 都没出现过），所以只有不可空的数字 / 布尔 / 枚举一定在；其余属性（字符串、数组、对象引用）都写成可选
 *     `?: T | undefined`，也不加 `| null`
 *   - 整数枚举 → 数字字面量联合；没有属性的 object、JToken 一类「任意 JSON」→ ApiPayload（接口原样透传的 any）
 *   - 泛型实例名（ReturnResult`1[[…]]）与嵌套类型（A+B）改写成合法标识符
 *
 * 【只接「核对过」的接口】swagger 并不总是对的：泛型 ListModel<T> 的 schema 里只有 resultCode（实际响应带
 * list / allCount），HomeApp/GetAppItems 的项实际是 workSheetId / workSheetName 而 schema 写的是 id / name。
 * 所以只给 VERIFIED 里的接口标类型 —— 每一条都拿真实响应比过键名（只看键、不看值），比对结果记在旁边。
 * 要加接口：先在已登录的页面里 `mdyAPI(controller, action, args)` 取一次，对照 schema 的属性名，再加进来。
 *
 * 用法：node tools/gen-api-types.ts --swagger <swagger-wwwapi-v8.0.0.0.json> [--dry]
 * 快照不入库（它等于整份内部接口的地图，见契约参考文档 §2），重新生成时从仓库外指给它。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const ROOT: string = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'src/api');
const OUT_FILE = path.join(ROOT, 'types/hap-api.d.ts');
const DRY = process.argv.includes('--dry');
const swaggerArg = process.argv[process.argv.indexOf('--swagger') + 1];

if (!process.argv.includes('--swagger') || !swaggerArg) {
  console.error('用法：node tools/gen-api-types.ts --swagger <swagger-wwwapi.json> [--dry]');
  process.exit(1);
}

interface Schema {
  $ref?: string;
  type?: string;
  format?: string;
  enum?: (number | string)[];
  items?: Schema;
  properties?: Record<string, Schema>;
  additionalProperties?: Schema | boolean;
  required?: string[];
  nullable?: boolean;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  description?: string;
}

interface Operation {
  summary?: string;
  responses?: Record<string, { content?: Record<string, { schema?: Schema }> }>;
}

interface Swagger {
  paths: Record<string, { get?: Operation; post?: Operation }>;
  components: { schemas: Record<string, Schema> };
}

const swagger: Swagger = JSON.parse(fs.readFileSync(swaggerArg, 'utf8'));
const schemas = swagger.components.schemas;

/**
 * 核对过的接口（controller/action）：真实响应的键名与 schema 一致，缺的只是值为 null 的属性。
 * 2026-09-24 在生产（7.4.5 后端）上各取一次比对。
 */
const VERIFIED = new Set([
  'HomeApp/GetAllHomeApp', // 8 个键全对上
  'HomeApp/GetApp', // 缺 13 个，全是 null 值（goodsId、license、langInfo…）
  'Worksheet/GetWorksheetInfo', // 缺 pyName、pluginConfiguration（null）
  'Worksheet/GetWorksheetControls', // 缺 msg（null）
  'Worksheet/GetFilterRows', // 缺 worksheet、template、clientId（null）
  // 第二批（同日，5 个应用 × 每个 2 张表各取一次）
  'HomeApp/GetWorksheetsByAppId', // 项就是 EntityInfo（改名同下）
  'HomeApp/GetAppItems',
  'HomeApp/GetAppSimpleInfo',
  'Worksheet/GetRowDetail', // view 是 any（schema 就是这么写的），rowData 是动态键
  'Worksheet/GetRowRelationRows', // swagger 没有响应 schema，见 RESPONSE_OVERRIDES
  'Worksheet/GetWorksheetBtns',
  'Worksheet/GetSwitchPermit',
  'Worksheet/GetControlRules',
  'Worksheet/GetQueryBySheetId',
  'Worksheet/GetWorksheetsControls', // 见 RESPONSE_OVERRIDES
  'Project/GetProjectLicenseSupportInfo',
  'AppManagement/GetAppForManager', // 改名见 SCHEMA_PATCHES
  // GetPrintList 取到的全是空数组，核对不了，先不接
  // 第三批（同日，页面内脚本批量取样）：只挑读取类接口，名字 / 参数带分享、令牌、验证码、密码、集成凭据、
  // 支付的一律不碰；参数从已核对接口的响应里取 id 填，缺 id 的不调。下面这些都是有真实数据可比、
  // 每一层的键名和值的种类都和 schema 一致的（整个响应是空数组、拿不到数据的没放进来）
  'AppManagement/GetAppRoleSetting',
  'AppManagement/GetWorksheetsUnderTheApp',
  'Organize/GetOrgRoleGroupsByProjectId',
  'HomeApp/GetMyApp',
  'ExternalPortal/GetConfig',
  'FixedData/LoadLangList',
  'Role/GetProjectPermissionsByUser',
  'Kc/GetUsage',
  'Calendar/GetUserAllCalCategories',
  'PublicWorksheet/GetPublicWorksheetInfo',
  'AppManagement/GetAppRoleSummary',
  'HomeApp/GetApiInfo',
  'PersonalStyle/GetAccountsPersonalStatus',
  'TaskCenter/GetMyTaskList',
  'Worksheet/GetViewPermission',
  'Department/GetDepartmentsByAccountId',
  'Organize/GetOrganizesByAccountId',
  'Worksheet/GetWorksheetViews',
  'ProjectSetting/GetAutoPurchaseWorkflowExtPack',
  'ProjectSetting/GetAutoPurchaseDataPipelineExtPack',
  'ProjectSetting/GetStructureForAll',
  'AppManagement/GetTotalMember',
  'HomeApp/GetHomePlatformSetting',
  'AppManagement/GetValidBackupFileInfo',
  'Worksheet/GetWorksheetApiInfo',
  'Worksheet/GetSwitch',
  'PersonalStyle/GetPersonalStatus',
  'SmartSearch/GetFilterCount',
  'HomeApp/GetAppFirstInfo',
  'Worksheet/GetAppExtendAttr',
  'TaskCenter/GetSubordinateTaskGantt',
  'Role/GetMyPermissions',
  'Account/GetMyContactInfo',
  'Kc/GetTotalUsedSize',
  'Calendar/GetUserBusyStatus',
  'Project/GetProjectLimitationInfo',
  'Worksheet/GetWorksheetViewById',
  'Worksheet/GetFollower',
  'Worksheet/GetWorksheetReferences',
  'AppManagement/CheckAppAdminForUser',
  'Department/SearchDeptAndUsers',
  'ExternalPortal/GetAppInfoByProject',
  'ExternalPortal/GetUsers',
  'ProjectSetting/GetAutoPurchaseExternalUserExtPack',
  'Role/IsSuperAdmin',
  'Role/GetUnauditedUserCount',
  'AppManagement/IsFirstInactiveUsers',
  'AppManagement/QueryInactiveUsers',
  'Attachment/GetAttachmentTotal',
  'HomeApp/GetAppRecoveryRecordList',
  'AppManagement/GetLogs',
  'AppManagement/GetUpgradeLogsByProject',
  'DataLimit/GetLimitRowTotal',
  'DataLimit/GetListPage',
  'Project/GetDBInstanceLimit',
  'ProjectSetting/GetColorSettings',
  'Application/GetProjectApplicationList',
  'DataLimit/GetAttachmentSetting',
  'ActionLog/GetActionLogs',
  'ActionLog/GetOrgLogs',
  'Project/GetProjectSource',
  'HomeApp/GetOwnedApp',
  'AppManagement/GetOutsourcingMembers',
  'AppManagement/GetAppStructureForER',
  'AppManagement/GetAppSupportInfo',
  'AppManagement/GetBackupTask',
  'Register/CheckExistAccountByCurrentAccount',
  'PublicWorksheet/GetPublicQuery',
  'Worksheet/GetRowIndexes',
  'Worksheet/GetFormSubmissionSettings',
  'AppManagement/GetDebugRoles',
  'Role/IsLastSuperAdmin',
  'Worksheet/GetFormComponent',
  'ExternalPortal/GetExAccountCategoryCount',
  'ExternalPortal/GetUserActionLogs',
  'ExternalPortal/GetViewShowControls',
  'ExternalPortal/GetUserAgreement',
  'ExternalPortal/GetPrivacyTerms',
  'TaskCenter/GetLeftMenu',
  'Chat/GetCardDetails',
  'User/CheckAccountSecured',
  'TaskCenter/GetSettingDefualtProjectId',
  'TaskCenter/GetSetting',
  'TaskCenter/GetTaskListWithStar',
  'TaskCenter/GetTopFolderList',
  'TaskCenter/GetProjectsFolderNotice',
  'TaskCenter/GetArchiveFolderList',
  'TaskCenter/GetHiddenFolderList',
  'Worksheet/GetWorksheetCurrencyInfos',
  'FixedData/CheckSensitive',
  'FixedData/GetRegionConfigInfos',
  'FixedData/LoadTimeZones',
]);

/**
 * 按真实响应核对出来的 schema 修正。服务端有些类用 Newtonsoft 的 JsonProperty 改了序列化名，swagger 没反映出来；
 * 判据：真实响应里多出来的键 + schema 里「不可空、按理一定出现却从没出现」的键，两边一一对上。
 */
const SCHEMA_PATCHES: Record<
  string,
  { rename?: Record<string, string>; required?: string[]; add?: Record<string, string> }
> = {
  // GetAppItems 的项、GetApp 里分组下的 workSheetInfo[]：实际是 workSheetId / workSheetName
  'MD.Entity.Apk.EntityInfo': { rename: { id: 'workSheetId', name: 'workSheetName' } },
  // GetApp 的 sections[] / childSections[]：实际是 appSectionId / workSheetInfo
  'MD.Entity.Apk.AppSectionDomainModel': { rename: { id: 'appSectionId', entityInfo: 'workSheetInfo' } },
  // GetAllHomeApp 的应用项：permission（不可空的枚举）从没出现、多出 permissionType；avatar 从没出现、多出 icon
  'MD.Entity.HomeApp.HomeAppDto': { rename: { avatar: 'icon', permission: 'permissionType' } },
  // 选项的 key 就是选项 id：6 个应用 645 个控件 252 个选项，一个不缺（schema 按 C# 的 string 标了 nullable）
  'MD.Entity.Worksheet.ControlOptionEntity': { required: ['key'] },
  // 控件模板的 controls：18 张表的 GetWorksheetInfo / GetWorksheetControls 里都在（空表是 []，不是缺省）
  'MD.Entity.Worksheet.ControlTemplateEntity': { required: ['controls'] },
  // GetAppForManager 的项：createTime 是不可空的日期却从没出现、多出 ctime；另两个同理
  'MD.Entity.Apk.AppForManagerModel': {
    rename: { apkNamePinyin: 'appNPY', entityInfo: 'workSheetInfo', createTime: 'ctime' },
  },
  // 许可证里的版本信息：swagger 里是个没有属性的空壳，实际带这两个
  'MD.Web.Ajax.ResultModel.Order.VersionModel': {
    add: { versionIdV2: 'string | undefined', name: 'string | undefined' },
  },
  // 开关集成失败时的提示区分飞书国际版（Lark）：前端读 isLark，swagger 里没有，
  // 本部署没开 Lark 集成，取样时也没出现 —— 按「可能不出现的布尔值」写
  'MD.Web.Ajax.ResultModel.Roles.ProjectPermissionsByUserModel': {
    add: { isLark: 'boolean | undefined' },
  },
};

/** 直接换成仓库里手写的类型：控件是全仓的核心数据结构，统一用 FormControl（它和控件实体的形状核对过） */
const SUBSTITUTES: Record<string, string> = {
  'MD.Entity.Worksheet.ControlEntity': "import('src/utils/controlTypes').FormControl",
};

/** 整个响应类型改写（swagger 给的是不带类型参数的壳） */
const RESPONSE_OVERRIDES: Record<string, { type: string; refs: string[] }> = {
  // 实际 data 就是控件模板（sourceId / worksheetId / projectId / version / controls），swagger 写的是 ReturnResult 的 any
  'Worksheet/GetWorksheetControls': {
    type: '{ code: number; msg?: string | undefined; data?: HapApi.MD.Entity.Worksheet.ControlTemplateEntity | undefined }',
    refs: ['MD.Entity.Worksheet.ControlTemplateEntity'],
  },
  // 一次取多张表：data 是控件模板的数组
  'Worksheet/GetWorksheetsControls': {
    type: '{ code: number; msg?: string | undefined; data?: HapApi.MD.Entity.Worksheet.ControlTemplateEntity[] | undefined }',
    refs: ['MD.Entity.Worksheet.ControlTemplateEntity'],
  },
  // swagger 没写响应；实际和 GetFilterRows 一样是 WorksheetRowsResult（12 个键逐个对上）
  'Worksheet/GetRowRelationRows': {
    type: 'HapApi.MD.Web.Ajax.ResultModel.Worksheet.WorksheetRowsResult',
    refs: ['MD.Web.Ajax.ResultModel.Worksheet.WorksheetRowsResult'],
  },
};

// ── 1. src/api 里用到了哪些接口 ─────────────────────────────────────────────
interface ApiMethod {
  file: string;
  /** mdyAPI 的前两个实参 */
  controller: string;
  action: string;
  /** 在文件原文里插入返回类型的位置（参数右括号之后） */
  insertAt: number;
  /** 已经有一个本脚本生成的 ApiResultOf<…> 时，要替换掉的那一段（重跑时整段换新） */
  replaceTo?: number;
}

function findMethods(file: string, text: string): ApiMethod[] {
  const ast = parser.parse(text, { sourceType: 'module', plugins: ['typescript'] });
  const methods: ApiMethod[] = [];
  const visit = (node: any): void => {
    if (!node || typeof node.type !== 'string') return;
    const generated =
      node.type === 'ObjectProperty' &&
      node.value &&
      node.value.type === 'FunctionExpression' &&
      node.value.returnType &&
      /^:\s*ApiResultOf</.test(text.slice(node.value.returnType.start, node.value.returnType.end));
    if (
      node.type === 'ObjectProperty' &&
      node.value &&
      node.value.type === 'FunctionExpression' &&
      (!node.value.returnType || generated)
    ) {
      const fn = node.value;
      const body = fn.body.body;
      const last = body[body.length - 1];
      const call = last && last.type === 'ReturnStatement' ? last.argument : null;
      if (
        call &&
        call.type === 'CallExpression' &&
        call.callee.type === 'Identifier' &&
        call.callee.name === 'mdyAPI' &&
        call.arguments[0] &&
        call.arguments[0].type === 'StringLiteral' &&
        call.arguments[1] &&
        call.arguments[1].type === 'StringLiteral'
      ) {
        // 返回类型插在函数体左花括号前面那个右括号之后；已有生成的返回类型就整段替换
        methods.push({
          file,
          controller: call.arguments[0].value,
          action: call.arguments[1].value,
          insertAt: generated ? fn.returnType.start : text.lastIndexOf(')', fn.body.start) + 1,
          ...(generated ? { replaceTo: fn.returnType.end } : {}),
        });
      }
    }
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(ast.program);
  return methods;
}

// ── 2. schema 名 → HapApi 里的名字 ──────────────────────────────────────────
const RESERVED = new Set(
  'break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with implements interface let package private protected public static yield any boolean number string symbol type'.split(
    ' ',
  ),
);
const safeSeg = (s: string): string => {
  const id = s.replace(/[^A-Za-z0-9_$]/g, '_').replace(/^(\d)/, '_$1');
  return RESERVED.has(id) ? id + '_' : id;
};

/** 泛型实参里出现的类型短名，拼进标识符 */
function genericArgNames(inner: string): string[] {
  const names: string[] = [];
  // 实参形如 [Full.Type.Name, Assembly, Version=…, Culture=neutral, PublicKeyToken=null]：
  // 只取每个方括号里第一段（类型全名），程序集名和 key=value 都跳过
  for (const m of inner.matchAll(/\[([A-Za-z_][\w.+]*)(?:`\d+)?/g)) {
    names.push((m[1] as string).split(/[.+]/).pop() as string);
  }
  return names;
}

const nameCache = new Map<string, { ns: string[]; name: string }>();
const usedNames = new Map<string, string>(); // `ns.name` → 原始全名（查重）

function mapName(full: string): { ns: string[]; name: string } {
  const hit = nameCache.get(full);
  if (hit) return hit;
  let base = full;
  let suffix = '';
  const g = full.match(/^([^`[]+)`\d+\[(.*)\]$/);
  if (g) {
    base = g[1] as string;
    suffix = '_' + genericArgNames(g[2] as string).join('_');
  }
  const parts = base.split('.');
  const last = (parts.pop() as string).replace(/\+/g, '_');
  const ns = parts.map(safeSeg);
  let name = safeSeg(last + suffix);
  // 改写后撞名的（不同泛型实参缩写成了同一个名字）加序号
  let key = ns.concat(name).join('.');
  for (let i = 2; usedNames.has(key) && usedNames.get(key) !== full; i++) {
    name = safeSeg(last + suffix) + '_' + i;
    key = ns.concat(name).join('.');
  }
  usedNames.set(key, full);
  const mapped = { ns, name };
  nameCache.set(full, mapped);
  return mapped;
}

const refName = (ref: string): string => ref.replace('#/components/schemas/', '');

/** 形状未知、只能原样透传的 schema：任意 JSON、没有属性的 object */
function isOpaque(full: string): boolean {
  if (/^(Newtonsoft\.Json\.Linq\.|System\.Object$|System\.Text\.Json\.)/.test(full)) return true;
  if (/^System\.ValueTuple`/.test(full)) return true;
  const s = schemas[full];
  const patched = SCHEMA_PATCHES[full];
  if (patched && patched.add) return false;
  return !!s && s.type === 'object' && !s.properties && !s.additionalProperties && !s.enum;
}

// ── 3. schema → TS 类型表达式 ───────────────────────────────────────────────
const reachable = new Set<string>();

function tsType(s: Schema | undefined): string {
  if (!s) return 'ApiPayload';
  let t: string;
  if (s.$ref) {
    const full = refName(s.$ref);
    if (SUBSTITUTES[full]) t = SUBSTITUTES[full] as string;
    else if (isOpaque(full) || !schemas[full]) t = 'ApiPayload';
    else {
      reachable.add(full);
      const { ns, name } = mapName(full);
      t = ['HapApi', ...ns, name].join('.');
    }
  } else if (s.allOf && s.allOf.length === 1) t = tsType(s.allOf[0]);
  else if (s.oneOf || s.anyOf) t = (s.oneOf || s.anyOf || []).map(x => wrap(tsType(x))).join(' | ') || 'ApiPayload';
  else if (s.enum) t = s.enum.map(v => JSON.stringify(v)).join(' | ');
  else if (s.type === 'string') t = 'string';
  else if (s.type === 'integer' || s.type === 'number') t = 'number';
  else if (s.type === 'boolean') t = 'boolean';
  else if (s.type === 'array') t = wrap(tsType(s.items)) + '[]';
  else if (s.type === 'object' && s.additionalProperties) {
    t = `Record<string, ${s.additionalProperties === true ? 'ApiPayload' : tsType(s.additionalProperties as Schema)}>`;
  } else t = 'ApiPayload';
  return t;
}

/** 服务端不输出 null 属性，所以只有「不可能是 null」的值类型一定会出现 */
function alwaysPresent(p: Schema): boolean {
  if (p.nullable) return false;
  if (p.type === 'integer' || p.type === 'number' || p.type === 'boolean') return true;
  if (p.$ref) {
    const target = schemas[refName(p.$ref)];
    return !!target && !!target.enum;
  }
  return false;
}

/** 放进数组 / 联合里时，含 | 或 => 的要加括号 */
function wrap(t: string): string {
  return /[|&]|=>/.test(t) ? `(${t})` : t;
}

// ── 4. 生成 ────────────────────────────────────────────────────────────────
const files = fs.readdirSync(API_DIR).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
const methods: ApiMethod[] = [];
const texts = new Map<string, string>();
for (const f of files) {
  const file = path.join(API_DIR, f);
  const text = fs.readFileSync(file, 'utf8');
  texts.set(file, text);
  methods.push(...findMethods(file, text));
}

const returnTypes = new Map<ApiMethod, string>();
let noSchema = 0;
let noPath = 0;
for (const m of methods) {
  const endpoint = `${m.controller}/${m.action}`;
  if (!VERIFIED.has(endpoint)) continue;
  const override = RESPONSE_OVERRIDES[endpoint];
  if (override) {
    override.refs.forEach(r => reachable.add(r));
    returnTypes.set(m, override.type);
    continue;
  }
  const p = swagger.paths[`/${m.controller}/${m.action}`];
  const op = p && (p.post || p.get);
  if (!op) {
    noPath++;
    continue;
  }
  const content = op.responses && op.responses['200'] && op.responses['200'].content;
  const schema = content && (content['application/json'] || content['text/plain'] || Object.values(content)[0]);
  if (!schema || !schema.schema) {
    noSchema++;
    continue;
  }
  returnTypes.set(m, tsType(schema.schema));
}

// 传递闭包：属性里引用到的 schema 也要生成
const emitted = new Set<string>();
const decls = new Map<string, string[]>(); // 命名空间路径 → 声明文本

function jsdoc(text: string | undefined, indent: string): string {
  if (!text) return '';
  const clean = text
    .replace(/\*\//g, '* /')
    .replace(/\r?\n+/g, ' ')
    .trim();
  return clean ? `${indent}/** ${clean} */\n` : '';
}

function emit(full: string): void {
  if (emitted.has(full)) return;
  emitted.add(full);
  const s = schemas[full] as Schema;
  const { ns, name } = mapName(full);
  const key = ns.join('.');
  const list = decls.get(key) || [];
  let text: string;
  if (s.enum) {
    text = `${jsdoc(s.description, '    ')}    type ${name} = ${s.enum.map(v => JSON.stringify(v)).join(' | ')};`;
  } else {
    const patch = SCHEMA_PATCHES[full] || {};
    const props = Object.entries(s.properties || {})
      .map(([k, p]) => {
        const serialized = (patch.rename && patch.rename[k]) || k;
        const key2 = /^[A-Za-z_$][\w$]*$/.test(serialized) ? serialized : JSON.stringify(serialized);
        const present = alwaysPresent(p) || !!(patch.required && patch.required.includes(k));
        const renamed = serialized === k ? '' : `（swagger 里叫 ${k}，实际序列化成 ${serialized}）`;
        return `${jsdoc((p.description || '') + renamed, '      ')}      ${key2}${present ? '' : '?'}: ${tsType(p)}${present ? '' : ' | undefined'};`;
      })
      .concat(
        Object.entries(patch.add || {}).map(
          ([k, t]) => `      /** （swagger 里没有，真实响应里有） */\n      ${k}?: ${t};`,
        ),
      )
      .join('\n');
    text = `${jsdoc(s.description, '    ')}    interface ${name} {\n${props}\n    }`;
  }
  list.push(text);
  decls.set(key, list);
}

// 新引用会在 emit 过程中不断加进 reachable，循环到不再增长
for (let size = -1; size !== reachable.size;) {
  size = reachable.size;
  for (const full of [...reachable]) emit(full);
}

const header = `/**
 * 【生成文件，不要手改】由 tools/gen-api-types.ts 从后端 wwwapi 的 swagger 快照生成。
 * 快照版本：${path.basename(swaggerArg)}（取自生产 HAP 7.4.3）。
 * 只含 src/api 实际用到的接口牵涉的 schema；名字照 .NET 全名分层，见生成脚本文件头的映射规则。
 */
`;
const body = [...decls.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([ns, list]) => `declare namespace HapApi${ns ? '.' + ns : ''} {\n${list.join('\n')}\n}`)
  .join('\n\n');

console.log(
  `src/api 方法 ${methods.length} 个；核对过、标上返回类型的 ${returnTypes.size} 个（VERIFIED ${VERIFIED.size} 条）；` +
    `其中 swagger 里没有这个接口 ${noPath} 个、没有响应 schema ${noSchema} 个`,
);
console.log(`生成 schema ${emitted.size} 个，分在 ${decls.size} 个命名空间里`);

/** 按仓库的 prettier 配置格式化（生成的类型声明、标了返回类型的长行都要折） */
async function formatFiles(files: string[]): Promise<void> {
  const prettier = require('prettier');
  for (const file of files) {
    const options = await prettier.resolveConfig(file);
    fs.writeFileSync(file, await prettier.format(fs.readFileSync(file, 'utf8'), { ...options, filepath: file }));
  }
}

if (!DRY) {
  fs.writeFileSync(OUT_FILE, header + '\n' + body + '\n');
  const byFile = new Map<string, ApiMethod[]>();
  for (const m of returnTypes.keys()) byFile.set(m.file, (byFile.get(m.file) || []).concat(m));
  for (const [file, list] of byFile) {
    let text = texts.get(file) as string;
    for (const m of list.sort((a, b) => b.insertAt - a.insertAt)) {
      text = text.slice(0, m.insertAt) + `: ApiResultOf<${returnTypes.get(m)}>` + text.slice(m.replaceTo ?? m.insertAt);
    }
    fs.writeFileSync(file, text);
  }
  formatFiles([OUT_FILE, ...byFile.keys()]).then(() =>
    console.log(`已写入 ${path.relative(ROOT, OUT_FILE)} 和 ${byFile.size} 个 src/api 文件（已按 prettier 格式化）`),
  );
}
