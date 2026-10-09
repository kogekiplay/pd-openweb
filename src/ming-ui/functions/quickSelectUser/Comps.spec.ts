const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'Comps.tsx'), 'utf8');
assert.match(
  source,
  /name="quickSelectUserComps"\s+className="searchInput"/,
  'Record detail keyboard handling relies on the searchInput class to leave text entry untouched',
);
console.log('Quick user search input keeps the record-form text-entry class.');
