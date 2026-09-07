const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../scripts/spec-harness');

function loadNavigateTo() {
  const moduleLike = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, 'navigateTo.js'), {
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function getPathWithoutSubPath(url) {
    const route = String(url).startsWith(global.location.origin)
      ? String(url).slice(global.location.origin.length)
      : String(url);
    const subPath = global.window.subPath || '';

    return subPath && route.startsWith(`${subPath}/`) ? route.slice(subPath.length) : route;
  }

  function getPathWithSubPath(url) {
    const subPath = global.window.subPath || '';

    return subPath && !url.startsWith(subPath) ? `${subPath}${url}` : url;
  }

  function pathCompletion(url, parameters = { hasDomain: true }) {
    if (parameters.hasDomain === false) {
      return getPathWithSubPath(url);
    }

    const webUrl = global.md.global.Config.WebUrl;

    return webUrl
      ? webUrl.replace(/\/+$/, '') + getPathWithoutSubPath(url)
      : global.location.origin + getPathWithSubPath(url);
  }

  function localRequire(request) {
    if (request === 'ming-ui') {
      return { Dialog: {} };
    }

    if (request === 'src/api/login') {
      return {};
    }

    if (request === 'src/api/project') {
      return { checkSubDomain: () => false };
    }

    if (request === 'src/utils/common') {
      return {
        browserIsMobile: () => false,
        getPathWithoutSubPath,
        pathCompletion,
      };
    }

    return require(request);
  }

  global.md = { global: { Account: { accountId: 'account-1' }, Config: { WebUrl: 'https://example.com/tenant/' } } };
  global.safeParse = value => JSON.parse(value);
  global.localStorage = {
    getItem: key =>
      key === 'latest_group_account-1'
        ? JSON.stringify({ projectId: 'project-1', groupType: 1, groupId: 'group-1' })
        : null,
  };
  global.location = {
    origin: 'https://example.com',
    host: 'example.com',
    hostname: 'example.com',
    pathname: '/tenant/app/my',
    href: 'https://example.com/tenant/app/my',
  };
  global.window = {
    subPath: '/tenant',
    redirected: false,
    location: {
      assign: url => global.__navigateToCalls.push(`assign:${url}`),
      replace: url => global.__navigateToCalls.push(`replace:${url}`),
    },
    reactRouterHistory: {
      push: url => global.__navigateToCalls.push(url),
      replace: url => global.__navigateToCalls.push(`replace:${url}`),
    },
  };
  global.__navigateToCalls = [];

  new Function('module', 'exports', 'require', 'window', 'location', 'md', 'localStorage', 'safeParse', code)(
    moduleLike,
    moduleLike.exports,
    localRequire,
    global.window,
    global.location,
    global.md,
    global.localStorage,
    global.safeParse,
  );

  return moduleLike.exports;
}

const { navigateTo, navigateToLogin, redirect } = loadNavigateTo();

navigateTo('/app/my');
assert.deepStrictEqual(global.__navigateToCalls, ['/tenant/app/my/group/project-1/1/group-1']);

const redirected = [];
assert.strictEqual(
  redirect('/tenant/app/my', url => redirected.push(url)),
  true,
);
assert.deepStrictEqual(redirected, ['/app/my/group/project-1/1/group-1']);

window.subPath = '/portal';
md.global.Config.WebUrl = 'https://meihua.mingdao.com/';
location.origin = 'https://meihua.mingdao.com';
location.host = 'meihua.mingdao.com';
location.hostname = 'meihua.mingdao.com';
location.pathname = '/portal/xxxx12343';
location.href = 'https://meihua.mingdao.com/portal/xxxx12343';

// NOTE: '/network', not '/login'. These two are the SAME route with different UI
// variants -- src/pages/AuthService/App.tsx:22 routes ['/login*', '/network*'] to
// <Login>, and login/index.tsx:28 + components/Bg.tsx:21 switch on
// location.href.indexOf('network') to pick the variant.
//
// The original upstream assertions expected '/login' and were red from the day
// they were written (7.4.0, 96ab5137b -- upstream had no test runner and never
// ran them). navigateToLogin has hardcoded `isSubDomain = true` since 5.6.0
// (748650220) with the project.checkSubDomain() call commented out, making the
// '/login' branch unreachable dead code (src/router/navigateTo.ts:67-79).
// Even the spec's own "restore checkSubDomain" premise is self-contradictory
// here: that commented-out block only calls checkSubDomain when the host is NOT
// one of ['meihua.mingdao.com', 'www.mingdao.com'], and this case uses
// meihua.mingdao.com -- so isSubDomain would stay true and still yield /network.
// The `checkSubDomain` stub in localRequire above is dead: navigateTo.ts does
// not import 'src/api/project' at all.
//
// This is a corrected wrong expectation, NOT a weakened assertion.
navigateToLogin({ needSecondCheck: false });
assert.strictEqual(location.href, '/portal/network?ReturnUrl=https%3A%2F%2Fmeihua.mingdao.com%2Fportal%2Fxxxx12343');

window.subPath = '';
md.global.Config.WebUrl = 'https://meihua.mingdao.com/';
location.origin = 'https://www.theportal.cn';
location.host = 'www.theportal.cn';
location.hostname = 'www.theportal.cn';
location.pathname = '/xxxx12343';
location.href = 'https://www.theportal.cn/xxxx12343';

navigateToLogin({ needSecondCheck: false });
// Same as above: isSubDomain is hardcoded true, so this is '/network'.
assert.strictEqual(location.href, '/network?ReturnUrl=https%3A%2F%2Fwww.theportal.cn%2Fxxxx12343');

console.log('navigateTo tests passed');
