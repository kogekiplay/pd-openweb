/// <reference path="./jsonView.d.ts" />
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const sdk: typeof import('@mingdaocom/json-view') = require('@mingdaocom/json-view');
const opaque = { rows: [{ id: 'row', value: false }], count: 0 };
const before = JSON.stringify(opaque);
for (const theme of ['dark', 'light', 'transparent', 'system', 'unknown']) {
  const html = ReactDOM.renderToStaticMarkup(
    React.createElement(sdk.default, {
      data: opaque,
      copyData: { copy: 'only' },
      rootKey: 0,
      indentSize: 12,
      enableClipboard: false,
      accentColor: 'red',
      theme,
      className: 'actual-class',
      bodyClassName: 'actual-body',
      showGuideLine: false,
      onCopy: (text, path) => {
        text.toUpperCase();
        path.map(key => (typeof key === 'number' ? key.toFixed() : key.toUpperCase()));
      },
    }),
  );
  assert.match(html, /actual-class/);
  assert.match(html, /actual-body/);
  assert.match(html, /row/);
  assert.match(html, /count/);
  assert.match(html, /12px/);
  assert.doesNotMatch(html, /copy value/);
  assert.equal(JSON.stringify(opaque), before, 'Actual SDK preserves the input object');
}
const knownDark = ReactDOM.renderToStaticMarkup(React.createElement(sdk.default, { data: [1, 2], theme: 'dark' }));
const fallbackDark = ReactDOM.renderToStaticMarkup(React.createElement(sdk.default, { data: [1, 2], theme: 'system' }));
assert.equal(fallbackDark, knownDark, 'Every unrecognized string palette uses the installed dark fallback');
const key = {
  toString() {
    return 'OBJECT_ROOT_KEY';
  },
};
const objectKeyHtml = ReactDOM.renderToStaticMarkup(
  React.createElement(sdk.default, { data: { value: true }, rootKey: key }),
);
assert.match(objectKeyHtml, /OBJECT_ROOT_KEY/);
assert.match(
  ReactDOM.renderToStaticMarkup(React.createElement(sdk.default, { data: '{"x":1}', rootKey: 'text' })),
  /text/,
);
console.log(
  'Installed json-view 0.1.4 actual ReactDOM rendering/full props/palette/String root key/opaque data passed',
);
