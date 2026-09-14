/**
 * 列出所有【直接从 antd 引入】的 DatePicker / TimePicker 调用点，
 * 并打印它们 value / defaultValue / defaultPickerValue 的源码文本（只读，不改文件）。
 *
 * 为什么要看这个：antd 5 起 picker 的底层是 dayjs，传 moment 对象进去
 * 日历会算错（moment 的 add/startOf 原地改并返回自身，dayjs 返回新实例，
 * rc-picker 逐格 addDate 时基准被反复推进 —— 详见 ming-ui/components/mdAntPickers.ts）。
 * 所以要按调用点【实际传什么】来决定换不换成 moment 版 picker，
 * 不能只看文件里 import 了 moment 还是 dayjs：有 6 个文件两个都 import 了。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const PICKERS = new Set(['DatePicker', 'TimePicker']);
const VALUE_ATTRS = new Set(['value', 'defaultValue', 'defaultPickerValue', 'disabledDate', 'onChange', 'onOk']);

const PARSE_OPTS = {
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'library') continue;
      walk(p, out);
    } else if (/\.(jsx|tsx)$/.test(e.name) && !/\.spec\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file);
  if (rel.includes('ming-ui/components/MdAnt') || rel.includes('mdAntPickers')) continue;

  const src = fs.readFileSync(file, 'utf8');
  if (!/from 'antd'/.test(src)) continue;

  let ast;
  try {
    ast = parser.parse(src, PARSE_OPTS);
  } catch {
    continue;
  }

  // 本文件从 antd 引入了哪些 picker，以及它们的本地名
  const localNames = new Set();
  traverse(ast, {
    ImportDeclaration(p) {
      if (p.node.source.value !== 'antd') return;
      for (const s of p.node.specifiers) {
        if (s.type === 'ImportSpecifier' && PICKERS.has(s.imported.name)) localNames.add(s.local.name);
      }
    },
  });
  if (!localNames.size) continue;

  // 解构出来的 RangePicker：const { RangePicker } = DatePicker;
  traverse(ast, {
    VariableDeclarator(p) {
      const { id, init } = p.node;
      if (id.type !== 'ObjectPattern' || !init || init.type !== 'Identifier' || !localNames.has(init.name)) return;
      for (const prop of id.properties) {
        if (prop.type === 'ObjectProperty' && prop.value.type === 'Identifier') localNames.add(prop.value.name);
      }
    },
  });

  const hits = [];
  traverse(ast, {
    JSXElement(p) {
      const n = p.node.openingElement.name;
      const name =
        n.type === 'JSXIdentifier'
          ? n.name
          : n.type === 'JSXMemberExpression' && n.object.type === 'JSXIdentifier'
            ? n.object.name
            : null;
      if (!name || !localNames.has(name)) return;

      const attrs = [];
      for (const a of p.node.openingElement.attributes) {
        if (a.type !== 'JSXAttribute' || !VALUE_ATTRS.has(a.name.name)) continue;
        const v = a.value;
        const text =
          v && v.type === 'JSXExpressionContainer' ? src.slice(v.expression.start, v.expression.end) : String(v?.value);
        attrs.push(`${a.name.name}=${text.replace(/\s+/g, ' ').slice(0, 88)}`);
      }
      hits.push({ line: p.node.loc.start.line, attrs });
    },
  });

  if (!hits.length) continue;

  const usesMoment = /\bmoment\(/.test(src);
  const usesDayjs = /\bdayjs\(/.test(src);
  console.log(`\n${rel}   [${usesMoment ? 'moment' : ''}${usesMoment && usesDayjs ? '+' : ''}${usesDayjs ? 'dayjs' : ''}]`);
  for (const h of hits) {
    console.log(`  :${h.line}`);
    h.attrs.forEach(a => console.log(`     ${a}`));
    if (!h.attrs.length) console.log('     （无 value/defaultValue 等时间类 prop）');
  }
}
