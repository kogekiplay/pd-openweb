/** Real full modules against fixed history; transport/DOM never touch business state. */
const assert = require('node:assert/strict');
const h = require('../../../../../../scripts/spec-fixtures/ruleActionLoader.ts');
let checks = 0;

function compare(name, run) {
  const results = [];

  for (const version of ['current', 'old']) {
    const hosts = [];

    const host = patches => {
      const s = h.host(version, patches);
      hosts.push(s);
      return s;
    };

    try {
      results.push(run(host));
    } finally {
      hosts.forEach(s => s.finish());
    }
  }

  assert.deepEqual(results[0], results[1], name);
  checks++;
  console.log('  PASS ' + name);
}

const view = s => h.tree({ state: s.item.state, view: s.item.render(), events: s.events });
const event = () => ({ stopPropagation() {} });
const dialog = d => h.nodes(d.render(), 'Dialog')[0].props;

compare('mount/action changes rebuild the actual filtered tree; same-action updates preserve search state', host => {
  const s = host({ actionType: 3 });
  assert.equal(
    s.item.state.dropDownData.some(c => c.controlId === 'formula'),
    false,
  );
  s.item.componentDidMount();
  const prev = s.item.props;
  s.item.props = { ...prev, actionType: 1 };
  s.item.componentDidUpdate(prev);
  assert.equal(
    s.item.state.dropDownData.some(c => c.controlId === 'formula'),
    true,
  );
  s.item.state.keyword = 'keep';
  s.item.componentDidUpdate({ ...s.item.props, values: [] });
  assert.equal(s.item.state.keyword, 'keep');
  return view(s);
});
compare(
  'throttled search escapes metacharacters and expands matched nested controls; clearing restores source identity',
  host => {
    const s = host();
    s.item.state.keyword = 'A+B';
    s.item.handleSearch();
    s.item.handleSearch.flush();
    assert.deepEqual(
      s.item.state.dropDownData.map(c => c.controlId),
      ['first'],
    );
    s.item.state.keyword = 'target';
    s.item.handleSearch();
    s.item.handleSearch.flush();
    assert.deepEqual(s.item.state.extendId, ['sub', 'rel']);
    const filtered = h.tree(s.item.state);
    s.item.state.keyword = '';
    s.item.handleSearch();
    s.item.handleSearch.flush();
    assert.strictEqual(s.item.state.dropDownData, s.item.state.originData);
    return { filtered, restored: view(s) };
  },
);
compare(
  'subtable editable parent selection removes child selections, seeds permissions, and then toggles off',
  host => {
    const s = host({
      actionType: 3,
      values: [
        { controlId: 'first', extra: 'keep' },
        { controlId: 'sub', childControlIds: ['child'] },
      ],
    });
    const original = s.item.props.values;
    s.item.updateValues('', 'sub');
    assert.deepEqual(s.events[0][1], [
      { controlId: 'first', extra: 'keep' },
      { controlId: 'sub', childControlIds: [], permission: [], isCustom: false },
    ]);
    assert.strictEqual(s.events[0][1][0], original[0]);
    assert.equal(original.length, 2);
    s.item.props = { ...s.item.props, values: s.events[0][1] };
    s.item.updateValues('', 'sub');
    assert.deepEqual(s.events[1][1], [original[0]]);
    return h.tree(s.events);
  },
);
compare('child add/remove keeps parent entries distinct and removes an emptied child selection', host => {
  const s = host({
    values: [
      { controlId: 'sub', childControlIds: [] },
      { controlId: 'sub', childControlIds: ['child'] },
    ],
  });
  s.item.updateValues('sub', 'child2');
  assert.deepEqual(s.events[0][1], [
    { controlId: 'sub', childControlIds: [] },
    { controlId: 'sub', childControlIds: ['child', 'child2'] },
  ]);
  s.item.props = { ...s.item.props, values: s.events[0][1] };
  s.item.updateValues('sub', 'child');
  s.item.props = { ...s.item.props, values: s.events[1][1] };
  s.item.updateValues('sub', 'child2');
  assert.deepEqual(s.events[2][1], [{ controlId: 'sub', childControlIds: [] }]);
  s.item.props = { ...s.item.props, values: [] };
  s.item.updateValues('sub', 'child');
  return h.tree(s.events);
});
compare(
  'tab select-all retains legacy splice position and missing child IDs without mutating incoming selections',
  host => {
    const s = host({
      values: [{ controlId: 'first' }, { controlId: 'tab' }, { controlId: 'tabField' }, { controlId: 'tail' }],
    });
    const tab = { controlId: 'tab', type: 52, relationControls: [{ controlId: 'tabField' }, {}] };
    s.item.updateSelectAll(tab, true);
    assert.deepEqual(
      s.events[0][1].map(v => v.controlId),
      ['first', 'tab', 'tabField', undefined, 'tail'],
    );
    assert.equal(s.item.props.values.length, 4);
    s.item.updateSelectAll(tab);
    assert.deepEqual(
      s.events[1][1].map(v => v.controlId),
      ['first', 'tab', 'tail'],
    );
    return h.tree(s.events);
  },
);
compare('recursive select-all preserves subtable permission arrays, child containers and tab child ordering', host => {
  const s = host({ actionType: 3 });
  const result = s.item.getAllControls(s.item.state.dropDownData);
  assert.deepEqual(
    result.map(v => v.controlId),
    ['first', 'sub', 'sub', 'rel', 'rel', 'tab', 'tabField'],
  );
  assert.deepEqual(result[1].permission, []);
  assert.deepEqual(result[2].childControlIds, ['child', 'child2']);
  const controls = h.nodes(s.item.renderContent(s.item.state.dropDownData), 'button');
  assert.equal(controls.length, 0);
  s.item.props = { ...s.item.props, showSelectAll: true };
  const buttons = h.nodes(s.item.renderContent(s.item.state.dropDownData), 'button');
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.deepEqual(s.events[1], ['controls', []]);
  return h.tree({ result, events: s.events });
});
compare(
  'parent/tab readonly checkboxes retain the selected object as their truthy disabled value and block clicks',
  host => {
    const selected = { controlId: 'tab', childControlIds: [] };
    const s = host({ actionType: 4, values: [selected] });
    const child = { controlId: 'sub', type: 34, sectionId: 'tab' };
    const checkbox = s.item.renderChecked(child, { controlId: 'tab', type: 52 });
    assert.strictEqual(checkbox.props.disabled, selected);
    assert.equal(checkbox.props.checked, true);
    checkbox.props.onClick(true, undefined, event());
    assert.equal(s.events.length, 0);
    const required = host({ actionType: 5 });
    assert.equal(required.item.renderChecked({ controlId: 'tab', type: 52 }).props.disabled, true);
    return h.tree({
      checkbox,
      required: required.item.renderChecked({ controlId: 'tab', type: 52 }),
      events: s.events,
    });
  },
);
compare(
  'normal checkbox and expandable row callbacks preserve stopPropagation and field/tab selection routing',
  host => {
    const s = host();
    const child = s.item.renderChecked({ controlId: 'child', type: 2 }, { controlId: 'sub', type: 34 });
    let stopped = 0;
    child.props.onClick(false, undefined, {
      stopPropagation() {
        stopped++;
      },
    });
    assert.equal(stopped, 1);
    assert.deepEqual(s.events[0][1], [{ controlId: 'sub', childControlIds: ['child'] }]);
    const row = s.item.renderItem(
      s.item.state.dropDownData.find(c => c.controlId === 'sub'),
      {},
      0,
    );
    row.props.onClick();
    assert.deepEqual(s.item.state.extendId, ['sub']);
    row.props.onClick();
    assert.deepEqual(s.item.state.extendId, []);
    return view(s);
  },
);
compare(
  'field text uses actual deleted flags and opens complete permission/style dialogs from settings clicks',
  host => {
    const s = host({ actionType: 3, values: [{ controlId: 'sub', childControlIds: [] }, { controlId: 'gone' }] });
    const texts = s.item.getTextByValue();
    assert.ok(h.nodes(texts, 'span').some(n => String(n.props.className).includes('disabled')));
    const settings = h.nodes(texts, 'div').find(n => String(n.props.className).includes('settingIcon'));
    settings.props.onClick(event());
    assert.equal(s.dialogs.length, 1);
    assert.strictEqual(s.dialogs[0].props.values, s.item.props.values);
    const style = host({
      actionType: 11,
      values: [{ controlId: 'rel' }],
      dropDownData: h.fields().map(c => (c.controlId === 'rel' ? { ...c, advancedSetting: { showtype: '1' } } : c)),
    });
    h.nodes(style.item.getTextByValue(), 'div')
      .find(n => String(n.props.className).includes('settingIcon'))
      .props.onClick(event());
    assert.equal(style.dialogs.length, 1);
    assert.equal(style.dialogs[0].props.data, undefined);
    return { text: h.tree(texts), setting: h.tree(s.dialogs[0].props), style: h.tree(style.dialogs[0].props) };
  },
);
compare('popup disabled state, ref container and search input callbacks remain identical, including null ref', host => {
  const s = host({ disabled: true });
  let render = s.item.render();
  render.props.onPopupVisibleChange(true);
  assert.equal(s.item.state.visible, false);
  const box = { tag: 'mounted' };
  const triggerChild = render.props.children;
  triggerChild.props.ref(box);
  assert.strictEqual(render.props.getPopupContainer(), box);
  triggerChild.props.ref(null);
  assert.equal(render.props.getPopupContainer(), null);
  s.item.props = { ...s.item.props, disabled: false };
  render = s.item.render();
  render.props.onPopupVisibleChange(true);
  const input = h.nodes(render.props.popup, 'input')[0];
  input.props.onChange({ target: { value: 'A+B' } });
  s.item.handleSearch.flush();
  assert.equal(s.item.state.keyword, 'A+B');
  return view(s);
});
compare(
  'permission dialog toggles custom operations and children, saves at legacy insertion position and closes',
  host => {
    const s = host();
    const d = s.setting({
      values: [
        { controlId: 'first' },
        { controlId: 'sub', childControlIds: [], isCustom: true, permission: ['add'] },
        { controlId: 'sub', childControlIds: ['child'] },
        { controlId: 'tail' },
      ],
    });
    let checkboxes = h.nodes(d.render(), 'Checkbox');
    assert.equal(checkboxes[0].props.checked, true);
    checkboxes[1].props.onClick(false);
    checkboxes = h.nodes(d.render(), 'Checkbox');
    checkboxes.find(n => n.props.clearselected !== undefined).props.onClick(false);
    dialog(d).onOk();
    assert.deepEqual(
      s.events[0][1].map(v => v.controlId),
      ['first', 'tail', 'sub', 'sub'],
    );
    assert.deepEqual(s.events[0][1][2].permission, ['add', 'delete']);
    assert.deepEqual(s.events[0][1][3].childControlIds, ['child', 'child2']);
    assert.equal(dialog(d).visible, false);
    return h.tree({ states: d.states, events: s.events });
  },
);
compare(
  'permission reset and empty-child clear preserve original parent object and native missing-parent failure',
  host => {
    const s = host();
    const d = s.setting({
      values: [
        { controlId: 'sub', childControlIds: [], isCustom: true, permission: ['add'] },
        { controlId: 'sub', childControlIds: ['child'] },
      ],
    });
    h.nodes(d.render(), 'Switch')[0].props.onClick(true);
    assert.deepEqual(d.states[1].permission, []);
    const all = h.nodes(d.render(), 'Checkbox').find(n => n.props.clearselected !== undefined);
    all.props.onClick(true);
    dialog(d).onOk();
    assert.equal(s.events[0][1].length, 1);
    const missing = s.setting({ id: 'missing' });
    assert.throws(() => missing.render(), TypeError);
    const absent = s.setting({ values: [] });
    dialog(absent).onOk();
    assert.deepEqual(s.events[1][1], [{}]);
    return h.tree(s.events);
  },
);
compare(
  'style defaults and actual serialized edits preserve unselected references and save-before-close order',
  host => {
    const s = host();
    const kept = { controlId: 'first', value: 'unchanged' };
    const d = s.style({ values: [kept, { controlId: 'rel' }] });
    d.render();
    d.flush();
    assert.equal(d.states[0].advancedSetting.cardtitlestyle, '{"size":"0","color":"var(--color-text-secondary)"}');
    const edited = {
      ...d.states[0],
      advancedSetting: { rowtitlestyle: '{"size":"2"}', cardstyle: '{"background":"red"}' },
    };
    h.nodes(d.render(), 'CardItem')[0].props.onChange(edited);
    dialog(d).onOk();
    assert.strictEqual(s.events[0][1][0], kept);
    assert.equal(s.events[0][1][1].value, JSON.stringify(edited.advancedSetting));
    assert.deepEqual(s.events[1], ['close']);
    const existing = s.style({ values: [{ controlId: 'rel', value: '{"cardstyle":"existing"}' }] });
    existing.render();
    existing.flush();
    assert.equal(existing.states[0].advancedSetting.cardstyle, 'existing');
    return h.tree({ events: s.events, existing: existing.states });
  },
);
compare('style parser keeps getter counts, primitive coercion and native JSON/selection failures', host => {
  const s = host();
  let reads = 0;
  const value = {
    controlId: 'rel',
    get value() {
      reads++;
      return '{"cardstyle":"ok"}';
    },
  };
  const d = s.style({ values: [value] });
  d.render();
  d.flush();
  assert.equal(reads, 2);
  const numeric = s.style({ values: [{ controlId: 'rel', value: 123 }] });
  numeric.render();
  numeric.flush();
  assert.deepEqual(numeric.states[0].advancedSetting, {});
  const broken = s.style({ values: [{ controlId: 'rel', value: '{' }] });
  broken.render();
  assert.throws(() => broken.flush(), SyntaxError);
  const missing = s.style({ values: [] });
  missing.render();
  assert.throws(() => missing.flush(), TypeError);
  const failure = s.style({
    onChange() {
      throw Error('save failed');
    },
  });
  failure.render();
  failure.flush();
  assert.throws(() => dialog(failure).onOk(), /save failed/);
  assert.equal(s.events.length, 0);
  return { reads, numeric: h.tree(numeric.states), style: h.tree(d.states) };
});
for (const file of h.files)
  assert.equal(h.compile(h.current[file], file), h.compile(h.old[file], file), 'Complete Babel output ' + file);
checks++;
console.log(`  PASS complete Babel output identical for ${h.files.length} production modules`);
console.log(`Rule action dropdown: ${checks} groups passed`);
