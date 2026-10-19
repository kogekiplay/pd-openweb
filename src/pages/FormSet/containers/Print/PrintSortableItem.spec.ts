/** Complete real print/menu and helper execution; service/UI/DOM leaves and hook scheduling are controlled. */
const assert = require('node:assert/strict'),
  cp = require('node:child_process');
const h = require('../../../../../scripts/spec-fixtures/printItemLoader.ts');
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  PASS ${name}`);
}
async function compare(run) {
  assert.deepEqual(await run('current'), await run('old'));
}
function one(root, name) {
  const n = h.nodes(root, name);
  assert.equal(n.length, 1, name);
  return n[0];
}
function named(root, text) {
  const n = h
    .nodes(root, 'span')
    .find(x => (Array.isArray(x.props.children) ? x.props.children.includes(text) : x.props.children === text));
  assert.ok(n, text);
  return n;
}
function rangeTrigger(root) {
  return h.nodes(root, 'Trigger').find(x => h.nodes(x.props.popup, 'RangeDrop').length);
}
function rename(s) {
  h.clickMenu(s, '重命名');
  s.render();
  s.focus();
  return one(s.render(), 'input');
}
async function main() {
  await check('all four complete modules erase byte-identically to frozen history', () => {
    for (const rel of [h.ROW, h.MENU, h.PARENT, h.RECORD])
      assert.equal(h.compile(h.current[rel], rel), h.compile(h.old[rel], rel), rel);
  });
  await check('full print type/range/label matrix preserves actual JSX and missing-view behavior', async () => {
    for (const type of [0, 2, 5, 3, 4, 6, 99])
      for (const range of [1, 2, 3])
        for (const views of [
          [],
          [
            { viewId: 'a', name: 'One' },
            { viewId: undefined, viewName: 'Legacy' },
          ],
        ])
          await compare(v => {
            const s = h.renderer(v, {
              item: h.item({ type, range, views, labelSize: 100, labelCustomWidth: 30, labelCustomHeight: 20 }),
            });
            return h.tree(s.render());
          });
    for (const v of ['old', 'current']) {
      assert.throws(() => h.renderer(v, { item: h.item({ range: 3, views: undefined }) }).render(), TypeError);
      assert.doesNotThrow(() => h.renderer(v, { item: h.item({ range: 1, views: undefined }) }).render());
    }
  });
  await check('edit/preview routes retain all six print branches, own keys and optional options prefix', async () => {
    for (const type of [0, 2, 5, 3, 4, 6, 99])
      await compare(v => {
        const ext = { future: true },
          item = h.item({ type, extension: ext }),
          s = h.renderer(v, { item });
        let root = s.render();
        named(root, '编辑').props.onClick();
        root = s.render();
        named(root, type === 6 ? '测试' : '预览').props.onClick();
        assert.equal(s.selections.length, 1);
        s.selections[0].onOk([{ rowid: 'record' }]);
        if (type === 6) {
          assert.equal(s.requests[0].method, 'SendCloudPrint');
          assert.deepEqual(s.requests[0].args.rowIds, ['record']);
        }
        if (type === 3 || type === 4) {
          assert.equal(s.events.filter(x => x[0] === 'qr').length, 2);
          assert.equal(s.events.find(x => x[0] === 'qr')[1].id, item.id);
        }
        assert.equal(item.extension, ext);
        return h.tree(s.events);
      });
  });
  await check('existing rename input suppresses edit before state or API changes', async () => {
    await compare(v => {
      const s = h.renderer(v, {}, { inputExists: true });
      named(s.render(), '编辑').props.onClick();
      assert.deepEqual(s.events, [['jquery', '.printTemplatesList-tr .name input']]);
      assert.equal(s.requests.length, 0);
      return s.events;
    });
  });
  await check('rename keeps same-name short circuit, empty-name focus and raw untrimmed save argument', async () => {
    for (const value of ['Template', '   ', '  Changed  '])
      await compare(async v => {
        const s = h.renderer(v);
        let field = rename(s);
        field.props.onChange({ stopPropagation: () => s.events.push(['stop']), target: { value } });
        field = one(s.render(), 'input');
        field.props.onBlur({ stopPropagation: () => s.events.push(['stop']) });
        if (value === 'Template') {
          assert.equal(s.requests.length, 0);
          assert.equal(s.states[2], true);
          s.render();
          assert.equal(s.states[2], false);
        } else if (!value.trim()) {
          assert.equal(s.requests.length, 0);
          assert.deepEqual(s.events.at(-2), ['alert', '请输入模板名称', 3]);
          assert.deepEqual(s.events.at(-1), ['focus']);
        } else {
          assert.equal(s.requests[0].args.name, value);
          s.requests[0].resolve(true);
          await h.settle();
          assert.deepEqual(s.events.at(-1), ['update', 'print', { name: value, cloudExtraParams: undefined }]);
        }
        return h.tree(s.events);
      });
  });
  await check(
    'cloud rename clones real parameter objects, updates only first name field and preserves originals',
    async () => {
      await compare(async v => {
        const ext = { keep: true },
          cloud = [
            { fieldKey: 'name', value: 'Old', extension: ext },
            { fieldKey: 'name', value: 'Second' },
            { fieldKey: 'other', value: NaN },
          ],
          item = h.item({ type: 6, cloudExtraParams: cloud }),
          s = h.renderer(v, { item });
        let field = rename(s);
        field.props.onChange({ stopPropagation: () => {}, target: { value: 'New' } });
        one(s.render(), 'input').props.onBlur({ stopPropagation: () => {} });
        s.requests[0].resolve(true);
        await h.settle();
        const result = s.events.find(x => x[0] === 'update')[2].cloudExtraParams;
        assert.notEqual(result, cloud);
        assert.notEqual(result[0], cloud[0]);
        assert.notEqual(result[0].extension, ext);
        assert.deepEqual(result[0].extension, ext);
        assert.equal(result[0].value, 'New');
        assert.equal(result[1].value, 'Second');
        assert.ok(Number.isNaN(result[2].value));
        assert.equal(cloud[0].value, 'Old');
        return h.tree(s.events);
      });
    },
  );
  await check('copy menu preserves absent isRename, callback alert-close ordering and failure truthiness', async () => {
    for (const result of [true, false, {}, 0])
      await compare(async v => {
        const s = h.renderer(v);
        s.render();
        h.clickMenu(s, '复制');
        s.render();
        assert.equal(s.states[2], undefined);
        assert.equal(s.states[3], false);
        assert.equal(s.requests[0].method, 'CopyPrint');
        s.requests[0].resolve(result);
        await h.settle();
        assert.equal(
          s.events.some(x => x[0] === 'load'),
          false,
        );
        const alert = s.events.find(x => x[0] === 'alert');
        if (result) {
          assert.equal(alert[1].msg, '复制成功');
          alert[1].onClose();
          assert.deepEqual(s.events.at(-1), ['load', { worksheetId: 'sheet' }]);
        } else assert.deepEqual(alert, ['alert', '复制失败', 2]);
        return h.tree(s.events);
      });
  });
  await check('delete keeps state patch before actual confirmation and native success-only reload', async () => {
    for (const result of [true, false, {}])
      await compare(async v => {
        const s = h.renderer(v);
        s.render();
        h.clickMenu(s, '删除');
        s.render();
        assert.equal(s.states[2], false);
        assert.equal(s.states[3], false);
        assert.equal(s.requests.length, 0);
        assert.equal(s.confirms[0].buttonType, 'danger');
        s.confirms[0].onOk();
        assert.equal(s.requests[0].method, 'DeletePrint');
        s.requests[0].resolve(result);
        await h.settle();
        assert.equal(
          s.events.some(x => x[0] === 'load'),
          !!result,
        );
        return h.tree(s.events);
      });
  });
  await check(
    'real RangeDrop and parent keep view identities, shallow update prefix and repeated dirty saves',
    async () => {
      await compare(async v => {
        const view = { viewId: undefined, name: 'Missing', worksheetId: 'sheet' },
          available = [view, { viewId: 'v2', worksheetId: 'sheet', name: 'Second' }],
          item = h.item({ views: [view], extension: { future: true } }),
          s = h.renderer(v, { item, worksheetInfo: { worksheetId: 'sheet', views: available } });
        let root = s.render();
        rangeTrigger(root).props.onPopupVisibleChange(true);
        assert.equal(s.requests.length, 0);
        const leaf = one(s.render(), 'RangeDrop'),
          actual = s.range(leaf);
        const radios = h.nodes(actual.instance.render(), 'Radio');
        radios[1].props.onClick();
        const update = s.events.find(x => x[0] === 'update');
        assert.equal(update[2].views[0], view);
        assert.equal(update[2].extension, item.extension);
        s.setProps({ item: { ...item, ...update[2] } });
        root = s.render();
        rangeTrigger(root).props.onPopupVisibleChange(false);
        assert.equal(s.requests[0].method, 'EditPrintRange');
        assert.deepEqual(s.requests[0].args.viewsIds, [undefined]);
        s.requests[0].resolve(false);
        await h.settle();
        assert.deepEqual(s.events.slice(-2), [
          ['alert', '修改失败', 2],
          ['load', { worksheetId: 'sheet' }],
        ]);
        rangeTrigger(s.render()).props.onPopupVisibleChange(false);
        assert.equal(s.requests.length, 2);
        return h.tree(s.events);
      });
    },
  );
  await check(
    'filter display and persistence use real recursive filterData and native formatter without pruning mixed payload',
    async () => {
      const columns = [
        { controlId: 'text', controlName: 'Text', type: 2 },
        { controlId: 'hidden', type: 2, viewDisplay: false },
        { controlId: 'formula', type: 31, viewDisplay: true },
      ];
      for (const filters of [
        [],
        [{ controlId: 'text', dataType: 2, filterType: 2, values: ['x'] }],
        [
          {
            isGroup: true,
            groupFilters: [{ controlId: 'text', dataType: 2, filterType: 2, values: ['x'] }],
            metadata: 'keep',
          },
          { controlId: 'deleted', dataType: 2, filterType: 2, values: ['y'] },
        ],
        [{ controlId: 'deleted', dataType: 2, filterType: 2, values: ['y'] }],
      ])
        await compare(async v => {
          const s = h.renderer(v, { item: h.item({ filters }), worksheetControls: columns });
          let root = s.render();
          named(root, '筛选条件').props.onClick();
          const dialog = one(s.render(), 'FilterDialog');
          assert.equal(dialog.props.filters, filters);
          assert.deepEqual(
            dialog.props.columns.map(x => x.controlId),
            ['text', 'formula'],
          );
          assert.equal(dialog.props.columns[1].type, 6);
          dialog.props.setValue({ filters, isShowBtnFilterDialog: false, isOk: false });
          assert.equal(s.requests.length, 0);
          dialog.props.setValue({ filters, isShowBtnFilterDialog: false, isOk: true });
          assert.equal(s.requests[0].method, 'EditPrintFilter');
          const body = s.requests[0].args.filters;
          if (filters.length === 2) assert.equal(body.length, 2);
          if (filters.length === 1 && filters[0].controlId === 'deleted') assert.deepEqual(body, []);
          s.requests[0].resolve(true);
          await h.settle();
          assert.deepEqual(s.events.at(-1), ['load', { worksheetId: 'sheet' }]);
          return { tree: h.tree(root), events: h.tree(s.events) };
        });
    },
  );
  await check(
    'print count controls retain upgrade gating, null/zero values and parent callback return identity',
    async () => {
      for (const disabled of [false, true])
        for (const value of [undefined, null, 0, 7])
          await compare(v => {
            const result = Promise.resolve(),
              events = [],
              s = h.renderer(v, {
                printLimit: value,
                printLimitCount: 3,
                printCountFeatureDisabled: disabled,
                onPrintCountUpgrade: () => events.push(['upgrade']),
                onPrintLimitChange: (...args) => {
                  events.push(['limit', ...args]);
                  return result;
                },
              });
            const root = s.render();
            named(root, value == null ? '无限制' : `${value}次`).props.onClick();
            const next = s.render();
            if (disabled) {
              assert.deepEqual(events, [['upgrade']]);
              assert.equal(h.nodes(next, 'CountModal').length, 0);
            } else {
              const modal = one(next, 'CountModal');
              assert.equal(modal.props.value, value);
              assert.equal(modal.props.defaultValue, 3);
              assert.equal(modal.props.onSave(null, 0), result);
              assert.deepEqual(events, [['limit', 'print', null, 0]]);
              modal.props.onCancel();
              assert.equal(h.nodes(s.render(), 'CountModal').length, 0);
            }
            return events;
          });
    },
  );
  await check(
    'props changes keep initial input state until real rename resets it; missing ref branches stay native',
    async () => {
      await compare(v => {
        const s = h.renderer(v);
        s.render();
        s.setProps({ item: h.item({ name: 'Changed' }) });
        s.render();
        assert.equal(s.states[1], 'Template');
        h.menu(s).props.setFn({ isRename: true, showMoreOption: false });
        let root = s.render();
        assert.equal(one(root, 'input').props.value, 'Changed');
        s.effects();
        return h.tree(s.events);
      });
      for (const v of ['old', 'current']) {
        const s = h.renderer(v);
        s.render();
        h.menu(s).props.setFn({ isRename: true, showMoreOption: false });
        let root = s.render();
        one(root, 'input').props.onChange({ stopPropagation: () => {}, target: { value: '' } });
        assert.throws(() => one(s.render(), 'input').props.onBlur({ stopPropagation: () => {} }), TypeError);
      }
    },
  );
  await check('real cloud sender keeps own undefined IDs and row slots, policy upgrade and size refusal', async () => {
    await compare(v => {
      const s = h.renderer(v, { item: h.item({ id: undefined, type: 6 }), worksheetInfo: {} });
      named(s.render(), '测试').props.onClick();
      s.selections[0].onOk([]);
      const args = s.requests[0].args;
      for (const k of ['id', 'projectId', 'appId', 'worksheetId']) assert.equal(Object.hasOwn(args, k), true);
      assert.deepEqual(args.rowIds, [undefined]);
      assert.equal(Object.hasOwn(args.rowIds, 0), true);
      return h.tree(s.events);
    });
    await compare(v => {
      const s = h.renderer(v);
      s.cloud({ rowIds: new Array(51).fill('record'), finishCallback: () => s.events.push(['finish']) });
      assert.equal(s.requests.length, 0);
      assert.deepEqual(s.events, [['alert', '单次最多打印 50 条', 3], ['finish']]);
      return s.events;
    });
    await compare(v => {
      const s = h.renderer(v, { item: h.item({ type: 6 }) }, { cloudFeature: '2' });
      named(s.render(), '测试').props.onClick();
      s.selections[0].onOk([{ rowid: 'x' }]);
      assert.equal(s.requests.length, 0);
      assert.equal(s.events.at(-1)[0], 'upgrade');
      return h.tree(s.events);
    });
  });
  await check('legacy transport and invalid cloud-name failures remain explicit old/new child-process failures', () => {
    for (const action of ['rename', 'filter', 'copy', 'delete', 'range', 'bad-cloud-name'])
      for (const version of ['old', 'current']) {
        const child = cp.spawnSync(process.execPath, [__filename, '--legacy-failure', action, version], {
          cwd: h.ROOT,
          encoding: 'utf8',
        });
        assert.notEqual(child.status, 0);
        assert.match(
          child.stderr,
          action === 'bad-cloud-name' ? /Cannot set properties of undefined/ : /print-request-rejected/,
        );
      }
  });
  console.log(`${checks} complete print item checks passed`);
}
async function legacyFailure(action, version) {
  const s = h.renderer(version, { item: h.item({ type: action === 'bad-cloud-name' ? 6 : 0, cloudExtraParams: [] }) });
  let root = s.render();
  if (action === 'rename' || action === 'bad-cloud-name') {
    let field = rename(s);
    field.props.onChange({ stopPropagation: () => {}, target: { value: 'New' } });
    one(s.render(), 'input').props.onBlur({ stopPropagation: () => {} });
  } else if (action === 'filter') {
    named(root, '筛选条件').props.onClick();
    one(s.render(), 'FilterDialog').props.setValue({ filters: [], isShowBtnFilterDialog: false, isOk: true });
  } else if (action === 'copy') h.clickMenu(s, '复制');
  else if (action === 'delete') {
    h.clickMenu(s, '删除');
    s.confirms[0].onOk();
  } else {
    const leaf = one(root, 'RangeDrop');
    leaf.props.setData({ printData: s.props.item });
    root = s.render();
    rangeTrigger(root).props.onPopupVisibleChange(false);
  }
  assert.equal(s.requests.length, 1);
  if (action === 'bad-cloud-name') s.requests[0].resolve(true);
  else s.requests[0].reject(Error('print-request-rejected'));
  await h.settle();
  throw Error('Expected native failure did not escape');
}
const run = process.argv[2] === '--legacy-failure' ? legacyFailure(process.argv[3], process.argv[4]) : main();
run.catch(error => {
  console.error(error);
  process.exitCode = 1;
});
