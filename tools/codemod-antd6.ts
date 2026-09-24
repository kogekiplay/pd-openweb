/**
 * antd 5 → 6 的 JSX 属性迁移，按【import 绑定】判定归属。
 *
 * 为什么必须自己写：
 * v5 那次有官方的 @ant-design/codemod-v5（jscodeshift，按 import 绑定追踪）。
 * v6 【没有】对应的 codemod —— `@ant-design/cli migrate --apply` 产出的是给 agent 看的
 * 提示清单（"Instructions for Code Agent"），不做 AST 改写，而且它的文件清单不按
 * import 绑定算：它列了 73 个 Button 文件，可全仓只有 33 个文件从 antd 导入 Button。
 *
 * 为什么不能用正则：本仓 ming-ui 有大量与 antd 同名的组件，实测导入文件数
 *   Tooltip  antd 1  / ming-ui 666      Checkbox antd 51 / ming-ui 287
 *   Dropdown antd 82 / ming-ui 264      Button   antd 33 / ming-ui 263
 *   Input    antd 127/ ming-ui 168
 * 另有 5 个文件两边同名都导入。按名字改 = 把 ming-ui 的组件一起改坏。
 *
 * 为什么是【文本手术】而不是 @babel/generator 重打印：
 * generator 会把整个文件按自己的风格重排，4000 个文件的 diff 会彻底淹掉真实改动，
 * 也没法 review。这里只用 AST 定位属性节点的 start/end，然后在原始字符串上替换那一段，
 * 其余字符一个不动。
 *
 * 用法：
 *   node tools/codemod-antd6.ts              # dry-run，只报告
 *   node tools/codemod-antd6.ts --apply      # 落盘
 *   node tools/codemod-antd6.ts --rule visible-to-open   # 只跑某条规则
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverseMod = require('@babel/traverse');

const traverse = traverseMod.default || traverseMod;
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const SKIP_DIR = /(^|\/)(node_modules|library)(\/|$)/;
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// ───────────────────────────── 规则 ─────────────────────────────
// kind:
//   rename  —— 只改属性名，值原样保留。最安全。
//   wrap    —— overlayClassName={x} → classNames={{ root: x }}。
//              目标属性已存在时【不改】，报出来人工处理（合并语义得看现场）。
//   const   —— arrowPointAtCenter → arrow={{ pointAtCenter: true }}，丢弃原值。
//              只在原值是 true / 裸属性时才改，其余报出来。
//
// 组件名是 antd 的【导出名】，不是文件里的局部名。
const RULES = [
  // ── 第一批：v6 真删掉的，现在就是坏的 ──
  {
    name: 'visible-to-open',
    kind: 'rename',
    components: ['Tooltip', 'Popover', 'Popconfirm', 'Dropdown'],
    from: 'visible',
    to: 'open',
  },
  {
    name: 'onVisibleChange-to-onOpenChange',
    kind: 'rename',
    components: ['Tooltip', 'Popover', 'Popconfirm', 'Dropdown'],
    from: 'onVisibleChange',
    to: 'onOpenChange',
  },
  {
    name: 'arrowPointAtCenter-to-arrow',
    kind: 'const',
    components: ['Tooltip', 'Popover', 'Popconfirm'],
    from: 'arrowPointAtCenter',
    to: 'arrow={{ pointAtCenter: true }}',
    conflictsWith: 'arrow',
  },

  {
    // antd 5 的 overlay 同时接受【元素】和【返回元素的函数】两种形态，v6 删掉了它。
    // 落点是 popupRender：实测 antd 6 的 renderOverlay() 里，不传 menu 时
    // overlayNode 为 undefined，随后 overlayNode = mergedPopupRender(overlayNode)，
    // 返回值直接当弹层内容，外面仍包同一个 OverrideProvider —— 与 overlay 1:1 等价。
    // 不改成 menu={{items}}：本仓 36 处里几乎都是 this.renderOverlay() 这类返回 JSX 的
    // 方法调用，改 menu 等于重写每个 render 方法，是语义改造不是迁移。
    //
    // 两种形态转换方式相反，所以只处理能【静态证明】的：
    //   元素 / 调用 / 三元 / 逻辑表达式  → popupRender={() => 原值}
    //   箭头函数 / function 表达式      → popupRender={原值}（只改名）
    //   裸标识符、成员表达式（moreMenu、this.renderShowColumns）→ 判不出来，报出来人工定
    name: 'overlay-to-popupRender',
    kind: 'overlay',
    components: ['Dropdown'],
    from: 'overlay',
  },

  // ── 第二批：v6 仍可用但已废弃，用户要求一并迁移 ──
  {
    name: 'destroyTooltipOnHide-to-destroyOnHidden',
    kind: 'rename',
    components: ['Tooltip', 'Popover', 'Popconfirm'],
    from: 'destroyTooltipOnHide',
    to: 'destroyOnHidden',
  },
  {
    name: 'destroyPopupOnHide-to-destroyOnHidden',
    kind: 'rename',
    components: ['Dropdown'],
    from: 'destroyPopupOnHide',
    to: 'destroyOnHidden',
  },
  {
    name: 'overlayClassName-to-classNames-root',
    kind: 'wrap',
    components: ['Tooltip', 'Popover', 'Popconfirm', 'Dropdown'],
    from: 'overlayClassName',
    to: 'classNames',
    key: 'root',
  },
  {
    name: 'overlayStyle-to-styles-root',
    kind: 'wrap',
    components: ['Tooltip', 'Popover', 'Popconfirm', 'Dropdown'],
    from: 'overlayStyle',
    to: 'styles',
    key: 'root',
  },
  {
    name: 'overlayInnerStyle-to-styles-container',
    kind: 'wrap',
    components: ['Tooltip', 'Popover', 'Popconfirm'],
    from: 'overlayInnerStyle',
    to: 'styles',
    key: 'container',
  },
  // ── 第三批：antd lint --only deprecated 报出的 255 条（官方口径，按 import 绑定判定）──
  // 每条的替代写法都用 `antd info <组件>` 核实过，不按记忆写。两个查出来的关键事实：
  //   Drawer.size 的类型是 'default' | 'large' | number | string —— 接受数字，
  //     所以 width={520} → size={520} 是合法的 1:1 改名，不是只能填预设档位。
  //   Drawer.mask 的类型是 boolean | { enabled?, blur?, closable? } —— maskClosable
  //     落到 mask.closable。
  { name: 'drawer-width-to-size', kind: 'rename', components: ['Drawer'], from: 'width', to: 'size' },
  { name: 'dropdownRender-to-popupRender', kind: 'rename', components: ['Select', 'TreeSelect', 'AutoComplete', 'Cascader'], from: 'dropdownRender', to: 'popupRender' },
  { name: 'onDropdownVisibleChange-to-onOpenChange', kind: 'rename', components: ['Select', 'TreeSelect', 'AutoComplete', 'Cascader'], from: 'onDropdownVisibleChange', to: 'onOpenChange' },
  { name: 'dropdownMatchSelectWidth-to-popupMatchSelectWidth', kind: 'rename', components: ['Select', 'TreeSelect', 'AutoComplete', 'Cascader'], from: 'dropdownMatchSelectWidth', to: 'popupMatchSelectWidth' },
  { name: 'trailColor-to-railColor', kind: 'rename', components: ['Progress'], from: 'trailColor', to: 'railColor' },
  { name: 'onAfterChange-to-onChangeComplete', kind: 'rename', components: ['Slider'], from: 'onAfterChange', to: 'onChangeComplete' },
  { name: 'destroyOnClose-to-destroyOnHidden', kind: 'rename', components: ['Modal', 'Drawer'], from: 'destroyOnClose', to: 'destroyOnHidden' },
  { name: 'space-direction-to-orientation', kind: 'rename', components: ['Space'], from: 'direction', to: 'orientation' },

  { name: 'drawer-bodyStyle-to-styles-body', kind: 'wrap', components: ['Drawer'], from: 'bodyStyle', to: 'styles', key: 'body' },
  { name: 'drawer-headerStyle-to-styles-header', kind: 'wrap', components: ['Drawer'], from: 'headerStyle', to: 'styles', key: 'header' },
  { name: 'drawer-maskStyle-to-styles-mask', kind: 'wrap', components: ['Drawer'], from: 'maskStyle', to: 'styles', key: 'mask' },
  { name: 'drawer-footerStyle-to-styles-footer', kind: 'wrap', components: ['Drawer'], from: 'footerStyle', to: 'styles', key: 'footer' },
  { name: 'drawer-drawerStyle-to-styles-section', kind: 'wrap', components: ['Drawer'], from: 'drawerStyle', to: 'styles', key: 'section' },
  { name: 'modal-bodyStyle-to-styles-body', kind: 'wrap', components: ['Modal'], from: 'bodyStyle', to: 'styles', key: 'body' },
  { name: 'modal-maskStyle-to-styles-mask', kind: 'wrap', components: ['Modal'], from: 'maskStyle', to: 'styles', key: 'mask' },
  { name: 'empty-imageStyle-to-styles-image', kind: 'wrap', components: ['Empty'], from: 'imageStyle', to: 'styles', key: 'image' },
  { name: 'maskClosable-to-mask-closable', kind: 'wrap', components: ['Modal', 'Drawer'], from: 'maskClosable', to: 'mask', key: 'closable' },
  { name: 'configProvider-autoInsertSpaceInButton', kind: 'wrap', components: ['ConfigProvider'], from: 'autoInsertSpaceInButton', to: 'button', key: 'autoInsertSpace' },
  { name: 'popupClassName-to-classNames-popup-root', kind: 'wrap', components: ['Select', 'TreeSelect', 'AutoComplete', 'Cascader', 'DatePicker'], from: 'popupClassName', to: 'classNames', key: 'popup.root' },
  { name: 'dropdownStyle-to-styles-popup-root', kind: 'wrap', components: ['Select', 'TreeSelect', 'AutoComplete', 'Cascader'], from: 'dropdownStyle', to: 'styles', key: 'popup.root' },
  {
    // Select 的 5 个搜索相关 props 在 v6 合并进 showSearch 对象。
    // 【读了实现才敢动】@rc-component/select/es/hooks/useSearchConfig.js：
    //   const isObject = typeof showSearch === 'object';
    //   searchConfig = { filterOption, searchValue, ..., ...(isObject ? showSearch : {}) };
    //   return [isObject || mode==='combobox' || ... ? true : showSearch, searchConfig];
    // 两个后果：
    //  (a) 顶层 props 仍然生效（先铺顶层、对象再覆盖）—— 所以这批确实只是「废弃」不是「坏了」。
    //  (b) 【传对象会强制把搜索打开】isObject 直接短路成 true。
    //      所以只有元素上已经是 showSearch / showSearch={true} 时合并才等价；
    //      showSearch={false}、写成表达式的、以及【根本没写 showSearch 的单选 Select】
    //      一旦合并就会凭空多出一个搜索框，必须跳过交人工。
    name: 'select-search-props-to-showSearch',
    kind: 'showSearch',
    components: ['Select', 'TreeSelect', 'AutoComplete', 'Cascader'],
    sources: ['filterOption', 'onSearch', 'optionFilterProp', 'searchValue', 'autoClearSearchValue', 'filterSort'],
  },
];

// ───────────────────────── 收集文件 ─────────────────────────
function collect(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);

    if (e.isDirectory()) {
      if (!SKIP_DIR.test(abs)) collect(abs, out);
    } else if (EXTS.has(path.extname(e.name)) && !e.name.endsWith('.spec.js')) {
      out.push(abs);
    }
  }

  return out;
}

// ──────────────────── antd 的 import 绑定 ────────────────────
// 只认这三种来源；`antd/es/tooltip` 这类深路径也算，取路径段推组件名。
function antdBindings(ast) {
  const map = new Map(); // 局部名 -> antd 导出名

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;

    const src = node.source.value;

    if (src !== 'antd' && !src.startsWith('antd/es/') && !src.startsWith('antd/lib/')) continue;

    for (const s of node.specifiers) {
      if (s.type === 'ImportSpecifier') {
        map.set(s.local.name, s.imported.name || s.imported.value);
      } else if (s.type === 'ImportDefaultSpecifier' && src !== 'antd') {
        // import Tooltip from 'antd/es/tooltip'
        const seg = src.split('/')[2];
        map.set(s.local.name, seg.charAt(0).toUpperCase() + seg.slice(1));
      }
    }
  }

  return map;
}

// ──────────────────── styled 包装的别名 ────────────────────
// `const SelectWrap = styled(Select)\`...\`` 之后 JSX 里写的是 <SelectWrap>，
// 属性原样透传给 antd 的 Select（styled-components 对【组件】不过滤 props），
// 所以同样要迁移。2026-09-23 之前这里不认包装，BaseFormInfo 的职位下拉就这样漏掉了
// onDropdownVisibleChange，打开成员抽屉必报一条弃用警告。
// 认的形态：styled(X)`` / styled(X).attrs(...)`` / styled(X).withConfig(...)`` / styled(X)({...})，
// X 可以是 antd 绑定，也可以是另一个已登记的包装（styled(styled(Select)) 这种套娃，多轮收敛）。
// 只看模块顶层的声明 —— 组件内部现场包一层的写法本仓没有，也不该有。
// 返回：局部名 -> 声明节点。resolveComponent 靠它确认 JSX 里的名字确实是这条声明。
function styledAliases(ast, map, src) {
  const decls = new Map();
  let styledName = null;

  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration' || node.source.value !== 'styled-components') continue;

    const def = node.specifiers.find(s => s.type === 'ImportDefaultSpecifier');

    if (def) styledName = def.local.name;
  }

  if (!styledName) return decls;

  // styled(X) 调用里的 X；不是这个形态返回 null
  const wrappedOf = init => {
    let n = init;

    if (n && n.type === 'TaggedTemplateExpression') n = n.tag;
    else if (n && n.type === 'CallExpression' && n.callee.type === 'CallExpression') n = n.callee; // styled(X)({...})

    // .attrs(...) / .withConfig(...)，可以连写
    while (
      n &&
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      ['attrs', 'withConfig'].includes(n.callee.property.name)
    ) {
      n = n.callee.object;
    }

    if (
      n &&
      n.type === 'CallExpression' &&
      n.callee.type === 'Identifier' &&
      n.callee.name === styledName &&
      n.arguments.length === 1 &&
      n.arguments[0].type === 'Identifier'
    ) {
      return n.arguments[0].name;
    }

    return null;
  };

  // 包装自己读了哪些东西：模板插值（${p => p.width}）、.attrs(...) / .withConfig(...) 的参数、
  // 对象写法的样式对象。【静态 CSS 文本不算】—— 否则 `width: 100%` 全是假阳性。
  const readsOf = init => {
    const parts = [];
    let n = init;

    if (n.type === 'TaggedTemplateExpression') {
      parts.push(...n.quasi.expressions);
      n = n.tag;
    } else if (n.type === 'CallExpression' && n.callee.type === 'CallExpression') {
      parts.push(...n.arguments);
      n = n.callee;
    }

    while (n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression') {
      parts.push(...n.arguments);
      n = n.callee.object;
    }

    return parts.map(e => src.slice(e.start, e.end)).join('\n');
  };

  const declarators = [];

  for (const node of ast.program.body) {
    const decl = node.type === 'ExportNamedDeclaration' ? node.declaration : node;

    if (!decl || decl.type !== 'VariableDeclaration') continue;

    for (const d of decl.declarations) {
      if (d.id.type === 'Identifier' && d.init) declarators.push(d);
    }
  }

  for (let changed = true; changed; ) {
    changed = false;

    for (const d of declarators) {
      if (decls.has(d.id.name)) continue;

      const inner = wrappedOf(d.init);

      if (inner && map.has(inner)) {
        map.set(d.id.name, map.get(inner));
        decls.set(d.id.name, d);
        // 套娃时把里层包装读的东西一并算上
        const innerDecl = decls.get(inner);
        d.__styledReads = readsOf(d.init) + (innerDecl ? '\n' + innerDecl.__styledReads : '');
        changed = true;
      }
    }
  }

  return decls;
}

// JSX 元素名 → antd 组件名；解析不出来（或被局部变量遮蔽）返回 null
function resolveComponent(openingPath, bindings, styledDecls) {
  const nameNode = openingPath.node.name;
  let rootName;

  if (nameNode.type === 'JSXIdentifier') rootName = nameNode.name;
  else if (nameNode.type === 'JSXMemberExpression' && nameNode.object.type === 'JSXIdentifier')
    rootName = nameNode.object.name;
  else return null;

  if (!bindings.has(rootName)) return null;

  // 【防遮蔽】确认这个名字在此处确实绑定到那条 import，而不是同名的局部变量/参数。
  // 不查的话，`const Tooltip = ...` 之后的用法会被误判成 antd 的。
  // styled 包装的绑定不是 module 而是 const，要求它正好是登记的那条顶层声明。
  const binding = openingPath.scope.getBinding(rootName);

  if (binding && binding.kind !== 'module' && styledDecls.get(rootName) !== binding.path.node) return null;

  const base = bindings.get(rootName);

  return nameNode.type === 'JSXMemberExpression' ? `${base}.${nameNode.property.name}` : base;
}

// ───────────────────────── 主流程 ─────────────────────────
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const onlyRule = argv.includes('--rule') ? argv[argv.indexOf('--rule') + 1] : null;
const rules = RULES.filter(r => !onlyRule || r.name === onlyRule);

if (!rules.length) {
  console.error(`没有匹配的规则。可用：\n  ${RULES.map(r => r.name).join('\n  ')}`);
  process.exit(2);
}

const LIST = argv.includes('--list'); // 逐条列出改动位置，给人工复核用

// --scan-deprecated：只报告、不改。对每个解析到 antd 组件（含 styled 包装）的 JSX 元素，
// 拿【已安装 antd 版本】的 `antd info` 弃用清单逐个属性比对。
// 为什么要有它：官方 `antd lint --only deprecated` 和上面的规则一样按 import 绑定看 JSX，
// 2026-09-23 它报 0 条的时候，styled 包装上还挂着一批弃用属性（打开成员抽屉就报警告）。
// 清单不手抄：升级 antd 之后自动跟着变。props 对象再展开（{...selectProps}）这种仍然看不到，得 grep。
const SCAN = argv.includes('--scan-deprecated');
const scanHits = [];
const deprecatedCache = new Map();
const ANTD_VERSION = require('antd/package.json').version;

function deprecatedPropsOf(comp) {
  if (!deprecatedCache.has(comp)) {
    let names = [];

    try {
      const out = require('child_process').execFileSync(
        'antd',
        ['info', comp, '--version', ANTD_VERSION, '--format', 'json', '--detail'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      names = (JSON.parse(out).props || []).filter(p => p.deprecated).map(p => p.name);
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.error('找不到 antd CLI：npm install -g @ant-design/cli');
        process.exit(2);
      }
      // 不是 antd 的顶层组件（比如 Typography.Text 这种子组件名），当作没有弃用属性
    }

    deprecatedCache.set(comp, new Set(names));
  }

  return deprecatedCache.get(comp);
}
const stats = new Map(rules.map(r => [r.name, { changed: 0, skipped: [], at: [] }]));
let filesWithAntd = 0;
let filesChanged = 0;

for (const file of collect(SRC)) {
  const src = fs.readFileSync(file, 'utf8');

  if (!src.includes('antd')) continue;

  let ast;

  try {
    ast = parser.parse(src, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'],
      errorRecovery: true,
    });
  } catch (e) {
    console.error(`解析失败（跳过）：${path.relative(ROOT, file)} — ${e.message}`);
    continue;
  }

  const bindings = antdBindings(ast);

  if (!bindings.size) continue;

  filesWithAntd++;

  const styledDecls = styledAliases(ast, bindings, src);

  const edits = []; // {start, end, text, rule}

  traverse(ast, {
    JSXOpeningElement(p) {
      const comp = resolveComponent(p, bindings, styledDecls);

      if (!comp) return;

      const attrNames = new Set(
        p.node.attributes.filter(a => a.type === 'JSXAttribute').map(a => a.name.name),
      );
      const wraps = Object.create(null); // 目标属性名 -> [{attr, key, inner, rule}]

      // 元素是 styled 包装时，包装自己的样式插值读到的 prop 不能改名/改形状：
      // 比如 styled(Drawer)`width: ${p => p.width}px` 配 <DrawerWrap width={480}>，
      // 把 width 改成 size 会让样式静默失效。这种一律跳过交人工。
      const rootName = p.node.name.type === 'JSXIdentifier' ? p.node.name.name : p.node.name.object.name;

      if (SCAN) {
        if (!comp.includes('.')) {
          const dep = deprecatedPropsOf(comp);

          for (const a of p.node.attributes) {
            if (a.type === 'JSXAttribute' && typeof a.name.name === 'string' && dep.has(a.name.name)) {
              const via = styledDecls.has(rootName) ? `（styled 包装 ${rootName}）` : '';
              scanHits.push(`${path.relative(ROOT, file)}:${a.loc.start.line}  ${comp}.${a.name.name}${via}`);
            }
          }
        }

        return;
      }

      const styledReads = (styledDecls.get(rootName) || {}).__styledReads || '';
      const readByStyled = name => new RegExp(`\\b${name}\\b`).test(styledReads);

      for (const rule of rules) {
        if (!rule.components.includes(comp)) continue;

        const touched = rule.kind === 'showSearch' ? rule.sources : [rule.from];
        const read = touched.find(n => attrNames.has(n) && readByStyled(n));

        if (read) {
          stats.get(rule.name).skipped.push(`${path.relative(ROOT, file)}:${p.node.loc.start.line}（styled 包装的样式读了 ${read}）`);
          continue;
        }

        if (rule.kind === 'showSearch') {
          const present = rule.sources
            .map(n => p.node.attributes.find(a => a.type === 'JSXAttribute' && a.name.name === n))
            .filter(Boolean);

          if (!present.length) continue;

          const ss = p.node.attributes.find(a => a.type === 'JSXAttribute' && a.name.name === 'showSearch');
          const line = `${path.relative(ROOT, file)}:${present[0].loc.start.line}`;
          const enabled =
            ss &&
            (ss.value === null ||
              (ss.value.type === 'JSXExpressionContainer' &&
                ss.value.expression.type === 'BooleanLiteral' &&
                ss.value.expression.value === true));

          if (!enabled) {
            const why = !ss ? '元素上没有 showSearch，合并会凭空开启搜索' : 'showSearch 不是字面量 true';
            stats.get(rule.name).skipped.push(`${line}（${why}）`);
            continue;
          }

          const body = present
            .map(a => {
              const v = a.value;
              const inner =
                v === null
                  ? 'true'
                  : v.type === 'JSXExpressionContainer'
                    ? src.slice(v.expression.start, v.expression.end)
                    : src.slice(v.start, v.end);
              return `${a.name.name}: ${inner}`;
            })
            .join(', ');

          edits.push({ start: ss.start, end: ss.end, text: `showSearch={{ ${body} }}`, rule: rule.name });

          for (const a of present) {
            let from = a.start;
            while (from > 0 && /\s/.test(src[from - 1])) from--;
            edits.push({ start: from, end: a.end, text: '', rule: rule.name });
          }

          continue;
        }

        const attr = p.node.attributes.find(a => a.type === 'JSXAttribute' && a.name.name === rule.from);

        if (!attr) continue;

        const where = `${path.relative(ROOT, file)}:${attr.loc.start.line}`;

        if (rule.kind === 'rename') {
          edits.push({ start: attr.name.start, end: attr.name.end, text: rule.to, rule: rule.name });
          continue;
        }

        if (rule.kind === 'const') {
          const v = attr.value;
          const isTrue =
            v === null || (v.type === 'JSXExpressionContainer' && v.expression.type === 'BooleanLiteral' && v.expression.value === true);

          if (!isTrue || attrNames.has(rule.conflictsWith)) {
            stats.get(rule.name).skipped.push(`${where}（${attrNames.has(rule.conflictsWith) ? `已有 ${rule.conflictsWith}` : '取值非 true'}）`);
            continue;
          }

          edits.push({ start: attr.start, end: attr.end, text: rule.to, rule: rule.name });
          continue;
        }

        if (rule.kind === 'overlay') {
          const v = attr.value;

          if (!v || v.type !== 'JSXExpressionContainer') {
            stats.get(rule.name).skipped.push(`${where}（取值不是表达式容器）`);
            continue;
          }

          const ex = v.expression;
          const text = src.slice(ex.start, ex.end);
          const WRAP = ['JSXElement', 'JSXFragment', 'CallExpression', 'ConditionalExpression', 'LogicalExpression'];
          const ASIS = ['ArrowFunctionExpression', 'FunctionExpression'];

          if (WRAP.includes(ex.type)) {
            edits.push({ start: attr.start, end: attr.end, text: `popupRender={() => ${text}}`, rule: rule.name });
          } else if (ASIS.includes(ex.type)) {
            edits.push({ start: attr.start, end: attr.end, text: `popupRender={${text}}`, rule: rule.name });
          } else {
            stats.get(rule.name).skipped.push(`${where}  overlay={${text}}（${ex.type}：元素还是函数判不出来）`);
          }

          continue;
        }

        if (rule.kind === 'wrap') {
          if (attrNames.has(rule.to)) {
            stats.get(rule.name).skipped.push(`${where}（已有 ${rule.to}=，合并语义需现场判断）`);
            continue;
          }

          const v = attr.value;

          if (!v) {
            stats.get(rule.name).skipped.push(`${where}（裸属性，无值）`);
            continue;
          }

          const inner =
            v.type === 'JSXExpressionContainer' ? src.slice(v.expression.start, v.expression.end) : src.slice(v.start, v.end);

          // 【同一目标属性必须合并成一条】Drawer 的 bodyStyle / headerStyle / maskStyle
          // 全都映射到 styles 对象。各自独立产出的话，同一个元素上会出现两个
          // styles={{…}} 属性 —— JSX 里后者直接覆盖前者，样式静默丢掉一半。
          // 所以先登记，等这个元素的规则跑完再统一产出。
          (wraps[rule.to] ||= []).push({ attr, key: rule.key, inner, rule: rule.name });
        }
      }

      // 按目标属性合并：第一个源属性的位置写合并后的新属性，其余源属性整段删掉
      //（连同前导空白，免得留下多余空格）。
      for (const target of Object.keys(wraps)) {
        const list = wraps[target].sort((a, b) => a.attr.start - b.attr.start);
        // key 支持两级（'popup.root' → { popup: { root: X } }），Select 的
        // popupClassName → classNames.popup.root 就是这种。
        const nest = (k, v) => k.split('.').reverse().reduce((acc, seg) => `{ ${seg}: ${acc} }`, v);
        const body = list.map(w => (w.key.includes('.')
          ? w.key.split('.').slice(0, -1).join('.') + ': ' + nest(w.key.split('.').slice(1).join('.'), w.inner)
          : `${w.key}: ${w.inner}`)).join(', ');

        edits.push({ start: list[0].attr.start, end: list[0].attr.end, text: `${target}={{ ${body} }}`, rule: list[0].rule });
        stats.get(list[0].rule);

        for (const w of list.slice(1)) {
          let from = w.attr.start;
          while (from > 0 && /\s/.test(src[from - 1])) from--;
          edits.push({ start: from, end: w.attr.end, text: '', rule: w.rule });
        }
      }
    },
  });

  if (!edits.length) continue;

  filesChanged++;

  // 从后往前替换，避免前面的改动移动后面的偏移
  edits.sort((a, b) => b.start - a.start);

  let out = src;

  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    stats.get(e.rule).changed++;

    const line = src.slice(0, e.start).split('\n').length;
    stats.get(e.rule).at.push(`${path.relative(ROOT, file)}:${line}`);
  }

  if (APPLY) fs.writeFileSync(file, out);
}

// 下限断言：一个引 antd 的文件都没认出来，说明绑定解析坏了
if (filesWithAntd < 100) {
  console.error(`只认出 ${filesWithAntd} 个从 antd 导入组件的文件，绑定解析大概率坏了`);
  process.exit(1);
}

if (SCAN) {
  console.log(`antd ${ANTD_VERSION} 弃用属性扫描：${filesWithAntd} 个文件，命中 ${scanHits.length} 处`);
  scanHits.forEach(x => console.log(`  ${x}`));
  process.exit(scanHits.length ? 1 : 0);
}

console.log(`${APPLY ? '已改写' : 'dry-run'}：扫到 ${filesWithAntd} 个从 antd 导入组件的文件，命中 ${filesChanged} 个\n`);

for (const r of rules) {
  const s = stats.get(r.name);

  if (!s.changed && !s.skipped.length) continue;

  console.log(`  ${r.name}：改 ${s.changed} 处${s.skipped.length ? `，跳过 ${s.skipped.length} 处` : ''}`);
  if (LIST) [...new Set(s.at)].forEach(x => console.log(`      改 ${x}`));
  s.skipped.slice(0, 8).forEach(x => console.log(`      跳过 ${x}`));
  if (s.skipped.length > 8) console.log(`      …还有 ${s.skipped.length - 8} 处`);
}

if (!APPLY) console.log('\n（dry-run，未写文件。确认后加 --apply）');
