const assert = require('node:assert/strict');
const path = require('node:path');
const { ESLint } = require('eslint');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  // 走仓库真实配置，但移除排版与 hooks 告警，让断言只关注作用域分析。
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfig: { rules: { 'prettier/prettier': 'off', 'padding-line-between-statements': 'off' } },
  });
  const lint = async (source: string, extension: string) => {
    const [result] = await eslint.lintText(source, { filePath: `src/eslint-scope-fixture.${extension}` });
    assert.equal(result.fatalErrorCount, 0);
    return result.messages;
  };

  const typed = await lint(
    `import type { Model } from './model';
     export function useModel(value: Model): HapApi.MD.Entity.Worksheet.PrintListModel[] {
       return value.items;
     }`,
    'tsx',
  );
  assert.deepEqual(typed, [], '类型参数、声明文件中的命名空间与已使用的 type-only import 不应报错');

  const unused = await lint(
    `import type { Model, UnusedModel } from './model';
     export function useModel(value: Model) { return value; }
     const unusedValue = 1;`,
    'ts',
  );
  assert.equal(unused.length, 2);
  assert.ok(unused.every(message => message.ruleId === '@typescript-eslint/no-unused-vars'));
  assert.ok(unused.some(message => message.message.includes('UnusedModel')));
  assert.ok(unused.some(message => message.message.includes('unusedValue')));

  const rest = await lint('const { omitted, ...rest } = { omitted: 1, value: 2 }; export { rest };', 'ts');
  assert.deepEqual(rest, [], 'ignoreRestSiblings 仍允许故意剥离的属性');

  const overloads = await lint(
    `export function identity(value: string): string;
     export function identity(value: number): number;
     export function identity(value: string | number) { return value; }`,
    'ts',
  );
  assert.deepEqual(overloads, [], '函数重载不是重复声明');
  const redeclared = await lint('var value = 1; var value = 2; export { value };', 'ts');
  assert.ok(redeclared.some(message => message.ruleId === '@typescript-eslint/no-redeclare'));

  const js = await lint('export const value = missingRuntimeValue;', 'js');
  assert.ok(js.some(message => message.ruleId === 'no-undef' && message.message.includes('missingRuntimeValue')));

  const jsUnused = await lint('const unusedValue = 1;', 'jsx');
  assert.ok(jsUnused.some(message => message.ruleId === 'no-unused-vars'));

  const tsConfig = await eslint.calculateConfigForFile('src/eslint-scope-fixture.tsx');
  const jsConfig = await eslint.calculateConfigForFile('src/eslint-scope-fixture.js');
  assert.equal(tsConfig.languageOptions.parser.meta.name, 'typescript-eslint/parser');
  assert.equal(tsConfig.rules['no-undef'][0], 0);
  assert.equal(jsConfig.rules['no-undef'][0], 2);

  // TS 6 的 API 只供 ESLint 使用，所有类型门禁仍依赖原生 TS 7。
  assert.match(require('@typescript/native/package.json').version, /^7\./);
  assert.equal(typeof require('typescript').createSourceFile, 'function');
  assert.equal(typeof require('@typescript/native/unstable/sync').API, 'function');
  console.log('ESLint 的 TS 类型作用域、真实未使用变量、JS 未定义变量与双编译器配置全部通过。');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
