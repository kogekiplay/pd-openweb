const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../../../scripts/spec-harness.ts');
interface PrintRow {
  rowId: string;
  rowTitle: string;
}
interface PrintApi {
  parsePrintPrecheck: (value: unknown) => { successRows: PrintRow[]; failedRows: PrintRow[] };
  parseRowPrintCount: (value: unknown) => {
    totalPrintCount: number;
    templates: {
      printId: string;
      printCount: number;
      leftPrintCount: number;
      printLimitCount: number;
      printLimitEnabled: boolean;
    }[];
  };
  precheckTemplatePrint: (args: {
    projectId: string;
    worksheetId: string;
    printId: string;
    rowIds: string[];
  }) => Promise<boolean>;
}
let result: unknown = { successRows: [{ rowId: 'r1', rowTitle: 'First' }], failedRows: [] };
let feature = '1';
let requests = 0;
const moduleLike: { exports: Partial<PrintApi> } = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, 'printCount.ts'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (name: string): unknown => {
  if (name === 'src/api/worksheet')
    return {
      __esModule: true,
      default: {
        precheckPrint: async () => {
          requests += 1;
          return result;
        },
      },
    };
  if (name === 'src/utils/domain/shared/productFeatures') return { VersionProductType: { printCountLimit: 58 } };
  if (name === 'src/utils/project') return { getFeatureStatus: () => feature };
  throw new Error(`Unexpected dependency ${name}`);
});
const printApi = moduleLike.exports as PrintApi;
assert.deepEqual(printApi.parsePrintPrecheck(result), result);
assert.throws(() => printApi.parsePrintPrecheck({ failedRows: [] }), /Invalid/);
assert.throws(() => printApi.parsePrintPrecheck({ successRows: [{}], failedRows: [] }), /Invalid/);
assert.deepEqual(
  printApi.parseRowPrintCount([
    {
      totalPrintCount: '4',
      templates: [
        { printId: 't1', printCount: '2', printLimitCount: 2, printLimitEnabled: true, leftPrintCount: 0 },
        { printId: null },
      ],
    },
  ]),
  {
    totalPrintCount: 4,
    templates: [{ printId: 't1', printCount: 2, printLimitCount: 2, printLimitEnabled: true, leftPrintCount: 0 }],
  },
);
async function run(): Promise<void> {
  const args = { projectId: 'p', worksheetId: 's', printId: 't1', rowIds: ['r1'] };
  assert.equal(await printApi.precheckTemplatePrint(args), true);
  result = { failedRows: [] };
  assert.equal(await printApi.precheckTemplatePrint(args), false, 'Malformed prechecks must fail closed');
  feature = '2';
  assert.equal(await printApi.precheckTemplatePrint(args), true);
  assert.equal(requests, 2, 'Unavailable features bypass the new endpoint');
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
