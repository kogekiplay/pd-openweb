const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../../scripts/spec-harness.ts');
const { matchRoutes } = require('react-router');
const _ = require('lodash');

function loadConfig(file: string, subPath: string): Record<string, { path: string | string[] }> {
  const moduleLike = { exports: {} };
  const { code } = transformFileSync(file);
  // Mirrors the actual addSubPath helper's prefixing contract, including the old relative-path defect.
  new Function('module', 'exports', 'require', '_l', code)(
    moduleLike,
    moduleLike.exports,
    (name: string) => {
      if (name === 'src/utils/common')
        return {
          addSubPathOfRoutes: (routes: Record<string, { path: string | string[] }>) => {
            const copy = _.cloneDeep(routes);
            for (const route of Object.values(copy))
              route.path = Array.isArray(route.path) ? route.path.map(p => subPath + p) : subPath + route.path;
            return copy;
          },
        };
      throw new Error(`Unexpected route dependency ${name}`);
    },
    (text: string) => text,
  );
  return moduleLike.exports;
}
for (const prefix of ['', '/portal', '/tenant/portal']) {
  const config = loadConfig(process.env.PORTAL_ROUTES_SOURCE || path.join(__dirname, 'config.ts'), prefix);
  for (const name of ['ROUTE_CONFIG', 'PORTAL_ROUTE_CONFIG']) {
    const routes = config[name] as unknown as Record<string, { path: string }>;
    const parent = `${prefix}/app/:appId`;
    const matches = matchRoutes(
      [{ path: parent, children: Object.values(routes).map(r => ({ path: r.path })) }],
      `${prefix}/app/app-id/group/sheet/view`,
    );
    assert(matches?.length === 2, `${prefix || 'root'} must match the application and its worksheet child`);
    assert.equal(matches[1].params.worksheetId, 'sheet');
    assert.equal(matches[1].params.viewId, 'view');
  }
}
console.log('Actual application route config matches worksheet content under main, portal and deployment prefixes.');
