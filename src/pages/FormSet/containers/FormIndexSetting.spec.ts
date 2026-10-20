/** Full historical/current list, class editor and API routing; all requests remain in memory. */
const assert = require('node:assert/strict');
const h = require('../../../../scripts/spec-fixtures/indexSettingLoader.ts');
let summarized = false,
  checks = 0;
process.on('unhandledRejection', error => {
  console.error(error);
  process.exitCode = 1;
});
process.on('beforeExit', () => {
  if (!summarized) {
    console.error('Index specs did not reach summary');
    process.exitCode = 1;
  }
});
async function check(name, run) {
  await run();
  checks++;
  console.log('  PASS ' + name);
}
async function compare(run) {
  assert.deepEqual(await run('current'), await run('old'));
}
const req = (s, method) => s.requests.filter(r => r.method === method).at(-1);
const create = s => h.nodes(s.render(), 'span').find(n => n.props.className?.startsWith('add Relative'));
const row = (s, i = 0) => h.nodes(s.render(), 'div').filter(n => n.props.className === 'printTemplatesList-tr')[i];
const more = (s, i = 0) => h.nodes(s.render(), 'Trigger')[i].props.popup.props;
async function loaded(version, items = [h.index()], fields = h.fields(), limit = 5) {
  const s = h.host(version);
  assert.equal(h.nodes(s.render(), 'LoadDiv').length, 1);
  assert.equal(s.requests.length, 0);
  s.effects();
  assert.equal(req(s, 'GetRowIndexes').args.worksheetId, 'sheet');
  req(s, 'GetRowIndexes').resolve({
    worksheetRowIndexConfigs: items,
    worksheetAvailableFields: fields,
    worksheetRowIndexLimit: limit,
  });
  await h.settle();
  s.render();
  s.effects();
  return s;
}
function beginRename(s) {
  h.nodes(s.render(), 'Icon')
    .filter(n => n.props.icon === 'more_horiz')[0]
    .props.onClick();
  more(s).setFn({ isRename: true, showMoreOption: false });
  const input = h.nodes(s.render(), 'input')[0];
  input.props.ref.current = { focus: () => s.events.push(['focus']) };
  s.effects();
  return input;
}
async function main() {
  await check(
    'list metadata, filtered fields, statuses and native numeric/string system rules match full history',
    () =>
      compare(async version => {
        const items = [
          h.index(),
          h.index({ indexConfigId: 'unique', uniqueIndex: true }),
          h.index({ indexConfigId: 'fail', indexStateId: -1 }),
          h.index({ indexConfigId: 'queued', indexStateId: 0 }),
          h.index({ indexConfigId: 'hidden', isSystem: true, indexFields: [{ fieldId: 'a', indexType: 1 }] }),
          h.index({ indexConfigId: 'special', isSystem: true, indexFields: [{ fieldId: 'raw', indexType: 'hashed' }] }),
          h.index({ indexConfigId: 'text', wildcardIndex: true }),
        ];
        const fields = h.fields().concat([{ id: 'blocked', name: 'Filtered', type: 0, controlType: 40 }]);
        const s = await loaded(version, items, fields, 10);
        assert.equal(h.nodes(s.render(), 'Trigger').length, 6);
        create(s).props.onClick();
        const editor = h.nodes(s.render(), 'CreateIndex')[0];
        assert.equal(editor.props.worksheetAvailableFields.length, 3);
        assert.equal(editor.props.selectedIndexList[0].indexType, '1');
        assert.equal(editor.props.selectedIndexList[0].fieldId, 'a');
        return h.tree({ view: s.render(), events: s.events });
      }),
  );
  await check(
    'no worksheet sends no request; late response still overwrites newer data without hidden cancellation',
    () =>
      compare(async version => {
        const s = h.host(version, { worksheetInfo: {} });
        s.render();
        s.effects();
        assert.equal(s.requests.length, 0);
        s.setProps({ worksheetInfo: { worksheetId: 'first', appId: 'app' } });
        s.render();
        s.effects();
        const first = req(s, 'GetRowIndexes');
        s.setProps({ worksheetInfo: { worksheetId: 'second', appId: 'app' } });
        s.render();
        s.effects();
        const second = req(s, 'GetRowIndexes');
        second.resolve({
          worksheetRowIndexConfigs: [h.index({ customeIndexName: 'Second' })],
          worksheetRowIndexLimit: 2,
        });
        await h.settle();
        first.resolve({
          worksheetRowIndexConfigs: [h.index({ customeIndexName: 'First' })],
          worksheetRowIndexLimit: 3,
        });
        await h.settle();
        assert.equal(s.states[4][0].customeIndexName, 'First');
        return h.tree({ view: s.render(), events: s.events });
      }),
  );
  await check('non-system limit blocks creation; an empty field list keeps blank seed values and source arrays', () =>
    compare(async version => {
      const s = await loaded(version, [h.index()], [], 1);
      create(s).props.onClick();
      assert.equal(h.nodes(s.render(), 'CreateIndex').length, 0);
      const t = await loaded(version, [], [], 1);
      create(t).props.onClick();
      const p = h.nodes(t.render(), 'CreateIndex')[0].props;
      assert.deepEqual(p.selectedIndexList, [
        { fieldId: '', name: '', type: '', indexType: '1', selectFiledsList: [] },
      ]);
      p.onClose();
      assert.equal(h.nodes(t.render(), 'CreateIndex').length, 0);
      return h.tree([s.render(), t.render(), t.events]);
    }),
  );
  await check('sort keeps original in-place mutation and missing-name native failure', () =>
    compare(async version => {
      const items = [h.index({ customeIndexName: 'Zulu' }), h.index({ indexConfigId: 'a', customeIndexName: 'Alpha' })];
      const s = await loaded(version, items);
      h.nodes(s.render(), 'div')
        .find(n => n.props.className?.includes('sortFields Hand'))
        .props.onClick();
      s.render();
      assert.equal(s.states[4], items);
      assert.equal(items[0].customeIndexName, 'Alpha');
      h.nodes(s.render(), 'div')
        .find(n => n.props.className?.includes('sortFields Hand'))
        .props.onClick();
      s.render();
      assert.equal(items[0].customeIndexName, 'Zulu');
      const t = await loaded(version, [h.index({ customeIndexName: undefined }), h.index()]);
      h.nodes(t.render(), 'div')
        .find(n => n.props.className?.includes('sortFields Hand'))
        .props.onClick();
      assert.throws(() => t.render(), /charCodeAt/);
      return h.tree(s.render());
    }),
  );
  await check(
    'rename validates trim, keeps focus and no-op behavior, then optimistically preserves full index metadata',
    () =>
      compare(async version => {
        const s = await loaded(version, [h.index({ extension: { preserved: true } })]);
        beginRename(s).props.onBlur({ target: { value: '   ' } });
        assert.equal(s.requests.length, 1);
        assert.deepEqual(s.events.at(-2), ['alert', '请输入索引名称', 3]);
        assert.deepEqual(s.events.at(-1), ['focus']);
        beginRename(s).props.onBlur({ target: { value: ' Index ' } });
        assert.equal(s.requests.length, 1);
        beginRename(s).props.onBlur({ target: { value: ' Renamed ' } });
        assert.equal(s.states[4][0].customeIndexName, 'Renamed');
        assert.deepEqual(s.states[4][0].extension, { preserved: true });
        assert.deepEqual(req(s, 'UpdateRowIndexCustomeIndexName').args, {
          appId: 'app',
          worksheetId: 'sheet',
          indexConfigId: 'idx',
          customeIndexName: 'Renamed',
        });
        req(s, 'UpdateRowIndexCustomeIndexName').resolve(0);
        await h.settle();
        assert.equal(s.requests.at(-1).method, 'GetRowIndexes');
        return h.tree({ state: s.states, events: s.events });
      }),
  );
  await check(
    'rename false result reloads; delete forwards original row IDs and distinguishes zero/minus-one/other responses',
    async () => {
      await compare(async version => {
        const s = await loaded(version);
        beginRename(s).props.onBlur({ target: { value: 'Other' } });
        req(s, 'UpdateRowIndexCustomeIndexName').resolve(false);
        await h.settle();
        assert.ok(s.events.some(e => e[0] === 'alert' && e[1] === '修改失败'));
        assert.equal(s.requests.at(-1).method, 'GetRowIndexes');
        return h.tree(s.events);
      });
      for (const code of [0, -1, 4])
        await compare(async version => {
          const s = await loaded(version, [
            h.index({
              indexConfigId: undefined,
              isSystem: true,
              systemIndexName: 'special',
              indexFields: [{ fieldId: 'raw', indexType: 'hashed' }],
            }),
          ]);
          more(s).deleteFn();
          assert.deepEqual(req(s, 'RemoveRowIndex').args, {
            appId: 'app',
            worksheetId: 'source-sheet',
            indexConfigId: undefined,
            isSystemIndex: true,
            systemIndexName: 'special',
          });
          req(s, 'RemoveRowIndex').resolve({ responseEnum: code });
          await h.settle();
          assert.equal(s.requests.length, code === 0 ? 3 : 2);
          return h.tree(s.events);
        });
    },
  );
  await check(
    'edit preserves row/field extensions, resolves selected candidates and forwards the exact live current index',
    () =>
      compare(async version => {
        const item = h.index({ extension: 'row', indexFields: [{ fieldId: 'b', indexType: -1, extension: 'field' }] });
        const s = await loaded(version, [item]);
        h.nodes(row(s), 'span')
          .find(n => n.props.children === '编辑')
          .props.onClick();
        const p = h.nodes(s.render(), 'CreateIndex')[0].props;
        assert.equal(p.currentIndexInfo, item);
        assert.equal(p.isEdit, true);
        assert.equal(p.selectedIndexList[0].extension, 'field');
        assert.deepEqual(
          p.selectedIndexList[0].selectFiledsList.map(f => f.id),
          ['b', 'a', 'c'],
        );
        assert.equal(p.getFieldObjById('absent').id, undefined);
        return h.tree({ view: s.render(), events: s.events });
      }),
  );
  await check(
    'editor initializes its true state and field/rule selectors retain users pseudo-field and native search failures',
    () =>
      compare(version => {
        const s = h.host(version),
          e = s.editor(),
          view = e.render(),
          selectors = h.nodes(view, 'Select');
        assert.equal(h.nodes(selectors[0], 'Option').at(-1).props.value, 'users');
        assert.equal(selectors[0].props.showSearch.filterOption('AL', { children: 'Alpha' }), true);
        assert.throws(() => selectors[0].props.showSearch.filterOption('x', undefined), TypeError);
        assert.throws(() => selectors[0].props.showSearch.filterOption('x', { children: undefined }), TypeError);
        e.changeIndexOnly(false);
        e.openAndClose(2);
        e.openAndClose(2);
        h.nodes(e.render(), 'Input')[0].props.onChange({ target: { value: 'Named' } });
        assert.equal(e.state.uniqueIndex, true);
        assert.deepEqual(e.state.showQAList, []);
        assert.equal(e.state.customeIndexName, 'Named');
        return h.tree({ state: e.state, view: e.render() });
      }),
  );
  await check(
    'changing fields/rules keeps original same-value no-op, metadata, numeric one and candidate ordering',
    () =>
      compare(version => {
        const s = h.host(version),
          e = s.editor({ selectedIndexList: [{ fieldId: 'a', indexType: 'text', type: 0, extension: 'keep' }] });
        const original = e.state.selectedIndexList;
        e.changeIndexField('a', 0);
        assert.equal(e.state.selectedIndexList, original);
        e.changeIndexField('b', 0);
        assert.equal(e.state.selectedIndexList[0].indexType, 1);
        assert.equal(e.state.selectedIndexList[0].extension, 'keep');
        assert.deepEqual(
          e.state.selectedIndexList[0].selectFiledsList.map(f => f.id),
          ['b', 'a', 'c'],
        );
        e.changeFieldValue('text', 0);
        e.changeIndexField('unknown', 0);
        assert.equal(e.state.selectedIndexList[0].type, undefined);
        assert.throws(() => e.changeIndexField('a', 9), TypeError);
        return h.tree(e.state);
      }),
  );
  await check('add/remove preserve limits, string initial rule, and the single-field minimum', () =>
    compare(version => {
      const s = h.host(version),
        e = s.editor();
      e.removeCurrentField(0);
      assert.equal(e.state.selectedIndexList.length, 1);
      e.addField();
      assert.equal(e.state.selectedIndexList[1].fieldId, 'b');
      assert.equal(e.state.selectedIndexList[1].indexType, '1');
      e.addField();
      e.addField();
      assert.equal(e.state.selectedIndexList.length, 3);
      e.removeCurrentField(1);
      assert.equal(e.state.selectedIndexList.length, 2);
      const t = s.editor({ worksheetRowIndexLimit: 1 });
      const before = t.state.selectedIndexList;
      t.addField();
      assert.equal(t.state.selectedIndexList, before);
      return h.tree([e.state, t.state]);
    }),
  );
  await check(
    'save validation retains deleted/queued/text-index/multiple-choice branches without any request',
    async () => {
      const cases = [
        { selectedIndexList: [{ isDelete: true }] },
        { currentIndexInfo: { indexStateId: 0 } },
        { selectedIndexList: [{ indexType: 'text' }], indexList: [h.index({ wildcardIndex: true })] },
        { selectedIndexList: [{ type: 3 }, { type: 3 }] },
        { selectedIndexList: [{ indexType: 'text' }, { type: 3 }] },
      ];
      for (const p of cases)
        await compare(version => {
          const s = h.host(version),
            e = s.editor(p);
          e.saveIndex();
          assert.equal(s.requests.length, 0);
          return h.tree({ state: e.state, events: s.events });
        });
    },
  );
  await check(
    'create/update payloads, close-before-response order and every result code match actual API wrappers',
    async () => {
      for (const isEdit of [false, true])
        for (const code of [0, -1, 1, 2, 3, 4, 99])
          await compare(async version => {
            const s = h.host(version),
              e = s.editor({
                isEdit,
                currentIndexInfo: { indexConfigId: 'edit', isSystem: true, systemIndexName: 'system' },
                selectedIndexList: [{ fieldId: 'a', indexType: -1, isSystem: true, extension: 'not-sent' }],
              });
            e.saveIndex();
            const r = s.requests[0];
            assert.equal(r.service, 'Worksheet');
            assert.equal(r.method, isEdit ? 'UpdateRowIndex' : 'AddRowIndex');
            assert.deepEqual(r.args.indexFields, [{ fieldId: 'a', indexType: -1, isSystem: true }]);
            assert.equal(r.args.backgroundIndex, true);
            assert.equal('indexConfigId' in r.args, isEdit);
            assert.deepEqual(s.events.at(-1), ['close']);
            assert.equal(e.state.saveLoading, true);
            r.resolve({ responseEnum: code, rowIndexConfigs: [h.index({ indexConfigId: 'edit' })] });
            await h.settle();
            assert.equal(e.state.saveLoading, false);
            assert.deepEqual(s.events.at(-1), ['refresh']);
            return h.tree({ args: r.args, state: e.state, events: s.events });
          });
    },
  );
  await check('text or wildcard saves disable background indexing; editing its own text index is allowed', async () => {
    for (const wildcardIndex of [false, true])
      await compare(version => {
        const s = h.host(version),
          e = s.editor({
            isEdit: true,
            currentIndexInfo: { indexConfigId: 'idx', wildcardIndex },
            indexList: [h.index({ wildcardIndex: true })],
            selectedIndexList: [{ fieldId: 'a', indexType: 'text' }],
          });
        e.saveIndex();
        assert.equal(s.requests.length, 1);
        assert.equal(s.requests[0].args.backgroundIndex, false);
        return h.tree(s.events);
      });
  });
  await check(
    'failed update row retains early-return loading state and no refresh; rejections and callback failures retain original catch',
    async () => {
      await compare(async version => {
        const s = h.host(version),
          e = s.editor({ isEdit: true, currentIndexInfo: { indexConfigId: 'idx' } });
        e.saveIndex();
        s.requests[0].resolve({ responseEnum: 0, rowIndexConfigs: [h.index({ indexStateId: -1 })] });
        await h.settle();
        assert.equal(e.state.saveLoading, true);
        assert.equal(
          s.events.some(e => e[0] === 'refresh'),
          false,
        );
        return h.tree({ state: e.state, events: s.events });
      });
      for (const isEdit of [false, true])
        await compare(async version => {
          const s = h.host(version),
            e = s.editor({ isEdit });
          e.saveIndex();
          s.requests[0].reject(Error('controlled rejection'));
          await h.settle();
          assert.equal(e.state.saveLoading, false);
          assert.equal(
            s.events.some(e => e[0] === 'alert' || e[0] === 'refresh'),
            false,
          );
          return h.tree(s.events);
        });
      await compare(async version => {
        const s = h.host(version),
          e = s.editor({
            getIndexesInfo: () => {
              throw Error('parent callback failed');
            },
          });
        e.saveIndex();
        s.requests[0].resolve({ responseEnum: 0 });
        await h.settle();
        assert.equal(e.state.saveLoading, false);
        return h.tree(s.events);
      });
    },
  );
  await check(
    'synchronous transport failures leave loading true and do not close, while missing system fields retain native errors',
    async () => {
      for (const version of ['old', 'current']) {
        const s = h.host(version, {}, { syncFailure: 'AddRowIndex' }),
          e = s.editor();
        assert.throws(() => e.saveIndex(), /synchronously/);
        assert.equal(e.state.saveLoading, true);
        assert.deepEqual(s.events, []);
        const item = h.index();
        const t = await loaded(version, [item]);
        item.isSystem = true;
        item.indexFields = undefined;
        assert.throws(() => t.render(), /some/);
      }
    },
  );
  await check('all three complete product modules retain exact Babel output', () => {
    for (const f of [h.LIST, h.EDITOR, h.API]) assert.equal(h.compile(h.current[f], f), h.compile(h.old[f], f), f);
  });
  summarized = true;
  console.log(`Index list/editor complete historical checks: ${checks}`);
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
