const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { transformSync } = require('../../../../../scripts/spec-harness.ts');
const React = require('react');
const root = path.resolve(__dirname, '../../../../..');
const file = 'src/pages/worksheet/components/ChildTable/RowDetail.tsx';
global.window = {};
const CustomFields = () => null;
interface ElementFixture {
  type: unknown;
  props: Record<string, unknown>;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findForm(value: unknown): ElementFixture | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findForm(child);
      if (found) return found;
    }
  } else if (object(value) && object(value['props'])) {
    if (value['type'] === CustomFields) return { type: CustomFields, props: value['props'] };
    return findForm(value['props']['children']);
  }

  return undefined;
}

interface Instance {
  render(): unknown;
  handleChange(): void;
  customwidget: { current: unknown };
}
function load(source: string): new (props: Record<string, unknown>) => Instance {
  const target = { exports: {} as Record<string, unknown> };
  const imports: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-redux': { shallowEqual: require('react-redux').shallowEqual },
    lodash: require('lodash'),
    'prop-types': require('prop-types'),
    'worksheet/common/recordInfo/RecordInfoContext': React.createContext({}),
    'src/components/Form': CustomFields,
    'src/utils/control': { isRelateRecordTableControl: () => false },
  };
  new Function('module', 'exports', 'require', transformSync(source, { filename: path.join(root, file) }).code)(
    target,
    target.exports,
    (name: string) => {
      if (name in imports) return imports[name];
      throw new Error('Unstubbed row detail import: ' + name);
    },
  );
  return target.exports['default'] as new (props: Record<string, unknown>) => Instance;
}

function scenario(Component: ReturnType<typeof load>, type: number, value: unknown, rowid: string) {
  const saved: unknown[] = [];
  const uniqueCalls: unknown[][] = [];
  const instance = new Component({
    controls: [
      { controlId: 'field', type, fieldPermission: '111' },
      { controlId: 'ownerid', type: 26 },
    ],
    data: { rowid, field: value, rqfield: 7 },
    from: 3,
    getMasterFormData: () => [],
    handleUniqueValidate: (...args: unknown[]) => {
      uniqueCalls.push(args);
      return false;
    },
    onSave: (...args: unknown[]) => saved.push(args),
  });
  const form = findForm(instance.render());
  if (!form) throw new Error('Missing actual row form');
  const fields = form.props['data'];
  if (!Array.isArray(fields) || !object(fields[0])) throw new Error('Missing projected control');
  assert.equal(fields.length, 1, 'owner system fields remain hidden');
  assert.equal(fields[0]['count'], 7);
  const unique = form.props['checkCellUnique'];
  if (typeof unique !== 'function') throw new Error('Missing unique validator');
  assert.equal(unique('field', 'candidate'), false, 'unique-check result is forwarded');
  assert.deepEqual(uniqueCalls[0]?.slice(0, 3), ['field', 'candidate', rowid]);
  instance.customwidget.current = {
    getSubmitData: () => ({ fullData: [{ controlId: 'field', value: 'edited' }] }),
    dataFormat: { getUpdateControlIds: () => ['field'] },
  };
  instance.handleChange();
  assert.deepEqual(saved, [[{ rowid, field: 'edited', rqfield: 7, empty: false }, ['field']]]);
  return { fields, recordId: form.props['recordId'], from: form.props['from'], uniqueResult: false, saved };
}

const before = load(execFileSync('git', ['show', 'c1c74ba4d:' + file], { cwd: root, encoding: 'utf8' }));
const after = load(fs.readFileSync(path.join(root, file), 'utf8'));
const functionValue = Object.assign(() => {}, { text: 'function text' });
const values: unknown[] = [
  undefined,
  null,
  '',
  'raw',
  0,
  12,
  false,
  [],
  {},
  { value: 'raw' },
  { text: 'shown', value: 'raw' },
  functionValue,
];
let cases = 0;

for (const type of [2, 19, 23, 24]) {
  for (const value of values) {
    for (const rowid of ['existing-row', 'temp-row']) {
      assert.deepEqual(scenario(after, type, value, rowid), scenario(before, type, value, rowid));
      cases++;
    }
  }
}

console.log('Row detail: ' + cases + ' production projection, save and unique-callback comparisons passed');
