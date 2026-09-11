/**
 * 禁止用默认导入 / 命名空间导入的方式引 antd。
 *
 * 起因是一次真实线上故障：src/pages/chat/components/Inbox/components/inboxHeader.tsx
 * 里写的是
 *     import antd from 'antd';
 *     ... <antd.Dropdown />
 * antd 4 的产物下这么写能跑（CJS + 合成默认导入，拿到的是整个模块命名空间）。
 * 升到 antd 5 之后 ESM 产物【没有默认导出】，antd 就是 undefined，
 * 于是渲染时抛「Cannot read properties of undefined (reading 'Dropdown')」，
 * 把整个 chat 组件树炸掉 —— 线上表现是右侧那排图标（消息/搜索/工作流…）全部点不开，
 * 页面其余部分看着完全正常，只有控制台里有错。
 *
 * 【为什么类型门禁拦不住】tsconfig 允许合成默认导入，TS 会把 `antd` 当成模块命名空间，
 * `antd.Dropdown` 类型上完全合法。也就是说这一类错误 tsc 结构上就看不见，
 * 必须单独立一条源码级规则。
 *
 * 正确写法一律是具名导入：
 *     import { Dropdown } from 'antd';
 * 与本仓已有的同名组件冲突时起别名（如 `Dropdown as AntdDropdown`）。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../../scripts/spec-harness');

const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP_DIR = /(^|\/)(node_modules|library)(\/|$)/;

function collect(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(abs)) collect(abs, out);
    } else if (EXTS.has(path.extname(entry.name)) && !entry.name.endsWith('.spec.js')) {
      out.push(abs);
    }
  }

  return out;
}

// import antd from 'antd'  /  import * as antd from 'antd'  /  const antd = require('antd')
const BAD = [
  /^\s*import\s+[A-Za-z_$][\w$]*\s*(,\s*\{[^}]*\})?\s*from\s*['"]antd['"]/m,
  /^\s*import\s+\*\s+as\s+[A-Za-z_$][\w$]*\s*from\s*['"]antd['"]/m,
  /=\s*require\(\s*['"]antd['"]\s*\)/,
];

const violations = [];
let scanned = 0;

for (const file of collect(path.join(ROOT, 'src'), [])) {
  const source = fs.readFileSync(file, 'utf8');

  if (!source.includes("'antd'") && !source.includes('"antd"')) continue;

  scanned++;

  for (const re of BAD) {
    const m = source.match(re);

    if (m) {
      const line = source.slice(0, m.index).split('\n').length;
      violations.push(`${path.relative(ROOT, file)}:${line}  ${m[0].trim()}`);
      break;
    }
  }
}

// 下限断言：一个引 antd 的文件都没扫到，说明扫描坏了而不是「全仓都合规」
assert.ok(scanned > 100, `只扫到 ${scanned} 个引用 antd 的文件，扫描逻辑大概率坏了`);

assert.deepStrictEqual(
  violations,
  [],
  'antd 只能具名导入。默认/命名空间导入在 antd 5 的 ESM 产物下会拿到 undefined，' +
    '运行时才炸且 tsc 看不见（见本文件头的线上故障记录）：\n  ' +
    violations.join('\n  '),
);

console.log(`antd import style tests passed（扫描 ${scanned} 个引用 antd 的文件）`);
