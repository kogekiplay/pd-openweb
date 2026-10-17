/** Actual complete class + historical class; leaf UI, host and state scheduling are isolated. No mount/network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const parser = require('@babel/parser');
const { ROOT, transformSync } = require('../../../../scripts/spec-harness.ts');
const React = require('react');
const lodash = require('lodash');
const BASE = '05d9de4338116660a496297d0d23aa595df3d0b2';
const REL = 'src/pages/FormExtend/PublicWorksheetConfig/PublicWorksheetConfigForm.tsx';
const old = execFileSync('git', ['show', `${BASE}:${REL}`], { cwd: ROOT, encoding: 'utf8' });
assert.equal(
  crypto.createHash('sha256').update(old).digest('hex'),
  '0e31d3bfc536772b15051b2957cebb8d43c65b776dc91f8c9716cac646c61f32',
);
const current = fs.readFileSync(path.join(ROOT, REL), 'utf8');
const compile = (source, file = REL) =>
  transformSync(source, { filename: path.join(ROOT, file), comments: false, compact: true }).code;
const parse = source => parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
function declaration(source, name) {
  const item = parse(source).program.body.find(item => {
    const n = item.type === 'ExportNamedDeclaration' ? item.declaration : item;
    return n && (n.id?.name === name || n.declarations?.some(d => d.id.name === name));
  });
  assert.ok(item, name);
  return source.slice(item.start, item.end).replace(/^export /, '');
}
const globals = fs.readFileSync(path.join(ROOT, 'src/common/global.ts'), 'utf8');
const safeNode = parse(globals).program.body.find(
  n => n.expression?.left?.object?.name === 'window' && n.expression.left.property?.name === 'safeParse',
);
assert.ok(safeNode);
const host: { safeParse?: (value: unknown) => unknown } = {};
new Function('window', 'console', compile(globals.slice(safeNode.start, safeNode.end), 'src/common/global.ts'))(host, {
  error() {},
});
const realSafeParse = host.safeParse;
const modules = new Map();
const leaves = new Map();
function realModule(rel) {
  if (modules.has(rel)) return modules.get(rel);
  const mod = { exports: {} };
  new Function(
    'module',
    'exports',
    'require',
    '_l',
    'safeParse',
    compile(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel),
  )(
    mod,
    mod.exports,
    name => {
      if (name.endsWith('.png')) return name;
      if (name === './enum') return realModule('src/pages/FormExtend/enum.ts');
      if (name === './pageConfig') return realModule('src/pages/FormExtend/pageConfig.ts');
      if (name === './PublicWorksheetConfig/CountDown') return leaf('CountDown');
      if (name === 'worksheet/constants/enum') {
        const source = fs.readFileSync(path.join(ROOT, 'src/pages/worksheet/constants/enum.ts'), 'utf8');
        return {
          RELATION_SEARCH_SHOW_TYPE: new Function(
            compile(declaration(source, 'RELATION_SEARCH_SHOW_TYPE')) + ';return RELATION_SEARCH_SHOW_TYPE',
          )(),
        };
      }
      if (['react', 'react/jsx-runtime', 'lodash', 'moment'].includes(name)) return require(name);
      throw Error(`Uncontrolled real helper dependency: ${name}`);
    },
    x => x,
    realSafeParse,
  );
  modules.set(rel, mod.exports);
  return mod.exports;
}
const header = realModule('src/pages/FormExtend/headerConfig.ts');
const page = realModule('src/pages/FormExtend/pageConfig.ts');
const utils = realModule('src/pages/FormExtend/utils.tsx');
function leaf(name) {
  if (!leaves.has(name)) {
    const component = () => null;
    component.displayName = name;
    leaves.set(name, component);
  }
  return leaves.get(name);
}
function load(source, safeParse = realSafeParse) {
  const events = [];
  const win: { open: (url: string) => number; scrollToFormEnd?: () => void } = {
    open: url => events.push(['open', url]),
  };
  let styleIndex = 0;
  // Styled leaves preserve the returned JSX tree; style callbacks are checked separately for erasure.
  const styled = { div: () => leaf(`styled-${styleIndex++}`) };
  // The class is compiled dynamically from the actual source; this is a harness binding, not a product DTO.
  const mod: { exports: Record<string, any> } = { exports: {} };
  const fixedMath = Object.create(Math);
  fixedMath.random = () => 0.4;
  const factory = source.replace(
    'export default connect(mapStateToProps, mapDispatchToProps)(PublicWorksheetConfigForm);',
    'export { PublicWorksheetConfigForm };',
  );
  assert.notEqual(factory, source);
  new Function('module', 'exports', 'require', '_l', 'safeParse', 'window', '$', 'Math', compile(factory))(
    mod,
    mod.exports,
    name => {
      if (
        ['react', 'react/jsx-runtime', 'redux', 'lodash', 'classnames', 'prop-types', '@ant-design/colors'].includes(
          name,
        )
      )
        return require(name);
      if (name === 'react-redux') return { connect: () => Component => Component };
      if (name === 'styled-components') return { default: styled, __esModule: true };
      if (name === '@rc-component/trigger') return leaf('Trigger');
      if (name === 'ming-ui')
        return Object.fromEntries(
          ['Icon', 'Menu', 'MenuItem', 'RichText', 'ScrollView', 'Skeleton'].map(x => [x, leaf(x)]),
        );
      if (name === 'worksheet/components/Basics')
        return Object.fromEntries(['Absolute', 'BlackBtn', 'FormTopImgCon', 'Hr'].map(x => [x, leaf(x)]));
      if (name === 'src/utils/common') return { pathCompletion: url => url };
      if (name === 'src/utils/controlCommon')
        return {
          getRgbaByColor() {
            throw Error('Styled callback should not run in leaf test');
          },
        };
      if (name === '../headerConfig') return header;
      if (name === '../pageConfig') return page;
      if (name === '../utils') return utils;
      if (name === '../PublicWorksheetConfig/redux/actions') return {};
      if (name.startsWith('./')) return leaf(name);
      throw Error(`Uncontrolled component dependency: ${name}`);
    },
    x => x,
    safeParse,
    win,
    () => ({ find: () => ({ scrollTop: y => events.push(['scroll', y]) }) }),
    fixedMath,
  );
  return { Component: mod.exports.PublicWorksheetConfigForm, win, events };
}
function setup(
  source,
  metadata = {},
  info = {},
  options: { safeParse?: (value: unknown) => unknown; props?: Record<string, unknown> } = {},
) {
  const loaded = load(source, options.safeParse);
  const events = loaded.events;
  const settings = { marker: 'keep-settings', extendDatas: metadata };
  const originalControls = [
    { controlId: 'name', type: 2, row: 0, col: 0, controlPermissions: '111' },
    { controlId: 'hidden', type: 2, row: 1, col: 0, controlPermissions: '111' },
  ];
  const props = {
    worksheetInfo: { worksheetId: 'sheet', name: 'Title', desc: 'Description', submitBtnName: 'Submit', ...info },
    worksheetSettings: settings,
    shareUrl: '/public?id=1',
    controls: undefined,
    originalControls,
    loading: false,
    hidedControlIds: ['hidden'],
    updateSettings: value => events.push(['save', value]),
    updateWorksheetInfo: value => events.push(['info', value]),
    changeControls: value => events.push(['controls', value]),
    onHideControl: value => events.push(['hide', value]),
    ...options.props,
  };
  const instance = new loaded.Component(props);
  instance.setState = patch => {
    events.push(['state', patch]);
    instance.state = { ...instance.state, ...patch };
  };
  return { ...loaded, instance, props, settings, events };
}
function nodes(value, name) {
  if (Array.isArray(value)) return value.flatMap(x => nodes(x, name));
  if (!React.isValidElement(value)) return [];
  const label = typeof value.type === 'string' ? value.type : value.type.displayName;
  return (label === name ? [value] : []).concat(...Object.values(value.props).map(x => nodes(x, name)));
}
function tree(value) {
  if (typeof value === 'function') return '[callback]';
  if (Array.isArray(value)) return value.map(tree);
  if (React.isValidElement(value))
    return {
      type:
        typeof value.type === 'string'
          ? value.type
          : value.type === React.Fragment
            ? 'Fragment'
            : value.type.displayName,
      key: value.key,
      props: tree(value.props),
    };
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Reflect.ownKeys(value)
        .filter(k => Object.prototype.propertyIsEnumerable.call(value, k))
        .map(k => [k, tree(value[k])]),
    );
  return value;
}
let checks = 0;
function check(name, fn) {
  fn();
  console.log(`  PASS ${name}`);
  checks++;
}

check('complete real render preserves normal/default/extension header JSX and callbacks', () => {
  for (const visibleHeaders of [
    undefined,
    '[]',
    '["logo"]',
    '["title","description"]',
    '["unknown","logo"]',
    '[null,7,{"extension":true},"title"]',
  ])
    for (const loading of [false, true])
      for (const logoUrl of [undefined, '', '/logo.png']) {
        const meta = {
          visibleHeaders,
          other: 'keep',
          pageConfigs: '[{"layout":2,"themeBgColor":"#abcdef","cover":"/cover.png"}]',
        };
        const a = setup(old, meta, { logoUrl }, { props: { loading } });
        const b = setup(current, meta, { logoUrl }, { props: { loading } });
        assert.deepEqual(tree(b.instance.render()), tree(a.instance.render()));
        assert.deepEqual(b.events, a.events);
        assert.deepEqual(b.instance.state, a.instance.state);
      }
});
check('real add-header callback preserves extension values, save payload and source array', () => {
  for (const headers of [[], ['title'], [null, 7, { x: 1 }, 'unknown']]) {
    const run = source => {
      const s = setup(
        source,
        { visibleHeaders: 'fixture', extra: 'preserve' },
        {},
        { safeParse: value => (value === 'fixture' ? headers : realSafeParse(value)) },
      );
      const root = s.instance.renderAddHeader();
      nodes(root, 'MenuItem')[0].props.onClick();
      const saved = s.events[0][1];
      assert.equal(saved.extendDatas.extra, 'preserve');
      assert.equal(saved.marker, 'keep-settings');
      assert.notEqual(saved, s.settings);
      assert.notEqual(saved.extendDatas, s.settings.extendDatas);
      return { payload: saved, keys: Reflect.ownKeys(headers) };
    };
    assert.deepEqual(run(current), run(old));
  }
});
check('real hide-header callback preserves unknown entries, duplicates and metadata', () => {
  for (const serialized of ['["logo","logo"]', '["title","logo"]', '[null,9,{"keep":true},"logo"]']) {
    const run = source => {
      const s = setup(source, { visibleHeaders: serialized, extra: 'keep' });
      const root = s.instance.render();
      const hide = nodes(root, 'div').find(x => x.props.className === 'hideIcon');
      assert.ok(hide);
      hide.props.onClick();
      return s.events;
    };
    assert.deepEqual(run(current), run(old));
  }
});
check('actual event closures preserve URL/trim/text/controls and state update forwarding', () => {
  const run = source => {
    const s = setup(source);
    const root = s.instance.render();
    nodes(root, './components/Logo')[0].props.onChange(undefined);
    nodes(root, './components/EditableText')[0].props.onChange('  next \n');
    nodes(root, 'RichText')[0].props.onSave('<p>next</p>');
    const preview = nodes(root, './FormPreview')[0];
    assert.deepEqual(
      preview.props.controls.map(c => c.controlId),
      ['name'],
    );
    const changed = [{ controlId: 'changed', row: 2 }];
    preview.props.onChange(changed);
    assert.equal(s.events.at(-1)[1], changed);
    preview.props.onHideControl('name');
    nodes(root, './components/EditableButton')[0].props.onChange('Send');
    nodes(root, 'BlackBtn')[0].props.onClick();
    nodes(root, './AppearanceConfig')[0].props.onClose();
    s.instance.renderAddHeader().props.onPopupVisibleChange(true);
    return s.events;
  };
  assert.deepEqual(run(current), run(old));
});
check('metadata spreads retain own prototype names/symbols and getter read order', () => {
  const run = source => {
    const order = [];
    const meta = {
      get visibleHeaders() {
        order.push('headers');
        return '["logo"]';
      },
      get keep() {
        order.push('keep');
        return 'x';
      },
    };
    Object.defineProperty(meta, '__proto__', { value: 'own', enumerable: true });
    meta[Symbol.for('header-extra')] = 'symbol';
    const s = setup(source, meta);
    const root = s.instance.render();
    nodes(root, 'div')
      .find(x => x.props.className === 'hideIcon')
      .props.onClick();
    assert.deepEqual(order.slice(0, 2), ['headers', 'headers']);
    const output = s.events[0][1].extendDatas;
    assert.equal(Object.hasOwn(output, '__proto__'), true);
    assert.equal(output[Symbol.for('header-extra')], 'symbol');
    return { order, events: s.events };
  };
  assert.deepEqual(run(current), run(old));
});
check('array boundary preserves identity, sparse slots, inherited values and getter timing', () => {
  const list = new Array(3);
  Object.defineProperty(list, 1, {
    get() {
      throw Error('not read eagerly');
    },
    enumerable: true,
  });
  assert.equal(header.visibleHeaderList(list), list);
  const run = source => {
    const order = [];
    const values = [];
    Object.defineProperty(values, 0, {
      get() {
        order.push('item');
        return { retained: true };
      },
      enumerable: true,
    });
    values.length = 2;
    const nativeConcat = values.concat;
    Object.defineProperty(values, 'concat', {
      get() {
        order.push('concat');
        return nativeConcat;
      },
    });
    const s = setup(
      source,
      { visibleHeaders: 'fixture' },
      {},
      { safeParse: v => (v === 'fixture' ? values : realSafeParse(v)) },
    );
    nodes(s.instance.renderAddHeader(), 'MenuItem')[0].props.onClick();
    return { order, events: s.events, keys: Reflect.ownKeys(values) };
  };
  assert.deepEqual(run(current), run(old));
});
check('missing/invalid/primitive header containers reject before configuration save', () => {
  for (const raw of ['null', 'false', '0', '"logo"', '{}', 'bad-json']) {
    const s = setup(current, { visibleHeaders: raw });
    assert.throws(() => s.instance.render(), /Invalid public form visible header list/);
    assert.throws(() => s.instance.renderAddHeader(), /Invalid public form visible header list/);
    assert.deepEqual(s.events, []);
  }
  // A non-array string previously rendered its substring-selected header; this is an intentional fix.
  assert.doesNotThrow(() => setup(old, { visibleHeaders: '"logo"' }).instance.render());
});
check('native concat/filter/toJSON and save failures keep order or reject invalid serialization', () => {
  for (const hide of [false, true]) {
    const order = [];
    const list = ['logo'];
    const method = hide ? 'filter' : 'concat';
    const native = list[method];
    list[method] = function (...args) {
      order.push(method);
      const output = Reflect.apply(native, this, args);
      output.toJSON = () => {
        order.push('toJSON');
        return undefined;
      };
      return output;
    };
    const s = setup(
      current,
      { visibleHeaders: 'fixture' },
      {},
      { safeParse: v => (v === 'fixture' ? list : realSafeParse(v)) },
    );
    const root = hide ? s.instance.render() : s.instance.renderAddHeader();
    const click = hide
      ? nodes(root, 'div').find(x => x.props.className === 'hideIcon').props.onClick
      : nodes(root, 'MenuItem')[0].props.onClick;
    assert.throws(click, /Invalid public form visible header serialization/);
    assert.deepEqual(order, [method, 'toJSON']);
    assert.deepEqual(s.events, []);
  }
  assert.throws(() => header.serializeVisibleHeaders({}), /serialization/);
  const cyclic = [];
  cyclic.push(cyclic);
  assert.throws(() => header.serializeVisibleHeaders(cyclic), TypeError);
  const s = setup(
    current,
    { visibleHeaders: '[]' },
    {},
    {
      props: {
        updateSettings() {
          throw Error('save-fail');
        },
      },
    },
  );
  assert.throws(nodes(s.instance.renderAddHeader(), 'MenuItem')[0].props.onClick, /save-fail/);
});
check('real mount/unmount host callback keeps original scroll and cleanup semantics', () => {
  const run = source => {
    const s = setup(source);
    s.instance.componentDidMount();
    s.win.scrollToFormEnd();
    s.instance.con = {};
    s.win.scrollToFormEnd();
    s.instance.componentWillUnmount();
    assert.equal(Object.hasOwn(s.win, 'scrollToFormEnd'), false);
    return s.events;
  };
  assert.deepEqual(run(current), run(old));
});
console.log(`${checks} public form parent/header checks passed`);
