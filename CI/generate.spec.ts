const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cheerio: typeof import('cheerio') = require('cheerio');
const harness: import('../scripts/spec-harness').SpecHarness = require('../scripts/spec-harness.ts');

const root = path.resolve(__dirname, '..');
const originalSource = process.env['CI_GENERATE_BEFORE_SOURCE'];
const source = fs.readFileSync(path.join(__dirname, 'generate.ts'), 'utf8');
interface Scenario {
  type?: string;
  name?: string;
  manifest: unknown;
}
interface Generated {
  html: string;
  manifestReads: string[];
}
async function generate(scenario: Scenario, codeSource = source): Promise<Generated> {
  const type = scenario.type || 'index';
  const templatePath = '/fixtures/templates';
  const template =
    '<!doctype html><html><head></head><body><script src="webpack[index]?fixture"></script></body></html>';
  const manifestPath = path.join(root, 'build/dist', type === 'index' ? '' : type, 'manifest.json');
  const outputs = new Map<string, string>();
  const manifestReads: string[] = [];
  const fakeFs = {
    existsSync: () => false,
    mkdirSync() {},
    readdirSync(dir: string) {
      assert.equal(dir, templatePath);
      return ['fixture.html'];
    },
    readFileSync(file: string, encoding?: string) {
      let content: string;
      if (file === path.join(templatePath, 'fixture.html')) content = template;
      else {
        assert.equal(file, manifestPath);
        manifestReads.push(file);
        content = JSON.stringify(scenario.manifest);
      }
      return encoding ? content : Buffer.from(content);
    },
    writeFileSync(file: string, content: string) {
      outputs.set(file, content);
    },
  };
  const module: { exports: unknown } = { exports: {} };
  const transformed = harness.transformSync(codeSource, {
    filename: path.join(__dirname, 'generate.ts'),
    envName: 'production',
    comments: false,
  });
  assert.ok(transformed?.code);
  new Function('module', 'exports', 'require', '__dirname', 'process', transformed.code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (name === 'fs') return fakeFs;
      if (name === 'child_process') return { execSync: () => Buffer.from('fixture-version\n') };
      if (name === 'moment') return () => ({ format: () => '2026/10/11 04:00:00' });
      if (name === './utils.ts')
        return {
          htmlTemplatesPath: templatePath,
          getEntryName: () => scenario.name || 'fixture-entry',
          getEntryFromHtml: () => ({ type, src: 'fixture', origin: 'webpack[index]?fixture' }),
        };
      if (name === './publishConfig.ts') return { apiServer: '/wwwapi/', webpackPublicPath: '/dist/pack/' };
      return require(name);
    },
    __dirname,
    { env: { NODE_ENV: 'production' } },
  );
  if (typeof module.exports !== 'function') throw new TypeError('Missing actual generate function');
  await Reflect.apply(module.exports, undefined, []);
  const html = outputs.get(path.join(root, 'build/files/fixture.html'));
  assert.ok(html);
  return { html, manifestReads };
}
function paths(html: string): { scripts: string[]; styles: string[] } {
  const $ = cheerio.load(html);
  return {
    scripts: $('script[src]')
      .map((_, node) => $(node).attr('src'))
      .get()
      .filter(value => value.startsWith('/dist/')),
    styles: $('link[rel="stylesheet"]')
      .map((_, node) => $(node).attr('href'))
      .get(),
  };
}
const commonNames = ['runtime', 'node_modules', 'cookies', 'vendors', 'worksheet', 'common', 'globals'];
const named: Record<string, unknown> = Object.fromEntries(commonNames.map(name => [name, { js: name + '.js' }]));
named['css'] = { css: 'base.css', js: { unused: true } };
named['fixture-entry'] = { js: 'fixture.js', css: 'fixture.css' };
// AssetsPlugin puts unnamed asynchronous chunks/assets under an empty key.
const aggregate = { js: ['async-a.js', 'async-b.js'], css: ['async-a.css'], png: ['image.png'] };
async function main(): Promise<void> {
  const cases: Scenario[] = [];
  for (const type of ['index', 'single', 'singleExtractModules']) {
    const scenario = { type, manifest: { ...named, '': aggregate, unused: { js: 42, css: null } } };
    const result = await generate(scenario);
    const prefix = type === 'index' ? '/dist/pack/' : '/dist/' + type + '/pack/';
    const entries = type === 'single' ? ['runtime', 'cookies', 'vendors', 'globals'] : commonNames;
    assert.deepEqual(paths(result.html), {
      scripts: [...entries.map(name => prefix + name + '.js'), prefix + 'fixture.js'],
      styles: [prefix + 'base.css', prefix + 'fixture.css'],
    });
    assert.doesNotMatch(result.html, /async-a|async-b|image\.png/);
    assert.deepEqual(result.manifestReads, [
      path.join(root, 'build/dist', type === 'index' ? '' : type, 'manifest.json'),
    ]);
    cases.push(scenario);
  }
  const excluded: Scenario = {
    name: 'auth-feishu-fixture',
    manifest: { ...named, 'auth-feishu-fixture': { js: 'auth.js', css: 42 }, '': aggregate, css: null },
  };
  assert.deepEqual(paths((await generate(excluded)).html), {
    scripts: ['/dist/pack/runtime.js', '/dist/pack/cookies.js', '/dist/pack/auth.js'],
    styles: [],
  });
  cases.push(excluded);
  const missing: Scenario = { manifest: { runtime: { js: 'runtime.js' }, 'fixture-entry': {}, '': aggregate } };
  assert.deepEqual(paths((await generate(missing)).html), { scripts: ['/dist/pack/runtime.js'], styles: [] });
  cases.push(missing);
  for (const invalid of [
    null,
    [],
    { runtime: null },
    { runtime: { js: 42 } },
    { runtime: { js: ['one.js'] } },
    { css: { css: 42 } },
    { 'fixture-entry': { css: ['one.css'] } },
  ])
    await assert.rejects(
      generate({ manifest: invalid }),
      /Invalid (webpack manifest|manifest entry|manifest js|manifest css)/,
    );
  if (originalSource) {
    const before = fs.readFileSync(originalSource, 'utf8');
    for (const scenario of cases)
      assert.equal((await generate(scenario, before)).html, (await generate(scenario)).html);
  }
  console.log(
    `Actual production HTML generation passed: ${cases.length} layouts, aggregate arrays, unused fields, missing entries and 7 invalid consumed payloads${originalSource ? ', historical HTML byte comparison' : ''}`,
  );
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
