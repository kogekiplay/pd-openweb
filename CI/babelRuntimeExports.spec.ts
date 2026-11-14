const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const os: typeof import('node:os') = require('node:os');
const path: typeof import('node:path') = require('node:path');
const webpack: typeof import('webpack') = require('webpack');

async function main() {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const config = require('./webpack.config.ts')();
  if (previous === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previous;
  const root = path.resolve(__dirname, '..');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'babel-runtime-exports-'));
  const helpers = ['classCallCheck', 'createClass', 'defineProperty', 'slicedToArray'];
  const runtime = require('@babel/runtime/package.json');
  for (const helper of helpers) {
    assert.ok(runtime.exports[`./helpers/${helper}`].import, `Missing public export: ${helper}`);
    assert.equal(runtime.exports[`./helpers/esm/${helper}`], undefined);
  }
  const entry = path.join(root, 'node_modules/@rc-component/input-number/es/index.js');
  const compile = (legacy: boolean): Promise<import('webpack').Stats> =>
    new Promise((resolve, reject) => {
      const alias = { ...config.resolve.alias };
      if (legacy) delete alias['@babel/runtime/helpers/esm/*'];
      const compiler = webpack({
        mode: 'production',
        target: 'web',
        context: root,
        entry,
        resolve: { ...config.resolve, alias },
        output: { path: temporary, filename: legacy ? 'before.js' : 'after.js' },
        optimization: { minimize: false },
        cache: false,
      });
      compiler.run((error, stats) =>
        compiler.close(closeError => {
          if (error || closeError || !stats) reject(error || closeError || new Error('No webpack stats'));
          else resolve(stats);
        }),
      );
    });
  try {
    const before = await compile(true);
    assert.ok(before.hasErrors(), 'Original production resolver must fail on the real vendor chain');
    const errors = before.toJson({ all: false, errors: true }).errors || [];
    for (const helper of helpers) {
      assert.ok(
        errors.some(error => error.message.includes(`helpers/esm/${helper}`)),
        helper,
      );
    }
    const after = await compile(false);
    assert.equal(after.hasErrors(), false, after.toString({ all: false, errors: true }));
    const modules = [...after.compilation.modules].map(module => module.identifier());
    assert.ok(
      modules.some(name => /input-number.*mini-decimal/.test(name)),
      'Nested consumer must be compiled',
    );
    for (const helper of helpers) {
      assert.ok(
        modules.some(name => name.endsWith(`/@babel/runtime/helpers/esm/${helper}.js`)),
        helper,
      );
    }
    console.log('babel runtime production exports: original fails all four helpers; normalized vendor chain compiles');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
