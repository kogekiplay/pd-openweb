const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');
interface TestRecord {
  rowid?: string | boolean | null;
}
interface TestControl {
  controlId: string;
  type: number;
  advancedSetting: { showtype: string };
  store: { getState: () => { records: TestRecord[]; changes: { addedRecordIds: string[] } } };
}
interface CoreUtilities {
  formatControlToServer(
    control: TestControl,
    options: { isNewRecord?: boolean; isDraft?: boolean; hasDefaultRelateRecordTableControls?: string[] },
  ): { value?: string };
}
const moduleLike: { exports: unknown } = { exports: {} };
const { code } = transformFileSync(process.env.RELATE_IDS_SOURCE || path.join(__dirname, 'utils.ts'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (name: string) => {
  if (name === 'lodash') return require('lodash');
  if (name === 'worksheet/constants/enum')
    return { RELATE_RECORD_SHOW_TYPE: { LIST: 1, TAB_TABLE: 5, TABLE: 3, DROPDOWN: 2 }, RELATION_SEARCH_SHOW_TYPE: {} };
  if (name === './config') return { FROM: {}, FORM_ERROR_TYPE: {}, FORM_ERROR_TYPE_TEXT: {} };
  return {};
});
const { formatControlToServer } = moduleLike.exports as CoreUtilities;
const records = [{ rowid: false }, {}, { rowid: '' }, { rowid: null }, { rowid: 'saved-1' }];
const control: TestControl = {
  controlId: 'relationship',
  type: 29,
  advancedSetting: { showtype: '3' },
  store: { getState: () => ({ records, changes: { addedRecordIds: ['draft-1'] } }) },
};
assert.deepEqual(JSON.parse(formatControlToServer(control, { isNewRecord: true }).value || '[]'), [{ sid: 'saved-1' }]);
assert.deepEqual(
  JSON.parse(formatControlToServer(control, { hasDefaultRelateRecordTableControls: ['relationship'] }).value || '[]'),
  [{ sid: 'saved-1' }],
);
assert.deepEqual(JSON.parse(formatControlToServer(control, { isDraft: true }).value || '[]'), [
  { sid: 'saved-1' },
  { sid: 'draft-1' },
]);
assert.equal(records.length, 5, 'Saving must not mutate the relation store records');
assert.equal(records[0]?.rowid, false);
console.log('Relation payload retains saved row IDs and excludes unsaved main-record placeholders');
