const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');

interface ChangeRow {
  id: string;
  name: string;
  itemName?: string;
  action: string;
  content: Array<string | { type: string; before?: string; after?: string }>;
}
type Sections = Record<string, ChangeRow[]>;
interface RequestResult<T> extends Promise<T> {
  abort?: () => void;
}
const root = path.resolve(__dirname, '../../..');
const cache = new Map<string, Record<string, unknown>>();
let apiResponse: unknown;
let aborted = 0;
const methods = new Proxy<Record<string, () => RequestResult<unknown>>>(
  {},
  {
    get: () => () =>
      Object.assign(Promise.resolve(apiResponse), {
        abort: () => {
          aborted += 1;
        },
      }),
  },
);

function translate(template: string, ...values: unknown[]): string {
  return values.reduce<string>((text, value, index) => text.replaceAll(`%${index}`, String(value)), template);
}
function load<T>(relative: string): T {
  const file = path.resolve(root, relative);
  const previous = cache.get(file);
  if (previous) return previous as T;
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  cache.set(file, moduleLike.exports);
  const { code } = transformFileSync(file, { babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
  function localRequire(request: string): unknown {
    if (request === 'src/api/appSandbox') return { __esModule: true, default: methods };
    if (request === 'src/utils/domain/app/sandbox') return { isSandboxEnvironment: () => false };
    if (request.startsWith('src/')) return load(request + '.ts');
    if (request.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), request)) + '.ts');
    return require(request);
  }
  const parse = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  };
  new Function('module', 'exports', 'require', '_l', 'safeParse', code)(
    moduleLike,
    moduleLike.exports,
    localRequire,
    translate,
    parse,
  );
  cache.set(file, moduleLike.exports);
  return moduleLike.exports as T;
}

async function main(): Promise<void> {
  const versions = load<{
    compareVersions: (a: string, b: string) => number;
    isVersionComplete: (value: string) => boolean;
    getNextPatchVersion: (value: string) => string;
  }>('src/components/AppSandbox/version/versionNumber.ts');
  assert.equal(versions.compareVersions('10.0.0', '2.99.99'), 1);
  assert.equal(versions.compareVersions('1.1.9', '1.1.10'), -1);
  assert.equal(versions.isVersionComplete('1.2'), false);
  assert.equal(versions.getNextPatchVersion('v1.2.9'), '1.2.10');

  const worksheet = load<{
    normalizeWorksheetContrastDetail: (detail: unknown, options: { reverse: boolean }) => Sections;
  }>('src/components/AppSandbox/version/contrast/model/worksheetContrast.ts');
  const baseline = {
    controls: [
      { controlId: 'c', controlName: '名称' },
      { controlId: 'c', controlName: '副名称' },
    ],
    views: [{ viewId: 'v', name: '旧名', updateTime: 'same' }],
  };
  const current = {
    controls: [
      { controlId: 'c', controlName: '新名称' },
      { controlId: 'c', controlName: '副名称' },
      { controlId: 'c', controlName: '新增重复项' },
    ],
    views: [{ viewId: 'v', name: '新名', updateTime: 'same' }],
  };
  const detail = { mdyJson: JSON.stringify(baseline), currentJson: JSON.stringify(current) };
  const result = worksheet.normalizeWorksheetContrastDetail(detail, { reverse: false });
  assert.deepEqual(
    result['fields']?.map(row => [row.id, row.action]),
    [
      ['control-c-0', '更新'],
      ['control-c-2', '新增'],
    ],
  );
  assert.deepEqual(result['views'], [], 'A name change alone must not invent a timestamp resource update');
  const reversed = worksheet.normalizeWorksheetContrastDetail(detail, { reverse: true });
  assert.deepEqual(
    reversed['fields']?.map(row => row.action),
    ['更新', '删除'],
  );

  const page = load<{ normalizePageContrastDetail: (detail: unknown, options: { reverse: boolean }) => Sections }>(
    'src/components/AppSandbox/version/contrast/model/pageContrast.ts',
  );
  const pageResult = page.normalizePageContrastDetail(
    {
      data: JSON.stringify({ pages: [{ components: [{ id: 'a', type: 2, value: '{}' }] }] }),
      originalData: JSON.stringify({ pages: [{ components: [] }] }),
    },
    { reverse: false },
  );
  assert.equal(pageResult['components']?.[0]?.action, '删除');

  const contrast = load<{
    isPublishContrastSuccess: (value: unknown) => boolean;
    normalizePublishContrast: (value: unknown) => { changes: Sections };
  }>('src/components/AppSandbox/version/contrast/publishContrast.ts');
  assert.equal(contrast.isPublishContrastSuccess({ code: 0, data: {} }), true);
  assert.equal(contrast.isPublishContrastSuccess({ code: 1, data: {} }), false);
  const publish = contrast.normalizePublishContrast({
    code: 0,
    data: {
      worksheets: [
        { id: 's', displayName: '旧', originalName: '新', upgradeType: 3 },
        { id: 'ignored', displayName: '无效', originalName: '无效', upgradeType: 999 },
      ],
    },
  });
  assert.deepEqual(
    publish.changes['worksheets']?.map(row => row.id),
    ['s'],
  );
  assert.equal(
    publish.changes['worksheets']?.[0]?.action,
    '新增',
    'Service upgradeType is authoritative even when the presentation reverses',
  );

  const review = load<{ getPageIndexAfterAction: (value: unknown) => number }>(
    'src/pages/Admin/sandbox/ReviewUpgrade/model/reviewVersion.ts',
  );
  assert.equal(
    review.getPageIndexAfterAction({
      action: 'approve',
      status: 0,
      total: 21,
      affectedCount: 1,
      pageIndex: 2,
      pageSize: 20,
    }),
    1,
  );
  assert.equal(
    review.getPageIndexAfterAction({
      action: 'approve',
      status: '',
      total: 21,
      affectedCount: 1,
      pageIndex: 2,
      pageSize: 20,
    }),
    2,
  );

  const api = load<{
    default: {
      batchApprove: (args: unknown) => RequestResult<{ code?: number }>;
      getPublishApps: (args: unknown) => RequestResult<unknown>;
      getByProjectId: (args: unknown) => RequestResult<{ data: unknown[]; total: number }>;
    };
  }>('src/components/AppSandbox/api.ts').default;
  apiResponse = false;
  const mutation = api.batchApprove({ projectId: 'p', versionIds: ['v'] });
  mutation.abort?.();
  assert.equal(aborted, 1, 'Decoding must retain cancellation on the returned promise');
  assert.equal((await mutation).code, 0, 'A false response must never be treated as a successful operation');
  apiResponse = [{ appId: 'a', appName: '可发布应用' }];
  assert.deepEqual(
    await api.getPublishApps({ projectId: 'p' }),
    apiResponse,
    'Publish apps returns a direct list used by AppTransfer',
  );
  apiResponse = { data: { data: [{ versionId: 'v' }], total: 1 } };
  assert.equal((await api.getByProjectId({ projectId: 'p' })).total, 1);
  console.log(
    'sandbox: version ordering, occurrence pairing, snapshot direction, service action, pagination and abort checks passed',
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
