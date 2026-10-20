/** Complete action dropdown/dialogs and real rule helpers; only UI leaves and hook/DOM scheduling are controlled. */
import type { SpecHarness } from '../spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const harness: SpecHarness = require('../spec-harness.ts');
const React: typeof import('react') = require('react');
const root = path.resolve(__dirname, '../..');
const target = 'src/pages/FormSet/components/columnRules/config.ts';
const beforeRev = '2f199e68f48ba83793def5b9493ff126ff326a7f';
const source = (relative: string, historical = false): string =>
  historical && beforeRev
    ? cp.execFileSync('git', ['show', beforeRev + ':' + relative], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, relative), 'utf8');

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid fixture object');
  return value[key];
}

function selected(relative: string, names: string[]): string {
  const text = source(relative);
  const parsed = harness.parser.parse(text, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  return names
    .map(name => {
      const node = parsed.program.body.find(statement => {
        const d = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
        return d?.type === 'FunctionDeclaration'
          ? d.id?.name === name && !!d.body
          : d?.type === 'VariableDeclaration' &&
              d.declarations.some(v => v.id.type === 'Identifier' && v.id.name === name);
      });
      assert.ok(node?.start != null && node.end != null, name);
      const raw = text.slice(node.start, node.end);
      return raw.startsWith('export ') ? raw : 'export ' + raw;
    })
    .join('\n');
}

const globals = source('src/common/global.ts');
const globalWindow: Record<string, unknown> = {};

for (const name of ['_l', 'safeParse']) {
  const begin = globals.indexOf('window.' + name + ' =');
  const end = globals.indexOf('\n};', begin);
  assert.ok(begin >= 0 && end > begin);
  new Function('window', 'console', harness.transformSync(globals.slice(begin, end + 3), { filename: target }).code)(
    globalWindow,
    { error: () => {} },
  );
}

const alerts: unknown[][] = [];
const dom: string[] = [];

function jquery(selector: string) {
  let text = '';
  const node = {
    0: { getBoundingClientRect: () => ({ width: text.length * 7.2 }) },
    text(value: string) {
      text = value;
      return node;
    },
    css() {
      return node;
    },
    append() {
      dom.push(selector);
      return node;
    },
    remove() {
      dom.push('remove');
    },
  };
  return node;
}

function load(text: string, dependencies: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const env = {
    _l: globalWindow['_l'],
    safeParse: globalWindow['safeParse'],
    $: jquery,
    alert: (...args: unknown[]) => alerts.push(args),
    console: { log: () => {}, error: () => {} },
    ...extra,
  };
  const code = harness.transformSync(text, {
    filename: target + 'x',
    presets: ['@babel/preset-react'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module', 'exports', 'require', ...Object.keys(env), code)(
    module,
    module.exports,
    (name: string): unknown => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (['lodash', 'moment', 'react', 'react/jsx-runtime'].includes(name) || name.startsWith('@babel/runtime/'))
        return require(name);
      throw new Error('Unexpected dependency ' + name);
    },
    ...Object.values(env),
  );
  return module.exports;
}

const widget = load(
  selected('src/pages/widgetConfig/config/widget.ts', [
    'WIDGETS_TO_API_TYPE_ENUM',
    'ROW_ID_CONTROL',
    'SYSTEM_DATE_CONTROL',
    'SYSTEM_CONTROL',
    'WORKFLOW_SYSTEM_CONTROL',
    'SYS',
    'ALL_SYS',
    'NORMAL_CONTROLS',
    'SYS_CONTROLS',
  ]),
);
const advanced = load(source('src/utils/advancedSettingBoundary.ts'));
const common = load(
  'import _, {get} from "lodash";\n' +
    selected('src/utils/controlCommon.ts', ['getAdvanceSetting', 'getDatePickerConfigs']),
  {},
  advanced,
);
const defaults = load(selected('src/components/Form/core/enum.ts', ['DEFAULT_TEXT']));
const switchNames = load(selected('src/utils/control.ts', ['getSwitchItemNames']), {}, { ...common, ...defaults });
const widgetUtils = load(
  'import _, {includes,get} from "lodash";\n' +
    selected('src/pages/widgetConfig/util/index.ts', ['isSheetDisplay', 'isCustomWidget']),
);
// Icon lookup is a controlled dependency; OCR whitelist behavior belongs to the target itself.
widgetUtils['getIconByType'] = (type: unknown) => 'fixture-icon-' + String(type);
const names = load('import _ from "lodash";\n' + selected('src/utils/common.ts', ['getUnUniqName']));
const enums = load(source('src/pages/worksheet/common/WorkSheetFilter/enum.ts'));
const filterBoundary = load(source('src/pages/worksheet/common/WorkSheetFilter/filterModelBoundary.ts'));
const filterUtils = load(source('src/pages/worksheet/common/WorkSheetFilter/util.ts'), {
  'src/pages/widgetConfig/config/widget': widget,
  'src/pages/widgetConfig/util/setting.js': common,
  'src/utils/common': {},
  'src/utils/control': {},
  'src/utils/project': {},
  'src/utils/subListStoreTypes': {},
  './enum': enums,
  './filterModelBoundary': filterBoundary,
});
const imports = {
  'pages/widgetConfig/config/widget': widget,
  uuid: { v4: () => 'fixture-rule-uuid' },
  'src/pages/widgetConfig/util': widgetUtils,
  'src/pages/widgetConfig/util/setting': common,
  'src/pages/worksheet/common/WorkSheetFilter/enum.js': enums,
  'src/pages/worksheet/common/WorkSheetFilter/util.js': filterUtils,
  'src/utils/common': names,
  'src/utils/control': switchNames,
};

const hashes = {
  'src/pages/FormSet/components/columnRules/config.ts':
    '41f7c9c9c0407f9a972f2babf054fb72116200c6d3e9cb727853c59f9a1fa1fc',
  'src/pages/FormSet/components/columnRules/actionDropdown/ActionDropDown.tsx':
    'af71217748f33fff180e1d57e5e130e6a8760bf968cf0ce69f57216dcb479d86',
  'src/pages/FormSet/components/columnRules/actionDropdown/SettingDialog.tsx':
    'ee85a491a0330c3a885f7c2e2cb78c6a84948d65d58866c73d09b037b808d4dd',
  'src/pages/FormSet/components/columnRules/actionDropdown/StyleSettingDialog.tsx':
    'ccdc3c01ef0e37c810571ff8cd7e7d422eb140b1f8b59081acad5b816953189d',
  'src/pages/FormSet/components/columnRules/RuleItem.tsx':
    'de2f23f8d63ea39dcfee9d740961406343fbde78baa6fe9ffe947916b665fa28',
};
const files = Object.keys(hashes);
const old = {},
  current = {};

for (const file of files) {
  old[file] = source(file, true);
  assert.equal(require('node:crypto').createHash('sha256').update(old[file]).digest('hex'), hashes[file]);
  current[file] = source(file);
}

const [CONFIG, DROP, SETTING, STYLE] = files;
const compiled = new Map<string, string>();

function compile(text, file) {
  const key = file + text;
  if (!compiled.has(key))
    compiled.set(key, harness.transformSync(text, { filename: path.join(root, file), comments: false }).code);
  return compiled.get(key);
}

const leaves = new Map();

function leaf(name) {
  if (!leaves.has(name)) {
    const C = () => null;
    C.displayName = name;
    leaves.set(name, C);
  }

  return leaves.get(name);
}

function nodeName(type: unknown): unknown {
  return typeof type === 'string' ? type : object(type) ? read(type, 'displayName') || read(type, 'name') : 'Fragment';
}

function nodes(value, name) {
  if (Array.isArray(value)) return value.flatMap(n => nodes(n, name));
  if (!React.isValidElement<Record<string, unknown>>(value)) return [];
  const found = nodeName(value.type) === name;
  return [...(found ? [value] : []), ...nodes(value.props.children, name)];
}

function tree(value) {
  if (typeof value === 'function') return '[function]';
  if (React.isValidElement<Record<string, unknown>>(value))
    return {
      type: nodeName(value.type) || 'Fragment',
      key: value.key,
      props: Object.fromEntries(Object.entries(value.props).map(([k, v]) => [k, tree(v)])),
    };
  if (Array.isArray(value)) return value.map(tree);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, tree(v)]));
  return value;
}

