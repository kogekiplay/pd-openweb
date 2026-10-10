const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;
const { transformSync } = require('../../scripts/spec-harness.ts');
const lodash = require('lodash');
const boundary = require('./caretBoundary.ts');
interface Caret {
  focus(): void;
  selectionStart?: number | null;
  setSelectionRange?(start: number, end: number): void;
  createTextRange?(): unknown;
}
interface Helpers {
  getCaretPosition(control: Caret): number | null | undefined;
  setCaretPosition(control: Caret | null, position?: number | null): void;
  getIconNameByExt(ext?: string | null): string;
  getClassNameByExt(ext?: string | false | null): string;
  getMimeTypeByExt(ext?: string | null): string;
  getUnUniqName(data: Array<Record<string, unknown>>, name?: string, key?: string): string;
}
const source = fs.readFileSync(path.join(__dirname, 'common.ts'), 'utf8');
const tree = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const wanted = new Set([
  'getCaretPosition',
  'setCaretPosition',
  'getIconNameByExt',
  'getClassNameByExt',
  'getMimeTypeByExt',
  'getUnUniqName',
]);
const declarations = tree.program.body
  .map(node => (node.type === 'ExportNamedDeclaration' ? node.declaration : node))
  .filter(node => node?.type === 'VariableDeclaration' && node.declarations.some(item => wanted.has(item.id.name)));
assert.equal(declarations.length, wanted.size, 'Use the actual product helper functions');
const calls: unknown[] = [];
const document: { selection?: unknown } = {};
const moduleLike: { exports: unknown } = { exports: {} };
new Function(
  'module',
  'exports',
  'document',
  'invokeLegacyCaretMethod',
  '_',
  'RegExpValidator',
  transformSync(
    declarations.map(node => generate(node).code).join('\n') +
      '\nmodule.exports={getCaretPosition,setCaretPosition,getIconNameByExt,getClassNameByExt,getMimeTypeByExt,getUnUniqName};',
    { filename: path.join(__dirname, 'common.ts') },
  ).code,
)(moduleLike, moduleLike.exports, document, boundary.invokeLegacyCaretMethod, lodash, {
  getExtOfFileName: (filename: string) => filename.split('.').at(-1),
});
const helpers = moduleLike.exports as Helpers;
const modern: Caret = {
  focus: () => calls.push('focus'),
  selectionStart: 3,
  setSelectionRange: (start, end) => calls.push([start, end]),
};
assert.equal(helpers.getCaretPosition(modern), 3);
helpers.setCaretPosition(modern, 5);
assert.deepEqual(calls, ['focus', 'focus', [5, 5]]);
modern.selectionStart = null;
assert.equal(helpers.getCaretPosition(modern), null, 'Native unsupported input selection remains null');
modern.selectionStart = undefined;
assert.equal(helpers.getCaretPosition(modern), undefined);
helpers.setCaretPosition(modern, 0);
assert.equal(calls.at(-1), 'focus', 'Zero position retains the original focus-only branch');
helpers.setCaretPosition(null, 5);
let moves = 0;
const copy = {
  moveToElementText(control: Caret) {
    assert.equal(this, copy);
    assert.equal(control, modern);
  },
  inRange(selection: unknown) {
    assert.equal(this, copy);
    assert.equal(selection, selectionRange);
    return moves < 4;
  },
  moveStart(unit: string) {
    assert.equal(this, copy);
    assert.equal(unit, 'character');
    moves++;
  },
};
const selectionRange = {
  duplicate() {
    assert.equal(this, selectionRange);
    return copy;
  },
};
document.selection = {
  createRange() {
    assert.equal(this, document.selection);
    return selectionRange;
  },
};
assert.equal(helpers.getCaretPosition(modern), 3);
delete document.selection;
const range = {
  move(unit: string, position?: number | null) {
    assert.equal(this, range);
    calls.push([unit, position]);
  },
  select() {
    assert.equal(this, range);
    calls.push('select');
  },
};
helpers.setCaretPosition({ focus: () => {}, createTextRange: () => range }, 2);
assert.deepEqual(calls.slice(-2), [['character', 2], 'select']);
assert.throws(() => helpers.setCaretPosition({ focus: () => {} }, 1), /selection method/);
assert.equal(helpers.getIconNameByExt('PDF'), 'pdf');
assert.equal(helpers.getClassNameByExt(false), 'fileIcon-folder');
assert.equal(helpers.getMimeTypeByExt('.PNG'), 'image/png');
assert.equal(helpers.getMimeTypeByExt(undefined), 'application/octet-stream');
assert.equal(helpers.getUnUniqName([{ name: 'Field1' }, { name: 'Field2' }], 'Field1'), 'Field3');
assert.equal(helpers.getUnUniqName([{ value: 'Option1' }, { value: 'Option3' }], 'Option1', 'value'), 'Option4');
assert.equal(helpers.getUnUniqName([{ name: 'Other' }], 'Unique'), 'Unique');
assert.throws(() => helpers.getUnUniqName([{ name: '1' }, { name: 2 }], '1'), /Unique names/);
console.log('Actual modern and legacy caret receiver, extension and unique-name protocols passed');
