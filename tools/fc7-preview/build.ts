/**
 * 打包预览页。用仓里已有的 esbuild，不引入新依赖。
 * 见 entry.tsx 的文件头说明为什么需要这个预览。
 */
const esbuild = require('esbuild');
const path = require('path');
const dir = __dirname;

esbuild
  .build({
    entryPoints: [path.join(dir, 'entry.tsx')],
    bundle: true,
    outfile: path.join(dir, 'dist/bundle.js'),
    loader: { '.css': 'css', '.tsx': 'tsx', '.ts': 'ts' },
    jsx: 'automatic',
    format: 'iife',
    target: 'es2020',
    logLevel: 'info',
  })
  .then(() => console.log('预览已打包：tools/fc7-preview/dist/index.html'))
  .catch(() => process.exit(1));
