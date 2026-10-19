/** Complete real controller/List/Header and helpers, with isolated React/transport/modal host. */
const assert = require('node:assert/strict');
const h = require('../../../../../scripts/spec-fixtures/customButtonListLoader.ts');
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  PASS ${name}`);
}
async function compare(run) {
  assert.deepEqual(await run('current'), await run('old'));
}
const one = (root, label) => {
  const n = h.nodes(root, label);
  assert.equal(n.length, 1, label);
  return n[0];
};
async function loaded(v, rows, provided = {}, options = {}) {
  const s = h.renderer(v, provided, options);
  s.render();
  s.effects();
  s.requests[0].resolve(rows);
  await h.settle();
  s.render();
  return s;
}
async function main() {
  await check('all four complete product files erase byte-identically to frozen history', () => {
    for (const rel of [h.MAIN, h.LIST, h.HEADER, h.UTIL])
      assert.equal(h.compile(h.current[rel], rel), h.compile(h.old[rel], rel), rel);
  });
  await check('actual bootstrap response and List keep the exact button array and callback references', async () => {
    await compare(async v => {
      const rows = [{ btnId: 'b', name: 'Button', extension: { keep: true } }],
        s = await loaded(v, rows);
      const list = one(s.render(), 'List');
      assert.equal(s.state.btnList, rows);
      assert.equal(list.props.btnList, rows);
      assert.equal(list.props.list, rows);
      const rendered = s.list(list),
        row = one(rendered, 'BtnTd');
      assert.equal(row.props.it, rows[0]);
      assert.equal(row.props.btnList, rows);
      assert.equal(row.props.onChange, list.props.onChange);
      return { state: s.state, tree: h.tree(rendered), events: s.events };
    });
  });
  await check('search preserves real name/desc/description coercion, own undefined and getter order', async () => {
    for (const query of ['', '  ALPHA  ', 'alias', '123', 'missing'])
      await compare(async v => {
        const reads = [],
          target = {
            btnId: 'a',
            get name() {
              reads.push('name');
              return 'Alpha';
            },
            get desc() {
              reads.push('desc');
              return undefined;
            },
            get description() {
              reads.push('description');
              return 'Alias';
            },
          },
          rows = [target, { btnId: 'n', name: 123, description: false }, { btnId: 'b', name: 'Beta', desc: 'Second' }];
        const s = await loaded(v, rows);
        reads.length = 0;
        one(s.render(), 'SearchBox').props.onChange(query);
        const root = s.render(),
          list = one(root, 'List');
        assert.equal(list.props.btnList, rows);
        if (!query.trim()) assert.equal(list.props.list, rows);
        else {
          assert.notEqual(list.props.list, rows);
          assert.deepEqual(reads, ['name', 'desc', 'description']);
        }
        return { ids: list.props.list.map(x => x.btnId), reads };
      });
  });
  await check('empty search and nonempty no-result states keep separate actual List copy', async () => {
    for (const searchKeywords of ['', 'x'])
      await compare(v => {
        const s = h.renderer(v),
          node = s.directList({
            btnList: [],
            list: [],
            searchKeywords,
            sortDirection: '',
            getSheetBtns: () => {},
            onChange: () => {},
            setSortDirection: () => {},
            worksheetId: undefined,
            worksheetInfo: {},
          });
        assert.equal(node.props.children.at(-1), searchKeywords ? '没有找到符合条件的结果' : '暂无自定义动作');
        return h.tree(node);
      });
  });
  await check(
    'sorting keeps native stable first-character order, section split, source and row references',
    async () => {
      for (const sortDirection of ['', 'ASC', 'DESC', 'other'])
        await compare(async v => {
          const rows = [
              { btnId: 'z', name: 'Zoo' },
              { btnId: 'a2', name: 'Another', isBatch: true },
              { btnId: 'a1', name: 'Alpha' },
              { btnId: 'a3', name: 'Apple' },
              { btnId: 'e', name: '', isBatch: true },
            ],
            s = await loaded(v, rows);
          const before = rows.slice();
          one(s.render(), 'List').props.setSortDirection(sortDirection);
          const root = s.render(),
            list = one(root, 'List'),
            actual = s.list(list);
          const got = h.nodes(actual, 'BtnTd');
          assert.deepEqual(rows, before);
          assert.ok(got.every(x => rows.includes(x.props.it)));
          assert.deepEqual(
            got.filter(x => !x.props.it.isBatch).map(x => x.props.it.btnId),
            sortDirection === '' || sortDirection === 'DESC' || sortDirection === 'other'
              ? ['z', 'a1', 'a3']
              : ['a1', 'a3', 'z'],
          );
          const header = h
            .nodes(actual, 'div')
            .find(x => x.props.className === 'name flex mRight20 valignWrapper Hand sortFields');
          header.props.onClick();
          s.render();
          assert.equal(s.state.sortDirection, sortDirection === 'ASC' ? 'DESC' : 'ASC');
          return { ids: got.map(x => x.props.it.btnId), state: s.state.sortDirection };
        });
      for (const v of ['old', 'current']) {
        const s = h.renderer(v);
        assert.throws(
          () =>
            s.directList({
              list: [{ btnId: 'a' }, { btnId: 'b', name: 'B' }],
              sortDirection: 'ASC',
              worksheetInfo: {},
            }),
          TypeError,
        );
      }
    },
  );
  await check('row edit and rename drive the actual parent patch without inventing an absent btnId', async () => {
    await compare(async v => {
      const rows = [{ btnId: 'b', name: 'Button', isAllView: 1 }],
        s = await loaded(v, rows),
        list = one(s.render(), 'List'),
        row = one(s.list(list), 'BtnTd');
      const actual = h.row.renderer('current', row.props);
      const tree = actual.render();
      h.nodes(tree, 'span')
        .find(x => x.props.children === '编辑')
        .props.onClick();
      let root = s.render();
      assert.equal(one(root, 'CreateCustomBtn').props.btnDataInfo, rows[0]);
      actual.focus();
      h.nodes(actual.render(), 'CustomMenu')[0].props.setFn({ isRename: true });
      h.nodes(actual.render(), 'Input')[0].props.onBlur({ target: { value: 'Renamed' } });
      assert.equal(actual.requests.length, 1);
      actual.requests[0].resolve(true);
      await h.settle();
      root = s.render();
      assert.equal(s.state.btnList[0].name, 'Renamed');
      one(root, 'CreateCustomBtn').props.onClose();
      root = s.render();
      assert.equal(h.nodes(root, 'CreateCustomBtn').length, 0);
      one(root, 'List').props.onChange({ isEdit: true, showCreateCustomBtn: true, btnId: undefined });
      root = s.render();
      assert.equal(Object.hasOwn(s.state, 'btnId'), true);
      assert.equal(s.state.btnId, undefined);
      assert.deepEqual(one(root, 'CreateCustomBtn').props.btnDataInfo, []);
      return { state: s.state, events: s.events };
    });
  });
  await check(
    'add/edit dialog preserves controls visibility, real complex translation and template/metadata spread',
    async () => {
      await compare(async v => {
        const shared = { future: true },
          visible = { controlId: 'plain', type: 2, extension: shared },
          calc = { controlId: 'formula', type: 31, viewDisplay: true },
          hidden = { controlId: 'hidden', type: 2, viewDisplay: false },
          inherited = Object.assign(Object.create({ viewDisplay: false }), { controlId: 'inherited', type: 2 }),
          controls = [visible, calc, hidden, inherited];
        const originalTemplate = { controls: ['obsolete'], keep: 'legacy' };
        const info = {
          appId: 'app',
          projectId: h.projectId,
          template: originalTemplate,
          views: [],
          switches: [{ type: 1, state: true }],
          extension: shared,
        };
        const s = await loaded(v, [], { worksheetControls: controls, worksheetInfo: info });
        one(s.render(), 'Header').props.onAdd();
        const child = one(s.render(), 'CreateCustomBtn');
        assert.equal(child.props.worksheetControls, controls);
        assert.deepEqual(
          child.props.columns.map(x => x.controlId),
          ['plain', 'formula'],
        );
        assert.notEqual(child.props.columns[0], visible);
        assert.deepEqual(child.props.columns[0], visible);
        assert.equal(child.props.columns[0].extension, shared);
        assert.equal(child.props.columns[1].type, 6);
        assert.equal(child.props.columns[1].originType, 31);
        assert.equal(calc.type, 31);
        assert.equal(child.props.currentSheetInfo.template.controls, controls);
        assert.equal(child.props.currentSheetInfo.extension, shared);
        assert.equal(info.template, originalTemplate);
        assert.equal(child.props.sheetSwitchPermit, info.switches);
        assert.deepEqual(child.props.btnDataInfo, []);
        return h.tree(child);
      });
    },
  );
  await check(
    'missing selected item stays undefined and editor refresh keeps original abort/request prefix',
    async () => {
      await compare(async v => {
        const s = await loaded(v, [{ btnId: 'b', name: 'B' }]);
        one(s.render(), 'List').props.onChange({ isEdit: true, showCreateCustomBtn: true, btnId: 'deleted' });
        const child = one(s.render(), 'CreateCustomBtn');
        assert.equal(child.props.btnDataInfo, undefined);
        child.props.refreshFn();
        assert.equal(s.requests[0].abortCount, 1);
        assert.deepEqual(s.requests[1].args, { worksheetId: 'sheet' });
        return s.events;
      });
    },
  );
  await check(
    'real cloneDeep plus refreshBtnData keeps add/update duplicate IDs, extensions and original state intact',
    async () => {
      for (const isAdd of [true, false])
        await compare(async v => {
          const ext = { keep: true },
            first = { btnId: 'b', name: 'Old', extension: ext },
            other = { btnId: 'other', extension: ext },
            rows = [first, other, first],
            s = await loaded(v, rows);
          one(s.render(), 'Header').props.onAdd();
          const fresh = { btnId: 'b', name: 'New', extension: { new: true } };
          one(s.render(), 'CreateCustomBtn').props.updateCustomButtons(fresh, isAdd);
          s.render();
          assert.equal(rows[0], first);
          assert.equal(rows.length, 3);
          const next = s.state.btnList;
          assert.notEqual(next, rows);
          if (isAdd) {
            assert.equal(next.at(-1), fresh);
            assert.notEqual(next[0], first);
            assert.equal(next[0], next[2]);
            assert.equal(next[0].extension, next[1].extension);
          } else {
            assert.equal(next[0], fresh);
            assert.equal(next[2], fresh);
            assert.notEqual(next[1], other);
          }
          return { state: next, original: rows };
        });
    },
  );
  await check(
    'actual helper alone preserves push mutation/map references, undefined IDs and native getter count',
    () => {
      const run = (fn, add) => {
        const reads = [],
          left = {
            get btnId() {
              reads.push('left');
              return undefined;
            },
            extension: { keep: NaN },
          },
          other = { btnId: 'other' },
          incoming = {
            get btnId() {
              reads.push('incoming');
              return undefined;
            },
            extension: { keep: Infinity },
          };
        const data = [left, other, left];
        data[Symbol.for('extra')] = 'meta';
        const result = fn(data, incoming, add);
        if (add) {
          assert.equal(result, data);
          assert.equal(data.at(-1), incoming);
          assert.deepEqual(reads, []);
        } else {
          assert.notEqual(result, data);
          assert.equal(result[0], incoming);
          assert.equal(result[1], other);
          assert.equal(result[2], incoming);
          assert.deepEqual(reads, ['left', 'incoming', 'incoming', 'left', 'incoming']);
        }
        return { reads, result, source: data };
      };
      for (const add of [true, false]) assert.deepEqual(run(h.refreshCurrent, add), run(h.refreshOld, add));
      for (const fn of [h.refreshOld, h.refreshCurrent]) {
        assert.throws(() => fn(undefined, {}, true), TypeError);
        assert.throws(() => fn([null], {}, false), TypeError);
      }
    },
  );
  await check(
    'worksheet changes and unmount retain duplicate abort calls and original late response semantics',
    async () => {
      for (const abortReject of [true, false])
        await compare(async v => {
          const s = h.renderer(v, {}, { abortReject });
          s.render();
          s.effects();
          assert.equal(s.requests.length, 1);
          s.setProps({ worksheetId: 'next' });
          s.render();
          s.effects();
          assert.equal(s.requests[0].abortCount, 2);
          assert.equal(s.requests[1].args.worksheetId, 'next');
          const next = [{ btnId: 'next' }];
          s.requests[1].resolve(next);
          await h.settle();
          s.render();
          assert.equal(s.state.btnList, next);
          const late = [{ btnId: 'late' }];
          s.requests[0].resolve(late);
          await h.settle();
          s.render();
          assert.equal(s.state.btnList, abortReject ? next : late);
          s.unmount();
          assert.equal(s.requests[1].abortCount, 1);
          return { state: s.state, events: s.events };
        });
    },
  );
  await check('absent worksheet skips mount request but explicit refresh still sends own undefined key', async () => {
    await compare(async v => {
      const s = h.renderer(v, { worksheetId: undefined });
      s.render();
      s.effects();
      assert.equal(s.requests.length, 0);
      one(s.render(), 'List').props.getSheetBtns();
      assert.equal(Object.hasOwn(s.requests[0].args, 'worksheetId'), true);
      assert.equal(s.requests[0].args.worksheetId, undefined);
      s.requests[0].reject(Error('isolated'));
      await h.settle();
      s.render();
      return { state: s.state, events: s.events };
    });
  });
  await check(
    'load rejection and aborted requests retain the old swallowed failure and previous list state',
    async () => {
      await compare(async v => {
        const rows = [{ btnId: 'b' }],
          s = await loaded(v, rows, {}, { abortReject: true });
        one(s.render(), 'List').props.getSheetBtns();
        s.requests[1].reject(Error('isolated request failure'));
        await h.settle();
        const root = s.render();
        assert.equal(s.state.btnList, rows);
        assert.equal(h.nodes(root, 'CreateCustomBtn').length, 0);
        return { state: s.state, events: s.events };
      });
    },
  );
  await check(
    'real feature/license/upgrade code keeps free gating and paid trash open/cancel/refresh flow',
    async () => {
      for (const licenseType of [0, 1, 2])
        for (const featureType of [0, 1, '1', '2', ''])
          await compare(async v => {
            const s = await loaded(v, [], {}, { licenseType, featureType });
            const header = one(s.render(), 'Header'),
              ui = s.header(header),
              trash = h.nodes(ui, 'div').find(x => x.props.className === 'trash mRight20 hoverColorPrimary flexRow');
            assert.equal(!!trash, !!featureType);
            if (trash) {
              trash.props.onClick();
              let root = s.render();
              if (licenseType === 0) {
                assert.equal(h.nodes(root, 'Trash').length, 0);
                assert.equal(s.dialogs.length, 1);
                assert.equal(s.dialogs[0].noFooter, true);
              } else {
                const popup = one(root, 'Trash');
                assert.equal(popup.props.views, s.props.worksheetInfo.views);
                popup.props.onChange();
                assert.equal(s.requests.length, 2);
                popup.props.onCancel();
                root = s.render();
                assert.equal(h.nodes(root, 'Trash').length, 0);
              }
            }
            return { state: s.state, events: h.tree(s.events), ui: h.tree(ui) };
          });
    },
  );
  await check('shared/public and invalid-project feature guards avoid any sync license network call', async () => {
    for (const provided of [{ worksheetInfo: { projectId: 'invalid' } }, { worksheetInfo: { projectId: undefined } }])
      await compare(v => {
        const s = h.renderer(v, provided);
        assert.equal(one(s.render(), 'Header').props.featureType, undefined);
        return s.events;
      });
    await compare(v => {
      const s = h.renderer(v, {}, { shareId: 'share' });
      assert.equal(one(s.render(), 'Header').props.featureType, undefined);
      return s.events;
    });
  });
  console.log(`${checks} complete custom button list checks passed`);
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
