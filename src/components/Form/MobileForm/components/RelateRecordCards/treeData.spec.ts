const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../../../../scripts/spec-harness.ts');

const moduleState: { exports: unknown } = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, 'treeData.ts'), { babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
new Function('module', 'exports', 'require', code)(moduleState, moduleState.exports, require);
interface TestTreeRow { rowid: string; pid?: string; childrenids?: string; addTime?: number; isNewAdd?: boolean; }
const tree = moduleState.exports as {
  getVisibleTreeRows(rows: TestTreeRow[], expanded: ReadonlySet<string>): Array<TestTreeRow & { treeLevel: number; treeNumber: string }>;
  getDefaultExpandedIds(rows: TestTreeRow[], layer: number): Set<string>;
  getTreeChildrenIds(row: TestTreeRow): string[];
};
global.safeParse = (value: unknown, fallback: unknown = {}) => {
  try { return JSON.parse(String(value)); }
  catch { return fallback === 'array' ? [] : fallback; }
};

const rows = [
  { rowid: 'root', childrenids: '["later","earlier"]' },
  { rowid: 'later', pid: 'root', addTime: 2 },
  { rowid: 'earlier', pid: 'root', childrenids: '["root"]', addTime: 1 },
  { rowid: 'independent', childrenids: '{invalid' },
];
// A referenced cycle does not hang or duplicate records; the independent root remains visible.
assert.deepStrictEqual(tree.getVisibleTreeRows(rows, new Set(['root', 'earlier'])).map(row => row.rowid), ['independent']);
const acyclic = rows.map(row => row.rowid === 'earlier' ? { ...row, childrenids: '[]' } : row);
const initial = tree.getDefaultExpandedIds(acyclic, 2);
assert.deepStrictEqual([...initial], ['root']);
assert.deepStrictEqual(tree.getVisibleTreeRows(acyclic, initial).map(row => [row.rowid, row.treeNumber]), [
  ['root', '1'], ['earlier', '1.1'], ['later', '1.2'], ['independent', '2'],
]);
assert.deepStrictEqual(tree.getVisibleTreeRows(acyclic, new Set()).map(row => row.rowid), ['root', 'independent']);
const duplicateReference = [...acyclic, { rowid: 'grandchild', pid: 'earlier', childrenids: '[]' }];
assert.strictEqual(tree.getVisibleTreeRows(duplicateReference, new Set(['root', 'earlier'])).filter(row => row.rowid === 'earlier').length, 1);
assert.strictEqual(acyclic[0]?.childrenids, '["later","earlier"]');
assert.deepStrictEqual(tree.getTreeChildrenIds({ rowid: 'root', childrenids: '[null,"",1,"valid"]' }), ['valid']);
console.log('Mobile relate tree ordering, folding, cycles and malformed children passed');

// Exercise the real card controller's tree branch and server calls with its UI boundaries stubbed.
const React = require('react');
const treeSection = () => null;
const apiCalls: Array<{ operation: string; args: Record<string, unknown> }> = [];
const fieldApi = {
  getRowRelationRows: (args: Record<string, unknown>) => {
    apiCalls.push({ operation: 'children', args });
    return Promise.resolve({ data: [{ rowid: 'lazy-child' }] });
  },
  updateRowRelationRows: (args: Record<string, unknown>) => {
    apiCalls.push({ operation: 'save', args });
    return Promise.resolve(true);
  },
};
const stubs: Record<string, unknown> = {
  './recordLoading': { shouldLoadInitialRecords: () => true, shouldReloadInitialRecords: () => false },
  './treeData': tree, './RelateTreeSection': treeSection,
  './RecordCoverCard': () => null, './RecordTag': () => null,
  'ming-ui': { Icon: () => null }, 'ming-ui/components/AutoSize': (component: unknown) => component,
  'src/api/worksheet': fieldApi, 'mobile/components/RecordCardListDialog': {}, 'mobile/Record': {}, 'mobile/RecordList/SheetRows': {},
  'worksheet/components/ChildTable/ChildTableContext': React.createContext({ rows: [] }),
  'src/components/Form/core/config': { FROM: { H5_ADD: 2, H5_EDIT: 3, RECORDINFO: 1, DRAFT: 21, SHARE: 6 } },
  'src/components/Form/MobileForm/components/ScanQRCode': {}, 'src/pages/worksheet/common/newRecord/MobileNewRecord': () => null,
  'src/pages/worksheet/common/WorkSheetFilter/util': {}, 'src/utils/app': { getTranslateInfo: () => ({}) },
  'src/utils/control': { completeControls: (value: unknown) => value, controlState: () => ({ editable: true, visible: true }) },
  'src/utils/project': {}, 'src/utils/translate': { replaceControlsTranslateInfo: (_app: unknown, _sheet: unknown, controls: unknown) => controls },
  'src/utils/domain/control/value': {}, 'src/utils/services/request/error': { alertIfNotUnauthorized: () => {} },
  '../../tools/utils': {}, '../ChildTable/SearchInput': () => null, '../RelateScanQRCode': () => null,
};
const controllerModule: { exports: unknown } = { exports: {} };
const controllerCode = transformFileSync(path.join(__dirname, 'index.tsx'), { babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
new Function('module', 'exports', 'require', controllerCode)(controllerModule, controllerModule.exports, (request: string) => stubs[request] || require(request));
interface ControllerState { records: TestTreeRow[]; count: number; controls: unknown[]; [key: string]: unknown; }
interface Controller {
  props: { control: Record<string, unknown>; [key: string]: unknown }; state: ControllerState;
  setState(update: unknown, callback?: () => void): void;
  renderRecordsCon(): { type: unknown };
  loadTreeChildren(row: TestTreeRow): Promise<TestTreeRow[]>;
  handleAdd(rows: TestTreeRow[]): void; handleDelete(row: TestTreeRow): void;
}
const Cards = (controllerModule.exports as { default: new (props: unknown) => Controller }).default;
global._l = (value: string) => value;
global.alert = () => {};
global.window = { isPublicWorksheet: false };
async function verifyController(): Promise<void> {
  let changed = 0;
  const cards = new Cards({ appId: 'app', count: 1, records: [{ rowid: 'root' }], multiple: true, editable: true,
    onChange: () => changed++, control: { appId: 'app', worksheetId: 'sheet', recordId: 'record', controlId: 'relate',
      dataSource: 'related-sheet', enumDefault: 2, from: 1, showRelateRecordEmpty: true,
      relationControls: [], advancedSetting: { showtype: '6', layercontrolid: 'parent' } } });
  cards.setState = (update, callback) => {
    const change = (typeof update === 'function' ? update(cards.state) : update) as Partial<ControllerState>;
    cards.state = { ...cards.state, ...change };
    callback?.call(cards);
  };
  assert.strictEqual(cards.renderRecordsCon().type, treeSection);
  const children = await cards.loadTreeChildren({ rowid: 'root' });
  assert.strictEqual(children[0]?.pid, 'root');
  assert.deepStrictEqual(apiCalls[0]?.args['fastFilters'], [{ controlId: 'rowid', value: 'root' }]);
  cards.handleAdd([{ rowid: 'added' }]);
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(apiCalls[1]?.args['isAdd'], true);
  assert.strictEqual(cards.state.records.find(row => row.rowid === 'added')?.isNewAdd, false);
  assert.strictEqual(changed, 0);
  cards.handleDelete({ rowid: 'root' });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(apiCalls[2]?.args['isAdd'], false);
  assert.strictEqual(cards.state.records.find(row => row.rowid === 'lazy-child')?.pid, '');
  cards.props.control['from'] = 3;
  cards.handleAdd([{ rowid: 'draft-add' }]);
  assert.strictEqual(apiCalls.length, 3);
  assert.strictEqual(changed, 1);
  console.log('Mobile relate tree render, child loading and direct/draft save passed');
}
verifyController().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
