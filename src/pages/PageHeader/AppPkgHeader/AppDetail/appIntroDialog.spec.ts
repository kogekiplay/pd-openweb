/**
 * Regression spec for the App Intro modal (.appIntroDialog / .appIntroDialogWrapCenter.preview)
 * after upgrading to antd v6 (@rc-component/dialog).
 *
 * Background:
 * - In antd v4/v5 rc-dialog, `.ant-modal` had 3 direct child divs:
 *   `[sentinelStart, .ant-modal-content, sentinelEnd]`.
 *   `.appIntroDialogWrapCenter.preview .appIntroDialog > div:nth-child(1), :nth-child(3)`
 *   hijacked the two sentinel divs as 40px top/bottom scroll spacers.
 * - In antd v6 (@rc-component/dialog), focus locking moved to `useLockFocus` and both
 *   sentinel divs were removed; `.ant-modal-container` is now the sole direct child div.
 *   The legacy `:nth-child(1)` rule collapsed `.ant-modal-container` to `height: 40px !important`.
 * - antd v6 also adds default `padding: 20px 24px` (`contentPadding`) on `.ant-modal-container`
 *   and fixed 32x32 size / hover fill on `.ant-modal-close`.
 */

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');

interface LessRenderOutput {
  css: string;
}

interface LessApi {
  render(input: string, options?: { filename?: string }): Promise<LessRenderOutput>;
}

interface CssRule {
  selectors: string[];
  declarations: Map<string, string>;
}

const less: LessApi = require('less');

const ROOT = path.resolve(__dirname, '../../../../..');
const LESS_PATH = path.join(__dirname, 'index.less');
const PANEL_PATH = path.join(ROOT, 'node_modules/@rc-component/dialog/es/Dialog/Content/Panel.js');

function normalizeSelector(selector: string): string {
  return selector
    .replace(/\s+/g, ' ')
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .trim();
}

function parseCssRules(css: string): CssRule[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const blockRe = /([^{}@][^{}]*)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(withoutComments)) !== null) {
    const rawSelectors = match[1] ?? '';
    const rawBody = match[2] ?? '';
    const selectors = rawSelectors
      .split(',')
      .map(s => normalizeSelector(s))
      .filter(Boolean);

    if (!selectors.length) continue;

    const declarations = new Map<string, string>();
    for (const part of rawBody.split(';')) {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) continue;
      const prop = part.slice(0, colonIdx).trim().toLowerCase();
      const value = part
        .slice(colonIdx + 1)
        .trim()
        .replace(/\s+/g, ' ');
      if (prop) declarations.set(prop, value);
    }

    rules.push({ selectors, declarations });
  }

  return rules;
}

function findDeclarations(rules: CssRule[], exactSelector: string): Map<string, string> {
  const target = normalizeSelector(exactSelector);
  const merged = new Map<string, string>();

  for (const rule of rules) {
    if (!rule.selectors.includes(target)) continue;
    for (const [prop, value] of rule.declarations) {
      merged.set(prop, value);
    }
  }

  return merged;
}

