const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
interface RelatedRecord {
  sid?: string;
  name?: string;
  sourcevalue?: string;
  row?: Record<string, unknown>;
  type?: number;
  isNew?: boolean;
  count?: number;
}
interface RecordHelpers {
  getRecordColorConfig(view?: {
    advancedSetting?: Record<string, string>;
  }): { controlId: string; colorItems: string[] | ''; showLine: boolean; showBg: boolean } | '' | undefined;
  getRelateRecordCountFromValue(value?: unknown, propsCount?: number): number;
  formatRecordToRelateRecord(
    controls: Array<{ attribute?: number; controlId: string; type?: number }>,
    rows?: Array<{ rowid?: string; [key: string]: unknown }>,
    options?: { addedIds?: string[]; deletedIds?: string[]; count?: number; isFromDefault?: boolean },
  ): RelatedRecord[];
  getRecordTempValue(
    controls: Array<{ controlId: string; type?: number; value?: unknown; [key: string]: unknown }>,
    relate?: Record<string, { controlId: string; value?: unknown }>,
    options?: { updateControlIds?: string[] },
  ): Record<string, unknown>;
  parseRecordTempValue(
    data: Record<string, unknown>,
    formData: Array<{ controlId: string; type?: number; sourceControlId?: string; value?: unknown }>,
    defaultRelated?: { relateSheetControlId?: string; value?: unknown },
  ): { formdata: Array<{ controlId: string; value?: unknown }>; relateRecordData: Record<string, unknown> };
}
function loadBoundary(): unknown {
  const target: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'recordValueBoundary.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', 'console', code)(target, target.exports, require);
  return target.exports;
}
function loadTarget(): RecordHelpers {
  const moduleLike: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'record.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', 'console', code)(
    moduleLike,
    moduleLike.exports,
    (name: string) => {
      if (name === './fieldStoreBoundary') return require(path.join(__dirname, 'fieldStoreBoundary.ts'));
      if (name === 'lodash') return require('lodash');
      if (name === 'src/pages/widgetConfig/config/widget.js')
        return { WIDGETS_TO_API_TYPE_ENUM: { SUB_LIST: 34, RELATE_SHEET: 29 } };
      if (name === 'src/components/Form/core/config') return {};
      if (name === 'worksheet/constants/enum')
        return {
          RECORD_COLOR_SHOW_TYPE: { LINE: '0', LINE_BG: '1', BG: '2' },
          VIEW_CONFIG_RECORD_CLICK_ACTION: { OPEN_RECORD: 1, OPEN_LINK: 2 },
        };
      if (name === 'src/utils/control')
        return {
          checkCellIsEmpty: (value: unknown) => value === undefined || value === null || value === '',
          getTitleTextFromRelateControl: (_control: unknown, row: { name?: string }) => row.name || '',
          isRelateRecordTableControl: () => false,
          renderText: ({ value }: { value: unknown }) => String(value ?? ''),
          formatAttachmentValue: value => value,
          getValueStyle: () => ({}),
        };
      if (name === 'src/utils/common') return { pathCompletion: (value: string) => value };
      if (name === 'src/api/worksheet') return { default: {} };
      if (name === 'worksheet/common/TreeTableHelper') return { getSheetViewRows: () => [] };
      if (name === 'src/components/upgradeVersion') return { buriedUpgradeVersionDialog: () => undefined };
      if (name === 'src/utils/project') return { getFeatureStatus: () => '1' };
      if (name === 'src/utils/enum') return { VersionProductType: { wordPrintTemplate: 1 } };
      if (name === './recordValueBoundary') return loadBoundary();
      if (name === '@ant-design/colors') return { generate: () => [] };
      if (name === '@ctrl/tinycolor')
        return {
          TinyColor: class {
            setAlpha() {
              return this;
            }
            toRgbString() {
              return '';
            }
          },
        };
      throw new Error(`Unexpected record dependency ${name}`);
    },
    { error: () => undefined, log: () => undefined },
  );
  return moduleLike.exports as RecordHelpers;
}
global.safeParse = (value: unknown, defaultValue: unknown = {}) => {
  try {
    return JSON.parse(String(value));
  } catch {
    return defaultValue === 'array' ? [] : defaultValue;
  }
};
global._l = (value: string) => value;
const helpers = loadTarget();
assert.equal(helpers.getRelateRecordCountFromValue('[{"count":3}]', 9), 3);
assert.equal(helpers.getRelateRecordCountFromValue('', 9), 0);
assert.equal(helpers.getRelateRecordCountFromValue('bad-json', 9), 9);
assert.equal(helpers.getRelateRecordCountFromValue('[{"count":3}]', 9), 3);
assert.equal(helpers.getRelateRecordCountFromValue('deleteRowIds:["x"]', 9), 0);
const controls = [{ controlId: 'title', attribute: 1, type: 2 }];
const relationRows = helpers.formatRecordToRelateRecord(
  controls,
  [
    { rowid: 'r1', title: 'Alpha' },
    { rowid: 'r2', title: 'Beta' },
  ],
  { addedIds: ['r2'], deletedIds: ['gone'], count: 2 },
);
assert.deepEqual(
  relationRows.map(row => ({ sid: row.sid, name: row.name, isNew: row.isNew, count: row.count })),
  [
    { sid: 'r1', name: 'Alpha', isNew: undefined, count: 2 },
    { sid: 'r2', name: 'Beta', isNew: true, count: 2 },
  ],
);
const malformedTitle = helpers.formatRecordToRelateRecord(
  [{ controlId: 'title', attribute: 1, type: 29 }],
  [{ rowid: 'r3', title: 'bad-json' }],
);
assert.equal(malformedTitle[0]?.name, '');
const idA = 'a'.repeat(24);
const idB = 'b'.repeat(24);
const idC = 'c'.repeat(24);
const temp = helpers.getRecordTempValue(
  [
    { controlId: idA, type: 2, value: 'text' },
    { controlId: idB, type: 2, value: '' },
    {
      controlId: idC,
      type: 29,
      value: '[{"sid":"r1","name":"Alpha","sourcevalue":"{\\"title\\":\\"Alpha\\"}"}]',
    },
  ],
  {},
);
assert.equal(temp[idA], 'text');
assert.equal(temp[idB], undefined);
assert.match(String(temp[idC]), /r1/);
const restored = helpers.parseRecordTempValue(
  { [idA]: 'restored', [idB]: [{ rowid: 'child' }], [idC]: 'existing' },
  [
    { controlId: idA, type: 2 },
    { controlId: idB, type: 34 },
    { controlId: idC, type: 29, enumDefault: 2, sourceControlId: 'master' } as {
      controlId: string;
      type: number;
      enumDefault: number;
      sourceControlId: string;
    },
  ],
  { relateSheetControlId: 'master', value: { rowid: 'master-row' } },
);
assert.equal(restored.formdata[0]?.value, 'restored');
assert.equal(restored.formdata[1]?.value, JSON.stringify([{ rowid: 'child' }]));
assert.equal(restored.formdata[2]?.value, JSON.stringify([{ rowid: 'master-row' }]));
assert.equal((restored.relateRecordData[idC] as { value?: unknown })?.value, 'existing');

