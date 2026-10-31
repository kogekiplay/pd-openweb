const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const traverse: typeof import('@babel/traverse').default = require('@babel/traverse').default;
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const { transformSync } = require('../../../../../scripts/spec-harness.ts') as SpecHarness;
const lodash: typeof import('lodash') = require('lodash');
const root = path.resolve(__dirname, '../../../../..');
const childFile = path.join(__dirname, 'ChildTable.tsx');
const childSource = fs.readFileSync(childFile, 'utf8');
const cellFile = path.join(root, 'src/pages/worksheet/components/WorksheetTable/components/Cell.tsx');
const cellSource = fs.readFileSync(cellFile, 'utf8');

interface Row {
  rowid?: string | undefined;
  isSubListFooter?: boolean | undefined;
}
interface State {
  previewRowIndex: number;
  recordVisible: boolean;
  isEditCurrentRow: boolean;
}
type Click = (control: unknown, row: Row, rowIndex?: number, columnIndex?: number, options?: { isSpace?: boolean }) => void;
interface Instance {
  state: State;
  opened: number[];
  created: number;
  setState(next: Partial<State>): void;
  openDetail(index: number): void;
  newRow(): Row;
}
function segment(source: string, node: { start?: number | null; end?: number | null }): string {
  if (node.start == null || node.end == null) throw new Error('Missing actual source range');
  return source.slice(node.start, node.end);
}
function compile(source: string, filename: string): string {
  const result = transformSync(source, { filename });
  if (!result || typeof result.code !== 'string') throw new Error('Missing compiled fixture');
  return result.code;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

// Extract the actual callback, state update, and detail-data expression. No copy of
// the selection algorithm is implemented in this test.
const clickSources: string[] = [], openSources: string[] = [], detailSources: string[] = [], tableDataSources: string[] = [];
traverse(parser.parse(childSource, { sourceType: 'module', plugins: ['typescript', 'jsx'] }), {
  JSXAttribute(p) {
    const n = p.node;
    if (n.name.type === 'JSXIdentifier' && n.name.name === 'onCellClick' && n.value?.type === 'JSXExpressionContainer' && n.value.expression.type === 'ArrowFunctionExpression') {
      clickSources.push(segment(childSource, n.value.expression));
    }
  },
  ClassProperty(p) {
    if (p.node.key.type === 'Identifier' && p.node.key.name === 'openDetail' && p.node.value?.type === 'ArrowFunctionExpression') {
      openSources.push(segment(childSource, p.node.value));
    }
  },
  JSXOpeningElement(p) {
    if (p.node.name.type !== 'JSXIdentifier') return;
    const destinations = p.node.name.name === 'RowDetailComponent' ? detailSources : p.node.name.name === 'WorksheetTable' ? tableDataSources : undefined;
    if (!destinations) return;
    for (const a of p.node.attributes) {
      if (a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' && a.name.name === 'data' && a.value?.type === 'JSXExpressionContainer') {
        destinations.push(segment(childSource, a.value.expression));
      }
    }
  },
});
assert.equal(clickSources.length, 1);
assert.equal(openSources.length, 1);
assert.equal(detailSources.length, 1);
assert.equal(tableDataSources.length, 1);
const recordFile = path.join(root, 'src/utils/record.ts');
const recordSource = fs.readFileSync(recordFile, 'utf8');
const filters: string[] = [];
traverse(parser.parse(recordSource, { sourceType: 'module', plugins: ['typescript'] }), {
  FunctionDeclaration(p) { if (p.node.id?.name === 'filterEmptyChildTableRows') filters.push(segment(recordSource, p.node)); },
});
assert.equal(filters.length, 1);
const filterRows: (rows: Row[]) => Row[] = new Function(compile('const filterRows = ' + filters[0] + ';', recordFile) + ';return filterRows;')();
const tableDataFactory = new Function('keywords', 'filterEmptyChildTableRows', 'tableData', compile('const rows = ' + tableDataSources[0] + ';', childFile) + ';return rows;');
const clickFactory = new Function('control', 'tableData', 'layoutDirection', 'allowOpenRecord', 'get', 'findIndex',
  compile('function createCallback() { return ' + clickSources[0] + '; }', childFile) + ';return createCallback.call(this);');
const openFactory = new Function(compile('function createOpen() { return ' + openSources[0] + '; }', childFile) + ';return createOpen.call(this);');
const dataFactory = new Function('tableData', 'previewRowIndex', compile('function readDetailData() { return ' + detailSources[0] + '; }', childFile) + ';return readDetailData.call(this);');

const blankSources: string[] = [];
traverse(parser.parse(cellSource, { sourceType: 'module', plugins: ['typescript', 'jsx'] }), {
  JSXAttribute(p) {
    const n = p.node;
    if (n.name.type !== 'JSXIdentifier' || n.name.name !== 'onClick' || n.value?.type !== 'JSXExpressionContainer' || n.value.expression.type !== 'ArrowFunctionExpression') return;
    let callsClick = false;
    p.traverse({ CallExpression(call) { if (call.node.callee.type === 'Identifier' && call.node.callee.name === 'onCellClick') callsClick = true; } });
    if (callsClick) blankSources.push(segment(cellSource, n.value.expression));
  },
});
assert.equal(blankSources.length, 1);
const blankFactory = new Function('control', 'row', 'rowIndex', 'columnIndex', 'allowlink', 'isEmpty', 'onCellClick',
  compile('const click = ' + blankSources[0] + ';', cellFile) + ';return click;');

// Load the real ordinary-cell event bridge; only the rendered CellControl is stubbed.
const target: { exports: Record<string, unknown> } = { exports: {} };
const dataCellFile = path.join(root, 'src/pages/worksheet/components/WorksheetTable/components/DataCell.tsx');
const CellControl = () => null;
new Function('module', 'exports', 'require', compile(fs.readFileSync(dataCellFile, 'utf8'), dataCellFile))(
  target, target.exports, (name: string) => {
    if (name === 'lodash') return lodash;
    if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
    if (name === 'worksheet/components/CellControls') return CellControl;
    throw new Error('Unexpected DataCell import: ' + name);
  },
);
const DataCell = target.exports['default'];
if (typeof DataCell !== 'function') throw new Error('Missing actual DataCell');

function fixture(rows: Row[], layout: string, simple = true, allowed = true) {
  const instance: Instance = {
    state: { previewRowIndex: -1, recordVisible: false, isEditCurrentRow: false },
    opened: [], created: 0,
    setState(next) {
      if (next.previewRowIndex !== undefined) this.opened.push(next.previewRowIndex);
      this.state = { ...this.state, ...next };
    },
    openDetail() { throw new Error('Actual openDetail not loaded'); },
    newRow() { this.created++; return { rowid: 'created-row' }; },
  };
  instance.openDetail = openFactory.call(instance);
  const control = { advancedSetting: { sheettype: simple ? '0' : '1' } };
  const click: Click = clickFactory.call(instance, control, rows, layout, allowed, lodash.get, lodash.findIndex);
  function displayedRow(): Row {
    const value: unknown = dataFactory.call(instance, rows, instance.state.previewRowIndex);
    if (!object(value)) throw new Error('Missing actual detail data');
    return value;
  }
  return { instance, click, control, displayedRow };
}
function opened(f: ReturnType<typeof fixture>, index: number, rowid: string) {
  assert.deepEqual(f.instance.opened, [index]);
  assert.equal(f.instance.state.recordVisible, true);
  assert.equal(f.instance.state.isEditCurrentRow, true);
  assert.equal(f.displayedRow().rowid, rowid);
  assert.equal(f.instance.created, 0, 'existing record click must not enter new-row mode');
}
function closed(f: ReturnType<typeof fixture>) {
  assert.deepEqual(f.instance.opened, []);
  assert.equal(f.instance.state.recordVisible, false);
  assert.equal(f.instance.created, 0);
}
const rows: Row[] = [{ rowid: 'first' }, { rowid: 'second' }];
for (const layout of ['horizontal', 'vertical']) {
  const f = fixture(rows, layout);
  f.click({}, { rowid: 'second' }, layout === 'horizontal' ? 1 : 0, layout === 'horizontal' ? 3 : 2);
  opened(f, 1, 'second');
}
// Execute the actual WorksheetTable data projection, blank-cell producer and
// ChildTable consumer against a table containing a filtered template row.
{
  const detailRows: Row[] = [{ rowid: 'first' }, { rowid: 'empty-template' }, { rowid: 'second' }];
  const renderedRows: Row[] = tableDataFactory('query', filterRows, detailRows);
  assert.deepEqual(renderedRows.map(row => row.rowid), ['first', 'second']);
  const f = fixture(detailRows, 'horizontal');
  blankFactory({ type: 'emptyForResize' }, renderedRows[1], 1, 3, '1', lodash.isEmpty, f.click)();
  opened(f, 2, 'second');
}
// A stale coordinate must not override the clicked row's identity in a page or
// visible tree slice; this is a defensive handler case, not a browser replay.
{
  const f = fixture([{ rowid: 'page-b' }, { rowid: 'page-a' }], 'horizontal');
  f.click({}, { rowid: 'page-a' }, 0, 3);
  opened(f, 1, 'page-a');
}
// Actual emptyForResize producer omits columnIndex in its existing horizontal path.
{
  const f = fixture(rows, 'horizontal');
  const click = blankFactory({ type: 'emptyForResize' }, { rowid: 'second' }, 1, 2, '1', lodash.isEmpty, f.click);
  click();
  opened(f, 1, 'second');
}
// Actual DataCell forwards the keyboard options object to the ChildTable callback.
{
  const f = fixture(rows, 'vertical', false);
  const element: unknown = DataCell({ control: { type: 2, controlId: 'text' }, row: { rowid: 'second' }, rowIndex: 0, columnIndex: 2, onCellClick: f.click });
  if (!object(element) || !object(element['props']) || typeof element['props']['onClick'] !== 'function') throw new Error('Missing actual DataCell click');
  element['props']['onClick']({ isSpace: true });
  opened(f, 1, 'second');
}
// Defensive direct calls are not claimed as browser-reachable fixed/vertical cells.
for (const layout of ['horizontal', 'vertical']) {
  for (const index of [undefined, Number.NaN, Infinity, -1, 999]) {
    const f = fixture(rows, layout);
    f.click({}, { rowid: 'second' }, index, index);
    opened(f, 1, 'second');
  }
}
for (const row of [{}, { rowid: '' }, { rowid: 'absent' }, { rowid: 'empty-template' }]) {
  const f = fixture(rows, 'horizontal');
  f.click({}, row, 0, 1);
  closed(f);
}
for (const id of ['temp-1', 'default-1']) {
  const f = fixture([{ rowid: id }], 'horizontal');
  f.click({}, { rowid: id }, 0, 1);
  opened(f, 0, id);
}
{
  const f = fixture(rows, 'horizontal', false);
  f.click({}, rows[0] || {}, 0, 1);
  closed(f);
}
{
  const f = fixture(rows, 'horizontal', true, false);
  f.click({}, rows[0] || {}, 0, 1, { isSpace: true });
  closed(f);
}
console.log('ChildTable record clicks: real callback, openDetail, detail-data expression and cell bridges passed');
