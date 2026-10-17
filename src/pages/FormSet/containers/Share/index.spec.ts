/** Real complete historical/current hook functions and actual API wrappers; no mount or production writes. */
const assert = require('node:assert/strict'),
  cp = require('node:child_process'),
  path = require('node:path');
const h = require('../../../../../scripts/spec-fixtures/shareSettingsLoader.ts');
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  PASS ${name}`);
}
async function ready(source, rows, props = {}, options = {}) {
  const s = h.renderer(source, props, options);
  assert.equal(h.tree(s.render()).type, 'LoadDiv');
  s.flushEffects();
  s.render();
  assert.equal(s.requests.length, 1);
  assert.equal(s.requests[0].method, 'GetSwitch');
  s.requests[0].resolve(rows);
  await h.drain();
  return { ...s, root: s.render() };
}
async function compare(run) {
  assert.deepEqual(await run(h.current), await run(h.previous));
}
async function tab(s, index) {
  h.nodes(s.render(), 'Tab')[index].props.onClick();
  let root = s.render();
  s.flushEffects();
  root = s.render();
  return root;
}
async function main() {
  await check(
    'normal wire rows, missing/empty/null view IDs and all tabs retain complete JSX and request trace',
    async () => {
      for (const state of [false, true, undefined])
        for (const viewIds of [undefined, null, [], ['v1']])
          await compare(async source => {
            const rows = [
              { type: 20, state, roleType: 0, viewIds, extension: { keep: true } },
              { type: 30, state, roleType: 100, viewIds },
              { type: 999, state: false },
            ];
            const s = await ready(source, rows);
            assert.equal(s.states[2].data, rows);
            const views = [];
            for (const index of [0, 1, 2]) views.push(h.tree(await tab(s, index)));
            assert.deepEqual(s.requests[0].args, { worksheetId: 'sheet' });
            assert.equal(s.requests[0].service, 'Worksheet');
            return { views, events: h.tree(s.events) };
          });
    },
  );
  await check('missing worksheet ID keeps the original no-request loading behavior', async () => {
    for (const source of [h.previous, h.current]) {
      const s = h.renderer(source, { worksheetId: undefined });
      assert.equal(h.tree(s.render()).type, 'LoadDiv');
      s.flushEffects();
      assert.equal(s.requests.length, 0);
    }
  });
  await check(
    'sharing switch updates preserve request metadata and immutable row/array reference behavior',
    async () => {
      for (const immediate of [false, true])
        await compare(async source => {
          const metadata = { keep: true };
          const row = { type: 20, state: true, roleType: 0, viewIds: [], extension: metadata };
          Object.defineProperty(row, '__proto__', { value: 'own', enumerable: true });
          row[Symbol.for('switch-meta')] = metadata;
          const other = { type: 30, state: false },
            duplicate = { type: 20, state: false, extra: 'duplicate' };
          const rows = [row, other, duplicate];
          const s = await ready(source, rows, {}, { immediate });
          h.nodes(s.root, 'Switch')[0].props.onClick();
          const r = s.requests[1];
          assert.equal(r.method, 'BatchEditSwitch');
          assert.equal(r.args.switchList.length, 1);
          const patch = r.args.switchList[0];
          assert.equal(patch.extension, metadata);
          assert.equal(patch[Symbol.for('switch-meta')], metadata);
          assert.equal(Object.hasOwn(patch, '__proto__'), true);
          assert.equal(s.states[2].data, rows);
          r.resolve(true);
          await h.drain();
          s.render();
          const next = s.states[2].data;
          assert.notEqual(next, rows);
          assert.notEqual(next[0], row);
          assert.equal(next[1], other);
          assert.notEqual(next[2], duplicate);
          assert.equal(next[0].extension, metadata);
          assert.equal(row.state, true);
          return { events: h.tree(s.events), data: next };
        });
    },
  );
  await check(
    'role and view selectors preserve missing vs empty view IDs, local selection and source views',
    async () => {
      for (const viewIds of [undefined, null, [], ['v1']])
        await compare(async source => {
          const rows = [{ type: 20, state: true, viewIds }];
          const s = await ready(source, rows);
          let radios = h.nodes(s.root, 'Radio');
          radios[1].props.onClick();
          assert.equal(s.requests.at(-1).args.switchList[0].roleType, 100);
          s.requests.at(-1).resolve(true);
          await h.drain();
          let root = s.render();
          h.nodes(root, 'Radio')[0].props.onClick();
          s.requests.at(-1).resolve(true);
          await h.drain();
          root = s.render();
          h.nodes(root, 'Radio')[3].props.onClick();
          root = s.render();
          assert.equal(s.states[1], true);
          s.requests.at(-1).resolve(true);
          await h.drain();
          root = s.render();
          const select = h.nodes(root, 'SelectExDrop')[0];
          assert.ok(select);
          assert.deepEqual(
            select.props.controls.map(v => v.viewId),
            ['v1', 'v2'],
          );
          assert.equal(select.props.controls[0], s.props.worksheetInfo.views[0]);
          const chosen = ['v2'];
          select.props.onChange(chosen);
          assert.equal(s.requests.at(-1).args.switchList[0].viewIds, chosen);
          s.requests.at(-1).resolve(true);
          await h.drain();
          root = s.render();
          h.nodes(root, 'Radio')[2].props.onClick();
          root = s.render();
          assert.equal(s.states[1], false);
          s.requests.at(-1).resolve(true);
          await h.drain();
          s.render();
          await tab(s, 1);
          assert.equal(s.states[1], false);
          return { events: h.tree(s.events), info: s.states[2] };
        });
    },
  );
  await check(
    'empty lists keep the original missing-type edit and off state rather than fabricating a switch row',
    async () => {
      await compare(async source => {
        const s = await ready(source, []);
        h.nodes(s.root, 'Switch')[0].props.onClick();
        assert.deepEqual(s.requests[1].args.switchList, [{ state: true }]);
        s.requests[1].resolve(true);
        await h.drain();
        s.render();
        assert.deepEqual(s.states[2].data, []);
        return h.tree(s.events);
      });
    },
  );
  await check('out-of-order save completions preserve the old captured-state behavior', async () => {
    await compare(async source => {
      const s = await ready(source, [{ type: 20, state: true, roleType: 0, viewIds: [] }]);
      const radio = h.nodes(s.root, 'Radio');
      radio[1].props.onClick();
      radio[3].props.onClick();
      s.render();
      s.requests[2].resolve(true);
      await h.drain();
      s.render();
      s.requests[1].resolve(true);
      await h.drain();
      s.render();
      assert.equal(s.states[2].data[0].roleType, 100);
      assert.deepEqual(s.states[2].data[0].viewIds, []);
      return { events: h.tree(s.events), info: s.states[2] };
    });
  });
  await check(
    'discussion permission saves keep own metadata, callback order and returned worksheet identity',
    async () => {
      for (const permission of [undefined, '', '2'])
        for (const success of [false, true])
          await compare(async source => {
            const reads = [];
            const meta = {
              get extension() {
                reads.push('extension');
                return 'keep';
              },
              discusspermission: permission,
            };
            Object.defineProperty(meta, '__proto__', { value: 'own', enumerable: true });
            meta[Symbol.for('advanced')] = 'symbol';
            const worksheetInfo = {
              worksheetId: 'sheet',
              appId: 'app',
              views: [],
              advancedSetting: meta,
              extra: { keep: true },
            };
            const s = await ready(source, [{ type: 20, state: true }], { worksheetInfo });
            const root = await tab(s, 2);
            const checked = h.nodes(root, 'Radio').map(r => r.props.checked);
            h.nodes(root, 'Radio')[1].props.onClick();
            assert.equal(reads.length, 0);
            const req = s.requests[1];
            assert.equal(req.method, 'EditWorksheetSetting');
            assert.deepEqual(req.args, {
              workSheetId: 'sheet',
              appId: 'app',
              advancedSetting: { discusspermission: '2' },
              editAdKeys: ['discusspermission'],
            });
            req.resolve(success);
            await h.drain();
            if (success) {
              const next = s.events.find(e => e[0] === 'onChange')[1];
              assert.notEqual(next, worksheetInfo);
              assert.notEqual(next.advancedSetting, meta);
              assert.equal(next.extra, worksheetInfo.extra);
              assert.equal(next.advancedSetting[Symbol.for('advanced')], 'symbol');
              assert.equal(Object.hasOwn(next.advancedSetting, '__proto__'), true);
              assert.deepEqual(reads, ['extension']);
            } else assert.deepEqual(reads, []);
            return { checked, events: h.tree(s.events), reads };
          });
    },
  );
  await check('a false batch response alerts without changing loaded rows or adding a success fallback', async () => {
    for (const response of [false, null, undefined, 0, '', {}, []])
      await compare(async source => {
        const rows = [{ type: 20, state: true }];
        const s = await ready(source, rows);
        h.nodes(s.root, 'Switch')[0].props.onClick();
        s.requests[1].resolve(response);
        await h.drain();
        s.render();
        if (!response) assert.equal(s.states[2].data, rows);
        return { events: h.tree(s.events), data: s.states[2].data };
      });
  });
  await check(
    'view/record share-card props keep actual controls, default text and runtime undefined handling',
    async () => {
      await compare(async source => {
        const s = await ready(source, [
          { type: 20, state: true },
          { type: 30, state: true },
        ]);
        const first = h.nodes(s.root, 'ShareCardSetting')[0];
        assert.deepEqual(
          first.props.controls.map(c => c.controlId),
          ['text', 'number', 'money', 'email', 'combo'],
        );
        assert.equal(first.props.worksheetInfo, s.props.worksheetInfo);
        const record = h.nodes(await tab(s, 1), 'ShareCardSetting')[0];
        return { view: h.tree(first), record: h.tree(record) };
      });
    },
  );
  await check('invalid or rejected loads produce retry UI and never invent successful permission data', async () => {
    for (const raw of [
      null,
      {},
      false,
      [null],
      [{ state: 'false' }],
      [{ type: '20' }],
      [{ roleType: '100' }],
      [{ viewIds: 'v1' }],
      [{ viewIds: [1] }],
    ]) {
      const s = h.renderer(h.current);
      s.render();
      s.flushEffects();
      s.requests[0].resolve(raw);
      await h.drain();
      let root = s.render();
      assert.equal(root.props.role, 'alert');
      assert.equal(s.states[2].data, undefined);
      h.nodes(root, 'Button')[0].props.onClick();
      assert.equal(h.tree(s.render()).type, 'LoadDiv');
      s.requests[1].resolve([{ type: 20, state: false }]);
      await h.drain();
      root = s.render();
      assert.equal(h.tree(root).type, 'ScrollView');
      assert.equal(h.nodes(root, 'Switch')[0].props.checked, false);
    }
    const s = h.renderer(h.current);
    s.render();
    s.flushEffects();
    s.requests[0].reject(Error('load-fail'));
    await h.drain();
    assert.equal(s.render().props.role, 'alert');
  });
  await check('batch and discussion request rejection alerts and preserves current settings', async () => {
    for (const discussion of [false, true]) {
      const rows = [{ type: 20, state: true }];
      const s = await ready(h.current, rows);
      const root = discussion ? await tab(s, 2) : s.root;
      (discussion ? h.nodes(root, 'Radio')[1] : h.nodes(root, 'Switch')[0]).props.onClick();
      s.requests[1].reject(Error('save-fail'));
      await h.drain();
      s.render();
      assert.equal(s.states[2].data, rows);
      assert.equal(
        s.events.some(e => e[0] === 'onChange'),
        false,
      );
      assert.equal(s.events.at(-1)[0], 'alert');
    }
    // A callback failure still follows the completed network request and keeps its prior prefix.
    const s = await ready(h.current, [], {
      onChange() {
        throw Error('consumer-fail');
      },
    });
    h.nodes(await tab(s, 2), 'Radio')[0].props.onClick();
    s.requests[1].resolve(true);
    await h.drain();
    assert.deepEqual(s.events.at(-1), ['alert', '修改失败，请稍后再试', 2]);
  });
  await check(
    'old-source rejected promises genuinely fail in isolated processes while new handlers finish',
    async () => {
      const loader = path.join(h.ROOT, 'scripts/spec-fixtures/shareSettingsLoader.ts');
      for (const method of ['load', 'batch', 'discussion'])
        for (const variant of ['previous', 'current']) {
          const code = `const h=require(${JSON.stringify(loader)});(async()=>{const s=h.renderer(h.${variant});s.render();s.flushEffects();${method === 'load' ? "s.requests[0].reject(Error('network-fail'));await h.drain();if(s.render().props.role!=='alert')throw Error('missing error');" : 's.requests[0].resolve([{type:20,state:true}]);await h.drain();let root=s.render();' + (method === 'discussion' ? "h.nodes(root,'Tab')[2].props.onClick();root=s.render();h.nodes(root,'Radio')[1].props.onClick();" : "h.nodes(root,'Switch')[0].props.onClick();") + "s.requests[1].reject(Error('network-fail'));await h.drain();if(!s.events.some(e=>e[0]==='alert'))throw Error('missing alert');"}})().catch(e=>{console.error(e);process.exitCode=1;});`;
          const r = cp.spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', code], {
            cwd: h.ROOT,
            encoding: 'utf8',
          });
          assert.equal(r.status, variant === 'previous' ? 1 : 0, method + variant + r.stderr);
          if (variant === 'previous') assert.match(r.stderr, /network-fail/);
        }
    },
  );
  await check(
    'wire validation preserves input identity and extensions while validating actual known fields',
    async () => {
      const rows = [
        { type: 20, state: true, viewIds: [], extension: { keep: true } },
        { type: 777, roleType: 33, viewIds: null },
      ];
      Object.defineProperty(rows[0], 'untouched', {
        get() {
          throw Error('extension not consumed');
        },
        enumerable: true,
      });
      const result = h.settings.sharingSwitches(rows);
      assert.equal(result, rows);
      assert.equal(result[0], rows[0]);
      assert.equal(result[0].viewIds, rows[0].viewIds);
      assert.equal(result[0].extension, rows[0].extension);
      assert.equal(h.settings.sharingSwitches([{ state: undefined, type: undefined, viewIds: undefined }]).length, 1);
      for (const raw of [undefined, '[]', {}, [false], [null], [{ state: 0 }], [{ viewIds: [null] }]])
        assert.throws(() => h.settings.sharingSwitches(raw), /sharing switch/);
      const bad = h.renderer(h.current);
      bad.render();
      bad.flushEffects();
      bad.requests[0].resolve([
        {
          get state() {
            throw Error('getter-fail');
          },
        },
      ]);
      await h.drain();
      assert.equal(bad.render().props.role, 'alert');
    },
  );
  console.log(`${checks} sharing settings checks passed`);
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
