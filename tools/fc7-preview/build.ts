/**
 * 打包预览页。用仓里已有的 esbuild，不引入新依赖。
 * 见 entry.tsx 的文件头说明为什么需要这个预览。
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const less = require('less');
const dir = __dirname;
const ROOT = path.join(dir, '../..');

// 把老「日程」页那份定制 LESS 编译进来，这样预览看到的就是【真实效果】，
// 不是只有 v7 的默认主题。变量在本仓的设计系统里，这里补一份最小的定义。
const TOKENS = `
:root{
  --color-border-primary:#e0e0e0; --color-border-secondary:#eaeaea;
  --color-background-primary:#fff; --color-text-primary:#333;
  --color-text-secondary:#757575; --color-error-bg:#fff4f4;
  --color-cyan-blue:#2196f3; --color-cyan-dark:#1565c0; --color-white:#fff;
}`;

async function buildLess() {
  const src = fs.readFileSync(path.join(ROOT, 'src/pages/calendar/modules/calendarControl/css/fullcalendar.less'), 'utf8');
  const out = await less.render(src, { filename: 'fullcalendar.less' });
  fs.writeFileSync(path.join(dir, 'dist/app.css'), TOKENS + '\n' + out.css);
  console.log('日程页定制样式已编译：dist/app.css');
}

buildLess().then(() =>
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
  .catch(() => process.exit(1)),
);
