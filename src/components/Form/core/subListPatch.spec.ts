const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
interface PatchApi {
  formatExistingSubListRow: (
    row: { rowid: string; updatedControlIds?: string[]; [key: string]: unknown },
    controls?: { controlId: string; type: number }[],
  ) => unknown;
}
const moduleLike: { exports: Partial<PatchApi> } = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, 'utils.ts'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (name: string): unknown => {
  if (name === 'lodash') return require('lodash');
  if (name === 'worksheet/constants/enum') return { RELATE_RECORD_SHOW_TYPE: {}, RELATION_SEARCH_SHOW_TYPE: {} };
  if (name === './config') return { FROM: {}, FORM_ERROR_TYPE: {}, FORM_ERROR_TYPE_TEXT: {} };
  return {};
});
const api = moduleLike.exports as PatchApi;
const controls = [
  { controlId: 'title', type: 2 },
  { controlId: 'hiddenRelation', type: 29 },
];
assert.equal(
  api.formatExistingSubListRow({ rowid: 'r1', title: 'Reloaded' }, controls),
  undefined,
  'Reloaded existing rows without edits must not clear hidden relations',
);
const row = Object.freeze({ rowid: 'r1', title: 'Edited', hiddenRelation: undefined, updatedControlIds: ['title'] });
assert.deepEqual(api.formatExistingSubListRow(row, controls), {
  rowid: 'r1',
  editType: 0,
  newOldControl: [
    { controlId: 'title', value: 'Edited' },
    { controlId: 'tempRowId', value: 'r1' },
  ],
});
assert.deepEqual(row.updatedControlIds, ['title']);
