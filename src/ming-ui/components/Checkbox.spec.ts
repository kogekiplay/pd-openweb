import type { SpecHarness } from '../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../..');
const before = process.env['CHECKBOX_BEFORE_REV'];

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
function moduleFixture(old = false) {
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
      if (request === './Checkbox') return load('Checkbox');
      if (request === './Icon')
        return {
          __esModule: true,
          default: ({ icon }: { icon: string }) => React.createElement('i', { 'data-icon': icon }),
        };
      if (request.endsWith('.less')) return {};
      throw new Error('Unexpected import: ' + request);
    };
    new Function('module', 'exports', 'require', compiled.code)(target, target.exports, imports);
    modules.set(name, target.exports);
    return target.exports;
  }
  function instantiate(component: unknown, props: Record<string, unknown>) {
    if (typeof component !== 'function') throw new TypeError('Missing actual component class');
    const defaults = read(component, 'defaultProps');
    const instance: unknown = Reflect.construct(component, [{ ...(object(defaults) ? defaults : {}), ...props }]);
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
        const event = { nativeEvent: { stopImmediatePropagation: () => {} } };
        invoke(undefined, this.render().props['onClick'], event);
        return event;
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
    checkbox(props: Record<string, unknown> = {}) {
      return instantiate(read(load('Checkbox'), 'default'), props);
    },
    group(props: Record<string, unknown> = {}) {
      return instantiate(read(load('CheckboxGroup'), 'default'), props);
    },
    groupHtml(props: Record<string, unknown>) {
      const f = this.group(props);
      return ReactDOM.renderToStaticMarkup(f.render());
    },
  };
}

