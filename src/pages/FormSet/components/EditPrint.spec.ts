/** Full editor/settings/uploader/link history with controlled DOM, credentials and transport. */
const assert = require('node:assert/strict'),
  cp = require('node:child_process');
const h = require('../../../../scripts/spec-fixtures/editPrintLoader.ts'),
  { tree, nodes, tick, outcome } = h;
let checks = 0,
  failed = 0,
  summarized = false;
const scenario = process.argv[2];
let activeScenario = scenario,
  observedFailures = 0;
process.on('unhandledRejection', error => {
  if (scenario) {
    console.log(
      JSON.stringify({
        unhandled: true,
        scenario: activeScenario,
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    observedFailures++;
    if (scenario !== 'all-errors') summarized = true;
  } else console.error(error);
  process.exitCode = 1;
});
process.on('uncaughtException', error => {
  console.error(error);
  process.exitCode = 1;
});
process.on('beforeExit', () => {
  if (!summarized) {
    console.error('EditPrint did not reach summary');
    process.exitCode = 1;
  }
});
async function check(name, fn) {
  checks++;
  try {
    await fn();
    console.log('✓ ' + name);
  } catch (e) {
    failed++;
    console.error('✗ ' + name, e);
  }
}
async function compare(fn) {
  assert.deepEqual(await fn('current'), await fn('old'));
}
function mounted(version, props = {}, options = {}) {
  const s = h.instance(version, props, options);
  s.mount();
  return s;
}
function req(s, method) {
  return s.requests.find(r => r.method === method);
}
function uploadButton(s) {
  return nodes(s.render(), 'p').find(x => x.props.className.includes('uploadBtn'));
}
const settingsProps = (extra = {}) => ({
  controls: [{ controlId: '123456789012345678901234', controlName: 'Title', attribute: 1, type: 2 }],
  exampleData: { '123456789012345678901234': 'row text' },
  ...extra,
});
async function run() {
  await check(
    'constructor/ref lifecycle, repeated listeners and prop-driven destruction preserve the real prefix',
    () =>
      compare(version => {
        const bare = h.instance(version);
        assert.equal(Object.hasOwn(bare.instance, 'uploader'), false);
        assert.equal(Object.hasOwn(bare.instance.state, 'isCreate'), false);
        const missing = outcome(() => bare.instance.componentDidMount());
        assert.ok(missing.error);
        assert.equal(bare.uploaders.length, 1);
        assert.equal(bare.instance.state.bindCreateUpload, true);
        const s = mounted(version);
        assert.equal(s.instance.con, s.con);
        assert.equal(s.uploaders.length, 1);
        assert.equal(s.con.listeners.dragover.length, 1);
        s.setProps({ exampleData: { changed: true } });
        assert.equal(s.uploaders.length, 1);
        s.setProps({
          templateId: 'other',
          fileType: 'Excel',
          type: 'edit',
          templateData: { name: 'Edited', formName: 'edit.xlsx' },
        });
        assert.equal(s.uploaders.length, 2);
        assert.equal(s.con.listeners.dragover.length, 2);
        assert.equal(s.instance.state.isCreate, false);
        s.instance.componentWillUnmount();
        return { missing, state: tree(s.instance.state), events: tree(s.events) };
      }),
  );
  await check(
    'actual uploader filters, wrapping, progress, result, destroy/recreate and old browse re-enable are preserved',
    () =>
      compare(async version => {
        const s = mounted(version);
        const up = s.instance.uploader;
        up.addFile(new File(['content'], 'a/b.docx'));
        await tick();
        await tick();
        assert.equal(s.uploads.length, 1);
        assert.equal(s.tokens[0][0][0].ext, '.docx');
        assert.equal(s.instance.state.fileName, 'a_b.docx');
        assert.equal(s.instance.state.file, up.files[0]);
        s.uploads[0].handlers.onProgress(7, 10, 66.6);
        assert.equal(s.instance.state.loadPer, 67);
        s.uploads[0].handlers.onComplete({ key: 'uploaded.docx' });
        assert.equal(s.instance.state.suc, true);
        assert.equal(s.instance.state.key, 'uploaded.docx');
        assert.equal(s.instance.state.url, 'https://doc.invalid/uploaded.docx');
        assert.equal(s.instance.state.createType, undefined);
        assert.notEqual(s.instance.uploader, up);
        assert.equal(s.uploaders.length, 2);
        assert.equal(s.instance.state.file, up.files[0]);
        return { state: tree(s.instance.state), events: tree(s.events), tokens: s.tokens };
      }),
  );
  await check('actual uploader extension failure and cancel route retain alerts, IDs and in-flight abort', () =>
    compare(async version => {
      const s = mounted(version, {}, {});
      s.instance.uploader.addFile(new File(['x'], 'bad.xlsx'));
      await tick();
      assert.equal(s.uploads.length, 0);
      assert.equal(s.instance.state.error, true);
      s.instance.uploader.addFile(new File(['x'], 'good.docx'));
      await tick();
      await tick();
      assert.equal(s.uploads.length, 1);
      const file = s.instance.state.file;
      nodes(s.render(), 'Icon')
        .find(n => n.props.icon === 'workflow_cancel')
        .props.onClick();
      assert.equal(s.uploads[0].aborted, true);
      assert.equal(s.instance.state.loading, false);
      assert.equal(s.instance.state.file, file);
      // A missing id is genuinely accepted by the real SDK as a no-op, including the constructor's empty identity.
      s.instance.uploader.removeFile({});
      assert.equal(s.instance.uploader.files.length, 0);
      return { state: tree(s.instance.state), events: tree(s.events) };
    }),
  );
  await check(
    'real SDK BeforeUpload callback rejects mismatched suffix before touching editor state; upload Error retains selected identity',
    () =>
      compare(version => {
        const s = mounted(version);
        const option = s.uploaders[0].option,
          up = s.instance.uploader;
        const before = tree(s.instance.state);
        assert.equal(option.init.BeforeUpload(up, { id: 'f', name: 'bad.xls', percent: 0 }), false);
        assert.deepEqual(tree(s.instance.state), before);
        option.init.BeforeUpload(up, { id: 'f', name: 'ok.DOCX', percent: 0 });
        const selected = s.instance.state.file;
        option.init.Error(up, {}, 'tip');
        assert.equal(s.instance.state.file, selected);
        assert.equal(s.instance.state.error, true);
        return { state: tree(s.instance.state), events: tree(s.events) };
      }),
  );
  await check('uploaded result missing key stays own undefined and retains original URL coercion', () =>
    compare(version => {
      const s = mounted(version),
        entry = s.uploaders[0],
        file = { id: 'f', name: 'file.docx', percent: 100 };
      entry.option.init.FileUploaded(entry.u, file, { response: {} });
      assert.equal(Object.hasOwn(s.instance.state, 'key'), true);
      assert.equal(s.instance.state.key, undefined);
      assert.equal(s.instance.state.url, 'https://doc.invalid/undefined');
      return { state: tree(s.instance.state), events: tree(s.events) };
    }),
  );
  await check('Word/Excel feature, role and prop/state edit guards retain exact strict comparisons', async () => {
    for (const options of [
      { featureType: '1' },
      { featureType: 1 },
      { featureType: '2' },
      { featureType: '1', docEdit: false },
    ])
      await compare(version => {
        const s = mounted(version, { fileType: 'Word' }, options);
        const before = tree(s.instance.renderEditFileBtn());
        s.instance.setState({ createEditLoading: true });
        s.instance.onEdit();
        assert.equal(s.requests.length, 1);
        s.setProps({ createEditLoading: true });
        s.instance.onEdit();
        assert.equal(s.requests.length, 1);
        s.setProps({ roleType: 1 });
        assert.equal(s.instance.renderEditFileBtn(), null);
        s.setProps({ roleType: 2, fileType: 'Excel' });
        assert.equal(s.instance.renderEditFileBtn(), null);
        return { before, requests: tree(s.requests.map(r => [r.method, r.args])) };
      });
  });
  await check(
    'save empty-placeholder guard and actual token/request payload preserve own undefineds and callbacks',
    () =>
      compare(async version => {
        const s = mounted(version, {
          templateId: 'print',
          type: 'edit',
          templateData: { name: 'Template', formName: 'template.docx', advanceSettings: [] },
        });
        s.instance.onChange({ advanceSettings: [{ key: 'enableEmptyPlaceholder', value: 1 }] });
        await s.instance.onOk();
        assert.equal(s.requests.length, 0);
        assert.equal(s.events.at(-1)[1], '请填写空值占位符内容');
        s.instance.onChange({
          advanceSettings: [
            { key: 'enableEmptyPlaceholder', value: 1 },
            { key: 'emptyPlaceholderMode', value: '-' },
          ],
        });
        const promise = s.instance.onOk();
        assert.equal(s.instance.state.saveLoading, true);
        req(s, 'GetToken').resolve('token');
        await promise;
        const save = s.requests.at(-1);
        assert.equal(save.args.type, 2);
        assert.equal(save.args.id, 'print');
        assert.equal(Object.hasOwn(save.args, 'doc'), true);
        assert.equal(save.args.doc, undefined);
        assert.equal(save.options.ajaxOptions.url, 'https://download.invalid/PrintTemplate/EditPrint');
        save.resolve('created');
        await tick();
        assert.deepEqual(s.events.slice(-3), [['refresh'], ['close'], ['alert', '修改成功']]);
        return tree({ args: save.args, state: s.instance.state, events: s.events });
      }),
  );
  await check(
    'save false response sets error, clears saving and refreshes the real uploader; onOk promise ends before remote request',
    () =>
      compare(async version => {
        const s = mounted(version, { fileType: 'Excel' });
        const p = s.instance.onOk();
        req(s, 'GetToken').resolve('token');
        await p;
        assert.equal(s.instance.state.saveLoading, true);
        assert.equal(s.requests.at(-1).args.type, 5);
        s.requests.at(-1).resolve(false);
        await tick();
        assert.equal(s.instance.state.saveLoading, false);
        assert.equal(s.instance.state.error, true);
        assert.equal(s.uploaders.length, 2);
        return tree({ state: s.instance.state, events: s.events });
      }),
  );
  await check(
    'actual create-edit helper orders token, document creation, edit URL and completion before controlled window open',
    () =>
      compare(async version => {
        const s = mounted(version);
        s.instance.onCreateEdit({ label: 'blank', value: 1 });
        assert.equal(s.instance.state.createEditLoading, true);
        assert.equal(s.instance.state.createType, 1);
        req(s, 'GetToken').resolve('token');
        await tick();
        const create = s.requests.at(-1);
        assert.equal(create.args.createType, 1);
        assert.equal(create.args.type, 2);
        assert.equal(Object.hasOwn(create.args, 'doc'), true);
        assert.equal(create.args.doc, undefined);
        create.resolve('new-print');
        await tick();
        const edit = req(s, 'GetAttachmentEditDetail');
        assert.equal(edit.args.fileId, 'new-print');
        edit.resolve({ wpsEditUrl: 'https://edit.invalid/doc' });
        await tick();
        assert.equal(s.instance.state.createEditLoading, false);
        assert.deepEqual(s.events.slice(-2), [
          ['refresh', true, 'new-print'],
          ['open', 'https://edit.invalid/doc'],
        ]);
        return tree({ state: s.instance.state, events: s.events });
      }),
  );
  await check(
    'helper false response retains undefined alert and optional completion; standalone defaults and empty params remain distinct',
    () =>
      compare(async version => {
        const s = mounted(version);
        s.instance.onCreateEdit({ label: 'template', value: 2 });
        req(s, 'GetToken').resolve('token');
        await tick();
        s.requests.at(-1).resolve(false);
        await tick();
        assert.equal(s.instance.state.createEditLoading, false);
        assert.deepEqual(s.events.slice(-2), [
          ['state', { createEditLoading: false }],
          ['refresh', true, undefined],
        ]);
        const start = s.requests.length;
        const p = s.link({ worksheetId: 'other', downLoadUrl: 'https://other.invalid', params: {}, createType: 2 });
        s.requests[start].resolve('token');
        await tick();
        const create = s.requests.at(-1);
        assert.equal(Object.hasOwn(create.args, 'allowEditAfterPrint'), false);
        create.resolve('id');
        await tick();
        s.requests.at(-1).resolve({});
        await p;
        return tree({ state: s.instance.state, events: s.events });
      }),
  );
  await check(
    'onEdit missing URL still marks changed; create-mode cancellation deletes then refreshes without direct close',
    () =>
      compare(async version => {
        const s = mounted(version, { templateId: 'print' });
        s.instance.onEdit();
        req(s, 'GetAttachmentEditDetail').resolve({});
        await tick();
        assert.equal(s.instance.state.hasChange, true);
        assert.equal(s.instance.state.createEditLoading, false);
        s.instance.handleClose();
        const remove = req(s, 'DeletePrint');
        assert.equal(remove.args.id, 'print');
        remove.resolve(false);
        await tick();
        assert.equal(
          s.events.some(x => x[0] === 'close'),
          false,
        );
        s.instance.handleClose();
        s.requests.at(-1).resolve(true);
        await tick();
        assert.deepEqual(s.events.at(-1), ['refresh']);
        s.instance.setState({ isCreate: false });
        s.instance.handleClose();
        assert.deepEqual(s.events.at(-1), ['close']);
        return tree(s.events);
      }),
  );
  await check('actual navigation/path completion and controlled form submission preserve URL/query/DOM arguments', () =>
    compare(version => {
      const s = mounted(
        version,
        { templateId: 'id', type: 'edit', templateData: { name: 'T', formName: 'F.docx' } },
        { subPath: '/sub', search: '?s=no&previewMode=ai' },
      );
      nodes(s.render(), 'p')
        .find(x => x.props.className === 'btnTable mTop20 Hand')
        .props.onClick();
      assert.deepEqual(s.events.at(-1), [
        'open',
        'https://app.invalid/sub/worksheet/uploadTemplateSheet/sheet?s=no&previewMode=ai',
      ]);
      nodes(s.render(), 'span')
        .find(x => x.props.className === 'downLoad')
        .props.onClick();
      assert.equal(s.forms[0].attrs.action, 'https://download.invalid/ExportWord/DownloadWord');
      assert.deepEqual(s.forms[0].children[0].attrs, { value: 'id', name: 'id', type: 'hidden' });
      return tree({ events: s.events, forms: s.forms });
    }),
  );
  await check(
    'disabled comparison retains four source settings, dirty flags, loading and export name type semantics',
    () =>
      compare(version => {
        const data = {
            name: 'T',
            formName: 'F.docx',
            allowEditAfterPrint: false,
            allowDownloadPermission: 0,
            advanceSettings: [],
          },
          s = mounted(version, { type: 'edit', templateData: data });
        assert.equal(s.instance.getDisabledOkBtn(), true);
        s.instance.setState({ hasChange: true });
        assert.equal(s.instance.getDisabledOkBtn(), false);
        s.instance.onChange({ advanceSettings: [{ key: 'export_type', value: '1' }] });
        assert.equal(s.instance.getDisabledOkBtn(), true);
        s.instance.onChange({ advanceSettings: [{ key: 'export_type', value: 1 }] });
        assert.equal(s.instance.getDisabledOkBtn(), false);
        s.instance.setState({ loading: true });
        assert.equal(s.instance.getDisabledOkBtn(), true);
        return tree(s.instance.state);
      }),
  );
  await check(
    'actual settings parses dynamic sources, projects controls and emits numeric checkbox flags unchanged',
    () =>
      compare(version => {
        const s = mounted(version, { controls: settingsProps().controls, exampleData: settingsProps().exampleData }),
          changes = [],
          d = s.settings({
            ...settingsProps(),
            advanceSettings: [
              { key: 'export_type', value: '1' },
              { key: 'export_name', value: '$temp-name$_$123456789012345678901234$_$print-time$' },
            ],
            onChange: x => changes.push(x),
          });
        const view = d.render();
        assert.ok(JSON.stringify(tree(view)).includes('20261019'));
        assert.ok(JSON.stringify(tree(view)).includes('row text'));
        const input = nodes(view, 'Input')[0];
        input.props.onChange('New name');
        const dynamic = nodes(view, 'DynamicDefaultValue')[0];
        assert.equal(dynamic.props.allControls.length, 1);
        dynamic.props.onChange({
          advancedSetting: {
            defsource:
              '[{"cid":"123456789012345678901234"},{"staticValue":"_"},{"cid":"parent","rcid":"child"},{"staticValue":3}]',
          },
        });
        nodes(view, 'Checkbox').at(-1).props.onClick();
        assert.equal(changes.at(-1).advanceSettings.at(-1).value, 1);
        assert.equal(
          changes[1].advanceSettings.find(x => x.key === 'export_name').value,
          '$123456789012345678901234$_$parent~child$3',
        );
        const output = { view: tree(view), changes: tree(changes) };
        d.restore();
        return output;
      }),
  );
  await check(
    'settings retains raw numeric type double patches, duplicate keys, false preview values and mount-only query',
    () =>
      compare(async version => {
        const s = mounted(version),
          changes = [],
          d = s.settings({
            ...settingsProps(),
            exampleData: { '123456789012345678901234': 0 },
            advanceSettings: [
              { key: 'export_type', value: 1 },
              { key: 'export_name', value: '$123456789012345678901234$' },
              { key: 'export_name', value: 'later' },
            ],
            onChange: x => changes.push(x),
          });
        let v = d.render();
        assert.ok(JSON.stringify(tree(v)).includes('later'));
        const oldTypeClick = nodes(v, 'Radio')[0].props.onClick;
        d.setProps({
          advanceSettings: [
            { key: 'export_type', value: '1' },
            { key: 'export_name', value: '$123456789012345678901234$' },
          ],
        });
        assert.ok(JSON.stringify(tree(d.render())).includes('未命名'));
        oldTypeClick();
        assert.equal(changes.length, 2);
        assert.equal(
          changes[0].advanceSettings.filter(x => x.key === 'export_name')[0].value,
          '$temp-name$_$123456789012345678901234$_$print-time$',
        );
        assert.equal(
          changes[1].advanceSettings.filter(x => x.key === 'export_name')[0].value,
          '$123456789012345678901234$',
        );
        d.setProps({ exampleData: undefined });
        d.render();
        d.effects();
        assert.equal(s.requests.length, 0);
        d.restore();
        const empty = s.settings({ exampleData: undefined });
        empty.render();
        empty.effects();
        assert.equal(req(s, 'GetFilterRows').args.pageSize, 1);
        req(s, 'GetFilterRows').resolve({ data: [{ cell: 'example' }] });
        await tick();
        empty.restore();
        assert.deepEqual(s.events.at(-1), ['example', { cell: 'example' }]);
        return tree({ changes, events: s.events });
      }),
  );
  await check(
    'settings keeps missing-control-ID and malformed source native failures; primitive preview returns native replacement text',
    () =>
      compare(version => {
        const s = mounted(version),
          d = s.settings({
            templateName: undefined,
            exampleData: { raw: { a: 1 } },
            controls: [{ controlId: 'raw', type: 2 }],
            advanceSettings: [
              { key: 'export_type', value: '1' },
              { key: 'export_name', value: '$raw$-$temp-name$' },
            ],
          });
        let v = d.render();
        const child = nodes(v, 'DynamicDefaultValue')[0];
        const malformed = outcome(() => child.props.onChange({ advancedSetting: { defsource: '{}' } }));
        assert.ok(malformed.error);
        d.setProps({ controls: [{ type: 2 }], advanceSettings: [{ key: 'export_type', value: '1' }] });
        const missing = outcome(() => d.render());
        assert.ok(missing.error);
        d.restore();
        return { malformed, missing, view: tree(v) };
      }),
  );
  await check('legacy actual async failures are nonzero in both versions, with matching native kinds/messages', () => {
    const expected = ['token-reject', 'save-reject', 'create-null', 'edit-reject'];
    const results = ['old', 'current'].map(version => {
      const run = cp.spawnSync(process.execPath, [__filename, 'all-errors', version], {
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.equal(run.status, 1, run.stdout + run.stderr);
      const failures = run.stdout
        .split('\n')
        .filter(x => x.startsWith('{"unhandled"'))
        .map(x => JSON.parse(x));
      assert.deepEqual(
        failures.map(x => x.scenario),
        expected,
      );
      assert.ok(run.stdout.includes('all four legacy failures observed'), run.stdout + run.stderr);
      return failures;
    });
    assert.deepEqual(results[0], results[1]);
  });
  await check('7.5.2 requires an explicit enabled document-edit flag; missing and false remain disabled', () => {
    for (const docEdit of [undefined, false]) {
      const s = mounted('current', { fileType: 'Word', roleType: 2, templateId: 'template' }, { featureType: '1', docEdit });
      assert.equal(s.instance.renderEditFileBtn(), null);
    }
    const enabled = mounted('current', { fileType: 'Word', roleType: 2, templateId: 'template' }, { featureType: '1', docEdit: true });
    assert.notEqual(enabled.instance.renderEditFileBtn(), null);
  });
  summarized = true;
  console.log(`EditPrint full historical flow: ${checks - failed}/${checks}`);
  if (failed) process.exitCode = 1;
}
async function legacy() {
  const version = process.argv[3];
  if (scenario === 'all-errors') {
    for (const name of ['token-reject', 'save-reject', 'create-null', 'edit-reject']) {
      activeScenario = name;
      const before = observedFailures;
      await legacyCase(version, name);
      await tick();
      assert.equal(observedFailures, before + 1, name);
    }
    assert.equal(observedFailures, 4);
    summarized = true;
    console.log('all four legacy failures observed');
    return;
  }
  await legacyCase(version, scenario);
}
async function legacyCase(version, kind) {
  const s = mounted(version);
  if (kind === 'token-reject') {
    s.instance.onOk();
    req(s, 'GetToken').reject(Error('token rejected'));
  }
  if (kind === 'save-reject') {
    s.instance.onOk();
    req(s, 'GetToken').resolve('token');
    await tick();
    s.requests.at(-1).reject(Error('save rejected'));
  }
  if (kind === 'create-null') {
    s.instance.onCreateEdit({ label: 'blank', value: 1 });
    req(s, 'GetToken').resolve('token');
    await tick();
    s.requests.at(-1).resolve(null);
  }
  if (kind === 'edit-reject') {
    s.instance.onEdit();
    req(s, 'GetAttachmentEditDetail').reject(Error('edit rejected'));
  }
  await tick();
}
if (scenario)
  legacy().catch(e => {
    console.error(e);
    process.exitCode = 2;
  });
else
  run().catch(e => {
    console.error(e);
    process.exitCode = 1;
  });
