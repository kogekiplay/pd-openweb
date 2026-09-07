const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readSource } = require('../../../../scripts/spec-harness');

const source = readSource(__dirname, 'getPrintContent.js');

assert.match(
  source,
  /case 15:\s*case 16:\s*if \(item\.isRelateMultipleSheet\) \{\s*return renderCellText\(dataItem, \{ appId: item\.appId \}\) \|\| placeholderMode;\s*\}/,
);

console.log('Print relation date format tests passed');
