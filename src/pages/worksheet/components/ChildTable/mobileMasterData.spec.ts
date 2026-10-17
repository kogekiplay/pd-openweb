const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { transformSync } = require('../../../../../scripts/spec-harness.ts');
const React = require('react');
const lodash = require('lodash');
const root = path.resolve(__dirname, '../../../../..');
const file = 'src/pages/worksheet/components/ChildTable/MobileTable.tsx';
global._l = (text: string) => text;
global.md = { global: { Account: { projects: [{ projectId: 'project' }] } } };
global.safeParse = (value: string) => JSON.parse(value || '[]');

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface ElementFixture {
  type: unknown;
  props: Record<string, unknown>;
}
function findElement(value: unknown, type: unknown): ElementFixture | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findElement(child, type);
      if (found) return found;
    }
  } else if (object(value) && object(value['props'])) {
    if (value['type'] === type) return { type, props: value['props'] };
    return findElement(value['props']['children'], type);
  }

  return undefined;
}

function load(source: string, filename: string, imports: Record<string, unknown>) {
  const target = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', 'require', transformSync(source, { filename: path.join(root, filename) }).code)(
    target,
    target.exports,
    (name: string) => {
      if (name in imports) return imports[name];
      throw new Error('Unstubbed master-data import: ' + name);
    },
  );
  return target.exports['default'];
}

const CellControl = () => null;
const CustomFields = () => null;
const tableImports = {
  react: {
    Fragment: React.Fragment,
    useState: (value: unknown) => [value, () => {}],
    useEffect() {},
    useRef: (current: unknown) => ({ current }),
  },
  'react/jsx-runtime': require('react/jsx-runtime'),
  'antd-mobile': { ActionSheet: {}, Button: () => null },
  classnames: require('classnames'),
  lodash,
  'prop-types': require('prop-types'),
  'styled-components': { div: () => () => null },
  'ming-ui': { Icon: () => null },
  'worksheet/components/CellControls': CellControl,
  'src/components/Form': CustomFields,
  'src/components/Form/core/formUtils/updateRulesData': { updateRulesData: ({ data }: { data: unknown }) => data },
  'src/utils/control': { getAdvanceSetting: () => ({}), isRelateRecordTableControl: () => false },
};
interface MasterFixture {
  worksheetId: string;
  formData: Array<{ controlId: string; value: string }>;
}
function renderTable(source: string, h5showtype: string, provider: () => MasterFixture) {
  const Table = load(source, file, tableImports) as (props: Record<string, unknown>) => unknown;
  return Table({
    controls: [{ controlId: 'role', type: 48, value: '[]', fieldPermission: '111' }],
    rows: [{ rowid: 'row', role: '[]' }],
    isEdit: true,
    h5showtype,
    masterData: provider,
    cellErrors: {},
    controlPermission: { editable: true },
  });
}

function selectWithRealConsumer(kind: 'OrgRole' | 'Department', passed: Record<string, unknown>) {
  const ranges: unknown[] = [];
  const opened: unknown[] = [];
  const filename = 'src/pages/worksheet/components/CellControls/' + kind + '.tsx';
  const Component = load(fs.readFileSync(path.join(root, filename), 'utf8'), filename, {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-redux': { shallowEqual: require('react-redux').shallowEqual },
    classnames: require('classnames'),
    lodash,
    'prop-types': require('prop-types'),
    '@rc-component/trigger': () => null,
    'ming-ui/components/ClickAway': () => null,
    'ming-ui/functions': {
      quickSelectRole: (_target: unknown, options: unknown) => opened.push(options),
      quickSelectDept: (_target: unknown, options: unknown) => opened.push(options),
    },
    'src/components/DisabledDepartmentAndRoleName': () => null,
    'src/components/Form/DesktopForm/widgets/DepartmentSelect/DepartmentTooltip': () => null,
    'src/components/Form/core/utils': {
      dealRenderValue: (value: unknown) => value,
      dealUserRange: (_cell: unknown, _row: unknown, master: unknown) => {
        ranges.push(master);
        return { appointedOrganizeIds: ['allowed'], appointedDepartmentIds: ['allowed'] };
      },
    },
    '../EditableCellCon': () => null,
  }) as new (props: Record<string, unknown>) => {
    cell: { current: unknown };
    handleSelect(): void;
    selectDepartments(event: unknown): void;
  };
  const instance = new Component({ ...passed, projectId: 'project', cell: { value: '[]', enumDefault: 0 } });
  instance.cell.current = {};
  if (kind === 'OrgRole') instance.handleSelect();
  else instance.selectDepartments({});
  assert.equal(opened.length, 1);
  return ranges;
}

const original = execFileSync('git', ['show', 'c1c74ba4d:' + file], { cwd: root, encoding: 'utf8' });
const current = fs.readFileSync(path.join(root, file), 'utf8');

for (const source of [original, current]) {
  for (const layout of ['1', '2']) {
    let calls = 0;
    let master: MasterFixture = { worksheetId: 'master', formData: [{ controlId: 'range', value: 'before' }] };

    const provider = () => {
      calls++;
      return master;
    };

    const tree = renderTable(source, layout, provider);
    assert.equal(calls, 0, 'rendering forwards the lazy master provider without invoking it');
    const node = findElement(tree, layout === '2' ? CustomFields : CellControl);
    if (!node) throw new Error('Missing mobile child content');
    assert.equal(node.props['masterData'], provider, 'both layouts preserve the provider identity');
    master = { ...master, formData: [{ controlId: 'range', value: 'after-render' }] };
    if (layout === '1') {
      for (const kind of ['OrgRole', 'Department'] as const) {
        assert.deepEqual(selectWithRealConsumer(kind, node.props), [master], 'real selector sees latest master values');
      }
    }
  }
}

const broken = execFileSync('git', ['show', '2351d0842:' + file], { cwd: root, encoding: 'utf8' });
const brokenNode = findElement(
  renderTable(broken, '1', () => ({ worksheetId: 'master', formData: [] })),
  CellControl,
);
if (!brokenNode) throw new Error('Missing historical mobile cell');
assert.throws(() => selectWithRealConsumer('OrgRole', brokenNode.props), /masterData is not a function/);
console.log(
  'Mobile child master provider: production parity, lazy forwarding and real role/department selectors passed',
);