function host(version = 'current', patches = {}) {
  const text = version === 'old' ? old : current;
  const config = load(text[CONFIG], imports);
  const events = [],
    dialogs = [],
    sessions = [];
  let active;
  const hooks = {
    ...React,
    useState(initial) {
      const h = active,
        i = h.cursor++;
      if (!(i in h.states)) h.states[i] = typeof initial === 'function' ? initial() : initial;
      return [
        h.states[i],
        update => {
          h.states[i] = typeof update === 'function' ? update(h.states[i]) : update;
        },
      ];
    },
    useEffect(fn, deps) {
      const h = active,
        i = h.cursor++;

      if (!h.deps[i] || deps.length !== h.deps[i].length || deps.some((v, j) => !Object.is(v, h.deps[i][j]))) {
        h.deps[i] = deps;
        h.effects.push(fn);
      }
    },
  };

  function dialog(Comp, props) {
    const h = {
      states: [],
      deps: [],
      effects: [],
      cursor: 0,
      props,
      render() {
        active = h;
        h.cursor = 0;
        try {
          return Comp(h.props);
        } finally {
          active = undefined;
        }
      },
      flush() {
        h.effects.splice(0).forEach(fn => fn());
      },
    };
    sessions.push(h);
    return h;
  }

  const modules = {};

  function moduleFor(file) {
    if (modules[file]) return modules[file];
    const m = { exports: {} };
    new Function('module', 'exports', 'require', '_l', compile(text[file], file))(
      m,
      m.exports,
      name => {
        if (name === 'react') return hooks;
        if (['react/jsx-runtime', 'react-redux', 'lodash', 'classnames', 'prop-types'].includes(name))
          return require(name);
        if (name === '../config') return config;
        if (name === './SettingDialog') return moduleFor(SETTING);
        if (name === './StyleSettingDialog') return moduleFor(STYLE);
        if (name === '@rc-component/trigger') return leaf('Trigger');
        if (name === 'ming-ui')
          return Object.fromEntries(['Checkbox', 'Icon', 'Dialog', 'Switch'].map(n => [n, leaf(n)]));
        if (name === 'ming-ui/antd-components') return { Tooltip: leaf('Tooltip') };
        if (name === 'styled-components')
          return { __esModule: true, default: { div: () => leaf('SectionConfirmWrap') } };
        if (name === 'ming-ui/components/FunctionWrap')
          return {
            __esModule: true,
            default: (Comp, props) => {
              const session = dialog(Comp, props);
              dialogs.push({ Comp, props, session });
              return session;
            },
          };
        if (name === 'src/pages/widgetConfig/widgetSetting/components/StyleContent/StyleContentItems')
          return { CardItem: leaf('CardItem') };
        if (name.endsWith('.less')) return {};
        throw Error('Unexpected action dependency ' + name);
      },
      globalWindow['_l'],
    );
    modules[file] = m.exports;
    return m.exports;
  }

  const Dropdown = moduleFor(DROP).default;
  const props = {
    values: [],
    dropDownData: fields(),
    from: 'rule',
    actionType: 1,
    onChange: (...args) => events.push(args),
    ...patches,
  };
  const item = new Dropdown(props);

  item.setState = (update, callback) => {
    item.state = { ...item.state, ...(typeof update === 'function' ? update(item.state, item.props) : update) };
    callback?.();
  };

  return {
    item,
    events,
    dialogs,
    config,
    props,
    setting(patch = {}) {
      return moduleFor(SETTING).default({
        data: fields(),
        values: [{ controlId: 'sub', childControlIds: [] }],
        id: 'sub',
        actionType: 3,
        onChange: (...args) => events.push(args),
        ...patch,
      });
    },
    style(patch = {}) {
      return moduleFor(STYLE).default({
        data: fields(),
        values: [{ controlId: 'rel' }],
        id: 'rel',
        onChange: (...args) => events.push(args),
        onClose: () => events.push(['close']),
        ...patch,
      });
    },
    finish() {
      item.handleSearch.cancel();
    },
  };
}

function fields() {
  return [
    { controlId: 'first', controlName: 'A+B', type: 2 },
    {
      controlId: 'sub',
      controlName: 'Subtable',
      type: 34,
      showControls: ['child', 'child2'],
      relationControls: [
        { controlId: 'child', controlName: 'Nested target', type: 2 },
        { controlId: 'child2', controlName: 'Second', type: 6 },
      ],
    },
    {
      controlId: 'rel',
      controlName: 'Related',
      type: 29,
      advancedSetting: { showtype: '2' },
      showControls: ['nested'],
      relationControls: [{ controlId: 'nested', controlName: 'Linked target', type: 2 }],
    },
    { controlId: 'tab', controlName: 'Tab', type: 52 },
    { controlId: 'tabField', controlName: 'In tab', type: 2, sectionId: 'tab' },
    { controlId: 'formula', controlName: 'Formula', type: 31 },
  ];
}

module.exports = { BASE: beforeRev, files, old, current, compile, host, fields, nodes, tree };
