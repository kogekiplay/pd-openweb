/**
 * 列表里的 JSX 必须有 key —— 零容忍，没有基线。
 *
 * 2026-09-23 全仓清掉了 579 处（367 个文件，tools/codemod-jsx-key.ts 批量补下标 + 5 处人工）。
 * 那之前用户在 dev 环境一路点、一路撞到 Linkify / Steps / PortalList 这些「Each child in a list
 * should have a unique key」，一条条报过来 —— 这类问题能静态扫全，就不该靠人肉点出来。
 *
 * 【解析器与仓库 eslint.config.ts 一致】@babel/eslint-parser 读项目 .babelrc。
 * 不用 @typescript-eslint/parser：本仓 preset-react 给所有文件开 JSX，
 * 按 tsc 的扩展名规则解析会和真实构建看到的语法不一致。
 *
 * 用法：bun run check:jsx-key（约 15 秒）
 */
const { ESLint } = require('eslint');
const react = require('eslint-plugin-react');
const babelParser = require('@babel/eslint-parser');

interface LintMessage {
  ruleId: string | null;
  line: number;
  column: number;
  message: string;
  fatal?: boolean;
}

interface LintResult {
  filePath: string;
  messages: LintMessage[];
}

async function main() {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
          parser: babelParser,
          parserOptions: { requireConfigFile: true, ecmaFeatures: { jsx: true } },
        },
        plugins: { react },
        rules: { 'react/jsx-key': ['error', { checkFragmentShorthand: true, warnOnDuplicates: true }] },
      },
    ],
  });

  const started = Date.now();
  const results: LintResult[] = await eslint.lintFiles(['src/**/*.tsx', 'src/**/*.ts']);
  const hits: string[] = [];
  let fatal = 0;
  for (const r of results) {
    if (r.filePath.includes('/src/library/')) continue;
    for (const m of r.messages) {
      const loc = `${r.filePath.replace(process.cwd() + '/', '')}:${m.line}:${m.column}`;
      if (m.ruleId === 'react/jsx-key') hits.push(`${loc}  ${m.message}`);
      else if (m.fatal) fatal++;
    }
  }

  // 安全网：一个文件都没扫到 / 大面积解析失败，说明扫描本身坏了，不能读成「全仓干净」
  if (results.length < 1000 || fatal > 20) {
    console.error(`拒绝执行：只扫到 ${results.length} 个文件、解析失败 ${fatal} 个 —— 扫描大概率没跑起来。`);
    process.exit(2);
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (!hits.length) {
    console.log(`jsx-key 检查通过：${results.length} 个文件，0 处缺 key / 撞 key（${secs}s）`);
    process.exit(0);
  }
  console.error(`jsx-key 检查失败：${hits.length} 处\n`);
  hits.slice(0, 40).forEach(h => console.error(`  ${h}`));
  if (hits.length > 40) console.error(`  …其余 ${hits.length - 40} 处略`);
  console.error(
    '\n列表里渲染的元素要给 key。纯展示的静态列表用下标即可（与不写 key 时 React 的行为逐位等价）；' +
      '会重排 / 插删的有状态列表用稳定 id。注意 concat / 展开合并进同一个数组时，各段的 key 不能撞。',
  );
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
