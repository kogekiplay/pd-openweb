const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
interface TestCondition {
  controlId?: string;
  dataType?: number;
  filterType?: number;
  spliceType?: number;
  values?: string[];
  value?: string | number;
  advancedSetting?: { daterange?: string };
  dateRange?: number;
  dateRangeType?: number;
  minValue?: string | number;
  maxValue?: string | number;
  dynamicSource?: { rcid: string; cid: string }[];
  metadata?: string;
}
interface FilterUtilities {
  formatQuickFilter(values?: TestCondition[]): TestCondition[];
  needHideViewFilters(view: {
    viewType?: number | string;
    childType?: number;
    advancedSetting?: { hierarchyViewType?: string };
  }): boolean;
}
const moduleLike: { exports: unknown } = { exports: {} };
const { code } = transformFileSync(process.env.WORKSHEET_FILTER_SOURCE || path.join(__dirname, 'filter.ts'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (name: string) =>
  name === 'worksheet/constants/enum' ? { VIEW_DISPLAY_TYPE: { structure: '2', gunter: '3' } } : require(name),
);
const utils = moduleLike.exports as FilterUtilities;
const condition = {
  controlId: 'title',
  dataType: 2,
  filterType: 1,
  spliceType: 1,
  values: ['kept'],
  value: 'query',
  advancedSetting: { daterange: '[]' },
  dateRange: 18,
  dateRangeType: 3,
  minValue: 'min',
  maxValue: 'max',
  dynamicSource: [{ rcid: 'url', cid: 'query' }],
  metadata: 'UI-only',
};
const expected = {
  controlId: 'title',
  dataType: 2,
  filterType: 1,
  spliceType: 1,
  values: ['kept'],
  value: 'query',
  advancedSetting: { daterange: '[]' },
  dateRange: 18,
  dateRangeType: 3,
  minValue: 'min',
  maxValue: 'max',
};
assert.deepEqual(utils.formatQuickFilter([condition]), [expected]);
assert.equal(
  utils.formatQuickFilter([condition])[0]?.values,
  condition.values,
  'Wire formatting must not clone or mutate field values',
);
assert.equal(condition.metadata, 'UI-only');
assert.deepEqual(utils.formatQuickFilter(), []);
assert.equal(
  utils.needHideViewFilters({ viewType: 2, childType: 2, advancedSetting: { hierarchyViewType: '3' } }),
  true,
);
assert.equal(
  utils.needHideViewFilters({ viewType: '2', childType: 3, advancedSetting: { hierarchyViewType: '3' } }),
  true,
);
for (const childType of [0, 1])
  assert.equal(
    utils.needHideViewFilters({ viewType: 2, childType, advancedSetting: { hierarchyViewType: '3' } }),
    false,
  );
assert.equal(
  utils.needHideViewFilters({ viewType: 2, childType: 2, advancedSetting: { hierarchyViewType: '2' } }),
  false,
);
assert.equal(utils.needHideViewFilters({ viewType: 3 }), true);
assert.equal(utils.needHideViewFilters({ viewType: '3' }), true);
assert.equal(utils.needHideViewFilters({ viewType: 0 }), false);
console.log('Worksheet quick-filter wire fields and hierarchy/gantt visibility passed');
