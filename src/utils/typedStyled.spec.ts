const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
const actual: typeof import('styled-components/dist/index') = require('styled-components');
const target: { exports: Record<string, unknown> } = { exports: {} };
new Function('module', 'exports', 'require', transformFileSync(path.join(__dirname, 'typedStyled.ts')).code)(
  target,
  target.exports,
  (name: string) => {
    assert.equal(name, 'styled-components', 'runtime still imports the package browser/main entry');
    return actual;
  },
);
const exportKeys = ['default', 'css', 'keyframes', 'createGlobalStyle', 'ServerStyleSheet'] as const;
for (const name of exportKeys)
  assert.equal(target.exports[name], actual[name], name + ' preserves exact installed runtime identity');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const styled = actual.default;
const Block = styled.div`
  color: var(--color-text-primary);
  padding: var(--space-2);
`;
const sheet = new actual.ServerStyleSheet();
try {
  const html = renderToStaticMarkup(
    sheet.collectStyles(React.createElement(Block, { id: 'typed-styled' }, 'same runtime')),
  );
  assert.ok(html.includes('typed-styled'));
  assert.ok(sheet.getStyleTags().includes('var(--color-text-primary)'));
} finally {
  sheet.seal();
}
console.log('Actual styled-components facade runtime/default/named identities and SSR styles passed');