function checkPublicContracts() {
  const cache = path.join(root, 'node_modules/.cache');
  fs.mkdirSync(cache, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(cache, 'hap-checkbox-contract-'));
  const source = `import Checkbox, { type CheckboxProps } from '${root}/src/ming-ui/components/Checkbox';
import CheckboxGroup, { type CheckboxGroupProps } from '${root}/src/ming-ui/components/CheckboxGroup';
export const complete = <Checkbox value={{ id: 'account' }} onClick={(checked, value, event) => {
  const status: boolean = checked;
  const id: string | undefined = value?.id;
  const label: HTMLLabelElement = event.currentTarget;
  void status; void id; void label;
}} />;
export const optional = <Checkbox onClick={(_checked, value) => {
  // @ts-expect-error A missing value remains unknown instead of becoming any.
  value.id;
}} />;
export const group = <CheckboxGroup data={[{ value: 'a', text: 'A' }]} checkedValues={['a']} onChange={value => {
  const result: string | undefined = value;
  void result;
}} />;
export const callback: CheckboxProps<string> = {
  // @ts-expect-error Optional Checkbox values can be undefined.
  onClick: (_checked: boolean, value: string) => { void value; },
};
export const malformed: CheckboxGroupProps<number> = {
  // @ts-expect-error Group values must agree with the declared value model.
  data: [{ value: 'text', text: 'Wrong' }],
};
`;
  try {
    const fixture = path.join(temporary, 'contract.tsx');
    fs.writeFileSync(fixture, source);
    const styles = path.join(temporary, 'styles.d.ts');
    fs.writeFileSync(styles, "declare module '*.less';\n");
    const config = path.join(temporary, 'tsconfig.json');
    fs.writeFileSync(
      config,
      JSON.stringify({
        extends: path.join(root, 'tsconfig.strict.json'),
        compilerOptions: { types: [], rootDir: root, noEmit: true },
        include: [fixture, styles],
        exclude: [],
      }),
    );
    const tsc = path.join(root, 'node_modules/@typescript/native/bin/tsc');
    execFileSync(process.execPath, [tsc, '-p', config, '--pretty', 'false'], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function main() {
  const current = moduleFixture();
  const old = before ? moduleFixture(true) : undefined;
  const appearances: Record<string, unknown>[] = [
    {},
    { text: 'Text' },
    { checked: true },
    { checked: false },
    { defaultChecked: true },
    { checked: true, defaultChecked: false },
    { disabled: true, checked: true },
    { size: 'small', noMargin: true },
    { styleType: 'light', textPosition: 'left', text: 'Left' },
    { indeterminate: true, checked: true },
    { clearselected: true, checked: true },
    { title: 'hint', className: 'extra', style: { color: '#123' }, children: React.createElement('b', null, 'Child') },
  ];
  for (const props of appearances) {
    const f = current.checkbox(props);
    if (old)
      assert.equal(
        ReactDOM.renderToStaticMarkup(f.render()),
        ReactDOM.renderToStaticMarkup(old.checkbox(props).render()),
      );
  }
  for (const modes of [{}, { checked: true }, { checked: false }, { defaultChecked: true }]) {
    for (const fixture of old ? [current, old] : [current]) {
      const calls: unknown[] = [];
      const value = { id: 'account' };
      const f = fixture.checkbox({ ...modes, value, onClick: (...args: unknown[]) => calls.push(args) });
      const event = f.click();
      assert.equal(calls.length, 1);
      assert.ok(Array.isArray(calls[0]));
      assert.equal(calls[0][1], value);
      assert.equal(calls[0][2], event);
      const expected = 'checked' in modes ? modes.checked : !('defaultChecked' in modes && modes.defaultChecked);
      assert.equal(calls[0][0], expected);
      assert.equal(f.checked(), 'checked' in modes ? modes.checked : expected);
    }
  }
  const priority = current.checkbox({ checked: false, defaultChecked: true });
  assert.equal(priority.checked(), false);
  const optional: unknown[] = [];
  const noValue = current.checkbox({ onClick: (...args: unknown[]) => optional.push(args) });
  noValue.click();
  assert.equal(read(optional[0], '1'), undefined);
  let blocked = 0;
  const disabled = current.checkbox({ disabled: true, onClick: () => blocked++ });
  disabled.click();
  assert.equal(blocked, 0);
  assert.equal(disabled.checked(), false);
  const controlled = current.checkbox({ checked: false });
  controlled.update({ checked: true });
  assert.equal(controlled.checked(), true);
  controlled.update({ checked: undefined });
  controlled.click();
  assert.equal(controlled.checked(), false);

  const data = [
    { value: 'a', text: 'A' },
    { value: 'b', text: 'B' },
  ];
  for (const props of [
    { data },
    { data, checkedValues: ['a'] },
    { data, defaultCheckedValues: ['b'] },
    { data, checkedValues: [], defaultCheckedValues: ['a'] },
    { data, vertical: true, className: 'rows', size: 'small' },
  ]) {
    if (old) assert.equal(current.groupHtml(props), old.groupHtml(props));
  }
  assert.deepEqual(
    data,
    [
      { value: 'a', text: 'A' },
      { value: 'b', text: 'B' },
    ],
    'Group never mutates the source items',
  );
  for (const fixture of old ? [current, old] : [current]) {
    const calls: unknown[] = [];
    const group = fixture.group({ data, checkedValues: ['a'], onChange: (value: unknown) => calls.push(value) });
    const child = group.children()[1];
    assert.ok(child);
    child.click();
    assert.deepEqual(calls, ['b']);
    assert.deepEqual(
      group.values().map(item => item.checked),
      [true, false],
      'A controlled group waits for its producer',
    );
    group.update({ checkedValues: ['b'] });
    assert.deepEqual(
      group.values().map(item => item.checked),
      [false, true],
    );
    group.update({ checkedValues: [] });
    assert.deepEqual(
      group.values().map(item => item.checked),
      [false, false],
    );
  }

  const updated = current.group({ data, checkedValues: ['a'] });
  updated.update({
    data: [
      { value: 'c', text: 'C' },
      { value: 'a', text: 'Updated A' },
    ],
  });
  assert.deepEqual(updated.values(), [
    { value: 'c', checked: false, text: 'C' },
    { value: 'a', checked: true, text: 'Updated A' },
  ]);
  updated.update({ data: [] });
  assert.deepEqual(updated.values(), []);
  const uncontrolled = current.group({ data, defaultCheckedValues: ['a'] });
  const initial = uncontrolled.children()[0];
  assert.ok(initial);
  initial.click();
  assert.deepEqual(
    uncontrolled.values().map(item => item.checked),
    [false, false],
  );
  const second = uncontrolled.children()[1];
  assert.ok(second);
  second.click();
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
  uncontrolled.update({ checkedValues: ['c'] });
  assert.deepEqual(
    uncontrolled.values().map(item => item.checked),
    [false, true],
  );

  const value = { id: 'opaque' },
    style = { color: '#123' },
    callbackValues: unknown[] = [];
  const objects = current.group({
    data: [{ value, style, text: 'Object' }],
    checkedValues: [value],
    onChange: (value: unknown) => callbackValues.push(value),
  });
  assert.equal(objects.values()[0]?.checked, true);
  assert.equal(objects.values()[0]?.value, value);
  const objectChild = objects.children()[0];
  assert.ok(objectChild);
  objectChild.click();
  assert.equal(callbackValues[0], value);
  const rawData = read(read(objects.instance, 'state'), 'data');
  assert.ok(Array.isArray(rawData));
  assert.notEqual(read(rawData[0], 'style'), style, 'Presentation metadata remains cloned');
  objects.update({ checkedValues: [] });
  assert.equal(objects.values()[0]?.checked, false);
  assert.equal(objects.values()[0]?.value, value);
  const missing = current.group({ data: [{ text: 'No value' }], checkedValues: [undefined] });
  assert.equal(missing.values()[0]?.checked, true);
  const empty = current.group({ data: null, checkedValues: null });
  assert.deepEqual(empty.values(), []);
  const mixed = current.group({
    data: [{ value: 0 }, { value: false }, { value: null }, { value: undefined }],
    checkedValues: [0, null],
  });
  assert.deepEqual(
    mixed.values().map(item => item.checked),
    [true, false, true, false],
  );
  const frozenData = Object.freeze([
    Object.freeze({ value: 'frozen', text: 'Frozen', style: Object.freeze({ color: '#456' }) }),
  ]);
  const frozen = current.group({ data: frozenData, checkedValues: ['frozen'] });
  frozen.update({ checkedValues: [] });
  assert.equal(frozen.values()[0]?.checked, false);
  assert.equal(frozenData[0]?.value, 'frozen');
  let disabledChanges = 0;
  const perItem = current.group({ data: [{ value: 'a', disabled: true }], onChange: () => disabledChanges++ });
  const disabledItem = perItem.children()[0];
  assert.ok(disabledItem);
  disabledItem.click();
  assert.equal(disabledChanges, 0);
  const groupDisabled = current.group({ data, disabled: true, onChange: () => disabledChanges++ });
  groupDisabled.children().forEach(child => child.click());
  assert.equal(disabledChanges, 0);
  checkPublicContracts();
  console.log(
    JSON.stringify({
      checkboxRenderings: appearances.length,
      groupRenderings: 5,
      callbacksAndUpdates: true,
      opaqueIdentityAndOptionalValues: true,
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
