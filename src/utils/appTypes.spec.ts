const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const loadedModule: { exports: Record<string, (...args: unknown[]) => unknown> } = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, './appTypes.ts'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', code)(loadedModule, loadedModule.exports);
const {
  decodeTranslationData,
  decodeAppLangInfo,
  decodeAppLanguages,
  decodeAppLanguageDetail,
  decodeDescriptionResponse,
} = loadedModule.exports;
assert.deepStrictEqual(decodeTranslationData([{ correlationId: 'app', data: { name: 'Translated' } }]), [
  { correlationId: 'app', data: { name: 'Translated' } },
]);
assert.deepStrictEqual(decodeTranslationData({ app: { correlationId: 'app', data: { name: 'Translated' } } }), {
  app: { correlationId: 'app', data: { name: 'Translated' } },
});
assert.deepStrictEqual(decodeAppLangInfo({ appLangId: 'lang', langCode: 'en', version: 2, projectId: 'org' }), {
  appLangId: 'lang',
  langCode: 'en',
  version: 2,
  projectId: 'org',
});
assert.deepStrictEqual(decodeAppLanguages([{ id: 'lang', langCode: 'en' }]), [{ id: 'lang', langCode: 'en' }]);
assert.deepStrictEqual(decodeAppLanguageDetail({ items: [{ correlationId: 'field', data: { name: 'Field' } }] }), {
  items: [{ correlationId: 'field', data: { name: 'Field' } }],
});
assert.deepStrictEqual(decodeDescriptionResponse({ data: { isSuccess: true, content: { value: 'Generated' } } }), {
  data: { isSuccess: true, content: { value: 'Generated' } },
});
const invalidCases: Array<[(value: unknown) => unknown, unknown]> = [
  [decodeTranslationData, [{ correlationId: 3 }]],
  [decodeAppLangInfo, { appLangId: 3 }],
  [decodeAppLanguages, [{ id: 3 }]],
  [decodeAppLanguageDetail, { items: [{ data: { name: 3 } }] }],
  [decodeDescriptionResponse, { data: { isSuccess: true } }],
];
for (const [decoder, value] of invalidCases) {
  assert.throws(() => decoder(value), /Invalid/);
}
console.log('app finite boundary tests passed');
