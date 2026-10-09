const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const lodash = require('lodash');

type Exported = Record<string, (...args: unknown[]) => unknown>;
function load(stubs: Record<string, unknown>, globals: Record<string, unknown>): Exported {
  const loaded: { exports: Exported } = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, './app.ts'), {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(
    loaded,
    loaded.exports,
    (name: string) => {
      if (!(name in stubs)) throw new Error('Unstubbed import ' + name);
      return stubs[name];
    },
    ...Object.values(globals),
  );
  return loaded.exports;
}
const appTypesLoaded: { exports: Record<string, unknown> } = { exports: {} };
const appTypesCode = transformFileSync(path.join(__dirname, './appTypes.ts'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
new Function('module', 'exports', appTypesCode)(appTypesLoaded, appTypesLoaded.exports);
const languageCache: Record<string, unknown> = {};
const window = Object.assign(languageCache, {
  getCurrentLang: () => 'en',
  md: { global: { Account: { accountId: 'account' } } },
});
const detailCalls: unknown[] = [];
const faviconRequests: unknown[] = [];
const faviconUpdates: string[] = [];
const originalSvg = '<svg fill="red"><path fill="blue"/></svg>';
let languageFailure: unknown;
let listFailure: unknown;
let descriptionResponse: unknown = { data: { isSuccess: true, content: { value: 'Generated' } } };
const app = load(
  {
    lodash,
    'src/api/agent': { agentExecute: () => Promise.resolve(descriptionResponse) },
    'src/api/appManagement': {
      getAppLangDetail: (args: unknown) => {
        detailCalls.push(args);
        if (languageFailure) return Promise.reject(languageFailure);
        return Promise.resolve({ items: [{ correlationId: 'field', parentId: 'sheet', data: { name: '字段' } }] });
      },
      getAppLangs: () =>
        listFailure ? Promise.reject(listFailure) : Promise.resolve([{ id: 'lang', langCode: 'en' }]),
    },
    'src/api/homeApp': {
      getAppLangInfo: () => Promise.resolve({ appLangId: 'lang', langCode: 'en', version: 2, projectId: 'org' }),
    },
    'src/common/langConfig': { getAppLangCode: (value: string | null) => value },
    'src/pages/widgetConfig/config/widget': {
      DEFAULT_CONFIG: { TEXT: { widgetName: '文本' } },
      WIDGETS_TO_API_TYPE_ENUM: { TEXT: 2 },
    },
    'src/utils/agentSession': { genBotSessionId: () => 'session' },
    './appTypes': appTypesLoaded.exports,
  },
  {
    window,
    location: { href: 'https://example.test/?app_lang=en' },
    fetch: (url: unknown) => {
      faviconRequests.push(url);
      return Promise.resolve({ text: () => Promise.resolve(originalSvg) });
    },
    btoa: (value: string) => value,
    $: () => ({
      attr(_name: string, value: string) {
        faviconUpdates.push(value);
      },
    }),
    _l: (value: string) => value,
  },
);
(async () => {
  app.setFavicon(undefined, 'green');
  app.setFavicon(null, 'green');
  app.setFavicon('', 'green');
  assert.deepStrictEqual(faviconRequests, [], 'missing URL never starts a favicon request');
  app.setFavicon('/uncolored.svg', undefined);
  app.setFavicon('/uncolored_preserve.svg', null);
  app.setFavicon('/empty-color.svg', '');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepStrictEqual(
    faviconUpdates,
    Array(3).fill('data:image/svg+xml;base64,' + originalSvg),
    'missing color keeps the fetched SVG unchanged',
  );
  app.setFavicon('/colored.svg', 'green');
  app.setFavicon('/colored_preserve.svg', 'green');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepStrictEqual(
    faviconUpdates.slice(3),
    [
      'data:image/svg+xml;base64,<svg fill="green" ><path /></svg>',
      'data:image/svg+xml;base64,<svg fill="green" fill="red"><path fill="blue"/></svg>',
    ],
    'valid normal and preserve icons keep their previous color behavior',
  );
  const sections = [
    {
      workSheetInfo: [{ type: 2, workSheetId: 'group' }],
      childSections: [{ appSectionId: 'group', item: [{ name: 'Nested page', type: 1 }] }],
    },
  ];
  assert.deepStrictEqual(app.getExistWorksheet({ sections }), [
    { name: 'Nested page', description: undefined, type: 'page' },
  ]);
  const cachedTranslations = [
    { correlationId: 'field', parentId: 'sheet', data: { name: '字段' } },
    { correlationId: 'field', parentId: 'other', data: { name: '其它' } },
  ];
  languageCache['langData-app'] = cachedTranslations;
  assert.deepStrictEqual(app.getTranslateInfo('app', 'sheet', 'field'), { name: '字段' });
  cachedTranslations[0].data.name = 'Mutated after indexing';
  assert.deepStrictEqual(
    app.getTranslateInfo('app', 'sheet', 'field'),
    { name: 'Mutated after indexing' },
    'same-length cache keeps the original index object',
  );
  cachedTranslations[0] = { correlationId: 'replacement', parentId: 'sheet', data: { name: 'Replacement' } };
  assert.deepStrictEqual(
    app.getTranslateInfo('app', 'sheet', 'field'),
    { name: 'Mutated after indexing' },
    'same-length replacement keeps the old indexed record',
  );
  assert.deepStrictEqual(app.getTranslateInfo('app', 'sheet', 'replacement'), {});
  cachedTranslations.push({ correlationId: 'new', parentId: '', data: { name: 'New' } });
  assert.deepStrictEqual(app.getTranslateInfo('app', null, 'new'), { name: 'New' }, 'length change rebuilds the index');
  let identityReads = 0;
  const countedItems = [
    {
      get correlationId() {
        identityReads++;
        return 'counted';
      },
      data: { name: 'Counted' },
    },
  ];
  app.getTranslateInfo('app', null, 'counted', countedItems);
  const initialReads = identityReads;
  app.getTranslateInfo('app', null, 'counted', countedItems);
  assert.strictEqual(identityReads, initialReads, 'hot lookup uses cached index without scanning translation records');
  languageCache['langData-app'] = { field: { correlationId: 'field', data: { name: '字段字典' } } };
  assert.deepStrictEqual(app.getTranslateInfo('app', null, 'field'), { name: '字段字典' });
  assert.deepStrictEqual(app.getWidgetTypeName(2), { controlTypeName: '文本', controlType: 'TEXT' });
  const description = await app.generateAppOrWorksheetDescription({ name: 'App', isApp: true, data: { sections } });
  assert.deepStrictEqual(description, { data: { isSuccess: true, content: { value: 'Generated' } } });
  descriptionResponse = { data: { isSuccess: false, errorMsg: 'failed' } };
  assert.deepStrictEqual(await app.generateAppOrWorksheetDescription({ name: 'Table', isApp: false }), {
    data: { isSuccess: false, errorMsg: 'failed' },
  });
  languageCache['langVersion-app'] = 1;
  const loaded = await app.getAppLangDetail({
    id: 'app',
    projectId: 'org',
    langInfo: { appLangId: 'lang', version: 2 },
  });
  assert.deepStrictEqual(loaded, { items: [{ correlationId: 'field', parentId: 'sheet', data: { name: '字段' } }] });
  assert.strictEqual(detailCalls.length, 1);
  const shared = await app.shareGetAppLangDetail({ appId: 'app', projectId: 'org' });
  assert.deepStrictEqual(shared, { items: [{ correlationId: 'field', parentId: 'sheet', data: { name: '字段' } }] });
  languageFailure = new Error('language network failure');
  const detailPending = app.getAppLangDetail({ id: 'failed', langInfo: { appLangId: 'lang', version: 1 } });
  assert.ok(detailPending instanceof Promise);
  await assert.rejects(detailPending, /language network failure/);
  assert.strictEqual(languageCache['langData-failed'], undefined, 'rejected language detail never writes cache');
  const sharePending = app.shareGetAppLangDetail({ appId: 'failed' });
  assert.ok(sharePending instanceof Promise);
  await assert.rejects(sharePending, /language network failure/);
  languageFailure = undefined;
  listFailure = new Error('language list failure');
  const listPending = app.shareGetAppLangDetail({ appId: 'failed' });
  assert.ok(listPending instanceof Promise);
  await assert.rejects(listPending, /language list failure/);
  console.log('app cache and description behavior tests passed');
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