const childId = 'd'.repeat(24);
const relatedId = 'e'.repeat(24);
const nestedSource = JSON.stringify([
  {
    sid: 'nested',
    name: 'Nested',
    sourcevalue: JSON.stringify({ title: 'Nested', keep: 1, hidden: '', recursive: 'sourcevalue' }),
  },
]);
const subTemp = helpers.getRecordTempValue([
  {
    controlId: childId,
    type: 34,
    value: {
      rows: [
        { rowid: 'empty-1', text: 'empty' },
        { rowid: 'r1', text: 'kept', blank: '', [relatedId]: nestedSource },
      ],
    },
  },
]);
const subRows = subTemp[childId] as Array<Record<string, unknown>>;
assert.equal(subRows.length, 1);
assert.equal(subRows[0]?.['text'], 'kept');
assert.equal(subRows[0]?.['blank'], undefined);
assert.deepEqual(JSON.parse(JSON.parse(String(subRows[0]?.[relatedId]))[0].sourcevalue), { title: 'Nested', keep: 1 });
const cleared = helpers.getRecordTempValue([
  {
    controlId: childId,
    type: 34,
    value: { rows: [{ rowid: 'r1', [relatedId]: '[{"sid":"bad","sourcevalue":"bad-json"}]' }] },
  },
]);
assert.equal(
  (cleared[childId] as Array<Record<string, unknown>>)[0]?.[relatedId],
  undefined,
  'Malformed nested sources must retire the entire field rather than persist bad JSON',
);
const unsafe = helpers.getRecordTempValue([], { [relatedId]: { controlId: relatedId, value: () => 'unsupported' } });
assert.equal(unsafe[relatedId], undefined, 'Draft serialization excludes functions at its unknown-value boundary');

const dateDraft = helpers.getRecordTempValue([], {
  [relatedId]: { controlId: relatedId, value: { date: new Date('2026-10-09T00:00:00.000Z') } },
});
assert.equal(JSON.stringify(dateDraft[relatedId]), '{"date":"2026-10-09T00:00:00.000Z"}');

console.log('Record relation count, nested serialization and temp save/restore boundaries passed');

assert.equal(
  helpers.formatRecordToRelateRecord([{ controlId: 'title', attribute: 1, type: 2 }], [{ rowid: 'r4', title: 0 }])[0]
    ?.name,
  0,
);

assert.deepEqual(
  helpers.getRecordColorConfig({ advancedSetting: { colorid: 'option', coloritems: '["a","b"]', colortype: '1' } }),
  { controlId: 'option', colorItems: ['a', 'b'], showLine: true, showBg: true },
);
assert.deepEqual(helpers.getRecordColorConfig({ advancedSetting: { colorid: 'option', colortype: '2' } }), {
  controlId: 'option',
  colorItems: '',
  showLine: false,
  showBg: true,
});
assert.equal(helpers.getRecordColorConfig(), undefined);
const invalidColorConfig = helpers.getRecordColorConfig({
  advancedSetting: { colorid: 'option', coloritems: '[{"bad":1},"a"]' },
});
assert.ok(invalidColorConfig && typeof invalidColorConfig === 'object');
if (invalidColorConfig && typeof invalidColorConfig === 'object')
  assert.deepEqual(invalidColorConfig.colorItems, ['a']);
