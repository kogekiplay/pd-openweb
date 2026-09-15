/**
 * 给 `useRef(null)` 补元素类型（TS2339 on type 'never'）
 *
 * 全仓 TS2339 里 3527 条是「属性不存在于类型 'never'」，仅次于 '{}' 那一类。
 * 【它的来源和老 codemod 假设的不是一回事】——
 * tools/codemod-null-init-types.ts 治的是 `let x = null` 之后再赋值那种，
 * 那一批早就做完了。现在剩下的 3527 条，主力是 React 的 ref：
 *
 *     const containerRef = useRef(null);    // -> RefObject<null>
 *     const container = containerRef.current;
 *     container.appendChild(iframe);        // ← null 收窄后只剩 never，每用一次报一条
 *
 * 先照着老 codemod 的判据写了一版（找赋值点求并集），实测 3517/3527 卡在
 * 「解析不到声明」—— 因为根本没有 `x = …` 赋值点，值是 React 塞进 .current 的。
 * 这条记在这里：**迁移期不要照搬老工具的假设，先采样看剩下的是什么形态。**
 *
 * 【类型从哪来 —— JSX 的挂载点】`<div ref={containerRef}>` 这一句就说明了
 * containerRef 指向的是 HTMLDivElement。这是精确信号，不是猜。
 * 全仓 382 个 useRef(null) 里有 250 个在同文件能找到 JSX 挂载点。
 *
 * 【为什么带 | null】useRef(null) 的初值就是 null，React 在挂载前后都可能是 null。
 * 不带的话调用方会以为它永远有值，那是【假的确定性】—— 比现在的 never 更危险。
 *
 * 【不处理的】
 * · 挂在自定义组件上的 `ref={xRef}`（`<MyComp ref={…}>`）：那是组件实例不是 DOM 元素，
 *   类型取决于组件自己的 forwardRef 声明，这里推不出来也不该猜。
 * · 同一个 ref 挂在多个不同标签上的：说明它不止一种形态，跳过。
 * · 已经写了类型参数的 `useRef<T>(null)`。
 *
 * 用法：
 *   node tools/codemod-useref-null-element.ts --list
 *   node tools/codemod-useref-null-element.ts
 */

const path = require('path');
const is = require('typescript/unstable/ast/is');
const { ROOT, openProject, writeSource } = require('./ts7.ts');

const APPLY = !process.argv.includes('--list');
const SRC = path.join(ROOT, 'src') + path.sep;

/** 标签 -> DOM 接口。没列到的走 HTMLElement 兜底（那是所有 HTML 元素的公共父类型，不是放水）。 */
const TAG_TO_ELEMENT: Record<string, string> = {
  a: 'HTMLAnchorElement',
  audio: 'HTMLAudioElement',
  br: 'HTMLBRElement',
  button: 'HTMLButtonElement',
  canvas: 'HTMLCanvasElement',
  div: 'HTMLDivElement',
  form: 'HTMLFormElement',
  h1: 'HTMLHeadingElement',
  h2: 'HTMLHeadingElement',
  h3: 'HTMLHeadingElement',
  iframe: 'HTMLIFrameElement',
  img: 'HTMLImageElement',
  input: 'HTMLInputElement',
  label: 'HTMLLabelElement',
  li: 'HTMLLIElement',
  ol: 'HTMLOListElement',
  option: 'HTMLOptionElement',
  p: 'HTMLParagraphElement',
  pre: 'HTMLPreElement',
  script: 'HTMLScriptElement',
  section: 'HTMLElement',
  select: 'HTMLSelectElement',
  span: 'HTMLSpanElement',
  table: 'HTMLTableElement',
  td: 'HTMLTableCellElement',
  textarea: 'HTMLTextAreaElement',
  th: 'HTMLTableCellElement',
  tr: 'HTMLTableRowElement',
  ul: 'HTMLUListElement',
  video: 'HTMLVideoElement',
};

const project = openProject('tsconfig.strictprobe.json');

// 只处理真的报了 never 的文件，避免动那些 TS 已经推得很好的 ref
const neverFiles = new Set<string>(
  project.program
    .getSemanticDiagnostics()
    .filter(
      (d: any) =>
        d.code === 2339 && d.fileName && d.fileName.startsWith(SRC) && / does not exist on type 'never'/.test(d.text || ''),
    )
    .map((d: any) => d.fileName),
);

type Target = { fileName: string; text: string; pos: number; name: string; element: string };
const targets: Target[] = [];
const skip = { noJsx: 0, custom: 0, conflict: 0, typed: 0 };

