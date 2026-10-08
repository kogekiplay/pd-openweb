const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../scripts/spec-harness.ts');
interface Payload {
  worksheetId: string;
  chartType: string;
  chartName: string;
  dataScope: string;
  [key: string]: unknown;
}
interface ChartSaveApi {
  canSaveChart: (value: unknown) => boolean;
  buildCreateChartPayload: (value: unknown, options?: { customPageId: string }) => Payload | null;
  saveChart: (value: Payload) => Promise<{ ok: boolean; message?: string; data?: unknown }>;
}
let response: unknown = { status: 1, data: { reportId: 'chart-1' } };
let requestError: unknown;
let sentOptions: unknown;
const moduleLike: { exports: Partial<ChartSaveApi> } = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, 'chartSave.ts'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (name: string): unknown => {
  if (name === 'src/pages/Statistics/api/reportConfig')
    return {
      __esModule: true,
      default: {
        createChart: async (_payload: unknown, options: unknown) => {
          sentOptions = options;
          if (requestError) throw requestError;
          return response;
        },
      },
    };
  if (name === 'src/api/homeApp' || name === 'src/api/worksheet') return { __esModule: true, default: {} };
  if (name === 'src/utils/domain/permission/app') return { canEditApp: () => true };
  throw new Error(`Unexpected dependency ${name}`);
});
const api = moduleLike.exports as ChartSaveApi;
const spec = {
  type: 'area',
  title: 'Revenue',
  stack: true,
  percent: true,
  _source: { worksheet_id: 'sheet-1', viewId: 'view-1', dimension: { fieldId: 'date' } },
};
const payload = api.buildCreateChartPayload(spec, { customPageId: 'page-1' });
assert.ok(payload);
assert.equal(payload.worksheetId, 'sheet-1');
assert.equal(payload.chartType, 'lineChart');
assert.equal(payload.dataScope, 'permission');
assert.equal(payload.percent, true);
assert.equal(payload.stack, false);
assert.equal(payload.style, 'area');
assert.equal(payload.addToCustomPageId, 'page-1');
assert.equal('worksheet_id' in payload, false);
assert.equal(api.canSaveChart({ type: 'rose', _source: { worksheetId: 'sheet-1' } }), false);
assert.equal(api.buildCreateChartPayload({ type: 'area' }), null);
async function run(): Promise<void> {
  assert.deepEqual(await api.saveChart(payload), { ok: true, data: { reportId: 'chart-1' } });
  assert.deepEqual(sentOptions, { customParseResponse: true, silent: true });
  response = { status: 2, msg: 'Denied', data: ['Missing permission'] };
  assert.deepEqual(await api.saveChart(payload), { ok: false, message: 'Denied（Missing permission）' });
  requestError = { status: 401, data: { message: 'Please log in' } };
  assert.deepEqual(await api.saveChart(payload), { ok: false, message: 'Please log in' });
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
