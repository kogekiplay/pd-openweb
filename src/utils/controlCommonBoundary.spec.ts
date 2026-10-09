const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
interface AdvancedSetting {
  showtype?: string;
  itemnames?: unknown;
  nested?: unknown;
  [key: string]: unknown;
}
interface Control {
  type?: number;
  advancedSetting?: AdvancedSetting;
  unit?: string;
}
interface ParsedBoundary {
  calendarPairs(value: unknown): { begin?: string; end?: string }[];
  parsedSettingStrings(value: unknown): string[];
}
interface CommonModule {
  getAdvanceSetting(data?: Control): AdvancedSetting;
  getAdvanceSetting(data: Control | undefined, key: string | string[]): unknown;
}
global._l = (value: string) => value;
global.safeParse = (value: unknown, type?: string) => {
  try {
    return JSON.parse(String(value));
  } catch {
    return type === 'array' ? [] : {};
  }
};
function loadDecoder(): unknown {
  const target: { exports: unknown } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'advancedSettingBoundary.ts'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', 'console', code)(target, target.exports, require);
  return target.exports;
}
const moduleLike: { exports: unknown } = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, 'controlCommon.ts'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'require', 'console', code)(
  moduleLike,
  moduleLike.exports,
  (name: string) => {
    if (name === 'lodash') return require('lodash');
    if (name === 'moment') return require('moment');
    if (name === 'src/components/Form/core/enum') return { HAVE_VALUE_STYLE_WIDGET: [] };
    if (name === './advancedSettingBoundary') return loadDecoder();
    return {};
  },
  { log: () => undefined },
);
const helpers = moduleLike.exports as CommonModule;
const raw: AdvancedSetting = { showtype: '3', itemnames: '[{"key":"a","value":"A"}]', nested: '{"enabled":true}' };
const control = { type: 9, advancedSetting: raw };
assert.equal(
  helpers.getAdvanceSetting(control),
  raw,
  'No-key access must preserve the original advancedSetting object',
);
assert.deepEqual(helpers.getAdvanceSetting(), {}, 'Missing control keeps the historical empty read');
assert.deepEqual(helpers.getAdvanceSetting(control, 'itemnames'), [{ key: 'a', value: 'A' }]);
assert.deepEqual(helpers.getAdvanceSetting(control, 'nested'), { enabled: true });
assert.equal(helpers.getAdvanceSetting(control, 'missing'), '');
assert.equal(helpers.getAdvanceSetting({ advancedSetting: { itemnames: 'bad-json' } }, 'itemnames'), '');
const arraySetting = { type: 9, advancedSetting: { itemnames: [{ key: 'a' }] } };
assert.deepEqual(
  helpers.getAdvanceSetting(arraySetting, 'itemnames'),
  [{ key: 'a' }],
  'Already parsed array settings pass through',
);
const objectSetting = { type: 9, advancedSetting: { nested: { enabled: true } } };
assert.deepEqual(
  helpers.getAdvanceSetting(objectSetting, 'nested'),
  { enabled: true },
  'Already parsed objects pass through',
);
console.log('Control advanced-setting raw identity, parsed JSON values, missing and malformed settings passed');

assert.equal(helpers.getAdvanceSetting({ advancedSetting: { showtype: '0' } }, 'showtype'), 0);
assert.equal(helpers.getAdvanceSetting({ advancedSetting: { showtype: '1' } }, 'showtype'), 1);
assert.equal(
  helpers.getAdvanceSetting({ advancedSetting: { itemnames: '' } }, 'itemnames'),
  '',
  'Missing known arrays retain the falsy sentinel needed by caller defaults',
);
assert.deepEqual(helpers.getAdvanceSetting({ advancedSetting: { min: '[{"cid":"today","staticValue":""}]' } }, 'min'), [
  { cid: 'today', staticValue: '' },
]);
assert.deepEqual(
  helpers.getAdvanceSetting(
    { advancedSetting: { itemcolor: '{"type":2,"colors":[{"key":"1","value":"red"}]}' } },
    'itemcolor',
  ),
  { type: 2, colors: [{ key: '1', value: 'red' }] },
);
assert.deepEqual(
  helpers.getAdvanceSetting(
    { advancedSetting: { itemnames: '[{"key":1},{"key":"ok","value":"valid"}]' } },
    'itemnames',
  ),
  [{ key: 'ok', value: 'valid' }],
);

const parsedBoundary = loadDecoder() as ParsedBoundary;
assert.deepEqual(parsedBoundary.calendarPairs('[{"begin":"start","end":"end"}]'), [{ begin: 'start', end: 'end' }]);
assert.deepEqual(parsedBoundary.calendarPairs('not-json'), []);
assert.deepEqual(parsedBoundary.calendarPairs('[null,{"begin":4},{"begin":"start"}]'), [{ begin: 'start' }]);
assert.deepEqual(parsedBoundary.parsedSettingStrings('["a",4,null,"b"]'), ['a', 'b']);
const countries = '[{"name":"China","iso2":"CN","dialCode":"86"}]';
assert.deepEqual(helpers.getAdvanceSetting({ advancedSetting: { allowcountries: countries } }, 'allowcountries'), [
  { name: 'China', iso2: 'CN', dialCode: '86' },
]);
assert.deepEqual(helpers.getAdvanceSetting({ advancedSetting: { commcountries: '["CN","US"]' } }, 'commcountries'), [
  'CN',
  'US',
]);

assert.deepEqual(
  helpers.getAdvanceSetting({ advancedSetting: { defsource: '[{"cid":"","staticValue":3}]' } }, 'defsource'),
  [{ cid: '', staticValue: 3 }],
);
