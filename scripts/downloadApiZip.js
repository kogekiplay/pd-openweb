const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT_PATH, print, runCommand } = require('./utils');

const API_ZIP_TARGETS = {
  report: {
    url: process.env.REPORT_API_DOC_URL || 'http://118.24.27.163:28086/v/api-docs?group=report',
    outputDir: path.join(ROOT_PATH, 'src/pages/Statistics/api'),
  },
  workflow: {
    url: process.env.WORKFLOW_API_DOC_URL || 'http://118.24.27.163:28085/v/api-docs?group=workflow%20all',
    outputDir: path.join(ROOT_PATH, 'src/pages/workflow/apiV2'),
  },
};

// 这些目录已全量迁到 .ts，但远端仍然只吐 .js，且 unzip -o 只覆盖不清理。
// 不做后处理的话，同名 .js 与 .ts 会【并存】：webpack 的 resolve.extensions 让 .ts 优先，
// 于是新拉下来的接口被陈旧 .ts 静默遮蔽——构建绿、tsc 绿、只有 git status 里多出未跟踪 .js。
// 因此把刚解出来的每个 .js 就地转正成 .ts（先删掉被它取代的旧 .ts）。
function adoptExtractedJsAsTs(outputDir) {
  const adopted = [];
  for (const name of fs.readdirSync(outputDir)) {
    if (!name.endsWith('.js')) continue;
    const jsPath = path.join(outputDir, name);
    if (!fs.statSync(jsPath).isFile()) continue;
    const tsPath = path.join(outputDir, `${name.slice(0, -3)}.ts`);
    fs.rmSync(tsPath, { force: true });
    fs.renameSync(jsPath, tsPath);
    adopted.push(name);
  }
  if (adopted.length) {
    print.info(`已将 ${adopted.length} 个解压出的 .js 就地转为 .ts: ${adopted.join(', ')}`);
  }
}

async function main() {
  const targetName = process.argv[2];
  const target = API_ZIP_TARGETS[targetName];

  if (!target) {
    throw new Error(`未知 API 生成目标: ${targetName || ''}, 可用目标: ${Object.keys(API_ZIP_TARGETS).join(', ')}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `md-api-${targetName}-`));
  const zipPath = path.join(tempDir, 'api.zip');

  try {
    fs.mkdirSync(target.outputDir, { recursive: true });
    print.info(`拉取 ${target.url}`);
    await runCommand('curl', ['-fL', target.url, '-o', zipPath]);
    print.info(`解压到 ${target.outputDir}`);
    await runCommand('unzip', ['-o', zipPath, '-d', target.outputDir]);
    adoptExtractedJsAsTs(target.outputDir);
    print.success(`${targetName} api 生成完成`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch(err => {
    print.danger(err.stack || err.message);
    process.exit(1);
  });
}

module.exports = main;
