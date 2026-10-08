const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
interface PrintableRow {
  rowid: string;
  [key: string]: unknown;
}
interface RowUtils {
  normalizePrintableRows: (value: unknown) => PrintableRow[];
  isPrintableRowId: (value: unknown) => boolean;
}
const moduleLike: { exports: Partial<RowUtils> } = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, 'printRowUtils.ts'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, require);
const rowUtils = moduleLike.exports as RowUtils;
assert.deepEqual(
  rowUtils.normalizePrintableRows([
    { rowid: 'groupTitle', rows: [{ rowid: 'r1', title: 'First' }, JSON.stringify({ rowid: 'r2' })] },
    { rowid: 'r1', title: 'Duplicate' },
    { rowid: 'loadGroupMore' },
    'invalid JSON',
    { rowid: '' },
    null,
  ]),
  [{ rowid: 'r1', title: 'First' }, { rowid: 'r2' }],
);
assert.deepEqual(rowUtils.normalizePrintableRows(undefined), []);
assert.equal(rowUtils.isPrintableRowId('groupTitle'), false);
assert.equal(rowUtils.isPrintableRowId('row-1'), true);
