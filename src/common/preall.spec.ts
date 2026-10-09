const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const metadataModule = require('./bootstrapMetadata.ts');
const identityModule = require('./portalIdentityRedirect.ts');

interface ObservedPreload {
  state: { loading: boolean; failed?: boolean };
  componentDidMount(): void;
  render(): unknown;
}
type PreloadConstructor = new (props: { label: string }) => ObservedPreload;
interface PageBootstrap {
  default(component: unknown, options?: { allowNotLogin?: boolean }): PreloadConstructor;
}

async function run() {
  let reply: unknown;
  let failure: unknown;
  const calls: Array<{ sync: boolean }> = [];
  const initial = {
    Account: { accountId: 'fixture', lang: 'zh-Hans', langModified: true, isPortal: false, projects: [] },
    Config: { ProductCode: 'server', WebUrl: 'https://example.com/' },
    SysSettings: {},
    FileStoreConfig: {},
  };
  const md: { global: unknown } = { global: initial };
  const location = { href: 'https://example.com/app/fixture', pathname: '/app/fixture', search: '', reload() {} };
  const window = {
    md,
    location,
    platformENV: {},
    shareState: {},
    isWaiting: false,
    addEventListener() {},
    top: {},
    self: {},
  };
  const storage = { getItem: () => null, removeItem() {}, setItem() {} };
  class ControlledComponent {
    props: { label: string };
    state: Record<string, unknown> = {};
    constructor(props: { label: string }) {
      this.props = props;
    }
    setState(update: Record<string, unknown>) {
      this.state = { ...this.state, ...update };
    }
  }
  const noop = () => {};
  const imports: Record<string, unknown> = {
    react: { ...React, Component: ControlledComponent },
    'react/jsx-runtime': require('react/jsx-runtime'),
    dayjs: { locale: noop },
    moment: { locale: noop },
    lodash: require('lodash'),
    'styled-components': { StyleSheetManager: ({ children }) => children },
    'ming-ui': { LoadDiv: () => React.createElement('p', null, 'loading') },
    'src/api/accountSetting': { autoEditAccountLangSetting: noop },
    'src/api/global': {
      getGlobalMeta: (_args: unknown, options?: { ajaxOptions?: { sync?: boolean } }) => {
        const sync = options?.ajaxOptions?.sync === true;
        calls.push({ sync });
        if (sync) return reply;
        return failure ? Promise.reject(failure) : Promise.resolve(reply);
      },
    },
    'src/common/portalIdentityRedirect': identityModule,
    'src/common/shouldForwardProp': () => true,
    'src/common/theme': { installPlatformTheme: noop, installStaticHolderTheme: noop, syncThemeFromLocation: noop },
    'src/components/checkPermission': { prefetchMyPermissions: () => Promise.resolve([]) },
    'src/pages/AuthService/portalAccount/util.js': { resetPortalUrl: noop },
    'src/router/globalEvents': { initThemeMode: noop },
    'src/router/navigateTo': { navigateTo: noop, navigateToLogin: noop, navigateToLogout: noop, redirect: noop },
    'src/utils/common': {
      browserIsMobile: () => false,
      getPathWithoutSubPath: (value: string) => value,
      pathCompletion: (value: string) => value,
    },
    'src/utils/project': { prefetchContactInfo: () => Promise.resolve({}) },
    'src/utils/pssId': { getPssId: () => 'fixture', setPssId: noop },
    './bootstrapMetadata': metadataModule,
  };
  const globals = {
    window,
    md,
    location,
    localStorage: storage,
    getCurrentLang: () => 'zh-Hans',
    getCurrentLangCode: () => 0,
    setCookie: noop,
    $: () => ({ attr: noop }),
    _l: (text: string) => text,
  };
  const loaded = { exports: {} };
  const code = transformFileSync(path.join(__dirname, 'preall.tsx')).code;
  const bootstrap: PageBootstrap = new Function(
    'module',
    'exports',
    'require',
    ...Object.keys(globals),
    `${code}\nreturn module.exports;`,
  )(
    loaded,
    loaded.exports,
    (name: string) => {
      if (name.startsWith('dayjs/locale/')) return {};
      if (!(name in imports)) throw new Error(`Unstubbed ${name}`);
      return imports[name];
    },
    ...Object.values(globals),
  );
  const page = ({ label }: { label: string }) => React.createElement('p', null, label);
  const WrappedPage = bootstrap.default(page);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  reply = { 'md.global': initial };
  const success = new WrappedPage({ label: 'protected page' });
  assert.match(renderToStaticMarkup(success.render()), /loading/);
  success.componentDidMount();
  await settle();
  assert.match(
    renderToStaticMarkup(success.render()),
    /protected page/,
    'Only a successful bootstrap renders its business page and forwards props',
  );
  const lastValidMetadata = md.global;
  failure = new Error('network unavailable');
  const rejected = new WrappedPage({ label: 'must stay hidden' });
  rejected.componentDidMount();
  await settle();
  assert.match(renderToStaticMarkup(rejected.render()), /role="alert"/);
  assert.doesNotMatch(renderToStaticMarkup(rejected.render()), /must stay hidden/);
  failure = undefined;
  reply = { 'md.global': { ...initial, Account: { accountId: 1 } } };
  const invalid = new WrappedPage({ label: 'invalid identity must stay hidden' });
  invalid.componentDidMount();
  await settle();
  assert.match(renderToStaticMarkup(invalid.render()), /role="alert"/);
  assert.doesNotMatch(renderToStaticMarkup(invalid.render()), /invalid identity must stay hidden/);
  assert.equal(md.global, lastValidMetadata, 'Rejected metadata never replaces the current bootstrap tree');
  md.global = null;
  const invalidInitial = new WrappedPage({ label: 'invalid initial tree must stay hidden' });
  assert.doesNotThrow(
    () => invalidInitial.componentDidMount(),
    'Synchronous initial metadata failures use the same error state',
  );
  assert.match(renderToStaticMarkup(invalidInitial.render()), /role="alert"/);
  assert.doesNotMatch(renderToStaticMarkup(invalidInitial.render()), /invalid initial tree must stay hidden/);
  md.global = lastValidMetadata;
  reply = { 'md.global': initial };
  assert.equal(bootstrap.default({ type: 'function' }, { allowNotLogin: true }), undefined);
  assert.equal(calls.at(-1)?.sync, true, 'The public-page sentinel completes metadata synchronously');
  const MemoPage = bootstrap.default(React.memo(page));
  const memo = new MemoPage({ label: 'memo page' });
  memo.componentDidMount();
  await settle();
  assert.match(
    renderToStaticMarkup(memo.render()),
    /memo page/,
    'Object-shaped React memo components are not sentinel commands',
  );
  console.log(
    'Actual page wrapper waits for valid metadata, forwards props, blocks failed bootstrap and preserves sync/memo entry points.',
  );
}
void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