async function run(): Promise<void> {
  // 1. Verify the installed @rc-component/dialog Panel structure contract (antd v6):
  //    `.ant-modal` wraps `.ant-modal-container` directly via MemoChildren with no sentinel divs.
  assert.ok(fs.existsSync(PANEL_PATH), `Expected @rc-component/dialog Panel.js at ${PANEL_PATH}`);
  const panelSource = fs.readFileSync(PANEL_PATH, 'utf8');

  assert.match(panelSource, /\buseLockFocus\b/, 'antd v6 Panel.js should manage focus via useLockFocus');
  assert.doesNotMatch(
    panelSource,
    /sentinelStart|sentinelEnd/,
    'antd v6 Panel.js should not render legacy sentinelStart/sentinelEnd divs',
  );
  assert.match(
    panelSource,
    /\$\{prefixCls\}-container/,
    'antd v6 Panel.js should render the ${prefixCls}-container div',
  );
  assert.match(
    panelSource,
    /role:\s*["']dialog["'][\s\S]*?React\.createElement\(MemoChildren[\s\S]*?modalRender\s*\?\s*modalRender\(content\)\s*:\s*content\)/,
    'antd v6 Panel.js dialog root should directly wrap MemoChildren -> content (.ant-modal-container)',
  );

  // 2. Compile AppDetail/index.less with the real Less compiler and inspect the output CSS.
  const lessSource = fs.readFileSync(LESS_PATH, 'utf8');
  const { css } = await less.render(lessSource, { filename: LESS_PATH });
  const rules = parseCssRules(css);

  assert.ok(rules.length > 0, 'Expected non-empty compiled CSS rules from AppDetail/index.less');

  // 3. Guard against the sentinel collapse regression:
  //    No selector may target `.appIntroDialog > div` or `:nth-child(1)` / `:nth-child(3)` under `.appIntroDialog`.
  for (const rule of rules) {
    for (const selector of rule.selectors) {
      assert.doesNotMatch(
        selector,
        /\.appIntroDialog\s*>\s*div\b/,
        `Selector "${selector}" must not target direct child div of .appIntroDialog (would hit .ant-modal-container in antd v6)`,
      );
      if (selector.includes('.appIntroDialog')) {
        assert.doesNotMatch(
          selector,
          /:nth-child\([13]\)/,
          `Selector "${selector}" must not rely on legacy :nth-child(1)/:nth-child(3) sentinel positions`,
        );
      }
      if (selector.includes('.appIntroDialog') && selector.includes('.ant-modal-container')) {
        const height = rule.declarations.get('height') ?? '';
        assert.notEqual(
          height.replace(/\s*!important$/i, ''),
          '40px',
          `Selector "${selector}" must never collapse .ant-modal-container height to 40px`,
        );
        for (const overflowProp of ['overflow', 'overflow-x', 'overflow-y']) {
          const overflowVal = (rule.declarations.get(overflowProp) ?? '').replace(/\s*!important$/i, '').toLowerCase();
          assert.notEqual(
            overflowVal,
            'hidden',
            `Selector "${selector}" must not set ${overflowProp}: hidden (clips external .ant-modal-close)`,
          );
        }
      }
    }
  }

  // 4. Verify `.appIntroDialog .ant-modal-container` clears antd v6 default contentPadding.
  const containerDecls = findDeclarations(rules, '.appIntroDialog .ant-modal-container');
  assert.equal(
    containerDecls.get('padding'),
    '0',
    '.appIntroDialog .ant-modal-container must reset antd v6 default padding to 0',
  );

  // 5. Verify `.appIntroDialogWrapCenter.preview` uses pseudo-element 40px spacers and height: auto.
  const previewWrapDecls = findDeclarations(rules, '.appIntroDialogWrapCenter.preview');
  assert.equal(
    previewWrapDecls.get('overflow-y'),
    'auto',
    '.appIntroDialogWrapCenter.preview must enable overflow-y: auto for tall preview content',
  );

  for (const pseudo of ['::before', '::after']) {
    const pseudoSelector = `.appIntroDialogWrapCenter.preview .appIntroDialog${pseudo}`;
    const decls = findDeclarations(rules, pseudoSelector);
    const content = decls.get('content');
    assert.ok(
      content === "''" || content === '""',
      `${pseudoSelector} must declare empty content (got: ${String(content)})`,
    );
    assert.equal(decls.get('display'), 'block', `${pseudoSelector} must be display: block`);
    assert.equal(decls.get('width'), '100%', `${pseudoSelector} must be width: 100%`);
    assert.equal(decls.get('height'), '40px', `${pseudoSelector} must provide 40px vertical spacing`);
  }

  const previewContainerDecls = findDeclarations(
    rules,
    '.appIntroDialogWrapCenter.preview .appIntroDialog .ant-modal-container',
  );
  assert.equal(
    previewContainerDecls.get('height'),
    'auto',
    'Preview mode .ant-modal-container must use height: auto so tall content does not clip the modal background',
  );

  // 6. Verify `.appIntroDialog .ant-modal-close` keeps external positioning without antd v6 32x32 / hover box artifacts.
  const closeDecls = findDeclarations(rules, '.appIntroDialog .ant-modal-close');
  assert.equal(closeDecls.get('top'), '-2px !important', '.ant-modal-close keeps external top offset');
  assert.equal(closeDecls.get('right'), '-30px !important', '.ant-modal-close keeps external right offset');
  assert.equal(closeDecls.get('width'), 'auto', '.ant-modal-close resets antd v6 fixed 32px width');
  assert.equal(closeDecls.get('height'), 'auto', '.ant-modal-close resets antd v6 fixed 32px height');
  assert.equal(
    closeDecls.get('background'),
    'transparent !important',
    '.ant-modal-close suppresses antd v6 hover/active gray fill box',
  );

  const closeFocusDecls = findDeclarations(rules, '.appIntroDialog .ant-modal-close:focus-visible');
  assert.equal(
    closeFocusDecls.get('outline-offset'),
    '2px !important',
    '.ant-modal-close:focus-visible uses outward offset so focus ring does not cut across the 18px icon',
  );

  const closeXDecls = findDeclarations(rules, '.appIntroDialog .ant-modal-close .ant-modal-close-x');
  assert.equal(closeXDecls.get('width'), 'auto', '.ant-modal-close-x keeps width: auto');
  assert.equal(closeXDecls.get('height'), 'auto', '.ant-modal-close-x sets height: auto');

  console.log('AppIntroDialog antd v6 layout, padding, preview scroll spacer, and close button assertions passed');
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
