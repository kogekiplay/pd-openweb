/**
 * 把【传 moment 值】的 antd DatePicker / TimePicker 调用点改指到 moment 版 picker（一次性工具）
 *
 * 背景见 src/ming-ui/components/mdAntPickers.ts：antd 5 起 picker 底层是 dayjs，
 * 传 moment 对象进去日历会算错（第一行出现 1 2 4 7 11 16 22 这种三角数，面板月份飘走），
 * 而且【只有传了值才错】，没选值时看着完全正常。
 *
 * 文件清单是【逐个核对过实际传值】后写死的，不做全量扫描替换 ——
 * 同一批文件里有 8 个已经在用 dayjs（传 dayjs 给 dayjs picker，本来就是对的），
 * 换过去反而会把它们弄坏。核对方法见 tools/scan-antd-picker-values.ts。
 *
 * ⚠ 那个扫描工具有个盲区，这里两条是人工补的：
 * EnterpriseForm 和 CustomDatePicker 用的是 styled(RangePicker) 包装后的组件，
 * JSX 里的标签名不是 RangePicker，AST 按标签名找不到。
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');
const TARGET = 'src/ming-ui/components/mdAntPickers';
const PICKERS = new Set(['DatePicker', 'TimePicker']);

// 逐个核对过：这些调用点确实把 moment 对象交给了 picker
const FILES = [
  'src/components/DateFilter/index.tsx',
  'src/pages/Role/PortalCon/setting/BaseSet/LoginSet.tsx',
  'src/pages/Statistics/components/ChartAnalyse/components/DataContrast.tsx',
  'src/pages/Statistics/components/DataSource/components/TimeModal.tsx',
  'src/pages/Statistics/components/FilterScope/index.tsx',
  'src/pages/worksheet/common/Sheet/QuickFilter/Inputs/Time.tsx',
  'src/pages/worksheet/common/WorkSheetFilter/components/contents/Time.tsx',
  'src/pages/certification/components/EnterpriseForm/index.tsx',
  'src/pages/chat/components/MyStatus/CustomDatePicker.tsx',
];

const PARSE_OPTS = {
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
};

let changed = 0;
const problems = [];

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(src, PARSE_OPTS);

  let antdNode = null;
  const moved = []; // { imported, local }

  traverse(ast, {
    ImportDeclaration(p) {
      if (p.node.source.value !== 'antd') return;
      antdNode = p.node;
      for (const s of p.node.specifiers) {
        if (s.type === 'ImportSpecifier' && PICKERS.has(s.imported.name)) {
          moved.push({ imported: s.imported.name, local: s.local.name });
        }
      }
    },
  });

  if (!antdNode || !moved.length) {
    problems.push(`${rel} —— 没找到从 antd 引入的 picker，跳过`);
    continue;
  }

  const keep = antdNode.specifiers.filter(
    s => !(s.type === 'ImportSpecifier' && PICKERS.has(s.imported.name)),
  );

  // 重建（或删除）原来的 antd import 语句
  const antdText = src.slice(antdNode.start, antdNode.end);
  const keepText = keep.length
    ? `import { ${keep
        .map(s => (s.imported && s.imported.name !== s.local.name ? `${s.imported.name} as ${s.local.name}` : s.local.name))
        .join(', ')} } from 'antd';`
    : null;

  const newImport = `import { ${moved
    .map(m => (m.imported !== m.local ? `${m.imported} as ${m.local}` : m.local))
    .join(', ')} } from '${TARGET}';`;

  let out = src;

  if (keepText) {
    out = out.replace(antdText, keepText);
  } else {
    // 整条删掉，连同行尾换行
    out = out.replace(antdText + '\n', '');
  }

  // 插在【第一条】import 之前：多行 import 的首行也匹配 /^\s*import/，
  // 按"最后一条 import + 1"插会把语句从中间劈开。顺序交给 prettier 的 sort-imports。
  const lines = out.split('\n');
  const first = lines.findIndex(l => /^\s*import\b/.test(l));

  if (first === -1) {
    problems.push(`${rel} —— 找不到 import 语句，未插入`);
    continue;
  }

  lines.splice(first, 0, newImport);
  fs.writeFileSync(file, lines.join('\n'));
  changed++;
  console.log(`  ${rel}  →  ${moved.map(m => m.local).join(', ')}`);
}

console.log(`\n改写 ${changed}/${FILES.length} 个文件`);
if (problems.length) {
  console.log('\n⚠ 需人工处理：');
  problems.forEach(p => console.log('  ' + p));
}
