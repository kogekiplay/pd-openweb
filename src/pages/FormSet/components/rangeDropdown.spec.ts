/** Complete real dropdowns and helper; leaf UI/memo/ClickAway are controlled, with actual parent callbacks. */
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process');
const h = require('../../../../scripts/spec-fixtures/rangeDropdownLoader.ts');
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`  PASS ${name}`);
}
function compare(run) {
  assert.deepEqual(run(h.button), run(h.oldButton));
}
check('complete button JSX preserves all scope states, legacy arrays and supported view types', () => {
  for (const isAllView of [undefined, 0, 1, 2])
    for (const detailviews of [
      undefined,
      '[]',
      '["v1"]',
      '["v1","tree","org","v2",null]',
      '[null,7,{"future":true},"v1"]',
    ])
      for (const listviews of ['[]', '["v1"]', '[true,"tree",null]']) {
        compare(source => {
          const s = h.buttonRenderer(source, {
            data: { isAllView, advancedSetting: { detailviews, listviews, keep: 'retained' } },
          });
          return { tree: h.tree(s.render()), events: s.events };
        });
      }
});
check('the real helper filters native IDs, sparse entries and inherited fields without cloning or mutation', () => {
  assert.equal(
    h.compile(h.declaration(fs.readFileSync(path.join(h.ROOT, h.UTIL), 'utf8'), 'getShowViews'), h.UTIL),
    h.compile(
      h.declaration(
        cp.execFileSync('git', ['show', `${h.BASE}:${h.UTIL}`], { cwd: h.ROOT, encoding: 'utf8' }),
        'getShowViews',
      ),
      h.UTIL,
    ),
  );
  for (const id of [undefined, null, 'sheet', 'v1', 'constructor', '__proto__']) {
    const run = helper => {
      const reads = [];
      const item = Object.create({ worksheetId: 'sheet' });
      Object.defineProperty(item, 'viewId', {
        get() {
          reads.push('id');
          return id;
        },
        enumerable: true,
      });
      const views = [item, , { viewId: undefined, worksheetId: undefined }];
      const keys = Reflect.ownKeys(views);
      const result = helper(views);
      if (result.length) assert.equal(result[0], item);
      assert.deepEqual(Reflect.ownKeys(views), keys);
      return { result, reads };
    };
    assert.deepEqual(run(h.getShowViews), run(h.oldHelper));
  }
  for (const raw of [undefined, null, {}, [null]]) {
    assert.throws(() => h.getShowViews(raw), TypeError);
    assert.throws(() => h.oldHelper(raw), TypeError);
  }
});
check('single view toggles keep unknown extension entries, duplicate-removal and metadata reference semantics', () => {
  for (const raw of [[null, 7, { future: true }, 'v1', 'v1'], ['tree', true], new Array(2)]) {
    compare(source => {
      const before = raw.slice();
      const advanced = { detailviews: 'raw', listviews: '[]', other: 'keep' };
      const data = { btnId: 'b', isAllView: 0, advancedSetting: advanced, extension: { keep: true } };
      const s = h.buttonRenderer(source, { data }, value => (value === 'raw' ? raw : h.safeParse(value, 'array')));
      const root = s.render();
      const row = h.nodes(root, 'div').find(x => x.props.className === 'flexRow alignItemsCenter mTop10');
      h.nodes(row, 'span')
        .find(x => typeof x.props.onClick === 'function')
        .props.onClick();
      const next = s.events[0][1];
      assert.equal(next.extension, data.extension);
      assert.equal(next.advancedSetting.other, 'keep');
      assert.notEqual(next, data);
      assert.notEqual(next.advancedSetting, advanced);
      assert.deepEqual(raw, before);
      return { events: h.tree(s.events), original: raw };
    });
  }
});
check('all/selected scope writes keep omit semantics, own prototype/symbol fields and source values', () => {
  compare(source => {
    const advanced = { detailviews: '["v1"]', listviews: '[]', extension: 'keep' };
    Object.defineProperty(advanced, '__proto__', { value: 'own', enumerable: true });
    advanced[Symbol.for('range-meta')] = 'symbol';
    const data = { isAllView: 0, advancedSetting: advanced, extension: { keep: true } };
    const s = h.buttonRenderer(source, { data });
    const root = s.render();
    h.nodes(root, 'Radio')[0].props.onClick();
    h.nodes(root, 'Radio')[1].props.onClick();
    h.nodes(root, 'Icon')[0].props.onClick();
    const all = s.events[0][1];
    assert.equal(Object.hasOwn(all.advancedSetting, 'detailviews'), false);
    assert.equal(all.advancedSetting.extension, 'keep');
    assert.equal(all.extension, data.extension);
    assert.equal(s.events[1][1].advancedSetting, advanced);
    return h.tree(s.events);
  });
});
check('header selection uses exact filtered/detail/batch arrays and preserves missing ID serialization', () => {
  for (const selected of [false, true])
    compare(source => {
      const available = h.views(),
        detail = selected ? ['v1', 'tree', 'org', 'v2', null] : [],
        list = selected ? ['v1', 'tree', null] : [];
      const s = h.buttonRenderer(source, {
        views: available,
        data: {
          isAllView: 0,
          advancedSetting: { detailviews: JSON.stringify(detail), listviews: JSON.stringify(list) },
        },
      });
      const root = s.render();
      const headers = h.nodes(root, 'span').filter(x => x.props.title === '记录详情' || x.props.title === '批量操作');
      assert.equal(headers.length, 2);
      headers[0].props.onClick();
      headers[1].props.onClick();
      const first = JSON.parse(s.events[0][1].advancedSetting.detailviews),
        second = JSON.parse(s.events[1][1].advancedSetting.listviews);
      // An absent viewId does not equal JSON null in includes; preserve the old truthiness/strict identity behavior.
      assert.deepEqual(first, ['v1', 'tree', 'org', 'v2', null]);
      assert.deepEqual(second, ['v1', 'tree', null]);
      return { tree: h.tree(root), events: h.tree(s.events) };
    });
});
check('all noBatch producer combinations and memo invalidation retain their real behavior', () => {
  for (const writeObject of [undefined, 1, 2])
    for (const writeType of [undefined, 1, 2])
      for (const clickType of [1, 3])
        for (const noBatch of [false, true])
          compare(source => {
            const data = {
              isAllView: 0,
              writeObject,
              writeType,
              clickType,
              advancedSetting: { detailviews: '[]', listviews: '[]' },
            };
            const views = h.views();
            const s = h.buttonRenderer(source, { data, noBatch, views });
            const first = h.tree(s.render());
            views.push({ viewId: 'late', worksheetId: 'sheet', viewType: 0, name: 'Late' });
            const same = h.tree(s.render());
            assert.deepEqual(same, first);
            s.setProps({ views: [...views] });
            const changed = h.tree(s.render());
            return { first, same, changed };
          });
});
check('raw getter order, array operations and failures before parent onChange preserve the valid-data prefix', () => {
  compare(source => {
    const reads = [];
    const list = ['v1'];
    const native = list.filter;
    Object.defineProperty(list, 'filter', {
      get() {
        reads.push('filter');
        return native;
      },
    });
    const advanced = {
      get detailviews() {
        reads.push('detail');
        return 'raw';
      },
      get listviews() {
        reads.push('list');
        return '[]';
      },
      get extension() {
        reads.push('extension');
        return 'keep';
      },
    };
    const s = h.buttonRenderer(source, { data: { isAllView: 0, advancedSetting: advanced } }, v =>
      v === 'raw' ? list : h.safeParse(v, 'array'),
    );
    const root = s.render();
    const row = h.nodes(root, 'div').find(x => x.props.className === 'flexRow alignItemsCenter mTop10');
    h.nodes(row, 'span')
      .find(x => typeof x.props.onClick === 'function')
      .props.onClick();
    return { reads, events: h.tree(s.events) };
  });
  for (const source of [h.oldButton, h.button]) {
    const s = h.buttonRenderer(source, {
      onChange() {
        throw Error('parent-fail');
      },
    });
    const root = s.render();
    assert.throws(h.nodes(root, 'Radio')[1].props.onClick, /parent-fail/);
  }
});
check('malformed containers reject explicitly; original safeParse defaults and legacy entries remain', () => {
  for (const text of ['null', '{}', '"v1"', '2', 'false']) {
    const s = h.buttonRenderer(h.button, {
      data: { isAllView: 0, advancedSetting: { detailviews: text, listviews: '[]' } },
    });
    assert.throws(() => s.render(), /Invalid view range list/);
    assert.deepEqual(s.events, []);
  }
  for (const text of [undefined, '', 'invalid-json']) {
    const s = h.buttonRenderer(h.button, {
      data: { isAllView: 0, advancedSetting: { detailviews: text, listviews: '[]' } },
    });
    assert.doesNotThrow(() => s.render());
  }
  const legacy = h.buttonRenderer(h.oldButton, {
    data: { isAllView: 0, advancedSetting: { detailviews: '"v1"', listviews: '[]' } },
  });
  assert.doesNotThrow(() => legacy.render());
  const list = [null, { keep: true }, 7, true];
  assert.equal(h.values.viewRangeList(list), list);
});
check('native root serializers and cycles are rejected before parent writes without a fake empty range', () => {
  const raw = ['v1'];
  Object.defineProperty(raw, 'filter', {
    value: () => ({ toJSON: () => undefined }),
    enumerable: true,
    writable: true,
    configurable: true,
  });
  const s = h.buttonRenderer(h.button, {}, v => (v === '["v1"]' ? raw : h.safeParse(v, 'array')));
  const root = s.render();
  const row = h.nodes(root, 'div').find(x => x.props.className === 'flexRow alignItemsCenter mTop10');
  const click = h.nodes(row, 'span').find(x => typeof x.props.onClick === 'function').props.onClick;
  assert.throws(click, /Invalid view range serialization/);
  assert.deepEqual(s.events, []);
  const cyclic = [];
  cyclic.push(cyclic);
  assert.throws(() => h.values.serializeViewRange(cyclic), TypeError);
  for (const value of [{}, undefined, 'x']) assert.throws(() => h.values.serializeViewRange(value), /serialization/);
});
check('print dropdown whole class erases identically and preserves real selection/concat/filter references', () => {
  assert.equal(h.compile(h.print, h.PRINT), h.compile(h.oldPrint, h.PRINT));
  for (const range of [1, 3, 2]) {
    const run = source => {
      const views = h.views();
      const selected = [views[0], views[0], { viewId: 'deleted', extension: { keep: true } }];
      const data = { id: 'print', range, views: selected, extension: { keep: true } };
      const s = h.printInstance(source, { printData: data, views });
      const root = s.instance.render();
      h.nodes(root, 'Radio').forEach(x => x.props.onClick());
      h.nodes(root, 'Icon')[0].props.onClick();
      for (const cb of h.nodes(root, 'Checkbox')) cb.props.onClick(cb.props.checked);
      assert.equal(data.views, selected);
      assert.equal(selected.length, 3);
      for (const event of s.events.filter(x => x[0] === 'set')) {
        assert.equal(event[1].printData.extension, data.extension);
        assert.notEqual(event[1].printData, data);
      }
      return { tree: h.tree(root), events: h.tree(s.events), data };
    };
    assert.deepEqual(run(h.print), run(h.oldPrint));
  }
  for (const source of [h.oldPrint, h.print]) {
    const x = h.printInstance(source, { printData: { range: 3 } });
    assert.throws(() => x.instance.render(), TypeError);
  }
});
check('actual print parent update callbacks receive the same complete leaf payload and update prefix', () => {
  const rel = h.PARENT;
  const run = (source, dropdown) => {
    let callback;
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node.type === 'JSXAttribute' && node.name.name === 'setData') callback = node.value.expression;
      Object.values(node).forEach(walk);
    }
    walk(h.parse(source));
    assert.ok(callback);
    const results = [];
    const fn = new Function(
      'updatePrint',
      'setIsChangeDrop',
      h.compile('const actual=' + source.slice(callback.start, callback.end) + ';', rel) + ';return actual;',
    )(
      (...args) => results.push(['update', ...args]),
      value => results.push(['dirty', value]),
    );
    const data = { id: 'print', range: 3, views: h.views().slice(0, 1), extension: { keep: true } };
    const s = h.printInstance(dropdown, { printData: data, setData: fn });
    h.nodes(s.instance.render(), 'Radio')[0].props.onClick();
    assert.equal(results[0][1], 'print');
    assert.equal(results[0][2].extension, data.extension);
    assert.deepEqual(results[1], ['dirty', true]);
    return results;
  };
  assert.deepEqual(run(fs.readFileSync(path.join(h.ROOT, rel), 'utf8'), h.print), run(h.oldParent, h.oldPrint));
});
check('getShowViews type propagation and view-consumer fixes erase identically across every edited caller', () => {
  for (const rel of [
    'src/pages/worksheet/views/util.ts',
    'src/pages/Mobile/RecordList/index.tsx',
    'src/pages/Print/components/SaveDia/index.tsx',
    'src/pages/customPage/components/editWidget/button/btnSetting.tsx',
    'src/pages/customPage/components/editWidget/carousel/Setting.tsx',
    'src/pages/customPage/components/editWidget/view/Setting.tsx',
    'src/pages/widgetConfig/widgetSetting/components/embed/SelectViewFromSheet.tsx',
    'src/pages/worksheet/components/ViewItems/ViewItems.tsx',
  ]) {
    const old = cp.execFileSync('git', ['show', `${h.BASE}:${rel}`], { cwd: h.ROOT, encoding: 'utf8' });
    assert.equal(h.compile(fs.readFileSync(path.join(h.ROOT, rel), 'utf8'), rel), h.compile(old, rel), rel);
  }
});
console.log(`${checks} print/button range dropdown checks passed`);
