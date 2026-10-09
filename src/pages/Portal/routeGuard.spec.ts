const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');
const lodash = require('lodash');

let logout = 0;
const location = { href: 'https://example.com/portal/app/app-id/group/sheet/view', search: '' };
const md = { global: { Account: { isPortal: true, appId: 'app-id', addressSuffix: 'custom-suffix' } } };
const exportsLike = { exports: {} as { formatPortalHref: (props: unknown) => void } };
const { code } = transformFileSync(process.env.PORTAL_GUARD_SOURCE || path.join(__dirname, 'util.ts'));
new Function('module', 'exports', 'require', 'md', 'location', code)(
  exportsLike,
  exportsLike.exports,
  (name: string) => {
    if (name === 'lodash') return lodash;
    if (name === 'src/api/homeApp') return {};
    if (name === 'src/pages/AuthService/portalAccount/util') return { getSuffix: () => 'app' };
    if (name === 'src/router/navigateTo')
      return {
        navigateToLogout: () => {
          logout++;
        },
      };
    if (name === 'src/utils/common') return { pathCompletion: (value: string) => value };
    throw new Error(`Unexpected portal guard dependency: ${name}`);
  },
  md,
  location,
);

exportsLike.exports.formatPortalHref({
  match: { params: { appId: 'app-id', groupId: 'group', worksheetId: 'sheet' } },
});
assert.equal(logout, 0, 'The real header guard must accept Router 8 match props for the authenticated portal app');
exportsLike.exports.formatPortalHref({ computedMatch: { params: { appId: 'app-id' } } });
assert.equal(logout, 0, 'Legacy callers remain valid');
exportsLike.exports.formatPortalHref({ match: { params: { appId: 'other-app' } } });
assert.equal(logout, 1, 'The mismatch check still rejects a different application');
console.log('Portal header accepts the actual match contract and retains app mismatch protection.');
