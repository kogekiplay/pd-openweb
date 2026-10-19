/** Complete historical/current cloud-print flow with actual renderer/footer/API and controlled hooks/transport. */
const assert = require('node:assert/strict');
const _ = require('lodash');
const h = require('../../../../../scripts/spec-fixtures/cloudPrintLoader.ts');
const { nodes, tree, outcome, tick } = h;
let checks = 0,
  failed = 0,
  summarized = false;
process.on('unhandledRejection', e => {
  console.error(e);
  process.exitCode = 1;
});
process.on('uncaughtException', e => {
  console.error(e);
  process.exitCode = 1;
});
process.on('beforeExit', () => {
  if (!summarized) {
    console.error('CloudPrint did not reach summary');
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
const field = (s, key) => s.data().find(f => f.fieldKey === key);
function dialog(s, title) {
  return nodes(s.render(), 'Dialog').find(n => n.props.title === title);
}
function openAnalysis(s) {
  field(s, 'functionFields').onClick();
  s.flush();
  return dialog(s, '字段解析');
}
function setText(s, text) {
  nodes(dialog(s, '字段解析').props.children, 'textarea')[0].props.onChange({ target: { value: text } });
  s.flush();
}
function analyze(s, text) {
  openAnalysis(s);
  setText(s, text);
  dialog(s, '字段解析').props.onOk();
  s.flush();
}
async function main() {
  await check(
    'real JSON/lodash analysis: receipt/label merging, key order, scalar entries, unknown descriptions and native failures',
    () =>
      compare(version => {
        const s = h.renderer(version),
          f = s.helpers.getAnalysisResult;
        const inputs = [
          ['{"Main":[{"code":"Code","n":0},{"extra":{"raw":true}}],"Other":[["zero","one"]]}', '1'],
          ['[{"B":[{"first":"old"}]},null,"ab",{"B":[{"last":"new"}],"A":[{"a":false}]}]', '2'],
          ['[{"A":[]},["extra"]]', '2'],
          ['{"2":[{"b":2}],"1":[{"a":1}],"x":null}', '1'],
          ['{"__proto__":[{"x":"prototype"}],"safe":[{"y":"safe"}]}', '1'],
          ['{"A":{"first":{"x":true},"second":[1,2],"third":"ab"}}', '1'],
          ['[]', '2'],
          ['[null,{}]', '2'],
          ['{}', '2'],
          ['[]', '1'],
          ['null', '1'],
          ['false', '1'],
          ['{', '1'],
          [undefined, '1'],
          ['{}', '3'],
          ['{}', 1],
          ['{}', undefined],
        ];
        const result = inputs.map(([raw, type]) => outcome(() => f(raw, type)));
        assert.equal(result[0].value[1].mappedFields[0].text, 0);
        assert.deepEqual(
          result[1].value.map(v => v.sheetName),
          ['0', '1', 'B', 'A'],
        );
        assert.deepEqual(
          result[1].value[2].mappedFields.map(v => v.text),
          ['last'],
        );
        assert.ok(result.at(-1).error);
        return { result, errors: s.errors };
      }),
  );
  await check(
    'getControls preserves master/source and relation-then-child order, missing IDs and native source failure',
    () =>
      compare(version => {
        const f = h.renderer(version).helpers.getControls,
          controls = h.controls();
        const master = f(controls, true),
          sub = f(controls, false);
        assert.deepEqual(
          master.map(v => v.value),
          ['text', 'formula', undefined],
        );
        assert.deepEqual(
          sub.map(v => v.value),
          ['relation', 'child', 'sub', 'subText'],
        );
        assert.equal(sub[0].disabled, true);
        assert.equal(sub[1].disabled, false);
        return {
          master,
          sub,
          missingSource: outcome(() => f([{ type: 30 }], true)),
          missingType: f([{}], true),
          empty: f(undefined, false),
        };
      }),
  );
  await check(
    'currentFieldValue: exactly four picked fields, sparse/custom map and unchanged getter/native failure prefixes',
    () =>
      compare(version => {
        const f = h.renderer(version).helpers.currentFieldValue,
          log = [];
        const data = [
          {
            get fieldKey() {
              log.push('key');
              return 'renderData';
            },
            get value() {
              log.push('value');
              return [{ fromKey: 0, legacy: 'opaque', isDetail: false, toControlId: undefined, fromTableName: 'A' }];
            },
          },
        ];
        const projected = f(data, 'renderData');
        assert.deepEqual(Reflect.ownKeys(projected[0]), ['fromKey', 'isDetail', 'toControlId', 'fromTableName']);
        const sparse = [];
        sparse[2] = { fromKey: 'sparse' };
        const custom = [];
        custom.map = function (fn) {
          log.push('custom-map');
          return [fn({ fromKey: 'custom' }, 0, custom)];
        };
        return {
          projected,
          log,
          sparse: f([{ fieldKey: 'renderData', value: sparse }], 'renderData'),
          custom: f([{ fieldKey: 'renderData', value: custom }], 'renderData'),
          missing: outcome(() => f([], 'renderData')),
          scalar: outcome(() => f([{ fieldKey: 'renderData', value: 3 }], 'renderData')),
          name: f([{ fieldKey: 'name', value: 'name' }], 'name'),
          absent: f(undefined, 'name'),
        };
      }),
  );
  await check(
    'create init mutates the same API array/rows, preserves extensions and derives exact option aliases',
    () =>
      compare(async version => {
        const data = h.validData();
        data[1].value = '';
        data.push({ fieldKey: 'future', type: 'future', value: { opaque: true } });
        const map = data.find(v => v.fieldKey === 'renderData');
        map.value.push({ fromKey: 'child', isDetail: true, toControlId: 'child', fromTableName: 'Other' });
        map.systemField.fields.push({ controlId: 'child', controlName: 'Child' });
        const row = map.value[0],
          oldValue = map.value,
          s = await h.create(version, data);
        assert.equal(s.data(), data);
        assert.equal(field(s, 'name'), data[1]);
        assert.equal(field(s, 'name').value, 'Worksheet');
        assert.notEqual(map.value, oldValue);
        assert.notEqual(map.value[0], row);
        assert.equal(row.legacy, 'retained');
        assert.equal(map.value[0].toControlOptions, map.systemField.fields[0].toControlOptions);
        assert.equal(map.value[1].toControlOptions, map.systemField.fields[1].toControlOptions);
        assert.equal(typeof field(s, 'functionFields').onClick, 'function');
        return {
          data: tree(s.data()),
          request: s.events[0],
          disabled: nodes(s.render(), 'DrawerFooter')[0].props.disabled,
        };
      }),
  );
  await check(
    'create failed init preserves partial source mutations and swallowed loading failure; edit failure remains synchronous',
    () =>
      compare(async version => {
        const bad = h.metadata();
        delete bad.find(f => f.fieldKey === 'renderData').fromField;
        const s = await h.create(version, bad);
        assert.equal(s.data().length, 0);
        assert.equal(bad[1].value, 'Worksheet');
        assert.equal(typeof bad[6].onClick, 'function');
        const edit = h.renderer(version, {
          type: 'edit',
          templateData: { id: 'p', cloudExtraParams: _.cloneDeep(bad) },
        });
        edit.render();
        const failure = outcome(() => edit.effects());
        assert.ok(failure.error);
        return {
          partial: tree(bad),
          data: s.data(),
          loading: nodes(s.render(), 'LoadDiv').length,
          failure,
          events: s.events,
        };
      }),
  );
  await check(
    'edit deep clone, required/unchanged comparison and UI-only mapping metadata do not mutate original',
    () =>
      compare(version => {
        const data = h.validData(),
          before = _.cloneDeep(data),
          s = h.edit(version, data);
        assert.notEqual(s.data(), data);
        assert.deepEqual(data, before);
        assert.equal(nodes(s.render(), 'DrawerFooter')[0].props.disabled, true);
        const map = field(s, 'renderData');
        map.value[0].toControlOptions.push({ value: 'extra' });
        assert.deepEqual(
          s.helpers.currentFieldValue(s.data(), 'renderData'),
          s.helpers.currentFieldValue(data, 'renderData'),
        );
        return {
          data: tree(s.data()),
          before,
          disabled: nodes(s.render(), 'DrawerFooter')[0].props.disabled,
          requests: s.requests.length,
        };
      }),
  );
  await check('actual DynamicRender text/radio callbacks copy only the outer array and chosen text row', () =>
    compare(async version => {
      const s = await h.create(version, h.validData()),
        original = s.data(),
        oldName = field(s, 'name'),
        map = field(s, 'renderData');
      let d = s.dynamic();
      d.render();
      d.effects();
      d.flush();
      nodes(d.render(), 'Input')[0].props.onChange('');
      d.flush();
      s.flush();
      assert.notEqual(s.data(), original);
      assert.notEqual(field(s, 'name'), oldName);
      assert.equal(field(s, 'renderData'), map);
      assert.equal(nodes(s.render(), 'DrawerFooter')[0].props.disabled, true);
      d = s.dynamic();
      d.render();
      nodes(d.render(), 'Input')[0].props.onChange('Renamed');
      d.flush();
      s.flush();
      d = s.dynamic();
      d.render();
      nodes(d.render(), 'Radio')[1].props.onClick();
      d.flush();
      s.flush();
      return { data: tree(s.data()), disabled: nodes(s.render(), 'DrawerFooter')[0].props.disabled };
    }),
  );
  await check(
    'actual mapping Select callback mutates the original row/system fields and preserves deleted labels',
    () =>
      compare(async version => {
        const s = await h.create(version, h.validData()),
          before = s.data(),
          map = field(s, 'renderData'),
          row = map.value[0];
        row.toControlId = 'deleted';
        const d = s.dynamic();
        d.render();
        const select = nodes(d.render(), 'Select')[0];
        assert.equal(select.props.options[0].value, 'deleted');
        select.props.onChange('deleted', select.props.options[0]);
        d.flush();
        s.flush();
        assert.notEqual(s.data(), before);
        assert.equal(field(s, 'renderData'), map);
        assert.equal(map.value[0], row);
        assert.equal(map.systemField.fields[0].controlName, select.props.options[0].label);
        return {
          data: tree(s.data()),
          select: tree(select),
          disabled: nodes(s.render(), 'DrawerFooter')[0].props.disabled,
        };
      }),
  );
  await check('actual function/link leaves invoke analysis and controlled window host', () =>
    compare(async version => {
      const s = await h.create(version),
        d = s.dynamic();
      d.render();
      const buttons = nodes(d.render(), 'div');
      buttons.find(n => n.props.className === 'functionButton').props.onClick();
      s.flush();
      assert.ok(dialog(s, '字段解析'));
      buttons.find(n => n.props.className === 'dynamicButton').props.onClick();
      return { events: s.events, dialog: tree(dialog(s, '字段解析')) };
    }),
  );
  await check(
    'invalid JSON retains analysis dialog, logs native parser error and emits the existing format warning',
    () =>
      compare(async version => {
        const s = await h.create(version);
        analyze(s, '{');
        assert.ok(dialog(s, '字段解析'));
        assert.equal(field(s, 'renderData').value.length, 0);
        assert.equal(s.events.at(-1)[1], '字段解析格式错误，请检查模版类型');
        return { events: s.events, errors: s.errors, analysis: tree(dialog(s, '字段解析')) };
      }),
  );
  await check(
    'receipt analysis chooses second master table, sorts original indices and derives relation/master bindings',
    () =>
      compare(async version => {
        const data = h.validData();
        data.find(f => f.fieldKey === 'cloudPrintType').value = '1';
        const s = await h.create(version, data);
        analyze(s, '{"First":[{"a":"A"}],"Second":[{"b":"B"},{"c":"C"}]}');
        assert.ok(dialog(s, '字段解析'));
        let chooser = dialog(s, '选择主表');
        assert.ok(chooser);
        nodes(chooser, 'Radio')[1].props.onClick();
        s.flush();
        chooser = dialog(s, '选择主表');
        chooser.props.onOk();
        s.flush();
        const map = field(s, 'renderData');
        assert.deepEqual(
          map.value.map(v => [v.fromKey, v.isDetail]),
          [
            ['b', false],
            ['c', false],
            ['a', true],
          ],
        );
        assert.equal(map.value[0].toControlOptions[0].value, 'text');
        assert.equal(map.value[2].toControlOptions[0].value, 'relation');
        assert.equal(dialog(s, '字段解析'), undefined);
        assert.equal(dialog(s, '选择主表'), undefined);
        return tree(map);
      }),
  );
  await check('legacy master index survives later label analysis, including its original control-option choice', () =>
    compare(async version => {
      const data = h.validData();
      data.find(f => f.fieldKey === 'cloudPrintType').value = '1';
      const s = await h.create(version, data);
      analyze(s, '{"A":[{"a":"A"}],"B":[{"b":"B"}]}');
      nodes(dialog(s, '选择主表'), 'Radio')[1].props.onClick();
      s.flush();
      dialog(s, '选择主表').props.onOk();
      s.flush();
      const d = s.dynamic();
      d.render();
      nodes(d.render(), 'Radio')[0].props.onClick();
      d.flush();
      s.flush();
      analyze(s, '[{"Label":[{"code":{"raw":true}}]}]');
      const map = field(s, 'renderData');
      assert.equal(map.value[0].isDetail, false);
      assert.equal(map.value[0].toControlOptions[0].value, 'relation');
      assert.deepEqual(map.fromField.fields[0].desc, { raw: true });
      return tree(map);
    }),
  );
  await check('chooser cancel only closes chooser; outer analysis cancel clears the text', () =>
    compare(async version => {
      const data = h.validData();
      data.find(f => f.fieldKey === 'cloudPrintType').value = '1';
      const s = await h.create(version, data);
      analyze(s, '{"A":[],"B":[]}');
      dialog(s, '选择主表').props.onCancel();
      s.flush();
      assert.ok(dialog(s, '字段解析'));
      assert.notEqual(nodes(dialog(s, '字段解析'), 'textarea')[0].props.value, '');
      dialog(s, '字段解析').props.onCancel();
      s.flush();
      openAnalysis(s);
      assert.equal(nodes(dialog(s, '字段解析'), 'textarea')[0].props.value, '');
      return tree(dialog(s, '字段解析'));
    }),
  );
  await check(
    'save clones before projection, picks exactly mapping/system fields and trims name; opaque metadata stays intact',
    () =>
      compare(async version => {
        const data = h.validData(),
          s = await h.create(version, data),
          map = field(s, 'renderData');
        map.extra = { opaque: true };
        map.systemField.fields = [{ controlId: 'text', controlName: 'Text', extra: 'drop' }, false, null, undefined];
        map.systemField.fields[6] = { controlId: 'child', controlName: 'Child' };
        const before = tree(s.data());
        nodes(s.render(), 'DrawerFooter')[0].props.handleSave();
        const req = s.requests.at(-1);
        assert.equal(req.method, 'CreateCloudPrint');
        assert.equal(req.args.name, 'Template');
        assert.equal(Object.hasOwn(req.args, 'id'), true);
        assert.equal(req.args.id, undefined);
        const sent = req.args.extraParams.find(f => f.fieldKey === 'renderData');
        assert.deepEqual(Object.keys(sent.value[0]), ['fromKey', 'isDetail', 'toControlId', 'fromTableName']);
        assert.deepEqual(sent.systemField.fields, [
          { controlId: 'text', controlName: 'Text' },
          { controlId: 'child', controlName: 'Child' },
        ]);
        assert.deepEqual(tree(s.data()), before);
        assert.deepEqual(sent.extra, { opaque: true });
        assert.notEqual(req.args.extraParams, s.data());
        req.resolve(true);
        await tick();
        s.flush();
        return tree({
          request: req.args,
          events: s.events,
          loading: nodes(s.render(), 'DrawerFooter')[0].props.saveLoading,
        });
      }),
  );
  await check('save empty/unmapped validations precede network; missing mapping keeps native failure', () =>
    compare(async version => {
      const s = await h.create(version, h.validData());
      field(s, 'renderData').value = [];
      nodes(s.render(), 'DrawerFooter')[0].props.handleSave();
      field(s, 'renderData').value = [{ fromKey: 'unbound' }];
      nodes(s.render(), 'DrawerFooter')[0].props.handleSave();
      const reqCount = s.requests.length;
      s.data().splice(
        s.data().findIndex(f => f.fieldKey === 'renderData'),
        1,
      );
      const native = outcome(() => nodes(s.render(), 'DrawerFooter')[0].props.handleSave());
      assert.ok(native.error);
      assert.equal(reqCount, 1);
      return { events: s.events, native };
    }),
  );
  await check(
    'save update/false/reject/success-callback error retain response truthiness, order and loading cleanup',
    async () => {
      for (const mode of ['success', 'false', 'reject', 'refresh-error', 'close-error'])
        await compare(async version => {
          const events = [],
            s = h.edit(version, h.validData(), {
              getPrintData: () => {
                events.push('refresh');
                if (mode === 'refresh-error') throw Error('refresh');
              },
              onClose: () => {
                events.push('close');
                if (mode === 'close-error') throw Error('close');
              },
            });
          nodes(s.render(), 'DrawerFooter')[0].props.handleSave();
          s.flush();
          assert.equal(nodes(s.render(), 'DrawerFooter')[0].props.saveLoading, true);
          const req = s.requests[0];
          assert.equal(req.method, 'UpdateCloudPrint');
          assert.equal(req.args.id, 'print');
          if (mode === 'reject') req.reject(Error('isolated failure'));
          else req.resolve(mode === 'false' ? false : { truthy: true });
          await tick();
          s.flush();
          assert.equal(nodes(s.render(), 'DrawerFooter')[0].props.saveLoading, false);
          return tree({ events, host: s.events, args: req.args });
        });
    },
  );
  await check(
    'actual footer guards after flush, permits pre-flush double click and leaves cancel usable while saving',
    () =>
      compare(async version => {
        const s = await h.create(version, h.validData());
        let footer = s.footer(),
          save = nodes(footer, 'span').find(n => n.props.className.includes('saveBtn'));
        save.props.onClick();
        save.props.onClick();
        assert.equal(s.requests.length, 3);
        s.flush();
        footer = s.footer();
        nodes(footer, 'span')
          .find(n => n.props.className.includes('saveBtn'))
          .props.onClick();
        assert.equal(s.requests.length, 3);
        nodes(footer, 'span')
          .find(n => n.props.className.includes('cancelBtn'))
          .props.onClick();
        s.requests[1].resolve(false);
        s.requests[2].resolve(false);
        await tick();
        s.flush();
        return tree(s.events);
      }),
  );
  await check('load rejection clears loading and older async response still overwrites newer template state', () =>
    compare(async version => {
      const s = h.renderer(version);
      s.render();
      s.effects();
      s.flush();
      assert.equal(nodes(s.render(), 'LoadDiv').length, 1);
      s.requests[0].reject(Error('rejected'));
      await tick();
      s.flush();
      assert.equal(s.data().length, 0);
      s.setProps({ templateData: { id: 'a' } });
      s.render();
      s.effects();
      s.flush();
      s.setProps({ templateData: { id: 'b' } });
      s.render();
      s.effects();
      s.flush();
      const older = h.validData(),
        newer = h.validData();
      older[1].value = 'Older';
      newer[1].value = 'Newer';
      s.requests[2].resolve(newer);
      await tick();
      s.flush();
      s.requests[1].resolve(older);
      await tick();
      s.flush();
      assert.equal(field(s, 'name').value, 'Older');
      return { data: tree(s.data()), requests: s.requests.map(r => [r.method, r.args]) };
    }),
  );
  await check(
    'type-only prop change retains original useMemo/effect dependencies; absent edit template keeps native failure',
    () =>
      compare(async version => {
        const data = h.validData(),
          templateData = { id: 'p', cloudExtraParams: data },
          s = await h.create(version, data, { templateData });
        assert.equal(nodes(s.render(), 'DrawerFooter')[0].props.disabled, false);
        s.setProps({ type: 'edit' });
        s.render();
        s.effects();
        s.flush();
        assert.equal(nodes(s.render(), 'DrawerFooter')[0].props.disabled, false);
        assert.equal(s.requests.length, 1);
        const missing = h.renderer(version, { type: 'edit' });
        const failure = outcome(() => missing.render());
        assert.ok(failure.error);
        return { disabled: nodes(s.render(), 'DrawerFooter')[0].props.disabled, failure };
      }),
  );
  summarized = true;
  console.log(`CloudPrint complete historical flow: ${checks - failed}/${checks}`);
  if (failed) process.exitCode = 1;
}
main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
