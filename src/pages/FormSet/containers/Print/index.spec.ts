/** Complete real controller/drawer/count setting and print-row callback, with isolated service and UI hosts. */
const assert = require('node:assert/strict'),
  cp = require('node:child_process');
const h = require('../../../../../scripts/spec-fixtures/printControllerLoader.ts');
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  PASS ${name}`);
}
async function compare(run) {
  assert.deepEqual(await run('current'), await run('old'));
}
const one = (root, name) => {
  const nodes = h.nodes(root, name);
  assert.equal(nodes.length, 1, name);
  return nodes[0];
};
const classNode = (root, name) => {
  const found = h.nodes(root, 'div').find(x => x.props.className === name);
  assert.ok(found, name);
  return found;
};
async function loaded(version, items, provided = {}, options = {}) {
  const s = h.instance(version, provided, options);
  s.controller.componentDidMount();
  assert.deepEqual(
    s.requests.map(x => x.method),
    ['GetPrintList', 'GetSystemIntegrationList'],
  );
  s.requests[0].resolve(items);
  s.requests[1].resolve([]);
  await h.settle();
  return s;
}
async function main() {
  await check('controller and count card full Babel outputs remain byte-identical to frozen history', () => {
    for (const rel of [h.MAIN, h.CARD]) assert.equal(h.compile(h.current[rel], rel), h.compile(h.old[rel], rel), rel);
  });
  await check(
    'mount request order/loading and actual array assignment retain identity, own undefined and partial state',
    async () => {
      await compare(async v => {
        const s = h.instance(v, { worksheetId: undefined, worksheetInfo: { projectId: undefined } }),
          initial = Reflect.ownKeys(s.controller.state);
        assert.equal(initial.includes('name'), false);
        assert.equal(initial.includes('previewRowId'), false);
        s.controller.componentDidMount();
        assert.equal(one(s.render(), 'LoadDiv').type.displayName, 'LoadDiv');
        assert.equal(Object.hasOwn(s.requests[0].args, 'worksheetId'), true);
        assert.equal(s.requests[0].args.worksheetId, undefined);
        const rows = [h.item({ extension: { keep: true } })];
        s.requests[0].resolve(rows);
        s.requests[1].resolve([{ opaque: true }]);
        await h.settle();
        assert.equal(s.controller.state.printData, rows);
        assert.equal(s.controller.state.bindKuaiMai, true);
        assert.equal(s.controller.state.loading, false);
        return { state: s.controller.state, events: h.tree(s.events) };
      });
    },
  );
  await check(
    'load response race and callbacks preserve old captured request semantics without new guards',
    async () => {
      await compare(async v => {
        const s = h.instance(v);
        s.controller.loadPrint({ worksheetId: 'old' });
        s.controller.loadPrint({ worksheetId: 'new' });
        const newer = [h.item({ id: 'new' })],
          older = [h.item({ id: 'old' })];
        s.requests[1].resolve(newer);
        await h.settle();
        assert.equal(s.controller.state.printData, newer);
        s.requests[0].resolve(older);
        await h.settle();
        assert.equal(s.controller.state.printData, older);
        return h.tree(s.events);
      });
    },
  );
  await check(
    'classification and real SortableList renderItem preserve all row props, array elements and count settings',
    async () => {
      for (const feature of ['1', '2', 1])
        await compare(async v => {
          const rows = [
              h.item({
                id: 'normal',
                type: 0,
                advanceSettings: [
                  { key: 'print_limit_enabled', value: '1' },
                  { key: 'print_limit_count', value: '7' },
                ],
              }),
              h.item({ id: 'qr', type: 3 }),
              h.item({ id: 'word', type: 2 }),
              h.item({ id: 'cloud', type: 6 }),
              h.item({ id: 'future', type: 99 }),
            ],
            s = await loaded(v, rows, {}, { countFeature: feature });
          const groups = h.nodes(s.render(), 'SortableList');
          assert.deepEqual(
            groups.map(x => x.props.items.map(o => o.id)),
            [['normal', 'word'], ['qr'], ['cloud']],
          );
          for (const group of groups)
            for (const item of group.props.items) {
              const DragHandle = () => null;
              const row = group.props.renderItem({ item, DragHandle });
              assert.equal(row.props.item, item);
              assert.equal(row.props.DragHandle, DragHandle);
              assert.equal(row.props.worksheetInfo, s.props.worksheetInfo);
              assert.equal(row.props.updatePrint, s.controller.updatePrint);
              if (item.id === 'normal') {
                assert.equal(row.props.printLimit, feature === '2' ? undefined : 7);
                assert.equal(row.props.printLimitCount, 7);
                assert.equal(row.props.printCountFeatureDisabled, feature === '2');
              }
            }
          return h.tree(s.render());
        });
    },
  );
  await check(
    'updatePrint clones every existing item and replaces matching duplicate/undefined IDs without pruning extensions',
    async () => {
      await compare(async v => {
        const ext = { keep: NaN },
          a = h.item({ id: undefined, extension: ext }),
          b = h.item({ id: 'other' }),
          rows = [a, b, a],
          s = await loaded(v, rows);
        const patch = { name: undefined, extra: Infinity };
        s.controller.updatePrint(undefined, patch);
        const updated = s.controller.state.printData;
        assert.notEqual(updated, rows);
        assert.notEqual(updated[0], a);
        assert.notEqual(updated[1], b);
        assert.notEqual(updated[0], updated[2]);
        assert.equal(updated[0].extension, ext);
        assert.equal(Object.hasOwn(updated[0], 'name'), true);
        assert.equal(updated[0].name, undefined);
        assert.equal(a.name, 'Template');
        assert.equal(updated[1].name, 'Template');
        return { state: updated, events: h.tree(s.events) };
      });
    },
  );
  await check(
    'native sort ordering and failed response clone keep original state snapshots and numeric class coercion',
    async () => {
      for (const type of [0, 1, 6, 99])
        for (const result of [true, false, {}, 0])
          await compare(async v => {
            const a = h.item({ id: 'a', type: 0 }),
              b = h.item({ id: 'b', type: 3 }),
              c = h.item({ id: 'c', type: 6 }),
              f = h.item({ id: 'future', type: 99 }),
              rows = [a, b, c, f],
              s = await loaded(v, rows),
              incoming = [h.item({ id: 'new', type })];
            s.controller.onSortEnd(incoming, type);
            const request = s.requests.at(-1);
            assert.equal(request.method, 'EditPrintTemplateSort');
            const defaults = rows.filter(x =>
              type === 0
                ? [3, 6].includes(x.type)
                : type === 1
                  ? [0, 6].includes(x.type)
                  : type === 6
                    ? [0, 3].includes(x.type)
                    : [0, 3, 6].includes(x.type),
            );
            const expected = type ? defaults.concat(incoming) : incoming.concat(defaults);
            assert.deepEqual(
              request.args.sortItems,
              expected.map((x, i) => ({ printId: x.id, sort: i })),
            );
            assert.equal(s.controller.state.printData, rows);
            request.resolve(result);
            await h.settle();
            if (result) {
              assert.deepEqual(s.controller.state.printData, expected);
              assert.equal(s.controller.state.printData.includes(incoming[0]), true);
            } else {
              assert.deepEqual(s.controller.state.printData, rows);
              assert.notEqual(s.controller.state.printData, rows);
              assert.notEqual(s.controller.state.printData[0], a);
              assert.deepEqual(s.events.at(-1), ['alert', '移动失败', 2]);
            }
            return h.tree(s.events);
          });
    },
  );
  await check('template limit checks preserve 499/500 threshold and guard all ordinary creation paths', async () => {
    for (const length of [0, 499, 500])
      await compare(v => {
        const s = h.instance(v);
        s.controller.state.printData = new Array(length).fill(h.item());
        const before = s.controller.state;
        s.controller.addNewRecordPrintTemp();
        if (length >= 500) {
          assert.equal(s.controller.state.showPrintTemDialog, false);
          assert.equal(s.events.at(-1)[0], 'alert');
        } else {
          assert.equal(s.controller.state.showPrintTemDialog, true);
          assert.equal(s.controller.state.type, 'new');
          assert.equal(s.controller.state.isDefault, true);
        }
        assert.equal(s.controller.state, before);
        return h.tree(s.events);
      });
  });
  await check(
    'actual create drawer keeps fallback project gating, code callback-before-close and overseas cloud hiding',
    async () => {
      for (const featureType of ['1', '2', 0])
        for (const overseas of [false, true])
          await compare(v => {
            const s = h.instance(v, {}, { featureType, overseas });
            const calls = [];
            const drawer = s.createDrawer({
              worksheetProjectId: undefined,
              visible: true,
              onCloseDrawer: () => calls.push('close'),
              addNewRecordPrintTemp: () => calls.push('record'),
              addWordPrintTemp: () => calls.push('word'),
              addExcelPrintTemp: () => calls.push('excel'),
              addKuaiMaiPrintTemp: () => calls.push('cloud'),
              addCodePrintTemp: x => calls.push(x),
            });
            const root = drawer.render(),
              entries = h.nodes(root, 'div').filter(x => x.props.className === 'printTempDrawerListItem');
            entries[1].props.onClick();
            assert.deepEqual(calls, [4, 'close']);
            assert.equal(entries.length, featureType ? (overseas ? 5 : 6) : 3);
            return h.tree(root);
          });
    },
  );
  await check(
    'Word/Excel creation and cloud integration distinguish entitlement, bound state and binding completion',
    async () => {
      for (const featureType of ['1', '2'])
        for (const bound of [false, true])
          await compare(v => {
            const s = h.instance(v, {}, { featureType });
            s.controller.state.bindKuaiMai = bound;
            s.controller.addDrawerPrintTemp('Excel');
            if (featureType === '2') {
              assert.equal(s.controller.state.showEditPrint, false);
              assert.equal(s.events.at(-1)[0], 'upgrade');
            } else {
              assert.equal(s.controller.state.showEditPrint, true);
              assert.equal(s.controller.state.fileType, 'Excel');
              assert.equal(s.controller.state.type, 'new');
            }
            s.controller.addKuaiMaiPrintTemp();
            if (featureType === '2') {
              assert.equal(s.bindings.length, 0);
              assert.equal(s.controller.state.showCloudPrint, false);
            } else if (bound) assert.equal(s.controller.state.showCloudPrint, true);
            else {
              assert.equal(s.bindings.length, 1);
              assert.equal(s.controller.state.showCloudPrint, false);
              s.bindings[0].onOk();
              assert.equal(s.controller.state.showCloudPrint, true);
            }
            return h.tree(s.events);
          });
    },
  );
  await check('code creation preserves real control arrays/worksheetInfo ID and close refresh sequencing', async () => {
    for (const type of [3, 4, 99])
      await compare(v => {
        const controls = [{ controlId: 'a', type: 2 }],
          s = h.instance(v, { worksheetId: 'outer', worksheetInfo: { worksheetId: 'inner', template: { controls } } });
        s.controller.addCodePrintTemp(type);
        const qr = s.events.find(x => x[0] === 'qr')[1];
        assert.equal(qr.controls, controls);
        assert.equal(qr.worksheetId, 'inner');
        assert.equal(qr.printType, type === 3 ? 1 : 3);
        assert.equal(s.controller.state.showCreatePrintTemp, false);
        qr.onClose();
        assert.deepEqual(s.requests[0].args, { worksheetId: 'inner' });
        return h.tree(s.events);
      });
  });
  await check(
    'template count save preserves null/zero/previous count condition and true/false response behavior',
    async () => {
      for (const count of [null, 0, 5])
        for (const previousCount of [undefined, 0, 4])
          for (const result of [true, false])
            await compare(async v => {
              const s = h.instance(v),
                promise = s.controller.updateTemplatePrintLimit(undefined, count, previousCount),
                req = s.requests[0];
              assert.equal(req.method, 'EditPrintCountConfig');
              assert.equal(req.args.printId, undefined);
              assert.equal(Object.hasOwn(req.args, 'printLimitCount'), count !== null || !!previousCount);
              if (Object.hasOwn(req.args, 'printLimitCount'))
                assert.equal(req.args.printLimitCount, count !== null ? count : previousCount);
              req.resolve(result);
              if (result) {
                await promise;
                assert.equal(s.requests[1].method, 'GetPrintList');
              } else await assert.rejects(promise, /Unable to update print count limit/);
              return h.tree(s.events);
            });
    },
  );
  await check(
    'real row callback changes controller without serializing unknown metadata or firing extra requests',
    async () => {
      await compare(async v => {
        const ext = { keep: true },
          item = h.item({ extension: ext }),
          s = await loaded(v, [item]);
        const group = one(s.render(), 'SortableList'),
          element = group.props.renderItem({ item, DragHandle: () => null }),
          actual = s.row(element);
        const tree = actual.render();
        const leaf = one(tree, 'RangeDrop');
        leaf.props.setData({ printData: { ...item, range: 1 } });
        assert.equal(s.controller.state.printData[0].extension, ext);
        assert.equal(s.controller.state.printData[0].range, 1);
        assert.equal(s.requests.length, 2);
        return h.tree(s.events);
      });
    },
  );
  await check(
    'editor/cloud/system dialogs preserve local sentinels, optional state keys and callback close/reload prefixes',
    async () => {
      await compare(async v => {
        const item = h.item({ id: 'b' }),
          s = await loaded(v, [item]);
        s.controller.changeState({
          showEditPrint: true,
          templateId: 'b',
          fileType: 'Word',
          type: 'edit',
          name: undefined,
        });
        let root = s.render(),
          editor = one(root, 'EditPrint');
        assert.equal(editor.props.templateData, item);
        assert.deepEqual(editor.props.exampleData, {});
        const opaque = { nested: [1], future: true };
        editor.props.updateExampleData(opaque);
        assert.equal(s.controller.state.exampleData, opaque);
        editor.props.refreshFn(true, undefined);
        assert.equal(s.controller.state.templateId, 'b');
        assert.equal(s.requests.at(-1).method, 'GetPrintList');
        editor.props.onClose();
        assert.equal(s.controller.state.showEditPrint, false);
        s.controller.changeState({ showCloudPrint: true, templateId: 'deleted', type: 'preview' });
        root = s.render();
        const cloud = one(root, 'CloudPrint');
        assert.equal(cloud.props.templateData, undefined);
        cloud.props.onClose();
        assert.equal(s.controller.state.templateId, '');
        s.controller.changeState({ showPrintTemDialog: true, templateId: undefined, previewRowId: undefined });
        root = s.render();
        const sys = one(root, 'PrintTemDialog');
        assert.equal(sys.props.printId, undefined);
        assert.equal(sys.props.rowId, '');
        sys.props.onBack();
        assert.equal(s.controller.state.showPrintTemDialog, false);
        assert.equal(s.controller.state.name, '');
        return h.tree(s.events);
      });
    },
  );
  await check(
    'real print-count card uses exact opaque IDs and merge order, guards duplicate save and reverts rejection',
    async () => {
      for (const result of [true, false, 'reject'])
        await compare(async v => {
          const info = {
              worksheetId: undefined,
              projectId: undefined,
              appId: undefined,
              advancedSetting: { print_count_enabled: '0', keep: 'retained' },
              extension: { keep: true },
            },
            s = h.instance(v, { worksheetInfo: info });
          const card = s.card(one(s.render(), 'CountCard'));
          let root = card.render();
          card.effects();
          root = card.render();
          one(root, 'Switch').props.onChange(true);
          one(root, 'Switch').props.onChange(false);
          assert.equal(s.requests.length, 1);
          root = card.render();
          assert.equal(one(root, 'Switch').props.disabled, true);
          const request = s.requests[0];
          assert.equal(Object.hasOwn(request.args, 'workSheetId'), true);
          assert.equal(request.args.workSheetId, undefined);
          assert.deepEqual(request.args.advancedSetting, { print_count_enabled: '1' });
          if (result === 'reject') request.reject(Error('isolated'));
          else request.resolve(result);
          await h.settle();
          root = card.render();
          assert.equal(one(root, 'Switch').props.disabled, false);
          assert.equal(one(root, 'Switch').props.checked, result === true);
          if (result === true) {
            const value = s.events.find(x => x[0] === 'change')[1];
            assert.equal(value.extension, info.extension);
            assert.deepEqual(value.advancedSetting, { print_count_enabled: '1', keep: 'retained' });
            assert.equal(info.advancedSetting.print_count_enabled, '0');
          } else assert.deepEqual(s.events.at(-1), ['alert', '修改失败，请稍后再试', 2]);
          return h.tree(s.events);
        });
    },
  );
  await check('count-card props effect and disabled upgrade retain actual original behavior', async () => {
    await compare(v => {
      const s = h.instance(v);
      let node = one(s.render(), 'CountCard');
      node = { ...node, props: { ...node.props, disabled: true } };
      const card = s.card(node);
      let root = card.render();
      assert.equal(one(root, 'Switch').props.disabled, true);
      one(root, 'Button').props.onClick();
      assert.equal(s.events.at(-1)[0], 'upgrade');
      card.setProps({ worksheetInfo: { worksheetId: 'new', advancedSetting: { print_count_enabled: '1' } } });
      card.render();
      card.effects();
      root = card.render();
      assert.equal(one(root, 'Switch').props.checked, true);
      return h.tree(s.events);
    });
  });
  await check('legacy load/sort/integration request rejections remain real old/new unhandled failures', () => {
    const results = [];
    for (const v of ['old', 'current']) {
      const child = cp.spawnSync(process.execPath, [__filename, '--failure-batch', v], {
        cwd: h.ROOT,
        encoding: 'utf8',
      });
      assert.equal(child.status, 1);
      assert.equal(child.stderr, '');
      const data = JSON.parse(child.stdout);
      assert.equal(data.length, 3);
      results.push(data);
    }
    assert.deepEqual(results[0], results[1]);
  });
  console.log(`${checks} complete print controller checks passed`);
}
async function failures(version) {
  const errors = [],
    results = [],
    observe = e => {
      errors.push(e);
      process.exitCode = 1;
    };
  process.on('unhandledRejection', observe);
  try {
    for (const action of ['load', 'sort', 'integration']) {
      const s = h.instance(version);
      if (action === 'load') s.controller.loadPrint({});
      else if (action === 'sort') s.controller.onSortEnd([], 0);
      else s.controller.checkedCloudPrint();
      const n = errors.length;
      s.requests[0].reject(Error('controller-request-rejected'));
      await h.settle();
      assert.equal(errors.length, n + 1);
      assert.equal(errors[n].message, 'controller-request-rejected');
      results.push([action, errors[n].name, errors[n].message]);
    }
    console.log(JSON.stringify(results));
  } finally {
    process.removeListener('unhandledRejection', observe);
  }
}
const run = process.argv[2] === '--failure-batch' ? failures(process.argv[3]) : main();
run.catch(e => {
  console.error(e);
  process.exitCode = 1;
});
