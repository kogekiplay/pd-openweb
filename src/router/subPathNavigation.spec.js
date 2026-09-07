const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parser, readSource, expectedFailure } = require('../../scripts/spec-harness');

const projectRoot = path.resolve(__dirname, '../..');
const files = [
  'src/pages/Mobile/components/TabBar/index.js',
  'src/pages/Mobile/Members/ChangeRole/index.js',
  'src/pages/Mobile/Members/List/index.js',
  'src/pages/Mobile/Members/index.js',
  'src/pages/Mobile/MyHome/index.js',
  'src/pages/Admin/app/exclusiveComp/container/DataBase.jsx',
  'src/pages/agent/AgentLand.jsx',
];
const mobileIndexFile = 'src/pages/Mobile/index.jsx';
const preallFile = 'src/common/preall.js';
const publicWorksheetActionFile = 'src/pages/PublicWorksheet/action.js';
const prePayorderFile = 'src/pages/Admin/pay/PrePayorder/index.js';
const calendarShareFile = 'src/pages/calendar/share/index.jsx';
const pathToRegexpFiles = [
  {
    file: 'src/socket/customNotice/index.js',
    direct: 'integrationParams(location.pathname)',
    normalized: 'integrationParams(getPathWithoutSubPath(location.pathname))',
  },
  {
    file: 'src/pages/invoice/InvoiceApply/index.jsx',
    direct: 'invoiceParams(location.pathname)',
    normalized: 'invoiceParams(getPathWithoutSubPath(location.pathname))',
  },
  {
    file: 'src/pages/Admin/pay/OrderPay/index.js',
    direct: 'fn(location.pathname)',
    normalized: 'fn(getPathWithoutSubPath(location.pathname))',
  },
];

function walk(node, visitor) {
  if (!node || typeof node !== 'object') return;

  visitor(node);

  Object.keys(node).forEach(key => {
    if (key === 'loc' || key === 'start' || key === 'end') return;

    const value = node[key];

    if (Array.isArray(value)) {
      value.forEach(child => walk(child, visitor));
    } else if (value && typeof value.type === 'string') {
      walk(value, visitor);
    }
  });
}

function getMemberExpressionName(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'ThisExpression') return 'this';
  if (node.type === 'MemberExpression') {
    return `${getMemberExpressionName(node.object)}.${getMemberExpressionName(node.property)}`;
  }

  return '';
}

function isHistoryRootNavigation(node) {
  const historyObject = getMemberExpressionName(node.callee && node.callee.object);

  return (
    node.type === 'CallExpression' &&
    node.callee &&
    node.callee.type === 'MemberExpression' &&
    (historyObject === 'history' || historyObject.endsWith('.history')) &&
    node.callee.property &&
    ['push', 'replace'].includes(node.callee.property.name) &&
    node.arguments[0] &&
    ((node.arguments[0].type === 'StringLiteral' && node.arguments[0].value.startsWith('/')) ||
      (node.arguments[0].type === 'TemplateLiteral' &&
        node.arguments[0].quasis[0] &&
        node.arguments[0].quasis[0].value.raw.startsWith('/')))
  );
}

const violations = [];

files.forEach(file => {
  const source = readSource(projectRoot, file);
  const ast = parser.parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties'],
  });

  walk(ast, node => {
    if (isHistoryRootNavigation(node)) {
      violations.push(`${file}:${node.loc.start.line}`);
    }
  });
});

{
  const source = readSource(projectRoot, mobileIndexFile);
  const ast = parser.parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'classProperties'],
  });
  const checks = {
    importsGetPathWithoutSubPath: false,
    normalizesMobileFallbackPathname: false,
  };

  walk(ast, node => {
    if (
      node.type === 'ImportDeclaration' &&
      node.source.value === 'src/utils/common' &&
      node.specifiers.some(specifier => specifier.imported && specifier.imported.name === 'getPathWithoutSubPath')
    ) {
      checks.importsGetPathWithoutSubPath = true;
    }

    if (
      node.type === 'VariableDeclarator' &&
      node.id &&
      node.id.name === 'pathname' &&
      node.init &&
      node.init.type === 'CallExpression' &&
      node.init.callee.name === 'getPathWithoutSubPath' &&
      node.init.arguments[0] &&
      node.init.arguments[0].type === 'MemberExpression' &&
      node.init.arguments[0].object.name === 'location' &&
      node.init.arguments[0].property.name === 'pathname'
    ) {
      checks.normalizesMobileFallbackPathname = true;
    }
  });

  assert.deepStrictEqual(checks, {
    importsGetPathWithoutSubPath: true,
    normalizesMobileFallbackPathname: true,
  });
}

