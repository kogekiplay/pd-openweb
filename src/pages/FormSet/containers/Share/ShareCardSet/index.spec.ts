/** Actual full hook functions with controlled scheduling/leaves/network; real promises and dynamic text helpers. */
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const path = require('node:path');
const h = require('../../../../../../scripts/spec-fixtures/shareCardLoader.ts');
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`  PASS ${name}`);
}
async function ready(source, raw, props = {}, options = {}) {
  const s = h.renderer(source, props, options);
  assert.equal(h.tree(s.render()).type, 'LoadDiv');
  s.flushEffects();
  assert.equal(s.requests[0].kind, 'load');
  s.requests[0].resolve(raw);
  await h.drain();
  return { ...s, root: s.render() };
}
async function compare(run) {
  assert.deepEqual(await run(h.current), await run(h.old));
}
async function main() {
  await check('complete real hooks preserve load/default/ref and full JSX for all valid metadata', async () => {
    for (const type of [
      h.constants.SHARECARDTYPS.RECORD,
      h.constants.SHARECARDTYPS.VIEW,
      h.constants.SHARECARDTYPS.PUBLICWORKSHEET,
    ])
      for (const raw of [
        {},
        { title: 'Title', desc: 'Description', icon: 'https://files.example.test/a.png' },
        { title: '', desc: null, icon: null, iconUrl: null },
        { icon: 0, iconUrl: false },
        false,
        'legacy',
      ]) {
        await compare(async source => {
          const s = await ready(source, raw, {
            type,
            showTips: true,
            showBaseImg: true,
            defaultValue: { title: 'Fallback', desc: 'Default' },
          });
          assert.equal(s.ref.current.onSave instanceof Function, true);
          return { tree: h.tree(s.root), events: h.tree(s.events), value: s.ref.current.shareConfigValue };
        });
      }
  });
  await check(
    'raw response spread/getters, lazy defaults, symbols/prototype keys and nested references are preserved',
    async () => {
      await compare(async source => {
        const reads = [];
        const nested = { keep: true };
        const raw = {
          get title() {
            reads.push('title');
            return '';
          },
          get desc() {
            reads.push('desc');
            return 'Desc';
          },
          get icon() {
            reads.push('icon');
            return null;
          },
          get extension() {
            reads.push('extension');
            return nested;
          },
        };
        Object.defineProperty(raw, '__proto__', { value: 'own', enumerable: true });
        raw[Symbol.for('share-extra')] = nested;
        const info = {
          get worksheetName() {
            reads.push('name');
            return 'Sheet';
          },
        };
        const s = await ready(source, raw, { type: h.constants.SHARECARDTYPS.PUBLICWORKSHEET, worksheetInfo: info });
        const value = s.ref.current.shareConfigValue;
        assert.equal(value.extension, nested);
        assert.equal(value[Symbol.for('share-extra')], nested);
        assert.equal(Object.hasOwn(value, '__proto__'), true);
        assert.deepEqual(reads, ['title', 'desc', 'icon', 'extension', 'title', 'name', 'desc']);
        return { reads, value };
      });
      // No title fallback means a missing worksheetInfo must not be read, even for public forms.
      await compare(async source => {
        const s = await ready(
          source,
          { title: 'Given', desc: 'Given' },
          { type: h.constants.SHARECARDTYPS.PUBLICWORKSHEET, worksheetInfo: undefined },
        );
        return h.tree(s.root);
      });
    },
  );
  await check('the real type-2 dynamic helper formats serialized static and current control text', async () => {
    const controls = [
      { controlId: 'field', type: 2, value: 'Current' },
      { controlId: 'percent', type: 6, value: '0.5', advancedSetting: { numshow: '1' } },
      { controlId: 'mail', type: 5, value: 'user@example.test' },
    ];
    for (const [title, expected] of [
      ['[{"staticValue":"Static"}]', 'Static'],
      ['[{"cid":"field"},{"staticValue":"!"}]', 'Current!'],
      ['[{"cid":"percent"}]', '50'],
      ['[{"cid":"mail"}]', 'user@example.test'],
      ['[{"isAsync":true,"staticValue":"later"}]', ''],
    ]) {
      assert.equal(h.getDynamicValue(controls, { type: 2, advancedSetting: { defsource: title } }), expected);
      await compare(async source => h.tree((await ready(source, { title }, { controls })).root));
    }
    assert.deepEqual(h.helperErrors, []);
  });
  await check('actual input edits preserve functional state updates, ref timing and patch-only autosave', async () => {
    for (const immediate of [false, true])
      for (const autoSave of [false, true])
        await compare(async source => {
          const s = await ready(
            source,
            { title: 'Old', desc: 'Old desc', extension: { keep: true } },
            { autoSave },
            { immediate },
          );
          const before = s.ref.current.shareConfigValue;
          const inputs = h.nodes(s.root, 'ShareInput');
          inputs[0].props.onChangeValue('Next');
          inputs[1].props.onChangeValue(undefined);
          assert.equal(s.ref.current.shareConfigValue, before);
          for (const request of s.requests.filter(r => r.kind === 'save')) {
            assert.equal(Object.hasOwn(request.args, 'extension'), false);
            request.resolve(true);
          }
          await h.drain();
          s.render();
          assert.equal(s.ref.current.shareConfigValue.extension, before.extension);
          assert.equal(Object.hasOwn(s.ref.current.shareConfigValue, 'desc'), true);
          return { events: h.tree(s.events), value: s.ref.current.shareConfigValue };
        });
  });
  await check('actual upload callbacks retain status/key/url/change/autosave/browse order', async () => {
    for (const autoSave of [false, true])
      await compare(async source => {
        const s = await ready(source, { extension: 'keep' }, { autoSave });
        const upload = h.nodes(s.root, 'QiniuUpload')[0];
        const up = { disableBrowse: value => s.events.push(['browse', value]) };
        upload.props.onAdd(up);
        const file = {
          get key() {
            s.events.push(['file-key']);
            return 'uploaded/icon';
          },
          get url() {
            s.events.push(['file-url']);
            return 'https://files.example.test/upload.png';
          },
        };
        upload.props.onUploaded(up, file);
        for (const r of s.requests.filter(r => r.kind === 'save')) r.resolve(true);
        await h.drain();
        const next = s.render();
        assert.equal(
          h.nodes(next, 'img').some(x => x.props.src === 'https://files.example.test/upload.png'),
          true,
        );
        return { events: h.tree(s.events), value: s.ref.current.shareConfigValue };
      });
    await compare(async source => {
      const s = await ready(source, {});
      const upload = h.nodes(s.root, 'QiniuUpload')[0];
      upload.props.onError({}, { code: -600 });
      upload.props.options.error_callback();
      return h.tree(s.events);
    });
  });
  await check(
    'preset/deletion and direct imperative saves retain metadata, receivers and false-response alerts',
    async () => {
      for (const success of [false, true])
        await compare(async source => {
          const metadata = {
            title: 'Title',
            desc: 'Desc',
            icon: 'file-key',
            iconUrl: 'https://files.example.test/icon.png',
            extra: { keep: true },
          };
          const s = await ready(source, metadata, { showBaseImg: true, autoSave: true });
          const value = s.ref.current.shareConfigValue;
          s.ref.current.onSave(value, 'custom-id');
          const save = s.requests.at(-1);
          assert.equal(save.kind, 'save');
          assert.equal(save.args.extra, value.extra);
          assert.equal(Object.hasOwn(save.args, 'iconUrl'), false);
          save.resolve(success);
          await h.drain();
          const remove = h.nodes(s.root, 'div').find(x => x.props.className === 'deleteBtn Hand');
          assert.ok(remove);
          remove.props.onClick();
          s.requests.at(-1).resolve(true);
          await h.drain();
          s.render();
          h.nodes(s.root, 'li')[0].props.onClick();
          s.requests.at(-1).resolve(true);
          await h.drain();
          s.render();
          return { events: h.tree(s.events), value: s.ref.current.shareConfigValue };
        });
    },
  );
  await check('icon reads and relative URL failures preserve the actual getter/native behavior', async () => {
    await compare(async source => {
      const s = await ready(source, {});
      const reads = [];
      const value = s.ref.current.shareConfigValue;
      Object.defineProperty(value, 'icon', {
        get() {
          reads.push('icon');
          return 'https://files.example.test/icon.png';
        },
        enumerable: true,
        configurable: true,
      });
      Object.defineProperty(value, 'iconUrl', {
        get() {
          reads.push('url');
          return 'https://files.example.test/unused.png';
        },
        enumerable: true,
        configurable: true,
      });
      const root = s.render();
      return { reads, tree: h.tree(root) };
    });
    for (const source of [h.old, h.current]) {
      const s = h.renderer(source);
      s.render();
      s.flushEffects();
      s.requests[0].resolve({ icon: 'key', iconUrl: 'relative' });
      await h.drain();
      assert.throws(() => s.render(), TypeError);
    }
  });
  await check(
    'invalid/rejected loads show a retry state without inventing an empty successful configuration',
    async () => {
      for (const raw of [null, undefined, { title: 4 }, { desc: {} }, { icon: true }, { iconUrl: 7 }]) {
        const s = h.renderer(h.current);
        s.render();
        s.flushEffects();
        const original = s.ref.current.shareConfigValue;
        s.requests[0].resolve(raw);
        await h.drain();
        let root = s.render();
        assert.equal(root.props.role, 'alert');
        assert.equal(s.ref.current.shareConfigValue, original);
        assert.equal(
          s.events.some(e => e[0] === 'set' && e[1] === 0),
          false,
        );
        h.nodes(root, 'Button')[0].props.onClick();
        assert.equal(h.tree(s.render()).type, 'LoadDiv');
        assert.equal(s.requests.length, 2);
        s.requests[1].resolve({ title: 'Recovered', extension: 'retained' });
        await h.drain();
        root = s.render();
        assert.equal(h.tree(root).type, 'Con');
        assert.equal(s.ref.current.shareConfigValue.title, 'Recovered');
        assert.equal(s.ref.current.shareConfigValue.extension, 'retained');
      }
      const s = h.renderer(h.current);
      s.render();
      s.flushEffects();
      s.requests[0].reject(Error('load-network'));
      await h.drain();
      assert.equal(s.render().props.role, 'alert');
      const changed = h.renderer(h.current);
      changed.render();
      changed.flushEffects();
      changed.requests[0].reject(Error('first-fail'));
      await h.drain();
      changed.render();
      changed.setProps({ type: h.constants.SHARECARDTYPS.PUBLICWORKSHEET });
      changed.render();
      changed.flushEffects();
      changed.requests[1].resolve({ title: 'New type' });
      await h.drain();
      assert.equal(h.tree(changed.render()).type, 'Con');
    },
  );
  await check('rejected saves are handled and do not reset the current draft/ref', async () => {
    const s = await ready(h.current, { title: 'Keep', extension: { keep: true } });
    const value = s.ref.current.shareConfigValue;
    s.ref.current.onSave(value, 'id');
    s.requests.at(-1).reject(Error('save-network'));
    await h.drain();
    assert.equal(s.ref.current.shareConfigValue, value);
    assert.deepEqual(s.events.at(-1), ['alert', '保存失败', 2]);
    // The original API omission/getter failure still throws synchronously, before a request is sent.
    for (const source of [h.old, h.current]) {
      const x = await ready(source, {});
      assert.throws(
        () =>
          x.ref.current.onSave(
            {
              get title() {
                throw Error('getter-fail');
              },
            },
            'id',
          ),
        /getter-fail/,
      );
      assert.equal(x.requests.length, 1);
    }
  });
  await check('new promise handling has genuine old-source rejection counterexamples', async () => {
    const fixture = path.join(h.ROOT, 'scripts/spec-fixtures/shareCardLoader.ts');
    for (const kind of ['load', 'save'])
      for (const variant of ['old', 'current']) {
        const code = `const h=require(${JSON.stringify(fixture)});(async()=>{const s=h.renderer(h.${variant});s.render();s.flushEffects();${kind === 'load' ? "s.requests[0].reject(Error('network-fail'));await h.drain();if(s.render().props.role!=='alert')throw Error('missing error UI');" : "s.requests[0].resolve({});await h.drain();s.render();s.ref.current.onSave(s.ref.current.shareConfigValue,'id');s.requests.at(-1).reject(Error('network-fail'));await h.drain();if(!s.events.some(e=>e[0]==='alert'))throw Error('missing save alert');"}})().catch(e=>{console.error(e);process.exitCode=1;});`;
        const result = cp.spawnSync(process.execPath, ['--unhandled-rejections=strict', '-e', code], {
          cwd: h.ROOT,
          encoding: 'utf8',
        });
        assert.equal(result.status, variant === 'old' ? 1 : 0, kind + variant + result.stderr);
        if (variant === 'old') assert.match(result.stderr, /network-fail/);
      }
  });
  await check(
    'actual input module and real dynamic producer keep text/undefined/events and prop forwarding',
    async () => {
      assert.equal(h.compile(h.currentInput, h.INPUT), h.compile(h.oldInput, h.INPUT));
      for (const dynamic of [false, true])
        for (const source of [h.oldInput, h.currentInput]) {
          const events = [];
          const props = {
            canUseControl: dynamic,
            controls: [{ controlId: 'field', type: 2 }],
            defaultValue: 'Old',
            worksheetInfo: {
              worksheetId: 'sheet',
              name: 'Sheet',
              appId: 'app',
              groupId: 'group',
              projectId: 'project',
            },
            onChangeValue: value => events.push(['value', value]),
          };
          const s = h.renderer(source, props, { input: true });
          const root = s.render();
          if (dynamic) {
            const target = h.nodes(root, 'DynamicDefaultValue')[0];
            const producer = h.dynamicProducer(target.props.onChange, {
              type: 2,
              advancedSetting: { extension: 'keep' },
            });
            producer([{ staticValue: 'Next' }]);
            assert.equal(typeof events[0][1], 'string');
            assert.deepEqual(JSON.parse(events[0][1]), [{ staticValue: 'Next' }]);
            target.props.onChange({});
            assert.deepEqual(events.at(-1), ['value', undefined]);
            assert.deepEqual(target.props.globalSheetInfo, props.worksheetInfo);
          } else {
            const input = h.nodes(root, 'Input')[0];
            input.props.onClick({ stopPropagation: () => events.push(['stop']) });
            input.props.onBlur({ stopPropagation: () => events.push(['stop']), target: { value: 'Old' } });
            assert.deepEqual(events, [['stop'], ['stop']]);
            input.props.onBlur({ stopPropagation: () => events.push(['stop']), target: { value: ' Next ' } });
            assert.deepEqual(events.at(-1), ['value', ' Next ']);
            assert.equal(input.props.controls, props.controls);
          }
        }
    },
  );
  await check(
    'boundary checks preserve legacy sentinels, primitive boxing, native errors and opaque extensions',
    async () => {
      const data = { title: 'T', desc: 'D', icon: false, iconUrl: 0, extra: { keep: true } };
      const value = h.value.loadedShareCard(data, { title: () => '', desc: () => '' });
      assert.equal(value.extra, data.extra);
      assert.equal(value.icon, false);
      assert.equal(value.iconUrl, 0);
      for (const raw of [null, undefined])
        assert.throws(() => h.value.loadedShareCard(raw, { title: () => '', desc: () => '' }), TypeError);
      for (const raw of [false, 0, 'abc']) {
        const result = h.value.loadedShareCard(raw, { title: () => 'T', desc: () => 'D' });
        assert.equal(result.title, 'T');
        assert.equal(result.desc, 'D');
      }
      for (const raw of [{ title: 1 }, { desc: [] }, { icon: true }, { iconUrl: 8 }])
        assert.throws(
          () => h.value.loadedShareCard(raw, { title: () => '', desc: () => '' }),
          /Invalid share card field/,
        );
      assert.throws(() => h.value.shareCardDynamicText({}), /dynamic text/);
      assert.equal(h.value.shareCardDynamicText(''), '');
      assert.deepEqual(h.helperErrors, []);
    },
  );
  console.log(`${checks} share-card checks passed`);
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
