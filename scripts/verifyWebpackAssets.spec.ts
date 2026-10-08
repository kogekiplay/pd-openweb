const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseJsFilenameMaps, parseCssFilenameMap, verifyRuntime } = require('./verifyWebpackAssets.ts');

// These two shapes are emitted by the main and extracted single-page builds.
const named = 'r.u=e=>e===3?"shared.entry.js":({1:"calendar"}[e]||e)+"."+{1:"abc",2:"def"}[e]+".chunk.js";';
const numeric = 'r.u=e=>e+"."+{1:"abc",2:"def"}[e]+".chunk.js";';
assert.deepEqual(
  [...parseJsFilenameMaps(named)[0]],
  [
    ['3', 'shared.entry.js'],
    ['1', 'calendar.abc.chunk.js'],
    ['2', '2.def.chunk.js'],
  ],
);
assert.deepEqual(
  [...parseJsFilenameMaps(numeric)[0]],
  [
    ['1', '1.abc.chunk.js'],
    ['2', '2.def.chunk.js'],
  ],
);
for (const code of ['r.miniCssF=e=>({1:"style"})[e]+".css";', 'r.miniCssF=e=>""+{1:"style"}[e]+".css";']) {
  assert.deepEqual([...parseCssFilenameMap(code)[0]], [['1', 'style.css']]);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hap-webpack-assets-spec-'));
try {
  const runtime = path.join(dir, 'runtime.entry.js');
  fs.writeFileSync(runtime, numeric + 'r.miniCssF=e=>({1:"style"})[e]+".css";r.f.miniCss=(e,t)=>{var a={1:1};};');
  for (const file of ['1.abc.chunk.js', '2.def.chunk.js', 'style.css']) fs.writeFileSync(path.join(dir, file), '');
  assert.equal(verifyRuntime(runtime).missingMappings.length, 0);
  assert.equal(verifyRuntime(runtime).missingJsFiles.length, 0);
  assert.equal(verifyRuntime(runtime).missingCssFiles.length, 0);
  fs.unlinkSync(path.join(dir, '2.def.chunk.js'));
  fs.unlinkSync(path.join(dir, 'style.css'));
  assert.match(verifyRuntime(runtime).missingJsFiles[0], /2\.def\.chunk\.js/);
  assert.match(verifyRuntime(runtime).missingCssFiles[0], /style\.css/);
  fs.writeFileSync(runtime, 'r.u=e=>unknownMap[e];');
  assert.match(verifyRuntime(runtime).missingMappings[0], /could not parse/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('Runtime asset validation detects missing JS/CSS and unsupported loader maps.');
