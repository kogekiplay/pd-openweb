const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../..');
const calls: Array<{ method: string; args: Record<string, unknown>; options: Record<string, unknown> }> = [];
const order: string[] = [];
let apiResponse: unknown;
let normalizedOptions: Record<string, unknown> = {};
const api = new Proxy<Record<string, (args: Record<string, unknown>, options: Record<string, unknown>) => Promise<unknown>>>({}, { get: (_target: unknown, method: string) => (args: Record<string, unknown>, options: Record<string, unknown>) => { calls.push({ method, args, options }); order.push(method); return Promise.resolve(apiResponse); } });
const cache = new Map<string, Record<string, unknown>>();
const viewer = { portal: false };
function load<T>(relative: string): T {
  const filename = path.resolve(root, relative);
  const old = cache.get(filename); if (old) return old as T;
  const mod: { exports: Record<string, unknown> } = { exports: {} }; cache.set(filename, mod.exports);
  const { code } = transformFileSync(filename, { babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  function localRequire(request: string): unknown {
    if (request === 'src/api/agent' || request === 'src/api/appManagement' || request === 'src/api/publicWorksheet' || request === 'src/api/worksheet') return { __esModule: true, default: api };
    if (request === './agentService') return { fetchAgentSessionMessages: async (_id: string, options: Record<string, unknown>) => { normalizedOptions = options; return [{ id: 'history', role: 'assistant', parts: [] }]; }, ...load<Record<string, unknown>>('src/components/Agent/shareService.ts') };
    if (request === 'src/utils/domain/worksheet/record') return { getNewRecordPageUrl: () => '' };
    if (request === 'src/utils/services/worksheet/record') return { getRecordLandUrl: async () => '' };
    if (request === 'src/utils/platform/navigation/path') return { pathCompletion: (url: string) => url, toMainSiteUrl: (url: string) => 'https://main.example' + new URL(url).pathname };
    if (request === 'src/utils/platform/runtime/config') return { isPortalAccount: () => viewer.portal };
    if (request === 'src/components/Agent/buildContext') return { getCurrentAppId: () => '' };
    if (request === 'src/redux/configureStore') return { __esModule: true, default: { getState: () => ({}) } };
    if (request === 'src/utils/services/security/permission') return { FEATURE_PERMISSION: { MINGO_BUILD_APP: 'allowMingoAppBuild', MINGO_DATA_QUERY: 'allowMingoDataQueryAndAnalysis', MINGO_OTHER_ASSISTANT: 'allowMingoAppOthers' } };
    if (request.startsWith('src/')) return load(request + '.ts');
    if (request.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), request)) + '.ts');
    return require(request);
  }
  const translate = (text: string, ...values: unknown[]) => values.reduce<string>((result, value, index) => result.replaceAll(`%${index}`, String(value)), text);
  new Function('module', 'exports', 'require', '_l', code)(mod, mod.exports, localRequire, translate);
  cache.set(filename, mod.exports); return mod.exports as T;
}
interface Service { createSessionShare: (args: unknown) => Promise<string>; fetchSharedSessionMessages: (args: unknown) => Promise<unknown>; continueSharedSession: (args: unknown) => Promise<{ sessionId: string; forked: boolean }>; fetchAgentSessionPage: (args: unknown) => Promise<{ items: unknown[]; hasMore: boolean }> }
async function main(): Promise<void> {
  const service = load<Service>('src/components/Agent/shareService.ts');
  apiResponse = { data: { shareId: 'shared' } };
  assert.equal(await service.createSessionShare({ sessionId: 's', scope: 'public', projectId: 'p' }), 'shared');
  assert.equal(Object.hasOwn(calls.at(-1)?.args || {}, 'projectId'), false, 'public shares must not send an organization target');
  await assert.rejects(() => service.createSessionShare({ sessionId: 's', scope: 'org' }), /Missing share project/);
  await assert.rejects(() => service.createSessionShare({ sessionId: 's', messageIds: Array.from({ length: 101 }, (_, index) => String(index)) }), /Too many/);
  await service.createSessionShare({ sessionId: 's', scope: 'org', projectId: 'p', messageIds: ['m'] });
  assert.equal(calls.at(-1)?.args['projectId'], 'p');
  apiResponse = { data: { messages: [{ role: 'assistant', content: 'shared reply' }] } };
  await service.fetchSharedSessionMessages({ shareId: 'shared', clientId: 'visitor' });
  assert.deepEqual(calls.at(-1)?.options['header'], { clientId: 'visitor' });
  assert.equal(normalizedOptions['includeUsage'], false);
  apiResponse = { success: false, errorCode: 'share_access_denied', errorMessage: 'denied' };
  await assert.rejects(() => service.fetchSharedSessionMessages({ shareId: 'shared', clientId: 'visitor' }), (error: unknown) => (error as { errorCode?: string }).errorCode === 'share_access_denied');
  apiResponse = { data: { sessionId: 'fork', forked: true } };
  assert.deepEqual(await service.continueSharedSession({ shareId: 'shared', clientId: 'visitor' }), { sessionId: 'fork', forked: true });
  apiResponse = { items: [{ sessionId: 'session-bot-1' }, { sessionId: 'session-bot-2' }] };
  assert.deepEqual(await service.fetchAgentSessionPage({ size: 2 }), { items: [], hasMore: true }, 'filtering tool sessions cannot make the server page look final');

  const controller = load<{ getPublicShare: (args: unknown) => Promise<unknown>; updatePublicShareStatus: (args: unknown) => Promise<{ shareLink: string; shareSourceId: string }> }>('src/pages/worksheet/components/Share/controller.ts');
  order.length = 0; apiResponse = { appEntityShare: { url: 'https://share.example/mingo/session' } };
  const create = async () => { order.push('create'); return 'anchor'; };
  const result = await controller.updatePublicShareStatus({ from: 'mingoHistory', isPublic: true, scope: 1, projectId: 'p', sourceId: 's', createShareSource: create });
  assert.deepEqual(order, ['create', 'editEntityShareStatus']);
  assert.equal(calls.at(-1)?.args['sourceId'], 'anchor');
  assert.equal(calls.at(-1)?.args['sourceType'], 73);
  assert.equal(result.shareLink, 'https://main.example/mingo/session');
  assert.equal(result.shareSourceId, 'anchor');
  order.length = 0;
  await controller.updatePublicShareStatus({ from: 'mingoHistory', isPublic: true, sourceId: 'anchor', createShareSource: create, reuseShareSource: true });
  assert.deepEqual(order, ['editEntityShareStatus'], 'editing a title must retain the current selective-share anchor');
  order.length = 0;
  assert.deepEqual(await controller.getPublicShare({ from: 'mingoHistory', sourceId: 's', disableShareQuery: true }), {});
  assert.deepEqual(order, [], 'opening a selective-share dialog must not create or query a share');

  const exportPlan = load<{ stripDocTitle: (value: string) => string; demoteHeadings: (value: string) => string; buildPlanMarkdown: (args: unknown) => string; buildPlanFileName: (args: unknown) => string }>('src/components/Agent/AppBuilder/planExport.ts');
  assert.equal(exportPlan.stripDocTitle('# App plan\n## Detail\nBody'), '## Detail\nBody');
  assert.equal(exportPlan.stripDocTitle('# One\nText\n# Two'), '# One\nText\n# Two');
  assert.equal(exportPlan.demoteHeadings('# Intro\n```\n# Code heading\n```'), '### Intro\n```\n# Code heading\n```');
  const markdown = exportPlan.buildPlanMarkdown({ appName: 'CRM', now: new Date('2026-01-01T00:00:00Z'), files: { '/jsons/worksheets.json': { parsed: [{ name: '客户', fields: '客户名称(Text), 分类(Relation:客户分类:single)' }] } } });
  assert.match(markdown, /客户名称.*文本/);
  assert.match(markdown, /关联工作表：客户分类/);
  assert.equal(exportPlan.buildPlanFileName({ appName: 'a/b:c', versionLabel: 'v1', now: new Date(2026, 0, 1) }).startsWith('abc应用搭建方案v1_'), true);

  const selection = load<{ getSessionMessageGroups: (messages: unknown[]) => string[][]; getFeedbackTraceId: (message: unknown) => string; alignSessionMessageIds: (messages: unknown[], history: unknown[]) => Array<{ messageId?: string }> }>('src/components/Agent/sessionSelection.ts');
  const grouped = [
    { id: 'u1', role: 'user', messageId: 'q1', parts: [] },
    { id: 'a1', role: 'assistant', messageId: 'r1', parts: [] },
    { id: 'a2', role: 'assistant', messageId: 'r2', parts: [] },
    { id: 'u2', role: 'user', parts: [] },
  ];
  assert.deepEqual(selection.getSessionMessageGroups(grouped), [['q1', 'r1', 'r2']], 'a question and all following replies form one selection group');
  const aligned = selection.alignSessionMessageIds([{ id: 'local', role: 'assistant', parts: [] }], [{ id: 'history', role: 'user', messageId: 'wrong', parts: [] }]);
  assert.equal(aligned[0]?.messageId, undefined, 'a role mismatch must stop backfilling rather than attach the wrong message id');
  assert.equal(selection.getFeedbackTraceId({ id: 'local', role: 'assistant', messageId: 'not-a-trace', parts: [] }), '', 'message ids cannot be sent to the feedback trace endpoint');
  assert.equal(selection.getFeedbackTraceId({ id: 'local', role: 'assistant', creditsTraceId: 'real-billing-trace', parts: [] }), 'real-billing-trace');

  global.md = { global: { Account: { accountId: 'member', projects: [{ projectId: 'p', allowMingoAppBuild: false, allowMingoDataQueryAndAnalysis: false, allowMingoAppOthers: false }] }, SysSettings: { hideAIBasicFun: false } } };
  global.localStorage = { getItem: () => 'p' };
  const permission = load<{ isProjectMingoEnabled: (projectId: string) => boolean; canShowMingoEntry: () => boolean }>('src/components/Mingo/permission.ts');
  assert.equal(permission.isProjectMingoEnabled('p'), false);
  assert.equal(permission.isProjectMingoEnabled('missing'), false);
  assert.equal(permission.canShowMingoEntry(), false);
  global.md.global.Account.projects = [{ projectId: 'p' }];
  assert.equal(permission.isProjectMingoEnabled('p'), true, 'older global payloads without the three organization flags retain their established access');
  global.md.global.SysSettings.hideAIBasicFun = true;
  assert.equal(permission.canShowMingoEntry(), false, 'the deployment AI switch overrides all organization flags');

  const account = load<{ isShareViewerLoggedIn: () => boolean }>('src/pages/mingo/PublicShare/shareAccount.ts');
  assert.equal(account.isShareViewerLoggedIn(), true); viewer.portal = true; assert.equal(account.isShareViewerLoggedIn(), false, 'a portal account must not pass the main-site login gate');
  console.log('session share: ordered creation, scoped identity, client headers, pagination, stable anchors, readonly viewer gate and plan export passed');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
