const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readSource } = require('../../../../../scripts/spec-harness');

const source = readSource(__dirname, 'index.jsx');
const desktopSafariPrintIndex = source.indexOf('if (window.isSafari && !isMobile)');
const iframeIndex = source.indexOf("document.createElement('iframe')");
const windowPrintIndex = source.indexOf('window.print()', iframeIndex);

assert.match(source, /const \{ params, isMobile \} = this\.props/);
assert.notStrictEqual(desktopSafariPrintIndex, -1);
assert.ok(desktopSafariPrintIndex < iframeIndex);
assert.ok(iframeIndex < windowPrintIndex);

console.log('Print Header tests passed');
