import type { SpecHarness } from '../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../..');
const before = process.env['RADIO_BEFORE_REV'];

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid observation');
  return value[key];
}
function invoke(receiver: unknown, fn: unknown, ...args: unknown[]): unknown {
  if (typeof fn !== 'function') throw new TypeError('Missing observed function');
  return Reflect.apply(fn, receiver, args);
}
function fixture(old = false) {
  const modules = new Map<string, unknown>();
  function load(name: string): unknown {
    const cached = modules.get(name);
    if (cached) return cached;
    const filename = 'src/ming-ui/components/' + name + '.tsx';
    const source =
      old && before
        ? execFileSync('git', ['show', before + ':' + filename], { cwd: root, encoding: 'utf8' })
        : fs.readFileSync(path.join(root, filename), 'utf8');
    const compiled = harness.transformSync(source, {
      filename: path.join(root, filename),
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    assert.ok(compiled?.code);
    const target: { exports: unknown } = { exports: {} };
    const imports = (request: string): unknown => {
      if (['react', 'react/jsx-runtime', 'react-redux', 'classnames', 'prop-types', 'lodash'].includes(request))
        return require(request);
      if (request === './Radio') return load('Radio');
      if (request.endsWith('.less')) return {};
      throw new Error('Unexpected import: ' + request);
    };
    new Function('module', 'exports', 'require', compiled.code)(target, target.exports, imports);
    modules.set(name, target.exports);
    return target.exports;
  }
  function instantiate(component: unknown, props: Record<string, unknown>) {
    if (typeof component !== 'function') throw new TypeError('Missing actual component class');
    const instance: unknown = Reflect.construct(component, [props]);
    assert.ok(object(instance));
    const writes: unknown[] = [];
    instance['setState'] = (patch: unknown) => {
      assert.ok(object(patch));
      const state = read(instance, 'state');
      assert.ok(object(state));
      instance['state'] = { ...state, ...patch };
      writes.push(patch);
    };
    return {
      instance,
      writes,
      call(name: string, ...args: unknown[]) {
        return invoke(instance, read(instance, name), ...args);
      },
      update(patch: Record<string, unknown>) {
        const previous = read(instance, 'props');
        assert.ok(object(previous));
        instance['props'] = { ...previous, ...patch };
        this.call('componentDidUpdate', previous);
      },
      render() {
        const result = this.call('render');
        assert.ok(React.isValidElement<Record<string, unknown>>(result));
        return result;
      },
      click() {
        invoke(undefined, this.render().props['onClick']);
      },
      checked() {
        return read(read(instance, 'state'), 'checked');
      },
      children() {
        const children = this.render().props['children'];
        assert.ok(Array.isArray(children));
        return children.map(child => {
          assert.ok(React.isValidElement<Record<string, unknown>>(child));
          return instantiate(child.type, child.props);
        });
      },
      values() {
        const data = read(read(instance, 'state'), 'data');
        assert.ok(Array.isArray(data));
        return data.map(item => ({
          value: read(item, 'value'),
          checked: read(item, 'checked'),
          text: read(item, 'text'),
        }));
      },
    };
  }
  return {
    radio(props: Record<string, unknown> = {}) {
      return instantiate(read(load('Radio'), 'default'), props);
    },
    group(props: Record<string, unknown> = {}) {
      return instantiate(read(load('RadioGroup'), 'default'), props);
    },
  };
}

function publicContracts() {
  const cache = path.join(root, 'node_modules/.cache');
  fs.mkdirSync(cache, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(cache, 'hap-radio-contract-'));
  const source = `import Radio, { type RadioProps } from '${root}/src/ming-ui/components/Radio';
import RadioGroup, { type RadioGroupProps, type RadioGroupItem } from '${root}/src/ming-ui/components/RadioGroup';
export const specific = <Radio value={{ id: 'account' }} onClick={value => {
  const id: string | undefined = value?.id; void id;
}} />;
export const unknown = <Radio onClick={value => {
  // @ts-expect-error Missing Radio values are unknown, never any.
  value.id;
}} />;
export const group = <RadioGroup data={[{ value: 0, text: 'Zero' }]} checkedValue={0} onChange={value => {
  const result: number | undefined = value; void result;
}} />;
export const noData = <RadioGroup onChange={value => {
  // @ts-expect-error Missing group value models are unknown.
  value.id;
}} />;
export const defaultModel: RadioProps = { onClick: value => {
  // @ts-expect-error Props defaults must not regress to any.
  value.id;
} };
export const defaultGroup: RadioGroupProps = { onChange: value => {
  // @ts-expect-error Group Props defaults must not regress to any.
  value.id;
} };
export const item: RadioGroupItem = { value: { id: 'opaque' } };
// @ts-expect-error Unspecified option value models remain unknown.
item.value.id;
export const callback: RadioGroupProps<number> = {
  // @ts-expect-error A missing optional value can be undefined.
  onChange: (value: number) => { void value; },
};
export const malformed: RadioGroupProps<number> = {
  // @ts-expect-error Option values must match their declared model.
  data: [{ value: 'wrong' }],
};
`;
  try {
    const file = path.join(temporary, 'contract.tsx'),
      styles = path.join(temporary, 'styles.d.ts'),
      config = path.join(temporary, 'tsconfig.json');
    fs.writeFileSync(file, source);
    fs.writeFileSync(styles, "declare module '*.less';\n");
    fs.writeFileSync(
      config,
      JSON.stringify({
        extends: path.join(root, 'tsconfig.strict.json'),
        compilerOptions: { types: [], rootDir: root, noEmit: true },
        include: [file, styles],
        exclude: [],
      }),
    );
    execFileSync(
      process.execPath,
      [path.join(root, 'node_modules/@typescript/native/bin/tsc'), '-p', config, '--pretty', 'false'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' },
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function actualConsumer(
  file: string,
  component: string,
  property: string,
  selector: string,
  locals: Record<string, unknown> = {},
  receiver: unknown = undefined,
): unknown {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const tree = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let selected: unknown;
  function walk(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!object(value)) return;
    if (value['type'] === 'JSXOpeningElement' && read(value['name'], 'name') === component) {
      const start = value['start'],
        end = value['end'];
      if (typeof start === 'number' && typeof end === 'number' && source.slice(start, end).includes(selector)) {
        const attributes = value['attributes'];
        assert.ok(Array.isArray(attributes));
        const attribute = attributes.find(
          item => read(item, 'type') === 'JSXAttribute' && read(read(item, 'name'), 'name') === property,
        );
        if (attribute) selected = read(read(attribute, 'value'), 'expression');
      }
    }
    for (const [key, item] of Object.entries(value)) if (key !== 'loc') walk(item);
  }
  walk(tree.program);
  const start = read(selected, 'start'),
    end = read(selected, 'end');
  assert.equal(typeof start, 'number');
  assert.equal(typeof end, 'number');
  if (typeof start !== 'number' || typeof end !== 'number') throw new TypeError('Missing callback source offsets');
  const compiled = harness.transformSync(
    'module.exports = function () { return (' + source.slice(start, end) + '); };',
    {
      filename: path.join(root, file),
    },
  );
  assert.ok(compiled?.code);
  const target: { exports: unknown } = { exports: {} };
  Reflect.apply(new Function('module', ...Object.keys(locals), compiled.code), receiver, [
    target,
    ...Object.values(locals),
  ]);
  return invoke(receiver, target.exports);
}

function main() {
  const current = fixture(),
    old = before ? fixture(true) : undefined;
  const appearances: Record<string, unknown>[] = [
    {},
    { text: 'Text' },
    { text: 0 },
    { text: React.createElement('b', null, 'JSX') },
    { checked: true },
    { checked: false },
    { defaultChecked: true },
    { checked: true, defaultChecked: false },
    { disabled: true, checked: true },
    { size: 'small', noMargin: true },
    { size: 'middle', title: 'hint' },
    { icon: 'icon-edit', children: React.createElement('b', null, 'Child') },
    { disableTitle: true, text: 'hidden hint' },
  ];
  for (const props of appearances)
    if (old)
      assert.equal(
        ReactDOM.renderToStaticMarkup(current.radio(props).render()),
        ReactDOM.renderToStaticMarkup(old.radio(props).render()),
      );
  for (const props of [
    { value: 0, checked: true },
    { value: false, checked: false },
    { value: { id: 'account' }, checked: false },
  ]) {
    for (const f of old ? [current, old] : [current]) {
      const emitted: unknown[] = [];
      const radio = f.radio({ ...props, onClick: (value: unknown) => emitted.push(value) });
      radio.click();
      assert.equal(emitted[0], props.value);
      assert.equal(Boolean(radio.checked()), props.checked);
    }
  }
  const priority = current.radio({ checked: false, defaultChecked: true });
  assert.equal(priority.checked(), false);
  const emptyInitial = current.group({ data: [{ value: 'preset', checked: true }], checkedValue: null });
  assert.deepEqual(
    emptyInitial.values().map(item => item.checked),
    [false],
    'An explicit empty initial selection clears option presets',
  );
  const retained = current.radio({ defaultChecked: true });
  retained.update({ text: 'changed' });
  assert.equal(retained.checked(), true);
  const unchecked = current.radio();
  unchecked.click();
  assert.equal(unchecked.checked(), true);
  const optional: unknown[] = [];
  current.radio({ onClick: (value: unknown) => optional.push(value) }).click();
  assert.deepEqual(optional, [undefined]);
  let blocked = 0;
  const disabled = current.radio({ disabled: true, onClick: () => blocked++ });
  disabled.click();
  assert.equal(blocked, 0);
  assert.equal(disabled.checked(), undefined);
  const changed = current.radio({ checked: false });
  changed.update({ checked: true });
  assert.equal(changed.checked(), true);
  changed.update({ checked: false });
  assert.equal(changed.checked(), false);

  function data() {
    return [
      { value: 'a', text: 'A' },
      { value: 'b', text: 'B' },
    ];
  }
  const groupCases = [
    {},
    { checkedValue: 'a' },
    { defaultCheckedValue: 'b' },
    { defaultCheckedValue: 'b', checkedValue: 'a' },
    { checkedValue: 'b', vertical: true, className: 'rows', radioItemClassName: 'item', size: 'small' },
  ];
  for (const props of groupCases)
    if (old)
      assert.equal(
        ReactDOM.renderToStaticMarkup(current.group({ ...props, data: data() }).render()),
        ReactDOM.renderToStaticMarkup(old.group({ ...props, data: data() }).render()),
      );
  for (const f of old ? [current, old] : [current]) {
    const emitted: unknown[] = [];
    const group = f.group({ data: data(), checkedValue: 'a', onChange: (value: unknown) => emitted.push(value) });
    const second = group.children()[1];
    assert.ok(second);
    second.click();
    assert.deepEqual(emitted, ['b']);
    assert.deepEqual(
      group.values().map(item => item.checked),
      [false, true],
    );
    group.update({ checkedValue: 'a', data: data() });
    assert.deepEqual(
      group.values().map(item => item.checked),
      [true, false],
    );
  }
  const original = Object.freeze([Object.freeze({ value: 'a', text: 'A' }), Object.freeze({ value: 'b', text: 'B' })]);
  const frozen = current.group({ data: original, checkedValue: 'a' });
  frozen.update({ checkedValue: 'b' });
  assert.deepEqual(
    frozen.values().map(item => item.checked),
    [false, true],
  );
  assert.equal(read(original[0], 'checked'), undefined);
  frozen.update({ checkedValue: undefined });
  assert.deepEqual(
    frozen.values().map(item => item.checked),
    [false, false],
  );
  frozen.update({ checkedValue: 'a' });
  frozen.update({ checkedValue: null });
  assert.deepEqual(
    frozen.values().map(item => item.checked),
    [false, false],
  );
  frozen.update({ checkedValue: 'b' });
  frozen.update({ checkedValue: '' });
  assert.deepEqual(
    frozen.values().map(item => item.checked),
    [false, false],
  );
  const opaque = { id: 'opaque' },
    emitted: unknown[] = [];
  const identities = current.group({
    data: [{ value: opaque, text: 'Object' }],
    checkedValue: opaque,
    onChange: (value: unknown) => emitted.push(value),
  });
  const item = identities.children()[0];
  assert.ok(item);
  item.click();
  assert.equal(emitted[0], opaque);
  assert.equal(identities.values()[0]?.value, opaque);
  const uncontrolled = current.group({ data: data() });
  const second = uncontrolled.children()[1];
  assert.ok(second);
  second.click();
  uncontrolled.update({ className: 'new', size: 'middle' });
  assert.deepEqual(
    uncontrolled.values().map(item => item.checked),
    [false, true],
  );
  uncontrolled.update({
    data: [
      { value: 'b', text: 'Updated B' },
      { value: 'c', text: 'C' },
    ],
  });
  assert.deepEqual(
    uncontrolled.values().map(item => item.checked),
    [true, false],
  );
  const presets = current.group({ data: [{ value: 1, checked: true }, { value: 2 }] });
  assert.equal(presets.values()[0]?.checked, true);
  presets.update({ data: [{ value: 3, checked: true }] });
  assert.equal(presets.values()[0]?.checked, true);
  const zero = current.group({
    data: [{ value: 0 }, { value: false }, { value: '' }, { value: null }],
    checkedValue: 0,
  });
  assert.deepEqual(
    zero.values().map(item => item.checked),
    [true, false, false, false],
  );
  zero.update({ checkedValue: false });
  assert.deepEqual(
    zero.values().map(item => item.checked),
    [false, true, false, false],
  );
  zero.update({ checkedValue: '' });
  assert.deepEqual(
    zero.values().map(item => item.checked),
    [false, false, true, false],
  );
  zero.update({ checkedValue: null });
  assert.deepEqual(
    zero.values().map(item => item.checked),
    [false, false, false, true],
  );
  const missingValues: unknown[] = [];
  const missing = current.group({
    data: [{ text: 'No value' }],
    onChange: (value: unknown) => missingValues.push(value),
  });
  const missingChild = missing.children()[0];
  assert.ok(missingChild);
  missingChild.click();
  assert.deepEqual(missingValues, [undefined]);
  let disabledChanges = 0;
  const perItem = current.group({ data: [{ value: 'a', disabled: true }], onChange: () => disabledChanges++ });
  const disabledItem = perItem.children()[0];
  assert.ok(disabledItem);
  disabledItem.click();
  assert.equal(disabledChanges, 0);
  for (const f of old ? [current, old] : [current]) {
    const calls: unknown[] = [];
    const initialized = f.group({
      data: data(),
      checkedValue: 'b',
      needDefaultUpdate: true,
      onChange: (value: unknown) => calls.push(value),
    });
    initialized.call('componentDidMount');
    assert.deepEqual([...calls], ['b']);
    const none = f.group({ data: data(), needDefaultUpdate: true, onChange: (value: unknown) => calls.push(value) });
    none.call('componentDidMount');
    assert.deepEqual([...calls], ['b']);
  }

  const updates: unknown[] = [];
  const access = actualConsumer(
    'src/pages/Admin/security/data/AppAccess/AccessConditions.tsx',
    'RadioGroup',
    'onChange',
    'ACCESS_CONDITION_ENUM',
    {
      setAccessType: (value: unknown) => updates.push(['type', value]),
      setIpRule: (value: unknown) => updates.push(['ips', value]),
      setHearderRule: (value: unknown) => updates.push(['headers', value]),
      setAdressRule: (value: unknown) => updates.push(['address', value]),
      setDeviceList: (value: unknown) => updates.push(['devices', value]),
    },
  );
  invoke(undefined, access, undefined);
  assert.deepEqual(updates, [], 'Missing choices must not clear access rules');
  invoke(undefined, access, 0);
  assert.equal(updates.length, 5);
  assert.deepEqual(updates[0], ['type', 0]);
  const roles: unknown[] = [];
  for (const checked of [false, true]) {
    const owner = {
      getCurrentUserOrgRoleChecked: () => checked,
      toggle: (value: unknown, selected: unknown) => roles.push([read(value, 'organizeId'), selected]),
    };
    const role = actualConsumer(
      'src/ming-ui/functions/dialogSelectOrgRole/index.tsx',
      'Radio',
      'onClick',
      '当前用户所在的组织角色',
      { _l: (value: string) => value },
      owner,
    );
    invoke(undefined, role);
  }
  assert.deepEqual(roles, [
    ['user-role', true],
    ['user-role', false],
  ]);
  publicContracts();
  console.log(
    JSON.stringify({
      radioRenderings: appearances.length,
      groupRenderings: groupCases.length,
      identityAndImmutableInput: true,
      callbacksAndSelection: true,
      actualConsumers: 2,
      publicTypeContracts: true,
      historicalAB: !!old,
    }),
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