{
  const source = readSource(projectRoot, preallFile);

  assert(!source.includes('md.global.Config.WebUrl + location.pathname + search'));
  assert(!source.includes('md.global.Config.WebUrl + `/portal/${md.global.Account.appId}`'));
  assert(!source.includes("md.global.Config.WebUrl + '/dashboard'"));
  assert(
    !source.includes(
      "md.global.Config.WebUrl.replace(/\\/+$/, '') + getPathWithoutSubPath(location.pathname) + search",
    ),
  );
  assert(!source.includes('`${location.search}&sys_lang=${sysDefaultLang}`'));
  assert(source.includes("url.searchParams.set('sys_lang', sysDefaultLang);"));
  assert(source.includes('location.href = pathCompletion(`${url.pathname}${url.search}`);'));
  assert(source.includes('location.href = pathCompletion(`/portal/${md.global.Account.appId}`);'));
  assert(source.includes("location.href = pathCompletion('/dashboard');"));
}

{
  const source = readSource(projectRoot, publicWorksheetActionFile);

  assert(!source.includes('`${md.global.Config.WebUrl}${url}ReturnUrl=${encodeURIComponent(location.href)}`'));
  assert(source.includes('location.href = pathCompletion(`${url}ReturnUrl=${encodeURIComponent(location.href)}`);'));

  // QUARANTINED -- upstream's subPath migration of this file is incomplete.
  // action.ts:534 was converted to pathCompletion(...), but the adjacent
  // weixinAuth baseUrl at action.ts:540 was not. The defect is real, but the
  // fix these two assertions prescribe is NOT correct: pathCompletion() appends
  // hideOptions as a query string (src/utils/common.ts:1517-1519), so
  // pathCompletion('/weixinAuth') can return '/weixinAuth?tb=no', and the very
  // next lines build `${baseUrl}?returnUrl=` / `${baseUrl}?authUrl=` -- yielding
  // a double-'?' URL that would break the WeChat OAuth redirect_uri.
  // Note this same spec asserts the OPPOSITE for Admin/pay/PrePayorder (it must
  // KEEP the absolute `${WebUrl}orderpay/...`), i.e. outward-facing absolute
  // URLs are already a recognised exception class -- weixinAuth is one too.
  // Do not "fix" action.ts to match these assertions. See TODO below.
  //
  // TODO(subpath-weixinauth): decide the correct fix. Requires (1) confirming
  // whether the server-issued md.global.Config.WebUrl already contains the
  // subPath under a subPath deployment -- unknowable from this repo; (2) if a
  // migration is needed, building the absolute prefix WITHOUT hideOptions
  // rather than calling pathCompletion('/weixinAuth'); (3) syncing the WeChat
  // open-platform callback-domain whitelist.
  expectedFailure('PublicWorksheet weixinAuth baseUrl is not subPath-aware', () => {
    assert(!source.includes('`${md.global.Config.WebUrl}weixinAuth`'));
    assert(source.includes("const baseUrl = pathCompletion('/weixinAuth');"));
  });
}

{
  const source = readSource(projectRoot, prePayorderFile);
  const orderpayPathCompletion = ['pathCompletion(`/', 'orderpay/${orderId}`)'].join('');

  assert(source.includes('`${md.global.Config.WebUrl}orderpay/${orderId}`'));
  assert(!source.includes(orderpayPathCompletion));
}

{
  const source = readSource(projectRoot, calendarShareFile);

  assert(!source.includes("md.global.Config.WebUrl + 'images/calendar/sharelogo.png'"));
  assert(source.includes("imgUrl: '/staticfiles/images/calendar/sharelogo.png'"));
}

pathToRegexpFiles.forEach(({ file, direct, normalized }) => {
  const source = readSource(projectRoot, file);

  assert(!source.includes(direct), `${file} should not pass location.pathname directly to path-to-regexp`);
  assert(source.includes(normalized), `${file} should normalize pathname before path-to-regexp match`);
});

assert.deepStrictEqual(violations, []);

console.log('subPath navigation tests passed');
