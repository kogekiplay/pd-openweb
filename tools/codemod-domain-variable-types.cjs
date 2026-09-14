/**
 * 给「名字已经说明了内容」的变量标领域类型
 *
 * 剩下的 TS7006 有 8800 多条是 `xxx.map(o => ...)` / `.filter` / `.forEach` / `.find`
 * 的回调参数 —— 根因不在回调，在【接收者是 any】。给接收者标一次类型，它身上所有
 * 回调的参数 TS 自己就推出来了，比一个个标回调划算得多，也更真：类型写在数据源上，
 * 而不是写在每个使用点上。
 *
 * 证据和 codemod-domain-callback-params.cjs 同一条：本仓 controls / rows 这类名字
 * 语义单一。那张表已经过差分闸门验证。这里只多一条约束 ——
 * 【只动 TS 推成 any 的变量】。TS 已经知道它是 string[] 的，说明名字骗了人，不碰。
 *
 * 【不动】：
 *   - 有类型标注的
 *   - 解构出来的（单个绑定元素标不了类型）
 *   - 不在 src/*.ts(x) 下的（allowJs 把 .js 也拉进 program 了）
 *   - 推断结果不是 any / any[] 的
 *
 * 用法：
 *   node tools/codemod-domain-variable-types.cjs --list
 *   node tools/codemod-domain-variable-types.cjs
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src') + path.sep;
const APPLY = !process.argv.includes('--list');

/**
 * 这些目录/文件里叫 controls 的东西【不是】表单控件，是别的模块自己的字段描述符
 * （字段名对不上：mdType / isPk / isCheck / 直接是字符串）。都是被差分闸门挡出来的。
 */
const EXCLUDE = [
  'src/pages/AppSettings/components/Aggregation/', // 聚合表的字段描述符，用 mdType 不是 type
  'src/pages/integration/', // 数据集成的字段描述符，带 isPk / isCheck
  'src/pages/customPage/components/editWidget/filter/FilterControl.tsx', // 这里的 controls 是字符串
  'src/pages/FormExtend/PublicWorksheetConfig/PublicConfig/WeChatSettings.tsx',
  'src/pages/Mobile/RecordList/redux/actions.ts',
  'src/pages/task/components/printTask/printTask.tsx', // controls 是 Dictionary<any[]>（按分组聚好的）
  'src/pages/widgetConfig/widgetDisplay/displayTypes/section.tsx', // controls 是嵌套数组
  'src/pages/worksheet/common/ViewConfig/components/Controls.tsx', // controls 装的是 controlId 字符串
  'src/pages/worksheet/common/WorksheetBody/ImportDataFromExcel/', // Excel 列描述符，有 text/value
  'src/pages/worksheet/components/ImportFileToChildTable/ImportData.tsx', // rows 是字符串
  'src/pages/worksheet/components/RelateRecordTable/TableComp.tsx',
  'src/pages/workflow/WorkflowSettings/Detail/components/SingleControlValue/index.tsx',
  'src/pages/workflow/WorkflowSettings/Detail/Start/PBCContent.tsx', // PBC 入参，带 jsonPath
  'src/pages/Print/components/Content/index.tsx',
  'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/components/SelectFields.tsx',
];

const DOMAIN = new Map([
  ...[
    'controls',
    'allControls',
    'originControls',
    'relationControls',
    'templateControls',
    'formControls',
    'receiveControls',
    'controlList',
    'newControls',
    'visibleControls',
    'subControls',
    'childTableControls',
    'availableControls',
    'currentControls',
    'sourceControls',
    'worksheetControls',
    // 'filterControls' 【不能收】：columnRules/config.ts 里同名变量装的是控件类型码
    // （filterControls.push(31, 38, 37, ...)），另有几处它是 `FormControl[] | false`
    // 的哨兵（customEvent 里 `filterControls === false ? [] : filterControls`）。
    // 一个名字两种含义，不满足「语义单一」。
  ].map(n => [n, 'FormControl[]']),
  ...['rows', 'originRows', 'newRows', 'records', 'selectedRows', 'realRows', 'rootRows', 'existingRows'].map(n => [
    n,
    'RecordRow[]',
  ]),
]);

const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(cfg.fileNames, { ...cfg.options, noEmit: true });
const checker = program.getTypeChecker();

const byFile = new Map();
let skippedTyped = 0;

for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(SRC) || !/\.tsx?$/.test(sf.fileName)) continue;
  const rel = path.relative(ROOT, sf.fileName);
  if (EXCLUDE.some(e => rel.startsWith(e))) continue;
  (function visit(n) {
    if (ts.isVariableDeclaration(n) && !n.type && ts.isIdentifier(n.name) && DOMAIN.has(n.name.text)) {
      const t = checker.typeToString(checker.getTypeAtLocation(n.name));
      if (t === 'any' || t === 'any[]') {
        const file = sf.fileName;
        if (!byFile.has(file)) byFile.set(file, { text: sf.getFullText(), ins: [] });
        byFile.get(file).ins.push({ pos: n.name.end, type: DOMAIN.get(n.name.text), name: n.name.text });
      } else {
        skippedTyped += 1;
      }
    }
    n.forEachChild(visit);
  })(sf);
}

function addImport(src, names) {
  const re = /^import type \{([^}]*)\} from 'src\/utils\/controlTypes';$/m;
  const m = src.match(re);
  if (m) {
    const merged = [
      ...new Set([...m[1].split(',').map(x => x.trim()).filter(Boolean), ...names]),
    ].sort();
    return src.replace(re, `import type { ${merged.join(', ')} } from 'src/utils/controlTypes';`);
  }
  const lines = src.split('\n');
  let idx = 0;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      depth = (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
      idx = i + 1;
    } else if (depth > 0) {
      depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
      idx = i + 1;
    }
  }
  lines.splice(idx, 0, `import type { ${[...names].sort().join(', ')} } from 'src/utils/controlTypes';`);
  return lines.join('\n');
}

let total = 0;
for (const [file, bucket] of [...byFile].sort()) {
  bucket.ins.sort((a, b) => b.pos - a.pos);
  total += bucket.ins.length;
  console.log(`${path.relative(ROOT, file)}: ${bucket.ins.map(i => i.name).join(', ')}`);
  if (!APPLY) continue;
  let src = bucket.text;
  for (const i of bucket.ins) src = src.slice(0, i.pos) + `: ${i.type}` + src.slice(i.pos);
  // 名字已经在文件里绑过就别再 import（有的文件自己有同名的本地类型）
  const need = [...new Set(bucket.ins.map(i => i.type.replace('[]', '')))].filter(
    n => !new RegExp(`\\b${n}\\b`).test(bucket.text),
  );
  if (need.length) src = addImport(src, need);
  fs.writeFileSync(file, src);
}

console.log(`\n${APPLY ? '已标' : '可标'} ${total} 个变量，涉及 ${byFile.size} 个文件（TS 已知道真类型、跳过的 ${skippedTyped} 个）`);
