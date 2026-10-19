/** Real complete row, both menus, List, range dropdown and API wrappers; no business writes or real DOM/storage. */
const assert = require('node:assert/strict'),
  cp = require('node:child_process'),
  fs = require('node:fs'),
  path = require('node:path');
const h = require('../../../../scripts/spec-fixtures/buttonRowLoader.ts');
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  PASS ${name}`);
}
async function compare(run) {
  assert.deepEqual(await run('current'), await run('old'));
}
function menu(s, root = s.render()) {
  return h.nodes(root, 'CustomMenu')[0];
}
function viewText(root) {
  return h.nodes(root, 'span').find(x => x.props.className === 'viewText textPrimary').props.children;
}
function button<T extends object = {}>(extra?: T) {
  return {
    btnId: 'b',
    name: 'Button',
    status: 1,
    isAllView: 0,
    writeObject: 1,
    writeType: 1,
    clickType: 1,
    advancedSetting: { detailviews: '["v1"]', listviews: '["tree"]' },
    ...extra,
  };
}
function input(s) {
  return h.nodes(s.render(), 'Input')[0];
}

async function main() {
  await check('full JSX color/icon/disabled/scope matrix matches frozen real row', async () => {
    for (const status of [undefined, 0, 1, -1])
      for (const color of [undefined, 'transparent', '#123456'])
        for (const icon of [undefined, 'bolt', 'action_svg'])
          for (const isAllView of [0, 1]) {
            await compare(v => {
              const s = h.renderer(v, {
                it: button({ status, color, icon, isAllView, iconUrl: icon ? 'url' : undefined }),
              });
              return h.tree(s.render());
            });
          }
    for (const v of ['old', 'current']) {
      const s = h.renderer(v, { it: button({ iconUrl: 'url', icon: undefined }) });
      assert.throws(() => s.render(), TypeError);
    }
  });
  await check('real range label keeps native IDs, unknown entries, duplicate and batch restrictions', async () => {
    for (const detail of ['[]', '["v1","v1","missing",null,7,true,{"future":true}]', '["org"]'])
      for (const list of ['[]', '["tree","org","v2",null]'])
        for (const flags of [{}, { writeObject: 2, clickType: 3 }, { writeType: 2, clickType: 3 }]) {
          await compare(v => {
            const s = h.renderer(v, {
              it: button({ ...flags, advancedSetting: { detailviews: detail, listviews: list } }),
            });
            return { label: viewText(s.render()), events: s.events };
          });
        }
    await compare(v => {
      const raw = ['v1', , undefined, NaN];
      raw[Symbol.for('extra')] = 'keep';
      const s = h.renderer(
        v,
        { it: button({ advancedSetting: { detailviews: 'raw', listviews: '[]' } }) },
        { parse: x => (x === 'raw' ? raw : h.range.safeParse(x, 'array')) },
      );
      const before = Reflect.ownKeys(raw),
        value = viewText(s.render());
      assert.deepEqual(Reflect.ownKeys(raw), before);
      assert.ok(Number.isNaN(raw[3]));
      return value;
    });
  });
  await check('actual react-use merging preserves initial absent templateId and all original update keys', async () => {
    await compare(v => {
      const s = h.renderer(v);
      let root = s.render();
      assert.equal(Object.hasOwn(s.state, 'templateId'), false);
      s.effects();
      root = s.render();
      const trigger = h.nodes(root, 'Trigger')[0];
      trigger.props.onPopupVisibleChange(true);
      root = s.render();
      assert.equal(s.state.templateId, 'b');
      assert.equal(s.state.showDropOption, true);
      menu(s, root).props.onVisibleChange(false);
      s.render();
      assert.equal(s.state.templateId, '');
      const keys = Reflect.ownKeys(s.state);
      menu(s).props.setFn({ isRename: true, showMoreOption: false });
      s.focus();
      s.render();
      s.effects();
      assert.equal(s.state.isRename, true);
      assert.deepEqual(Reflect.ownKeys(s.state), keys);
      return { state: s.state, events: s.events };
    });
  });
  await check('props synchronization keeps old captured state until its real effect runs', async () => {
    await compare(v => {
      const s = h.renderer(v);
      s.render();
      s.effects();
      s.render();
      const old = s.state.it;
      const next = button({ btnId: 'new', name: 'Next' });
      s.setProps({ it: next });
      assert.equal(menu(s, s.render()).props.item, old);
      s.effects();
      assert.equal(menu(s, s.render()).props.item, next);
      return h.tree(s.events);
    });
  });
  await check('disabled action handlers suppress edit/range while more-menu propagation is preserved', async () => {
    await compare(v => {
      const s = h.renderer(v, { it: button({ status: 0 }) });
      const root = s.render();
      h.nodes(root, 'Trigger')[0].props.onPopupVisibleChange(true);
      h.nodes(root, 'span')
        .find(x => x.props.children === '编辑')
        .props.onClick();
      assert.deepEqual(s.events, []);
      const m = h.menuRow(s, root);
      h.nodes(m.trigger, 'Icon')[0].props.onClick({ stopPropagation: () => s.events.push(['stop']) });
      s.render();
      assert.equal(s.state.showMoreOption, true);
      h.clickMenu(s, '重命名');
      assert.equal(s.state.isRename, false);
      return s.events;
    });
  });
  await check('empty and duplicate rename keep focus, state prefix and never issue a request', async () => {
    for (const name of ['  ', 'Taken'])
      await compare(v => {
        const it = button(),
          other = button({ btnId: 'other', name: 'Taken' });
        const s = h.renderer(v, { it, btnList: [it, other] });
        s.render();
        s.focus();
        menu(s).props.setFn({ isRename: true });
        const field = input(s);
        field.props.onBlur({ target: { value: name } });
        s.render();
        assert.equal(s.state.isRename, false);
        assert.equal(s.state.templateId, '');
        assert.equal(s.requests.length, 0);
        assert.equal(s.events.at(-1)[0], 'focus');
        return s.events;
      });
    for (const v of ['old', 'current']) {
      const s = h.renderer(v);
      s.render();
      menu(s).props.setFn({ isRename: true });
      input(s).props.onBlur;
      assert.throws(() => s.effects(), TypeError);
    }
  });
  await check(
    'rename preserves optimistic list before real API request, repeated keys and EditAttrs casing',
    async () => {
      await compare(async v => {
        const ext = { future: true },
          it = button({ extension: ext }),
          same = button({ name: 'Duplicate same ID' }),
          other = button({ btnId: 'other', name: 'Other' });
        const s = h.renderer(v, { it, btnList: [other, it, same] });
        s.render();
        s.focus();
        menu(s).props.setFn({ isRename: true });
        input(s).props.onBlur({ target: { value: '  Renamed  ' } });
        const change = s.events.find(x => x[0] === 'change')[1];
        assert.equal(change.btnList[0], other);
        assert.equal(change.btnList[1].extension, ext);
        assert.notEqual(change.btnList[1], it);
        assert.equal(it.name, 'Button');
        assert.equal(change.btnList[2].name, 'Renamed');
        const request = s.requests[0];
        assert.equal(request.method, 'SaveWorksheetBtn');
        assert.deepEqual(request.args, { btnId: 'b', worksheetId: 'sheet', name: 'Renamed', EditAttrs: ['name'] });
        assert.ok(s.events.findIndex(x => x[0] === 'change') < s.events.findIndex(x => x[0] === 'request'));
        request.resolve(false);
        await h.settle();
        return h.tree(s.events);
      });
    },
  );
  await check('real dropdown leaf and row parent preserve full payload metadata and callback ordering', async () => {
    await compare(async v => {
      const ext = { future: true },
        it = button({ extension: ext, displayViews: ['legacy'] }),
        other = button({ btnId: 'other' }),
        s = h.renderer(v, { it, btnList: [it, other, it] });
      const root = s.render(),
        leaf = h.nodes(root, 'BtnRangeDrop')[0];
      assert.equal(leaf.props.data, it);
      assert.equal(leaf.props.views, s.props.views);
      const dropdown = h.range.buttonRenderer(h.range.button, leaf.props),
        tree = dropdown.render();
      h.range.nodes(tree, 'Radio')[0].props.onClick();
      assert.equal(
        s.events.some(x => x[0] === 'change'),
        false,
      );
      const req = s.requests[0];
      assert.equal(req.method, 'SaveWorksheetBtn');
      assert.deepEqual(req.args.editAttrs, ['advancedSetting', 'isAllView', 'displayViews']);
      assert.deepEqual(req.args.displayViews, []);
      assert.equal(req.args.extension, ext);
      req.resolve(undefined);
      await h.settle();
      const output = s.events.find(x => x[0] === 'change')[1].btnList;
      assert.equal(output[0], output[2]);
      assert.equal(output[1], other);
      assert.equal(output[0].extension, ext);
      assert.deepEqual(it.displayViews, ['legacy']);
      return h.tree(s.events);
    });
  });
  await check('out-of-order scope saves retain old captured button list semantics', async () => {
    await compare(async v => {
      const it = button(),
        s = h.renderer(v, { it, btnList: [it] });
      const oldLeaf = h.nodes(s.render(), 'BtnRangeDrop')[0];
      oldLeaf.props.onChange({ ...it, isAllView: 1 });
      s.setProps({ btnList: [button({ btnId: 'added' }), it] });
      const newLeaf = h.nodes(s.render(), 'BtnRangeDrop')[0];
      newLeaf.props.onChange({ ...it, isAllView: 0 });
      s.requests[1].resolve(true);
      await h.settle();
      s.requests[0].resolve(true);
      await h.settle();
      const values = s.events.filter(x => x[0] === 'change').map(x => x[1].btnList);
      assert.equal(values[0].length, 2);
      assert.equal(values[1].length, 1);
      return h.tree(s.events);
    });
  });
  await check(
    'real menus and copy/enable/disable/delete API truthiness retain confirmation and alert order',
    async () => {
      for (const action of ['复制', '停用', '启用', '删除'])
        for (const response of [true, false, null, 0, {}, 'yes'])
          await compare(async v => {
            const s = h.renderer(v, { it: button({ status: action === '启用' ? 0 : 1 }) });
            s.render();
            h.clickMenu(s, action);
            s.render();
            assert.equal(s.state.showMoreOption, false);
            if (action === '复制' || action === '删除') {
              assert.equal(s.confirms.length, 1);
              s.confirms[0].onOk();
            }
            const req = s.requests[0];
            assert.equal(req.service, 'Worksheet');
            assert.equal(req.method, action === '复制' ? 'CopyWorksheetBtn' : 'OptionWorksheetBtn');
            if (action !== '复制')
              assert.equal(req.args.optionType, action === '删除' ? 9 : action === '停用' ? 12 : 13);
            req.resolve(response);
            await h.settle();
            const tail = s.events.filter(x => ['reload', 'alert'].includes(x[0]));
            if (response) {
              assert.ok(tail.some(x => x[0] === 'reload'));
              if (action === '复制')
                assert.deepEqual(
                  tail.map(x => x[0]),
                  ['reload', 'alert'],
                );
              if (action === '删除')
                assert.deepEqual(
                  tail.map(x => x[0]),
                  ['alert', 'reload'],
                );
            } else
              assert.deepEqual(tail, [
                [
                  'alert',
                  action === '复制'
                    ? '复制失败'
                    : action === '删除'
                      ? '删除失败'
                      : action === '停用'
                        ? '停用失败'
                        : '启用失败',
                  2,
                ],
              ]);
            return h.tree(s.events);
          });
    },
  );
  await check('real List preserves sections/sorting and passes the same live row objects and callbacks', async () => {
    for (const sortDirection of ['', 'ASC', 'DESC'])
      await compare(v => {
        const s = h.renderer(v),
          btnList = [
            button({ btnId: 'b', name: 'Beta' }),
            button({ btnId: 'a', name: 'Alpha', isBatch: true }),
            button({ btnId: 'g', name: 'Gamma' }),
          ],
          onChange = () => {};
        const root = s.list({
          btnList,
          list: btnList,
          getSheetBtns: () => {},
          onChange,
          searchKeywords: '',
          sortDirection,
          setSortDirection: () => {},
          worksheetId: 'sheet',
          worksheetInfo: { appId: 'app', views: s.props.views },
        });
        const rows = h.nodes(root, 'BtnTd');
        assert.equal(rows.length, 3);
        for (const row of rows) {
          assert.ok(btnList.includes(row.props.it));
          assert.equal(row.props.btnList, btnList);
          assert.equal(row.props.onChange, onChange);
          assert.equal(row.props.views, s.props.views);
        }
        return h.tree(root);
      });
  });
  await check(
    'raw range getters/filter/concat keep valid execution order; invalid containers fail before writes',
    async () => {
      await compare(v => {
        const reads = [],
          detail = ['v1'],
          list = ['tree'];
        for (const [array, key] of [[list, 'filter'] as const, [detail, 'concat'] as const]) {
          const native = array[key];
          Object.defineProperty(array, key, {
            get() {
              reads.push(key);
              return native;
            },
          });
        }
        const advanced = {
          get detailviews() {
            reads.push('detail');
            return detail;
          },
          get listviews() {
            reads.push('list');
            return list;
          },
        };
        const s = h.renderer(v, { it: button({ advancedSetting: advanced }) });
        const label = viewText(s.render());
        assert.deepEqual(reads, ['detail', 'list', 'filter', 'concat']);
        return { label, reads, events: s.events };
      });
      for (const name of ['detailviews', 'listviews'])
        for (const raw of ['null', '{}', '"v1"', '3']) {
          const s = h.renderer('current', {
            it: button({ advancedSetting: { detailviews: '[]', listviews: '[]', [name]: raw } }),
          });
          assert.throws(() => s.render(), /Invalid view range list/);
          assert.deepEqual(s.events, []);
        }
      for (const v of ['old', 'current']) {
        const s = h.renderer(v, {
          it: button({ isAllView: 1, advancedSetting: { detailviews: '{}', listviews: 'null' } }),
        });
        assert.doesNotThrow(() => s.render());
      }
    },
  );
  await check(
    'synchronous transport and parent failures keep their original prefix and do not fake success',
    async () => {
      for (const v of ['old', 'current']) {
        const s = h.renderer(v, {}, { syncFailure: 'CopyWorksheetBtn' });
        s.render();
        assert.throws(() => menu(s).props.onCopy(), /sync transport failure/);
        assert.equal(
          s.events.some(x => x[0] === 'alert'),
          false,
        );
        const t = h.renderer(v, {
          onChange() {
            throw Error('parent-fail');
          },
        });
        const root = t.render();
        assert.throws(
          () =>
            h
              .nodes(root, 'span')
              .find(x => x.props.children === '编辑')
              .props.onClick(),
          /parent-fail/,
        );
      }
    },
  );
  await check(
    'transport rejection old processes fail and current processes alert without success callbacks',
    async () => {
      for (const action of ['save', 'copy', 'delete', 'disable', 'enable']) {
        const child = cp.spawnSync(process.execPath, [__filename, '--reject', action, 'old'], {
          cwd: h.ROOT,
          encoding: 'utf8',
        });
        assert.notEqual(child.status, 0);
        assert.match(child.stderr, /button-request-rejected/);
        const fixed = cp.spawnSync(process.execPath, [__filename, '--reject', action, 'current'], {
          cwd: h.ROOT,
          encoding: 'utf8',
        });
        assert.equal(fixed.status, 0, fixed.stderr);
        assert.match(fixed.stdout, /handled rejection/);
      }
    },
  );
  await check('success callback failures retain native rejection without being relabeled as transport failure', () => {
    for (const action of ['save', 'copy'])
      for (const version of ['old', 'current']) {
        const child = cp.spawnSync(process.execPath, [__filename, '--callback-failure', action, version], {
          cwd: h.ROOT,
          encoding: 'utf8',
        });
        assert.notEqual(child.status, 0);
        assert.match(child.stderr, /button-success-callback-failed/);
        assert.doesNotMatch(child.stdout, /unexpected-alert/);
      }
  });
  await check('menu type layer erases identically and unchanged shared menu/List remain frozen', () => {
    for (const rel of [h.MENU, h.MORE, h.LIST])
      assert.equal(h.compile(h.current[rel], rel), h.compile(h.old[rel], rel), rel);
  });
  console.log(`${checks} complete custom button row checks passed`);
}
async function rejection(action, version) {
  const s = h.renderer(version);
  const root = s.render();
  if (action === 'save') h.nodes(root, 'BtnRangeDrop')[0].props.onChange(button({ isAllView: 1 }));
  else if (action === 'copy') menu(s, root).props.onCopy();
  else if (action === 'delete') menu(s, root).props.onDelete();
  else menu(s, root).props.onToggleEnable(action === 'disable');
  assert.equal(s.requests.length, 1);
  s.requests[0].reject(Error('button-request-rejected'));
  await h.settle();
  assert.equal(
    s.events.some(x => x[0] === 'reload' || x[0] === 'change'),
    false,
  );
  const expected = { save: '保存失败', copy: '复制失败', delete: '删除失败', disable: '停用失败', enable: '启用失败' }[
    action
  ];
  assert.deepEqual(
    s.events.filter(x => x[0] === 'alert'),
    [['alert', expected, 2]],
  );
  console.log('handled rejection');
}
async function callbackFailure(action, version) {
  const s = h.renderer(version, {
    onChange() {
      throw Error('button-success-callback-failed');
    },
    getSheetBtns() {
      throw Error('button-success-callback-failed');
    },
  });
  const root = s.render();
  if (action === 'save') h.nodes(root, 'BtnRangeDrop')[0].props.onChange(button({ isAllView: 1 }));
  else menu(s, root).props.onCopy();
  s.requests[0].resolve(true);
  await h.settle();
  if (s.events.some(x => x[0] === 'alert')) console.log('unexpected-alert');
  throw Error('success callback failure must escape');
}
const run =
  process.argv[2] === '--reject'
    ? rejection(process.argv[3], process.argv[4])
    : process.argv[2] === '--callback-failure'
      ? callbackFailure(process.argv[3], process.argv[4])
      : main();
run.catch(error => {
  console.error(error);
  process.exitCode = 1;
});
