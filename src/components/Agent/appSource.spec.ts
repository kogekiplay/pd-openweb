import type { SpecHarness } from '../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const harness: SpecHarness = require('../../../scripts/spec-harness.ts');
const filename = 'src/components/Agent/appSource.ts';
const root = path.resolve(__dirname, '../../..');
const before = process.env['MENTION_SOURCE_BEFORE_REV'];

interface Request {
  method: string;
  args: unknown;
  options: unknown;
}

function fixture(old = false) {
  let now = 0;
  let favorites: unknown = {};
  let search: unknown = [];
  let favoriteError = false;
  let searchError = false;
  const requests: Request[] = [];
  const source =
    old && before
      ? execFileSync('git', ['show', before + ':' + filename], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, filename), 'utf8');
  const transformed = harness.transformSync(source, {
    filename: path.join(root, filename),
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  assert.ok(transformed?.code);
  const moduleLike: { exports: Record<string, unknown> } = { exports: {} };
  const api = {
    getMyApp(args: unknown, options: unknown) {
      requests.push({ method: 'favorite', args, options });
      return favoriteError ? Promise.reject(new Error('favorite failure')) : Promise.resolve(favorites);
    },
    searchMyApps(args: unknown, options: unknown) {
      requests.push({ method: 'search', args, options });
      return searchError ? Promise.reject(new Error('search failure')) : Promise.resolve(search);
    },
  };
  new Function('module', 'exports', 'require', 'Date', transformed.code)(
    moduleLike,
    moduleLike.exports,
    (request: string) => {
      assert.equal(request, 'src/api/homeApp');
      return { __esModule: true, default: api };
    },
    { now: () => now },
  );
  return {
    requests,
    call(name: string, ...args: unknown[]): unknown {
      const fn = moduleLike.exports[name];
      if (typeof fn !== 'function') throw new TypeError('Missing module function: ' + name);
      return Reflect.apply(fn, undefined, args);
    },
    setTime(value: number) {
      now = value;
    },
    setResponses(favoriteValue: unknown, searchValue: unknown) {
      favorites = favoriteValue;
      search = searchValue;
    },
    setErrors(favoriteValue: boolean, searchValue: boolean) {
      favoriteError = favoriteValue;
      searchError = searchValue;
    },
  };
}

const valid = [
  [{ id: 'a', name: 'A' }],
  [{ appId: 'b', appName: 'B', appIconUrl: '/b.svg', appIconColor: '#abc' }],
  [{ id: '', appId: 'c', name: '', appName: 'C', icon: '/c.svg', themeColor: '#def' }],
  [{ id: 'a', appId: 'b', name: 'A', appName: 'B', iconUrl: '/a.svg', appIconUrl: '/b.svg', navColor: '#abc' }],
  [{ id: 'a', name: 'A', iconColor: '#123', appIconColor: '#456', themeColor: '#789', navColor: '#abc' }],
  [],
  {},
  { apps: [{ id: 'a', name: 'A' }] },
  { list: [{ appId: 'a', appName: 'A' }] },
  { data: [{ id: 'a', name: 'A' }] },
  { apps: [], list: [{ id: 'a', name: 'A' }] },
  { apps: false, list: [{ id: 'a', name: 'A' }] },
];

async function main() {
  const current = fixture();
  const historical = before ? fixture(true) : undefined;
  for (const value of valid) {
    const actual = current.call('normalizeApps', value);
    if (historical) assert.deepEqual(actual, historical.call('normalizeApps', value));
  }
  assert.deepEqual(current.call('normalizeApps', valid[1]), [
    { id: 'b', name: 'B', iconUrl: '/b.svg', iconColor: '#abc' },
  ]);
  assert.deepEqual(current.call('normalizeApps', valid[10]), []);

  for (const malformed of [
    null,
    undefined,
    1,
    'apps',
    [null, 1, 'app', [], {}, { id: 1, name: 'A' }, { id: 'a', name: {} }],
  ]) {
    assert.deepEqual(current.call('normalizeApps', malformed), []);
  }
  assert.deepEqual(current.call('normalizeApps', [{ id: 'a', name: 'A', iconUrl: {}, iconColor: 3 }]), [
    { id: 'a', name: 'A', iconUrl: undefined, iconColor: undefined },
  ]);

  const cached = [{ id: 'a', name: 'A' }];
  current.call('writeAppCache', 'ttl', cached);
  assert.equal(current.call('readAppCache', 'ttl'), cached);
  current.setTime(300000);
  assert.equal(current.call('readAppCache', 'ttl'), cached);
  current.setTime(300001);
  assert.equal(current.call('readAppCache', 'ttl'), null);
  assert.equal(current.call('readAppCache', 'missing'), null);
  const capacity = fixture();
  for (let i = 0; i < 101; i++) capacity.call('writeAppCache', String(i), cached);
  assert.equal(capacity.call('readAppCache', '0'), null);
  assert.equal(capacity.call('readAppCache', '1'), cached);
  assert.equal(capacity.call('readAppCache', '100'), cached);

  const network = fixture();
  network.setResponses({ markedAppItems: [{ appId: 'favorite', appName: 'Favorite' }] }, [
    { id: 'recent', name: 'Recent' },
    { id: 'favorite', name: 'Duplicate' },
  ]);
  const controller = new AbortController();
  const defaults = await network.call('fetchDefaultApps', 'project', { abortController: controller });
  assert.deepEqual(defaults, [
    { id: 'favorite', name: 'Favorite', iconUrl: undefined, iconColor: undefined },
    { id: 'recent', name: 'Recent', iconUrl: undefined, iconColor: undefined },
  ]);
  assert.deepEqual(network.requests, [
    {
      method: 'favorite',
      args: { projectId: 'project', containsLinks: true },
      options: { silent: true, abortController: controller },
    },
    {
      method: 'search',
      args: { projectId: 'project', keywords: '' },
      options: { silent: true, abortController: controller },
    },
  ]);
  if (historical) {
    historical.setResponses({ markedAppItems: [{ appId: 'favorite', appName: 'Favorite' }] }, [
      { id: 'recent', name: 'Recent' },
      { id: 'favorite', name: 'Duplicate' },
    ]);
    assert.deepEqual(defaults, await historical.call('fetchDefaultApps', 'project', { abortController: controller }));
  }
  network.setResponses({ markedApps: 'bad' }, null);
  assert.deepEqual(await network.call('fetchDefaultApps', 'project'), []);
  network.setErrors(true, false);
  assert.deepEqual(await network.call('fetchFavoriteApps', 'project'), []);

  const candidates = fixture();
  candidates.setResponses({}, [{ id: 'a', name: 'A' }]);
  assert.deepEqual(await candidates.call('fetchAppCandidates', ''), []);
  assert.equal(candidates.requests.length, 0);
  const first = await candidates.call('fetchAppCandidates', 'project', 'query');
  assert.equal(await candidates.call('fetchAppCandidates', 'project', 'query'), first);
  assert.equal(candidates.requests.length, 1);
  candidates.setTime(300001);
  assert.deepEqual(await candidates.call('fetchAppCandidates', 'project', 'query'), first);
  assert.equal(candidates.requests.length, 2);
  candidates.setErrors(false, true);
  assert.deepEqual(await candidates.call('fetchAppCandidates', 'project', 'failure'), []);
  console.log(JSON.stringify({ normalizedCases: valid.length, cacheAndNetwork: true, historicalAB: !!historical }));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
