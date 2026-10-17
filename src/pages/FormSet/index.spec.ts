/** Complete real entry and API/translation/navigation declarations, controlled hook scheduling/host and leaf UI. */
const assert = require('node:assert/strict'),
  cp = require('node:child_process'),
  path = require('node:path');
const h = require('../../../scripts/spec-fixtures/formSetEntryLoader.ts');
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  PASS ${name}`);
}
async function ready(source, configure = (_data: any) => {}, props = {}, options = {}) {
  const s = h.renderer(source, props, options);
  assert.equal(h.tree(s.render()).type, 'LoadDiv');
  s.flushEffects();
  const data = h.response();
  configure(data);
  s.requests[0].resolve(data);
  await h.drain();
  return { ...s, data, root: s.render() };
}
async function compare(run) {
  assert.deepEqual(await run(h.current), await run(h.previous));
}
async function main() {
  await check('complete actual entry preserves every module route/default and forwarded props', async () => {
    for (const type of [
      'alias',
      'display',
      'printTemplate',
      'functionalSwitch',
      'customAction',
      'aiAction',
      'indexSetting',
      'editProtect',
      'submitForm',
      'share',
      'unknown',
      '',
    ])
      await compare(async source => {
        const history = { marker: 'keep' };
        const s = await ready(source, () => {}, {
          match: { params: { worksheetId: 'sheet', type } },
          history,
          extension: { keep: true },
        });
        assert.equal(s.requests.length, 1);
        assert.deepEqual(s.requests[0].args, {
          worksheetId: 'sheet',
          getTemplate: true,
          getViews: true,
          getSwitchPermit: true,
        });
        assert.equal(s.requests[0].method, 'GetWorksheetInfo');
        assert.equal(s.states[4], s.data);
        return { tree: h.tree(s.root), events: h.tree(h.businessEvents(s.events)) };
      });
  });
  await check('missing route/missing ID retain original request and navigation IDs without fake defaults', async () => {
    for (const props of [{}, { match: undefined }, { match: { params: {} } }])
      await compare(async source => {
        const s = await ready(source, () => {}, { match: undefined, ...props });
        assert.equal(s.requests[0].args.worksheetId, undefined);
        h.nodes(s.root, 'Header')[0].props.onClose();
        assert.equal(s.requests[1].args.worksheetId, undefined);
        s.requests[1].resolve({ appId: 'app', groupId: 'group', worksheetId: 'sheet' });
        await h.drain();
        return h.tree(h.businessEvents(s.events));
      });
  });
  await check(
    'raw response mutation, control arrays, sort order, own undefined and time-zone/cache effects stay intact',
    async () => {
      for (const immediate of [false, true])
        for (const appTimeZone of [undefined, 0, 8])
          await compare(async source => {
            const s = await ready(
              source,
              d => {
                d.appTimeZone = appTimeZone;
                d.projectId = undefined;
                d.name = undefined;
              },
              {},
              { immediate },
            );
            assert.equal(s.states[4], s.data);
            assert.equal(s.states[2], s.data.template.controls);
            assert.notEqual(s.states[3], s.states[2]);
            assert.equal(s.states[3][0], s.states[2][1]);
            assert.deepEqual(
              s.states[3].map(c => c.controlId),
              ['a', 'b'],
            );
            assert.equal(Object.hasOwn(s.states[4], 'projectId'), true);
            const event = s.events.find(e => e[0] === 'clear-cache');
            assert.deepEqual(event[1], {
              requestData: { worksheetId: 'sheet' },
              clearSpecificKeys: ['Worksheet_GetWorksheetInfo', 'Worksheet_GetWorksheetBaseInfo'],
            });
            return {
              tree: h.tree(s.root),
              events: h.tree(h.businessEvents(s.events)),
              zone: s.win['timeZone_app'],
              data: s.data,
            };
          });
    },
  );
  await check(
    'real translation lookup and recursive control translation preserve names/options/nested mutations',
    async () => {
      const language = [
        { correlationId: 'sheet', parentId: null, data: { name: 'Translated sheet' } },
        {
          correlationId: 'choice',
          parentId: 'sheet',
          data: { name: 'Translated choice', hintText: 'Hint', k: 'Translated option' },
        },
        { correlationId: 'number', parentId: 'sheet', data: { name: 'Amount', prefix: 'EUR ', suffix: ' units' } },
        { correlationId: 'nested', parentId: 'children', data: { name: 'Translated nested' } },
      ];
      await compare(async source => {
        const s = await ready(
          source,
          d => {
            d.template.controls = [
              {
                controlId: 'choice',
                type: 9,
                row: 1,
                hint: 'Old hint',
                options: [{ key: 'k', value: 'Old option' }],
                advancedSetting: { otherhint: 'Other' },
              },
              { controlId: 'number', type: 6, row: 2, advancedSetting: { prefix: '$ ', suffix: ' old' } },
              {
                controlId: 'sub',
                type: 34,
                row: 3,
                dataSource: 'children',
                relationControls: [{ controlId: 'nested', type: 2, row: 0, controlName: 'Nested' }],
              },
            ];
          },
          {},
          { language },
        );
        assert.equal(s.data.name, 'Translated sheet');
        assert.equal(s.data.template.controls[0].options[0].value, 'Translated option');
        assert.equal(s.data.template.controls[1].advancedSetting.prefix, 'EUR ');
        assert.equal(s.data.template.controls[2].relationControls[0].controlName, 'Translated nested');
        return { tree: h.tree(s.root), data: s.data, events: h.tree(h.businessEvents(s.events)) };
      });
    },
  );
  await check('native getter and mutation prefix order is unchanged on a valid response', async () => {
    await compare(async source => {
      const s = h.renderer(source);
      s.render();
      s.flushEffects();
      const reads = [];
      let name = 'Name';
      const template = { controls: [{ controlId: 'x', type: 2, row: 0 }] };
      const raw = {
        roleType: 2,
        get appId() {
          reads.push('appId');
          return undefined;
        },
        get name() {
          reads.push('name');
          return name;
        },
        set name(v) {
          reads.push('set-name');
          name = v;
        },
        get template() {
          reads.push('template');
          return template;
        },
        get appTimeZone() {
          reads.push('zone');
          return undefined;
        },
      };
      s.requests[0].resolve(raw);
      await h.drain();
      const root = s.render();
      return { reads, tree: h.tree(root), events: h.tree(h.businessEvents(s.events)) };
    });
  });
  await check(
    'role permission decisions preserve pre-check translation/cache prefix and denial navigation',
    async () => {
      for (const role of [0, 1, 2, 3, 4, 6, 7])
        await compare(async source => {
          const s = await ready(source, d => {
            d.roleType = role;
          });
          const denied = ![2, 4, 6].includes(role);
          assert.equal(s.states[5], denied);
          assert.equal(h.nodes(s.root, 'ErrorState').length, denied ? 1 : 0);
          assert.equal(
            s.events.some(e => e[0] === 'clear-cache'),
            true,
          );
          if (denied) {
            assert.deepEqual(s.states[4], {});
            h.nodes(s.root, 'ErrorState')[0].props.callback();
            s.requests[1].resolve({ appId: 'app', groupId: 'group', worksheetId: 'sheet' });
            await h.drain();
          }
          return { tree: h.tree(s.root), events: h.tree(h.businessEvents(s.events)) };
        });
    },
  );
  await check('latest request wins and old response/getters are untouched after a worksheet route change', async () => {
    for (const immediate of [false, true])
      await compare(async source => {
        const s = h.renderer(source, {}, { immediate });
        s.render();
        s.flushEffects();
        s.setProps({ match: { params: { worksheetId: 'new-sheet', type: 'alias' } } });
        s.render();
        s.flushEffects();
        assert.equal(s.requests.length, 2);
        const next = h.response();
        next.name = 'Newest';
        s.requests[1].resolve(next);
        await h.drain();
        const root = s.render();
        s.requests[0].resolve({
          get name() {
            throw Error('stale response consumed');
          },
        });
        await h.drain();
        s.render();
        assert.equal(s.states[4], next);
        return { tree: h.tree(root), events: h.tree(h.businessEvents(s.events)) };
      });
  });
  await check(
    'same-worksheet tab change does not refetch, and unmount keeps original HTML cleanup/response guard',
    async () => {
      await compare(async source => {
        const s = await ready(source);
        s.setProps({ match: { params: { worksheetId: 'sheet', type: 'alias' } } });
        const root = s.render();
        s.flushEffects();
        assert.equal(s.requests.length, 1);
        s.unmount();
        assert.deepEqual(s.events.at(-1), ['removeClass', 'html', 'formSetWorksheet']);
        return { tree: h.tree(root), events: h.tree(h.businessEvents(s.events)) };
      });
      await compare(async source => {
        const s = h.renderer(source);
        s.render();
        s.flushEffects();
        s.unmount();
        const before = s.events.length;
        s.requests[0].resolve({
          get appId() {
            throw Error('unmounted response consumed');
          },
        });
        await h.drain();
        assert.equal(s.events.length, before);
        return h.tree(h.businessEvents(s.events));
      });
    },
  );
  await check(
    'actual back/close navigation and child onChange preserve original API/storage route and references',
    async () => {
      for (const redirect of [false, true])
        await compare(async source => {
          const storage = JSON.stringify({ worksheets: [{ groupId: 'group', worksheetId: 'sheet', viewId: 'view' }] });
          const s = await ready(source, () => {}, {}, { storage });
          const header = h.nodes(s.root, 'Header')[0];
          header.props.onBack(redirect ? { redirectfn: () => s.events.push(['redirect']) } : {});
          if (!redirect) {
            s.requests[1].resolve({ appId: 'app', groupId: 'group', worksheetId: 'sheet' });
            await h.drain();
            assert.deepEqual(s.events.at(-1), ['navigate', '/app/app/group/sheet/view']);
          }
          const child = h.nodes(s.root, './containers/Share')[0];
          const changed = { ...s.data, name: 'Changed', advancedSetting: { keep: 'yes' } };
          child.props.onChange(changed);
          s.render();
          assert.equal(s.states[4], changed);
          return { events: h.tree(h.businessEvents(s.events)), state: s.states[4] };
        });
    },
  );
  await check(
    'failed requests and malformed response prefixes produce guarded retry UI without claiming no-right',
    async () => {
      for (const malformed of [false, true]) {
        const s = h.renderer(h.current);
        s.render();
        s.flushEffects();
        if (malformed) s.requests[0].resolve({ name: 'Prefix', appId: 'app' });
        else s.requests[0].reject(Error('network-fail'));
        await h.drain();
        let root = s.render();
        assert.equal(s.states[5], false);
        const error = h.nodes(root, 'ErrorState')[0];
        assert.equal(error.props.btnText, '重试');
        assert.equal(h.nodes(root, './containers/Share').length, 0);
        error.props.callback();
        assert.equal(h.tree(s.render()).type, 'LoadDiv');
        const data = h.response();
        s.requests[1].resolve(data);
        await h.drain();
        root = s.render();
        assert.equal(s.states[4], data);
        assert.equal(h.nodes(root, 'ErrorState').length, 0);
      }
    },
  );
  await check('stale or unmounted rejections do not change current state or show a late load error', async () => {
    const s = h.renderer(h.current);
    s.render();
    s.flushEffects();
    s.setProps({ match: { params: { worksheetId: 'new', type: 'share' } } });
    s.render();
    s.flushEffects();
    s.requests[1].resolve(h.response());
    await h.drain();
    s.render();
    const before = s.events.length;
    s.requests[0].reject(Error('old-fail'));
    await h.drain();
    assert.equal(s.events.length, before);
    assert.equal(h.nodes(s.render(), 'ErrorState').length, 0);
    const x = h.renderer(h.current);
    x.render();
    x.flushEffects();
    x.unmount();
    const count = x.events.length;
    x.requests[0].reject(Error('late-fail'));
    await h.drain();
    assert.equal(x.events.length, count);
  });
  await check('old-source rejection and missing-template errors are real child-process counterexamples', async () => {
    const loader = path.join(h.ROOT, 'scripts/spec-fixtures/formSetEntryLoader.ts');
    for (const kind of ['reject', 'malformed'])
      for (const variant of ['previous', 'current']) {
        const code = `const h=require(${JSON.stringify(loader)});(async()=>{const s=h.renderer(h.${variant});s.render();s.flushEffects();s.requests[0].${kind === 'reject' ? "reject(Error('network-fail'))" : "resolve({name:'Name',appId:'app'})"};await h.drain();if(h.nodes(s.render(),'ErrorState')[0]?.props.btnText!=='重试')throw Error('missing retry UI');})().catch(e=>{console.error(e);process.exitCode=1;});`;
        const r = cp.spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', code], {
          cwd: h.ROOT,
          encoding: 'utf8',
        });
        assert.equal(r.status, variant === 'previous' ? 1 : 0, kind + variant + r.stderr);
        if (variant === 'previous') assert.match(r.stderr, kind === 'reject' ? /network-fail/ : /controls/);
      }
  });
  console.log(`${checks} FormSet entry checks passed`);
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
