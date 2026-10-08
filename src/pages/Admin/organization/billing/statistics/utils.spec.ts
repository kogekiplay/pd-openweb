const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../../../../scripts/spec-harness.ts');

const filename = path.join(__dirname, 'utils.ts');
const compiled = transformFileSync(filename).code;
const moduleLike: { exports: Record<string, Function> } = { exports: {} };
const localRequire = (request: string) =>
  request === '../config'
    ? { CREDIT_TYPES: [{ value: 1, label: '短信' }], getAITypeLabel: (value: string) => value }
    : require(request);
new Function('require', 'module', 'exports', compiled)(localRequire, moduleLike, moduleLike.exports);
const { sumStatisticsValues, aggregateColumnData, transformStatisticsSummary, formatColumnDate } = moduleLike.exports;

assert.equal(sumStatisticsValues([0.1, 0.2]), 0.3, '金额汇总不能积累浮点误差');
assert.equal(sumStatisticsValues([1e-8, 2e-8]), 3.0000000000000004e-8, '科学计数法使用普通求和');
assert.deepEqual(
  aggregateColumnData(
    [
      { date: '2026-10-01', type: '短信', value: 0.1 },
      { date: '2026-10-01', type: '短信', value: 0.2 },
      { date: '2026-10-02', type: '邮件', value: 2 },
    ],
    'day',
    '2026-10-01',
    '2026-10-02',
  ),
  [
    { date: '2026-10-01', type: '短信', value: 0.3 },
    { date: '2026-10-01', type: '邮件', value: 0 },
    { date: '2026-10-02', type: '短信', value: 0 },
    { date: '2026-10-02', type: '邮件', value: 2 },
  ],
);
assert.equal(
  formatColumnDate('2026-10-01', { granularity: 'month', startDate: '2026-10-05', endDate: '2026-10-20', full: true }),
  '2026/10/5–2026/10/20',
);
assert.deepEqual(transformStatisticsSummary({}), {
  creditTotal: 0,
  aiModelTotal: 0,
  creditDistribution: [],
  mingoDistribution: [],
  credit: [],
  aiModel: [],
});
console.log('账务金额精度、缺失桶补零、周期裁剪及空响应测试通过。');
