/**
 * `postMention` 的既有渲染缺陷：把 style 对象传给了 `className`
 * （持续目标·lead 2026-10-21 13:17 明确要求的「真实渲染反例」）。
 *
 * 【缺陷位置】
 * `components/Inbox/components/wrappedComp/postMention.tsx` 里 `description` 那一段：
 * ```tsx
 * <p className={{ color: 'var(--color-text-secondary)', 'font-size': '12px', 'line-height': '20px' }}>
 *   {description}
 * </p>
 * ```
 * `className` 期望**字符串**（CSS 类名），这里却给了对象 —— 对象会被 `String()` 成 `[object Object]`。
 *
 * 【本 spec 证明什么】用**真实 ReactDOMServer**渲染同一 JSX 结构，逐条钉住：
 * 1. 当前写法产出的 `class` 属性是字面量 `[object Object]` —— 这不是任何真实 CSS 类，样式**完全丢失**；
 * 2. 若按原意改成 `style={...}`，则产出完整的行内样式；
 * 3. 若 `className` 传字符串（正常用法），产出正常类名 —— 说明问题不在组件，而在这处实参类型。
 *
 * 【为什么要用真实 ReactDOMServer】本 spec 不复制产品源码，而是把**同样的 props 形状**交给真实的
 * React 渲染器，得到的就是浏览器会看到的 DOM 字节。这满足「必须执行真实实现/真实边界」的要求：
 * 渲染器是真的，只有被渲染的那一小段 JSX 是重述（因为原文件是 TSX 且依赖大量模块）。
 *
 * 【修复建议】把 `className={...}` 改为 `style={...}`（键名转 camelCase：fontSize/lineHeight）。
 * 这属于**业务行为修正**，需 lead 批准后再改产品源码；本 spec 只提供证据。
 *
 * 【自包含】按 `tsconfig.tools.json` 口径：不静态 import 产品模块。
 */

const assert: typeof import('node:assert/strict') = require('node:assert/strict');

/** 真实 React 19 + react-dom/server（仓库依赖，非桩） */
const React: typeof import('react') = require('react');
const { renderToStaticMarkup }: typeof import('react-dom/server') = require('react-dom/server');

type ReactElement = import('react').ReactElement;

const checks: { name: string; run: () => void }[] = [];
function check(name: string, run: () => void): void {
  checks.push({ name, run });
}

/** 产品源码里那处对象的真实键（连字符键，原样保留） */
const buggyClassNameValue = {
  color: 'var(--color-text-secondary)',
  'font-size': '12px',
  'line-height': '20px',
};

/** 若修复为 style，React 需要 camelCase 键 */
const correctedStyleValue = {
  color: 'var(--color-text-secondary)',
  fontSize: '12px',
  lineHeight: '20px',
};

const DESCRIPTION = '这是动态描述的文本内容';

function renderWith(className: unknown, style?: unknown): string {
  const props: Record<string, unknown> = {};
  if (className !== undefined) props.className = className;
  if (style !== undefined) props.style = style;
  const el: ReactElement = React.createElement('p', props, DESCRIPTION);
  return renderToStaticMarkup(el);
}

check('【反例核心】className 传对象 → 渲染出 class="[object Object]"（样式完全丢失）', () => {
  const html = renderWith(buggyClassNameValue);
  assert.equal(
    html,
    `<p class="[object Object]">${DESCRIPTION}</p>`,
    '当前写法产出的 class 就是 [object Object]——不是任何真实 CSS 类',
  );
  assert.ok(!html.includes('color:'), '样式值没有出现在输出里，说明样式确实丢失');
});

check('【对照】className 传字符串 → 正常类名（说明问题在实参类型而非组件）', () => {
  const html = renderWith('colorPrimary');
  assert.equal(html, `<p class="colorPrimary">${DESCRIPTION}</p>`);
});

check('【正确修法】改为 style={...}（camelCase 键）→ 输出完整行内样式', () => {
  const html = renderWith(undefined, correctedStyleValue);
  assert.equal(
    html,
    `<p style="color:var(--color-text-secondary);font-size:12px;line-height:20px">${DESCRIPTION}</p>`,
  );
});

check('【补充·实测反直觉】连字符键传给 style：React 19 会告警，但**仍然输出**该属性', () => {
  // 实测（react-dom 19）：控制台告警 "Unsupported style property font-size. Did you mean fontSize?",
  // 但 renderToStaticMarkup 的输出里**确实带上了** font-size/line-height 声明。
  // 因此修复时改用 style 即使保留连字符键也能生效（只是会有告警）—— 这里如实钉住真实输出。
  const html = renderWith(undefined, buggyClassNameValue);
  assert.equal(
    html,
    `<p style="color:var(--color-text-secondary);font-size:12px;line-height:20px">${DESCRIPTION}</p>`,
    'React 19 对连字符键既告警又输出，二者同时成立',
  );
});

check('【缺陷影响面】输出里 class 值既非空也非合法标识符 → CSS 选择器无法命中', () => {
  const html = renderWith(buggyClassNameValue);
  const m = html.match(/class="([^"]*)"/);
  assert.ok(m, '应当有 class 属性');
  const value = m![1]!;
  assert.equal(value, '[object Object]');
  // 合法 CSS 类名不含空格/方括号
  assert.ok(/[\s\[\]]/.test(value), '含空格与方括号，不可能是合法 CSS 类名');
});

function main(): void {
  let passed = 0;
  for (const item of checks) {
    try {
      item.run();
      passed += 1;
      console.log(`  ✓ ${item.name}`);
    } catch (err) {
      console.error(`  ✗ ${item.name}`);
      console.error(err);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`chat/PostMentionClassNameBug 渲染反例通过：${passed} 项`);
}

main();