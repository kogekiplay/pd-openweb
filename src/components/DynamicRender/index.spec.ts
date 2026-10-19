/** Real complete historical/current renderer and footer; controlled hook/Select/window host, no business writes. */
const assert = require('node:assert/strict');
const h = require('../../../scripts/spec-fixtures/cloudPrintLoader.ts');
const { nodes, tree, outcome } = h;
let count = 0,
  failed = 0,
  summarized = false;
process.on('unhandledRejection', e => {
  console.error(e);
  process.exitCode = 1;
});
process.on('uncaughtException', e => {
  console.error(e);
  process.exitCode = 1;
});
process.on('beforeExit', () => {
  if (!summarized) {
    console.error('DynamicRender did not reach summary');
    process.exitCode = 1;
  }
});
function check(name, fn) {
  count++;
  try {
    fn();
    console.log('✓ ' + name);
  } catch (e) {
    failed++;
    console.error('✗ ' + name, e);
  }
}
function compare(fn) {
  assert.deepEqual(fn('current'), fn('old'));
}
function dynamic(version, data, listener) {
  const p = h.renderer(version);
  const d = p.dynamic({ data, onChange: listener });
  d.render();
  return d;
}
function input(d, index = 0) {
  return nodes(d.render(), 'Input')[index];
}
function select(d) {
  return nodes(d.render(), 'Select')[0];
}
check('text updates first duplicate key and preserves raw future text fields and outer-array copy semantics', () =>
  compare(version => {
    const data = h.validData(),
      changed = [];
    data.push(
      { fieldKey: 'name', type: 'text', value: 'Duplicate', extra: { opaque: true } },
      { fieldKey: 'future', type: 'text', value: 'Future', extra: { opaque: true } },
    );
    data.extra = 'array metadata';
    const first = data[1],
      last = data.at(-1),
      duplicate = data.at(-2),
      d = dynamic(version, data, x => changed.push(x));
    input(d, 3).props.onChange('Changed duplicate');
    d.flush();
    let next = changed.at(-1);
    assert.notEqual(next, data);
    assert.notEqual(next[1], first);
    assert.equal(next.at(-2), duplicate);
    assert.equal(next[1].value, 'Changed duplicate');
    assert.equal(Object.hasOwn(next, 'extra'), false);
    assert.equal(data.extra, 'array metadata');
    input(d, 4).props.onChange('Changed future');
    d.flush();
    next = changed.at(-1);
    assert.notEqual(next.at(-1), last);
    assert.deepEqual(next.at(-1).extra, { opaque: true });
    return tree(changed);
  }),
);
check('stale text callback missing its key retains the original negative-index own property', () =>
  compare(version => {
    const data = h.validData(),
      changes = [],
      d = dynamic(version, data, x => changes.push(x));
    const cb = input(d).props.onChange;
    data.splice(
      data.findIndex(f => f.fieldKey === 'name'),
      1,
    );
    cb('stale');
    d.flush();
    const result = changes[0];
    assert.equal(result.length, data.length);
    assert.deepEqual(result[-1], { value: 'stale' });
    assert.equal(Object.hasOwn(result, '-1'), true);
    assert.equal(Object.hasOwn(data, '-1'), false);
    return { keys: Reflect.ownKeys(result), extra: result[-1], items: tree(result) };
  }),
);
check(
  'mapping reads option getters twice for IDs/once for label, mutates the same row and writes missing IDs unchanged',
  () =>
    compare(version => {
      const data = h.validData(),
        map = data.find(f => f.fieldKey === 'renderData'),
        row = map.value[0],
        oldSystem = map.systemField.fields[0],
        changes = [],
        log = [];
      const d = dynamic(version, data, x => changes.push(x));
      const cb = select(d).props.onChange;
      let n = 0;
      cb('unused', {
        get value() {
          log.push('value');
          return ++n === 1 ? 'first' : undefined;
        },
        get label() {
          log.push('label');
          return 'Label';
        },
      });
      d.flush();
      assert.equal(log.filter(v => v === 'value').length, 2);
      assert.equal(log.filter(v => v === 'label').length, 1);
      assert.equal(row.toControlId, 'first');
      assert.equal(map.systemField.fields[0].controlId, undefined);
      assert.equal(
        changes[0].find(f => f.fieldKey === 'renderData'),
        map,
      );
      assert.equal(map.value[0], row);
      assert.notEqual(map.systemField.fields[0], oldSystem);
      return { log, data: tree(changes[0]) };
    }),
);
check('missing mapping parent/index/value preserve native failure and the original partial mutation prefix', () => {
  for (const fault of ['field', 'value', 'row', 'system', 'false-system', 'fields', 'option'])
    compare(version => {
      const data = h.validData(),
        map = data.find(f => f.fieldKey === 'renderData'),
        row = map.value[0],
        changes = [],
        d = dynamic(version, data, x => changes.push(x));
      const cb = select(d).props.onChange;
      if (fault === 'field') data.splice(data.indexOf(map), 1);
      if (fault === 'value') map.value = undefined;
      if (fault === 'row') map.value = [];
      if (fault === 'system') map.systemField = undefined;
      if (fault === 'false-system') map.systemField = false;
      if (fault === 'fields') map.systemField.fields = undefined;
      cb('next', fault === 'option' ? undefined : { value: 'new', label: 'New' });
      const result = outcome(() => d.flush());
      if (fault === 'fields') {
        assert.equal(result.error, undefined);
        assert.equal(changes.length, 1);
      } else {
        assert.ok(result.error, fault);
        assert.equal(changes.length, 0);
      }
      if (['system', 'false-system'].includes(fault)) assert.equal(row.toControlId, 'new');
      return { result, row: tree(row), system: tree(map.systemField), changes: tree(changes) };
    });
});
check('mapping callback rejection escapes after row mutation without committing the new outer array', () =>
  compare(version => {
    const data = h.validData(),
      map = data.find(f => f.fieldKey === 'renderData'),
      d = dynamic(version, data, () => {
        throw Error('listener failure');
      });
    select(d).props.onChange('text', { value: 'changed', label: 'Changed' });
    const result = outcome(() => d.flush());
    assert.deepEqual(result.error, ['Error', 'listener failure']);
    assert.equal(map.value[0].toControlId, 'changed');
    return { result, data: tree(data) };
  }),
);
check(
  'data effect and callback dependencies preserve pre-effect state, callback identity and old listener closures',
  () =>
    compare(version => {
      const a = h.validData(),
        b = h.validData();
      a[1].value = 'A';
      b[1].value = 'B';
      const log = [];
      const listenA = x => log.push(['a', x[1].value]),
        listenB = x => log.push(['b', x[1].value]);
      const d = dynamic(version, a, listenA);
      d.effects();
      d.flush();
      const oldHandler = d.callbacks.at(-1),
        oldInput = input(d).props.onChange;
      d.setProps({ data: b });
      assert.equal(input(d).props.value, 'A');
      assert.equal(d.callbacks.at(-1), oldHandler);
      d.effects();
      d.flush();
      assert.equal(input(d).props.value, 'B');
      d.setProps({ onChange: listenB });
      const newInput = input(d).props.onChange;
      assert.notEqual(d.callbacks.at(-1), oldHandler);
      assert.equal(oldHandler.length, 4);
      oldInput('old callback');
      d.flush();
      newInput('new callback');
      d.flush();
      assert.deepEqual(log, [
        ['a', 'old callback'],
        ['b', 'new callback'],
      ]);
      return log;
    }),
);
check(
  'mapping grouping, deleted option, opaque descriptions and skipped service/future types retain the complete tree',
  () =>
    compare(version => {
      const data = h.validData(),
        map = data.find(f => f.fieldKey === 'renderData');
      map.value.push({
        fromKey: 1,
        isDetail: true,
        toControlId: 'child',
        fromTableName: 'Other',
        toControlOptions: [{ value: 'child', label: 'Child' }],
      });
      map.fromField.fields.push({ text: 1, desc: { opaque: true }, sheetIndex: 1 });
      data.push({ fieldKey: 'future', type: 'future', value: { opaque: true } });
      const d = dynamic(version, data, undefined),
        rendered = d.render();
      assert.equal(nodes(rendered, 'Select').length, 2);
      assert.equal(nodes(rendered, 'Input').length, 3);
      assert.equal(nodes(rendered, 'Select')[0].props.options[0].value, 'text');
      return tree(rendered);
    }),
);
check('footer tooltip branch passes the event directly and bypasses its normal disabled/loading guard', () =>
  compare(version => {
    const p = h.edit(version),
      calls = [],
      save = (...args) => calls.push(['save', ...args]),
      cancel = (...args) => calls.push(['cancel', ...args]),
      event = { kind: 'event' };
    let rendered = p.footer({
      disabled: true,
      saveLoading: true,
      showTooltips: false,
      handleSave: save,
      onCancel: cancel,
    });
    let buttons = nodes(rendered, 'span');
    buttons.find(x => x.props.className.includes('saveBtn')).props.onClick(event);
    assert.equal(calls.length, 0);
    rendered = p.footer({
      disabled: true,
      saveLoading: true,
      showTooltips: true,
      handleSave: save,
      onCancel: cancel,
      tipsTxt: 'Tip',
    });
    buttons = nodes(rendered, 'span');
    const saveBtn = buttons.find(x => x.props.className.includes('saveBtn'));
    assert.equal(saveBtn.props.onClick, save);
    saveBtn.props.onClick(event);
    buttons.find(x => x.props.className.includes('cancelBtn')).props.onClick(event);
    assert.deepEqual(calls, [
      ['save', event],
      ['cancel', event],
    ]);
    return { calls, tree: tree(rendered) };
  }),
);
check('footer normal save drops the DOM event and optional callbacks/text retain exact destructuring defaults', () =>
  compare(version => {
    const p = h.edit(version),
      calls = [],
      rendered = p.footer({
        disabled: false,
        saveLoading: false,
        showTooltips: false,
        handleSave: (...args) => calls.push(args),
        okText: 0,
      });
    const save = nodes(rendered, 'span').find(x => x.props.className.includes('saveBtn'));
    assert.equal(save.props.children, 0);
    save.props.onClick({ kind: 'event' });
    assert.deepEqual(calls, [[]]);
    const empty = p.footer({
      disabled: false,
      saveLoading: false,
      handleSave: undefined,
      onCancel: undefined,
      okText: undefined,
    });
    for (const x of nodes(empty, 'span')) x.props.onClick();
    assert.equal(nodes(empty, 'span')[0].props.children, '保存');
    return { calls, tree: tree(empty) };
  }),
);
summarized = true;
console.log(`DynamicRender/Footer full historical contract: ${count - failed}/${count}`);
if (failed) process.exitCode = 1;
