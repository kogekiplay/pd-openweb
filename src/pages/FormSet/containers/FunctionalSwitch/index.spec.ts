/** Complete actual historical/current modules, real config/API/storage wrapper; UI/DOM/transport controlled. */
const assert = require('node:assert/strict'),
  cp = require('node:child_process'),
  path = require('node:path'),
  fs = require('node:fs');
const h = require('../../../../../scripts/spec-fixtures/functionalSwitchLoader.ts');
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  PASS ${name}`);
}
async function compare(run) {
  assert.deepEqual(await run(h.current), await run(h.previous));
}
async function ready(source, configure = (_rows: any[]) => {}, props = {}, options = {}) {
  const s = h.renderer(source, props, options);
  s.render();
  s.flushEffects();
  s.render();
  const rows = h.rows();
  configure(rows);
  s.requests[0].resolve(rows);
  await h.drain();
  return { ...s, rows, root: s.render() };
}
function snapshot(s) {
  return { events: h.tree(h.businessEvents(s.events)), info: h.businessState(s.states[4]) };
}
function thrown(fn) {
  try {
    return { value: fn() };
  } catch (e) {
    return { error: [e.name, e.message] };
  }
}
async function main() {
  await check(
    'all real configured switches render, retain wire references and synthesize the local statistics row',
    async () => {
      for (const state of [true, false])
        for (const flags of [{}, { batchIsOpen: '1', statisticsIsOpen: '1' }])
          await compare(async source => {
            const s = await ready(
              source,
              rows =>
                rows.forEach(r => {
                  r.state = state;
                }),
              {},
              { storage: flags },
            );
            const data = s.states[4].data;
            assert.notEqual(data, s.rows);
            assert.equal(data[0], s.rows[0]);
            assert.equal(data.at(-1).type, 500);
            assert.equal(data.at(-1).state, state);
            assert.deepEqual(data.at(-1).viewIds, []);
            return { tree: h.tree(s.root), ...snapshot(s) };
          });
    },
  );
  await check(
    'ordinary/batch/statistics updates preserve exact four-field picks, filtered payload and merge ordering',
    async () => {
      for (const type of [10, 20, 30, 25, ...h.constants.batch, 500, ...h.constants.statistics, 41, 999])
        for (const state of [true, false])
          for (const immediate of [false, true])
            await compare(async source => {
              const s = await ready(
                source,
                rows => {
                  rows.forEach(r => {
                    r.state = state;
                  });
                },
                {},
                { immediate },
              );
              const previous = s.states[4].data;
              s.helpers().edit({ type, state: !state, roleType: 100, viewIds: ['v1'], extra: { keep: true } });
              const req = s.requests[1];
              assert.equal(req.method, 'BatchEditSwitch');
              assert.equal(req.args.worksheetId, 'sheet');
              assert.equal(
                req.args.switchList.some(r => r.type === 500),
                false,
              );
              if (type === 25 || type === 500) {
                for (const item of req.args.switchList.slice(type === 500 ? 0 : 1)) {
                  assert.deepEqual(Object.keys(item).sort(), ['roleType', 'state', 'type', 'viewIds']);
                }
              }
              req.resolve(true);
              await h.drain();
              s.render();
              const next = s.states[4].data;
              assert.notEqual(next, previous);
              assert.equal(s.states[4].showData.extra?.keep, true);
              const unaffected = previous.find(r => r.type === 11);
              if (unaffected && type !== 11)
                assert.equal(
                  next.find(r => r.type === 11),
                  unaffected,
                );
              return snapshot(s);
            });
    },
  );
  await check(
    'unmodified subitems keep references and extension metadata while aggregate branches intentionally pick fields',
    async () => {
      await compare(async source => {
        const s = await ready(source);
        const other = s.states[4].data.find(r => r.type === 26),
          nested = other.extension;
        s.helpers().edit({ type: 24, state: false });
        const sent = s.requests[1].args.switchList;
        assert.equal(
          sent.find(r => r.type === 26),
          other,
        );
        assert.equal(sent.find(r => r.type === 26).extension, nested);
        s.requests[1].resolve(true);
        await h.drain();
        s.render();
        assert.equal(
          s.states[4].data.find(r => r.type === 26),
          other,
        );
        return snapshot(s);
      });
    },
  );
  await check(
    'duplicate type IDs, sequential requests and reverse completion preserve original captured arrays',
    async () => {
      await compare(async source => {
        const s = await ready(source, rows => rows.push({ type: 10, state: false, extension: 'duplicate' }));
        s.helpers().edit({ type: 10, state: false });
        s.helpers().edit({ type: 11, state: false });
        s.requests[2].resolve(true);
        await h.drain();
        s.render();
        s.requests[1].resolve(true);
        await h.drain();
        s.render();
        assert.equal(s.states[4].data.filter(r => r.type === 10).length, 1);
        assert.equal(s.states[4].data.find(r => r.type === 11).state, true);
        return snapshot(s);
      });
    },
  );
  await check(
    'real close-share confirmation, locked range and false save response keep callback prefixes',
    async () => {
      await compare(async source => {
        const s = await ready(source);
        let sw = s.helpers().renderSwitch({ type: 20, state: true, roleType: 0 });
        sw.props.onClick();
        assert.equal(s.requests.length, 1);
        assert.equal(s.confirms.length, 1);
        s.confirms[0].onOk();
        assert.equal(s.requests.length, 2);
        assert.deepEqual(s.requests[1].args.switchList, [{ state: false, type: 20, roleType: 0 }]);
        s.requests[1].resolve(false);
        await h.drain();
        s.render();
        const info = s.states[4];
        info.showDialog = true;
        s.render();
        sw = s.helpers().renderSwitch({ type: 10, state: true });
        sw.props.onClick();
        assert.equal(s.requests.length, 2);
        return { confirm: h.tree(s.confirms), ...snapshot(s) };
      });
    },
  );
  await check(
    'actual range opening/closing preserves coordinates, required selection alert and tab-specific labels',
    async () => {
      for (const nearest of [true, false])
        await compare(async source => {
          const s = await ready(source, () => {}, {}, { nearest, top: 75 });
          const li =
            h.nodes(s.root, 'li').find(x => h.nodes(x, 'span').some(n => n.props.children?.includes?.('导出'))) ||
            h.nodes(s.root, 'li')[0];
          const con = h.nodes(li, 'span').find(x => x.props.className === 'con flexRow');
          con.props.onClick({ target: {}, clientX: 200 });
          let root = s.render();
          assert.deepEqual(s.states[4].showLocation, { left: 200, top: nearest ? 75 : 0 });
          const range = h.nodes(root, 'Range')[0];
          assert.ok(range);
          range.props.change(100);
          s.requests.at(-1).resolve(true);
          await h.drain();
          root = s.render();
          h.nodes(root, 'Range')[0].props.changeViewRange({ viewIds: [], diaRang: false });
          s.requests.at(-1).resolve(true);
          await h.drain();
          root = s.render();
          h.nodes(root, 'Range')[0].props.onClickAway();
          s.render();
          assert.equal(s.events.at(-1)[0], 'alert');
          s.states[5] = true;
          s.render();
          s.helpers().closeRangeDiaFn(s.states[4]);
          s.render();
          assert.equal(s.states[4].showDialog, false);
          assert.deepEqual(s.states[4].showData, {});
          return snapshot(s);
        });
      for (const key of ['1', '2', '3', '4', 'other'])
        await compare(async source => {
          const s = await ready(source);
          return {
            empty: s.helpers().strRight(key, {}),
            selected: s.helpers().strRight(key, { viewIds: ['v1', 'deleted', undefined] }),
          };
        });
    },
  );
  await check('main and actual Range callback compose without cloning away the original pull mutation', async () => {
    await compare(async source => {
      const s = await ready(source);
      const row = s.states[4].data.find(r => r.type === 41);
      row.viewIds = ['v1'];
      s.states[4].showData = row;
      s.states[4].showDialog = true;
      s.states[4].showLocation = { top: 10 };
      s.states[5] = false;
      const rangeProps = h.nodes(s.render(), 'Range')[0].props;
      const range = h.range(source === h.current ? h.currentRange : h.oldRange, rangeProps);
      const root = range.instance.render();
      const checkbox = h.nodes(root, 'Checkbox').find(n => n.props.text === 'One');
      checkbox.props.onClick(true);
      assert.deepEqual(row.viewIds, []);
      assert.equal(s.requests[1].args.switchList[0].viewIds, row.viewIds);
      s.requests[1].resolve(true);
      await h.drain();
      s.render();
      return snapshot(s);
    });
  });
  await check(
    'actual preference wrapper forwards null/string without removing keys and honors initial stored flags',
    async () => {
      for (const initial of ['1', 'null', ''])
        await compare(async source => {
          const s = await ready(source, () => {}, {}, { storage: { batchIsOpen: initial, statisticsIsOpen: initial } });
          for (let i = 0; i < 2; i++) {
            const toggle = h
              .nodes(s.render(), 'span')
              .find(n => n.props.className === 'batchIsOpen Right Hand hoverColorPrimary');
            assert.ok(toggle);
            toggle.props.onClick();
            s.render();
          }
          const writes = s.events.filter(e => e[0] === 'storage-write');
          assert.deepEqual(
            writes.map(e => e[1]),
            ['statisticsIsOpen', 'statisticsIsOpen'],
          );
          assert.equal(
            s.events.some(e => e[0] === 'storage-remove'),
            false,
          );
          return snapshot(s);
        });
    },
  );
  await check(
    'autoID visibility/callback and initial worksheet ID storage preserve original prop-change behavior',
    async () => {
      await compare(async source => {
        const s = await ready(source);
        h.nodes(s.root, 'span')
          .find(n => n.props.className === 'Hand text delBtn')
          .props.onClick();
        let root = s.render();
        const del = h.nodes(root, 'DelDialog')[0];
        assert.equal(del.props.companyId, 'company');
        del.props.delCallback();
        s.render();
        assert.equal(s.states[3], true);
        s.setProps({ worksheetId: 'new-sheet', worksheetInfo: { closeAutoID: true, views: [] } });
        s.render();
        s.flushEffects();
        s.render();
        assert.equal(s.requests.length, 1);
        assert.equal(s.states[4].worksheetId, 'sheet');
        return snapshot(s);
      });
    },
  );
  await check(
    'malformed/rejected loading and batch rejection produce explicit errors without fake successful settings',
    async () => {
      for (const raw of [null, {}, [null]]) {
        const s = h.renderer(h.current);
        s.render();
        s.flushEffects();
        s.requests[0].resolve(raw);
        await h.drain();
        let root = s.render();
        const error = h.nodes(root, 'div').find(x => x.props.role === 'alert');
        assert.ok(error);
        assert.equal(s.states[4].data, undefined);
        h.nodes(error, 'Button')[0].props.onClick();
        s.render();
        s.requests[1].resolve(h.rows());
        await h.drain();
        assert.equal(
          h.nodes(s.render(), 'div').some(x => x.props.role === 'alert'),
          false,
        );
      }
      const s = await ready(h.current);
      const before = s.states[4].data;
      s.helpers().edit({ type: 10, state: false });
      s.requests[1].reject(Error('batch-fail'));
      await h.drain();
      s.render();
      assert.equal(s.states[4].data, before);
      assert.deepEqual(s.events.at(-1), ['alert', '修改失败，请稍后再试！', 2]);
      // Existing missing aggregate lookup still fails natively after a valid but incomplete response.
      for (const source of [h.previous, h.current]) {
        const x = h.renderer(source);
        x.render();
        x.flushEffects();
        x.requests[0].resolve([{ type: 24, state: true }]);
        await h.drain();
        assert.throws(() => x.render(), TypeError);
      }
    },
  );
  await check(
    'Range class erases identically and keeps role/view/other callbacks, IDs and array side effects',
    async () => {
      assert.equal(h.compile(h.currentRange, h.RANGE), h.compile(h.oldRange, h.RANGE));
      function run(source) {
        const r = h.range(source);
        const input = r.props.data.viewIds;
        const root = r.instance.render();
        h.nodes(root, 'Radio').forEach(x => x.props.onClick());
        h.nodes(root, 'Checkbox')[0].props.onClick(true);
        assert.equal(r.props.data.viewIds, input);
        assert.deepEqual(input, []);
        h.nodes(root, 'Checkbox')[1].props.onClick(false);
        h.nodes(root, 'Checkbox')[2].props.onClick(false);
        h.nodes(root, 'Checkbox').at(-1).props.onClick();
        h.nodes(root, 'Icon')
          .find(x => x.props.icon === 'close')
          .props.onClick();
        return { events: h.tree(r.events), data: r.props.data };
      }
      assert.deepEqual(run(h.currentRange), run(h.oldRange));
    },
  );
  await check(
    'actual Range mount/resize/update/unmount positioning and missing-chat failure retain native behavior',
    async () => {
      function run(source, options) {
        const r = h.range(source, {}, options);
        r.instance.componentDidMount();
        r.flushTimers();
        const first = { ...r.element.style };
        r.instance.props = { ...r.instance.props, top: 350 };
        r.instance.componentDidUpdate(r.props);
        r.flushTimers();
        r.instance.handleResize();
        r.flushTimers();
        r.instance.componentWillUnmount();
        return { first, next: r.element.style, events: h.tree(r.events) };
      }
      for (const width of [500, 1000]) assert.deepEqual(run(h.currentRange, { width }), run(h.oldRange, { width }));
      for (const source of [h.previous, h.current]) {
        const r = h.range(source === h.current ? h.currentRange : h.oldRange, {}, { chat: null });
        r.instance.componentDidMount();
        assert.throws(() => r.flushTimers(), TypeError);
      }
    },
  );
  await check('actual autoID check API renders real usage references and nested names', async () => {
    async function run(source) {
      const s = h.renderer(source, {}, { kind: 'delete' });
      let root = s.render();
      h.nodes(root, 'Button')[0].props.onClick();
      assert.equal(s.requests[0].method, 'processgetProcessByControlId');
      assert.deepEqual(s.requests[0].args, { controlId: 'autoid', appId: 'sheet', companyId: 'company' });
      assert.equal(
        s.requests[0].options.ajaxOptions.url,
        'https://workflow.example.test/process/getProcessByControlId',
      );
      const rows = [
        { name: 'Flow', flowNodes: [{ name: 'Node' }], extension: { keep: true } },
        { name: null, flowNodes: null },
      ];
      s.requests[0].resolve(rows);
      await h.drain();
      root = s.render();
      assert.equal(s.states[2], rows);
      assert.equal(s.states[2][0], rows[0]);
      return { tree: h.tree(root), events: h.tree(s.events) };
    }
    assert.deepEqual(await run(h.currentDelete), await run(h.oldDelete));
  });
  await check(
    'autoID deletion keeps wrapper data truthiness, success/callback/close order and undefined default',
    async () => {
      for (const response of [undefined, {}, { data: false }, { data: true }, { data: 1 }, { data: 'yes' }]) {
        async function run(source) {
          const s = h.renderer(source, {}, { kind: 'delete' });
          h.nodes(s.render(), 'Button')[1].props.onClick();
          assert.equal(s.requests[0].method, 'DeleteWorksheetAutoID');
          s.requests[0].resolve(response);
          await h.drain();
          return h.tree(s.events);
        }
        assert.deepEqual(await run(h.currentDelete), await run(h.oldDelete));
      }
    },
  );
  await check(
    'autoID failures preserve the dialog/draft and never claim malformed usage was a successful empty list',
    async () => {
      for (const raw of [null, {}, [null], [{ name: 4 }], [{ flowNodes: [null] }]]) {
        const s = h.renderer(h.currentDelete, {}, { kind: 'delete' });
        h.nodes(s.render(), 'Button')[0].props.onClick();
        s.requests[0].resolve(raw);
        await h.drain();
        s.render();
        assert.equal(s.states[0], false);
        assert.equal(s.states[1], false);
        assert.deepEqual(s.states[2], []);
        assert.deepEqual(s.events.at(-1), ['alert', '检查失败，请稍后再试！', 2]);
      }
      for (const deleting of [false, true]) {
        const s = h.renderer(h.currentDelete, {}, { kind: 'delete' });
        h.nodes(s.render(), 'Button')[deleting ? 1 : 0].props.onClick();
        s.requests[0].reject(Error('network-fail'));
        await h.drain();
        assert.equal(
          s.events.some(e => e[0] === 'close'),
          false,
        );
        assert.equal(s.events.at(-1)[0], 'alert');
      }
      const s = h.renderer(
        h.currentDelete,
        {
          delCallback() {
            throw Error('callback-fail');
          },
        },
        { kind: 'delete' },
      );
      h.nodes(s.render(), 'Button')[1].props.onClick();
      s.requests[0].resolve({ data: true });
      await h.drain();
      assert.equal(
        s.events.some(e => e[0] === 'close'),
        false,
      );
      assert.deepEqual(s.events.at(-1), ['alert', '删除失败，请稍后再试！', 2]);
    },
  );
  await check('all four old promise rejection paths have real child-process counterexamples', async () => {
    const loader = path.join(h.ROOT, 'scripts/spec-fixtures/functionalSwitchLoader.ts');
    for (const method of ['load', 'batch', 'check', 'delete'])
      for (const version of ['old', 'current']) {
        const main = method === 'load' || method === 'batch',
          source = main
            ? version === 'old'
              ? 'previous'
              : 'current'
            : version === 'old'
              ? 'oldDelete'
              : 'currentDelete';
        const work = main
          ? `s.render();s.flushEffects();${method === 'batch' ? "s.requests[0].resolve(h.rows());await h.drain();s.render();s.helpers().edit({type:10,state:false});s.requests[1].reject(Error('network-fail'));" : "s.requests[0].reject(Error('network-fail'));"}`
          : `h.nodes(s.render(),'Button')[${method === 'check' ? 0 : 1}].props.onClick();s.requests[0].reject(Error('network-fail'));`;
        const code = `const h=require(${JSON.stringify(loader)});(async()=>{const s=h.renderer(h.${source},{},${main ? '{}' : "{kind:'delete'}"});${work}await h.drain();s.render();})().catch(e=>{console.error(e);process.exitCode=1;});`;
        const r = cp.spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', code], {
          cwd: h.ROOT,
          encoding: 'utf8',
        });
        assert.equal(r.status, version === 'old' ? 1 : 0, method + version + r.stderr);
        if (version === 'old') assert.match(r.stderr, /network-fail/);
      }
  });
  await check('native storage shims erase identically and workflow usage decoder keeps opaque metadata', async () => {
    for (const rel of ['src/common/cookies.ts', 'src/pages/embed/mingoEntry/widgetEntry.ts']) {
      const old = cp.execFileSync('git', ['show', `${h.BASE}:${rel}`], { cwd: h.ROOT, encoding: 'utf8' });
      assert.equal(h.compile(fs.readFileSync(path.join(h.ROOT, rel), 'utf8'), rel), h.compile(old, rel), rel);
    }
    const s = h.renderer(h.currentDelete, {}, { kind: 'delete' });
    const rows = [{ name: 'Flow', flowNodes: [{ name: 'Node' }], extra: { keep: true } }];
    assert.equal(s.module.autoIdUsages(rows), rows);
    assert.equal(s.module.autoIdUsages(rows)[0].extra, rows[0].extra);
    Object.defineProperty(rows[0], 'unconsumed', {
      get() {
        throw Error('not consumed');
      },
    });
    assert.equal(s.module.autoIdUsages(rows), rows);
    assert.throws(() => s.module.autoIdDeletionResult(null), TypeError);
    assert.equal(s.module.autoIdDeletionResult({ data: 'truthy' }), 'truthy');
  });
  console.log(`${checks} functional switch/range/autoID checks passed`);
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
