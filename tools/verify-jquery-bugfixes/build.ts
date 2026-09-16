/**
 * 打包验证页。用仓里已有的 esbuild，不引入新依赖。
 * 说明见 entry.ts 的文件头。
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const dir = __dirname;
const dist = path.join(dir, 'dist');
fs.mkdirSync(dist, { recursive: true });

const HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>jQuery 三处 bug 修复实测</title>
<style>
  body { font: 14px/1.6 -apple-system, "PingFang SC", sans-serif; margin: 24px; color: #222; background: #fff; }
  .ver { color: #757575; font-size: 12px; margin-bottom: 8px; }
  .banner { padding: 10px 14px; border-radius: 6px; font-weight: 600; margin-bottom: 20px; }
  .ok.banner { background: #e8f5e9; color: #1b5e20; }
  .bad.banner { background: #ffebee; color: #b71c1c; }
  .case { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 18px; }
  h2 { font-size: 15px; margin: 0 0 4px; }
  h2 .ok { color: #1b5e20; font-size: 12px; background: #e8f5e9; padding: 2px 8px; border-radius: 10px; margin-left: 6px; }
  h2 .bad { color: #b71c1c; font-size: 12px; background: #ffebee; padding: 2px 8px; border-radius: 10px; margin-left: 6px; }
  .where { color: #757575; font-size: 12px; font-family: ui-monospace, Menlo, monospace; margin-bottom: 10px; }
  table.cmp { border-collapse: collapse; width: 100%; margin-bottom: 10px; }
  table.cmp th { text-align: left; width: 80px; vertical-align: top; padding: 4px 8px 4px 0; color: #555; font-weight: 500; }
  table.cmp td { padding: 4px 0; }
  .val { font-family: ui-monospace, Menlo, monospace; }
  /* 夹具本身不用好看，但要能看出结构 */
  .fx { border: 1px dashed #ccc; padding: 8px; border-radius: 6px; background: #fcfcfc; font-size: 12px; color: #666; }
  .fx .listStageTaskContent { border: 1px solid #ddd; padding: 2px 6px; margin: 2px 0; }
  /* 第 1 例的可视对比 */
  .visual { display: flex; gap: 24px; margin-top: 14px; }
  .vcol { flex: 1; }
  .vlabel { font-size: 12px; color: #555; margin-bottom: 4px; }
  .vhead { height: 36px; background: #f0f0f0; border: 1px solid #ddd; }
  .vbody { height: 204px; background: #fafafa; border: 1px solid #ddd; border-top: none; }
  .vline { position: absolute; left: 40px; top: 0; width: 3px; background: #2196f3; z-index: 2; }
  .vnote { font-size: 12px; color: #757575; margin-top: 6px; }
</style>
</head>
<body><div id="app"></div><script src="./bundle.js"></script></body>
</html>`;

fs.writeFileSync(path.join(dist, 'index.html'), HTML);

esbuild
  .build({
    entryPoints: [path.join(dir, 'entry.ts')],
    bundle: true,
    outfile: path.join(dist, 'bundle.js'),
    format: 'iife',
    target: 'es2020',
    logLevel: 'info',
  })
  .then(() => console.log('验证页已构建：tools/verify-jquery-bugfixes/dist/'));