project.eachSrcFile(({ fileName, text, node }: any) => {
  if (!neverFiles.has(fileName)) return;

  // 1) 收集本文件里 `const xRef = useRef(null)`（没有类型参数的）
  const refs = new Map<string, { pos: number }>();
  (function walk(n: any) {
    if (
      is.isVariableDeclaration(n) &&
      n.name &&
      is.isIdentifier(n.name) &&
      !n.type &&
      n.initializer &&
      is.isCallExpression(n.initializer) &&
      n.initializer.expression &&
      is.isIdentifier(n.initializer.expression) &&
      n.initializer.expression.text === 'useRef' &&
      n.initializer.arguments &&
      n.initializer.arguments.length === 1 &&
      n.initializer.arguments[0].kind !== undefined &&
      text.slice(n.initializer.arguments[0].pos, n.initializer.arguments[0].end).trim() === 'null'
    ) {
      if (n.initializer.typeArguments && n.initializer.typeArguments.length) {
        skip.typed += 1;
      } else {
        // 插入点在 useRef 之后、左括号之前
        refs.set(n.name.text, { pos: n.initializer.expression.end });
      }
    }
    n.forEachChild(walk);
  })(node);

  if (!refs.size) return;

  // 2) 找 JSX 里的 ref={xRef}，取所在标签
  const tagsFor = new Map<string, Set<string>>();
  (function walk(n: any) {
    if (is.isJsxAttribute(n) && n.name && is.isIdentifier(n.name) && n.name.text === 'ref' && n.initializer) {
      const expr = is.isJsxExpression(n.initializer) ? n.initializer.expression : null;
      if (expr && is.isIdentifier(expr) && refs.has(expr.text)) {
        // 往上找到承载这个属性的 JSX 元素，取标签名
        let el = n.parent;
        while (el && !is.isJsxOpeningElement(el) && !is.isJsxSelfClosingElement(el)) el = el.parent;
        const tagNode = el && el.tagName;
        if (tagNode && is.isIdentifier(tagNode)) {
          if (!tagsFor.has(expr.text)) tagsFor.set(expr.text, new Set());
          tagsFor.get(expr.text)!.add(tagNode.text);
        }
      }
    }
    n.forEachChild(walk);
  })(node);

  for (const [name, { pos }] of refs) {
    const tags = tagsFor.get(name);
    if (!tags || !tags.size) {
      skip.noJsx += 1;
      continue;
    }
    // 同一个 ref 挂在多个不同标签上 -> 不止一种形态，跳过
    if (tags.size > 1) {
      skip.conflict += 1;
      continue;
    }
    const tag = [...tags][0];
    // 自定义组件（首字母大写）是组件实例不是 DOM 元素，推不出来也不该猜
    if (!/^[a-z]/.test(tag)) {
      skip.custom += 1;
      continue;
    }
    targets.push({ fileName, text, pos, name, element: TAG_TO_ELEMENT[tag] || 'HTMLElement' });
  }
});

// ── 报告与应用 ────────────────────────────────────────────────────────────
const byElement = new Map<string, number>();
for (const t of targets) byElement.set(t.element, (byElement.get(t.element) || 0) + 1);
console.log('按推出来的元素类型：');
for (const [e, n] of [...byElement].sort((a, b) => b[1] - a[1])) console.log(`  ${e.padEnd(24)} ${n} 个`);

const fileCount = new Set(targets.map(t => t.fileName)).size;
console.log(
  `\n${APPLY ? '已标' : '可标'} ${targets.length} 个 ref，涉及 ${fileCount} 个文件；` +
    `跳过：同文件没有 JSX 挂载点 ${skip.noJsx} / 挂在自定义组件上 ${skip.custom} / ` +
    `挂在多个不同标签上 ${skip.conflict} / 已有类型参数 ${skip.typed}`,
);

if (APPLY && targets.length) {
  const edits = new Map<string, { text: string; list: { pos: number; text: string }[] }>();
  for (const t of targets) {
    if (!edits.has(t.fileName)) edits.set(t.fileName, { text: t.text, list: [] });
    // 【必须带 | null】useRef(null) 的初值就是 null，挂载前后都可能没值。
    // 不带的话调用方会以为它永远有值，那是比 never 更危险的假确定性。
    edits.get(t.fileName)!.list.push({ pos: t.pos, text: `<${t.element} | null>` });
  }
  for (const [fileName, bucket] of edits) writeSource(fileName, bucket.text, bucket.list);
  console.log(`已写入 ${edits.size} 个文件。`);
}

project.close();
