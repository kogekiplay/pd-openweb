/** Actual complete historical/current PublicConfig classes. No React mount, browser, API or storage writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const h = require('../../../../../scripts/spec-fixtures/publicConfigLoader.ts');
const { previous, current, setup, tree, nodes, outcome, models, constants } = h;
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`  PASS ${name}`);
}
function compare(configure = (_data: any) => {}, run = (s: any) => s.instance.validateConfigData(), options = {}) {
  const execute = source => {
    const s = setup(source, configure, options);
    const result = outcome(() => run(s));
    return { result, events: tree(s.events), state: tree(s.instance.state) };
  };
  assert.deepEqual(execute(current), execute(previous));
}
check('constructor/reset and all four tabs preserve complete actual JSX and default state', () => {
  for (const tab of [1, 2, 3, 4, undefined])
    for (const frequency of [0, 1]) {
      compare(
        d => {
          d.limitWriteFrequencySetting.limitRangType = frequency;
        },
        s => {
          s.instance.state.activeTab = tab;
          const rendered = tree(s.instance.render());
          s.instance.resetInitState();
          return rendered;
        },
      );
    }
});
check('real time-range method preserves missing periods, empty values, split parts and native failures', () => {
  for (const monthType of [1, 3])
    for (const dayType of [1, 4])
      for (const hourType of [1, 2]) {
        compare(
          d => {
            d.limitWriteTime = {
              isEnable: false,
              monthSetting: { monthType, defineMonth: [] },
              daySetting: { dayType, defineDay: [3, 7] },
              hourSetting: { hourType, rangHour: ['08:00-12:00', 'missing', ''] },
            };
          },
          s => s.instance.getTimeRange(s.data),
        );
      }
  for (const value of [undefined, null, {}]) {
    compare(
      () => {},
      s => s.instance.getTimeRange({ limitWriteTime: value }),
    );
  }
});
check('all immediate setting key/value paths preserve patch, callback and save order in both schedulers', () => {
  for (const batched of [false, true])
    for (const [key, value] of [
      ['sourceKeys', ['a', 'b']],
      ['extendDatas', { extension: 'keep' }],
      ['ipControlId', ''],
      ['browserControlId', undefined],
      ['deviceControlId', 'field'],
      ['systemControlId', 'system'],
      ['extendSourceId', 'source'],
    ]) {
      compare(
        () => {},
        s => {
          s.instance.saveSetting = () => s.events.push(['save']);
          s.instance.handleChange(key, value, () => s.events.push(['callback']));
          s.flush();
        },
        { batched },
      );
    }
});
check('callback/update exceptions stop later effects and native ID uniqueness remains intact', () => {
  for (const batched of [false, true])
    compare(
      () => {},
      s => {
        s.instance.saveSetting = () => s.events.push(['save']);
        s.instance.handleChange('ipControlId', 'new', () => {
          s.events.push(['callback']);
          throw Error('callback-fail');
        });
        s.flush();
      },
      { batched },
    );
  compare(
    () => {},
    s => {
      s.instance.state.ipControlId = 'different';
      s.instance.props.updateSettings = () => {
        throw Error('update-fail');
      };
      s.instance.saveSetting();
    },
  );
  for (const value of [undefined, '', 'ip', '__proto__', 'constructor', 'toString'])
    compare(
      d => {
        d.ipControlId = value;
        d.browserControlId = value;
      },
      s => {
        s.instance.state.ipControlId = undefined;
        s.instance.state.browserControlId = undefined;
        return s.instance.getChangedIds();
      },
    );
});
check('real link patches keep own undefined keys, sticky dirty flag, getter order and state identity', () => {
  for (const dirty of [false, true])
    for (const changed of [false, true])
      compare(
        () => {},
        s => {
          s.instance.state.settingChanged = dirty;
          const reads = [];
          const patch = {
            get smsSignature() {
              reads.push('signature');
              return undefined;
            },
            get writeScope() {
              reads.push('scope');
              return undefined;
            },
          };
          s.instance.handleLinkSettingChange(patch, changed);
          assert.equal(Object.hasOwn(s.instance.state, 'smsSignature'), true);
          return reads;
        },
      );
});
check('actual source generation/removal and field creation preserve immediate and batched effects', () => {
  for (const batched of [false, true])
    for (const value of ['', '  ', 'news', ' x '])
      compare(
        () => {},
        s => {
          s.instance.keyinput = { value };
          s.instance.handleGenUrl();
          s.flush();
          return { input: s.instance.keyinput.value, cacheSame: s.instance.cacheSettings === s.data };
        },
        { batched },
      );
  compare(
    () => {},
    s => {
      s.instance.handleRemoveUrl(0);
      s.instance.handleShowControl('ipControlId');
      s.instance.handleAddControl('IP');
      return s.instance.state.activeSourceKey;
    },
  );
});
check('real metadata merge retains extension/symbol/prototype keys and getter order', () => {
  for (const immediately of [false, true])
    compare(
      d => {
        Object.defineProperty(d.extendDatas, '__proto__', { value: 'own', enumerable: true });
        d.extendDatas[Symbol.for('public-extra')] = 'symbol';
      },
      s => {
        const reads = [];
        const patch = {
          get afterSubmit() {
            reads.push('patch');
            return '{"action":1}';
          },
        };
        s.instance.handleUpdateExpandDatas(patch, immediately);
        assert.equal(s.instance.state.extendDatas[Symbol.for('public-extra')], 'symbol');
        assert.equal(Object.hasOwn(s.instance.state.extendDatas, '__proto__'), true);
        return reads;
      },
    );
});
check('actual validation covers every existing rejection branch and source-side mutations', () => {
  const cases: Array<(data: any, state: any) => void> = [
    () => {},
    d => {
      d.linkSwitchTime.isEnable = true;
    },
    d => {
      d.linkSwitchTime = { isEnable: true, startTime: '0001-01-01' };
    },
    d => {
      d.limitWriteTime.isEnable = true;
      d.limitWriteTime.monthSetting.monthType = 2;
    },
    d => {
      d.limitWriteTime.isEnable = true;
      d.limitWriteTime.monthSetting.monthType = 3;
    },
    d => {
      d.limitWriteTime.isEnable = true;
      d.limitWriteTime.daySetting.dayType = 2;
    },
    d => {
      d.limitWriteTime.isEnable = true;
      d.limitWriteTime.daySetting.dayType = 3;
    },
    d => {
      d.limitWriteTime.isEnable = true;
      d.limitWriteTime.daySetting.dayType = 4;
    },
    d => {
      d.limitWriteTime.isEnable = true;
      d.limitWriteTime.hourSetting.hourType = 2;
    },
    d => {
      d.limitWriteCount.isEnable = true;
    },
    d => {
      d.limitWriteFrequencySetting.isEnable = true;
    },
    d => {
      d.limitPasswordWrite.isEnable = true;
    },
    d => {
      d.limitPasswordWrite = { isEnable: true, limitPasswordWrite: 'bad!' };
    },
    d => {
      d.cacheFieldData = { isEnable: true, cacheField: ['deleted'] };
    },
    (d, s) => {
      d.weChatSetting.isCollectWxInfo = true;
      s.activeTab = 2;
    },
    (d, s) => {
      d.weChatSetting = { isCollectWxInfo: true, collectChannel: 2, fieldMaps: { openId: 'field' } };
      s.activeTab = 2;
    },
    (d, s) => {
      d.weChatSetting = { isCollectWxInfo: true, collectChannel: 2, fieldMaps: { openId: 'field' } };
      s.activeTab = 2;
      s.weChatBind = { isBind: 2 };
    },
    d => {
      d.abilityExpand.autoFillField.isAutoFillField = true;
    },
    d => {
      d.abilityExpand.allowViewChange = { isAllowViewChange: true, changeSetting: { changeType: 2, expireTime: 0 } };
    },
    d => {
      d.extendDatas.shareConfig = '{"title":""}';
    },
    d => {
      d.extendDatas.afterSubmit = '{"action":2,"content":""}';
    },
    (d, s) => {
      d.limitWriteTime.isEnable = true;
      d.limitWriteTime.hourSetting.hourType = 2;
      s.timeRange.hour = [
        { start: '08:00', end: '10:00' },
        { start: '', end: '11:00' },
      ];
      d.weChatSetting.collectChannel = 2;
      s.weChatBind = { isBind: 1, appId: 'app' };
    },
  ];
  for (const configure of cases)
    compare(
      () => {},
      s => {
        configure(s.data, s.instance.state);
        const timing = s.instance.state.limitWriteTime,
          wx = s.instance.state.weChatSetting;
        const valid = s.instance.validateConfigData();
        assert.equal(s.instance.state.limitWriteTime, timing);
        assert.equal(s.instance.state.weChatSetting, wx);
        return { valid, sourceTiming: s.data.limitWriteTime, sourceWeChat: s.data.weChatSetting };
      },
    );
  for (const key of [
    'linkSwitchTime',
    'limitWriteTime',
    'limitWriteCount',
    'limitWriteFrequencySetting',
    'limitPasswordWrite',
    'cacheFieldData',
    'weChatSetting',
    'abilityExpand',
  ])
    compare(
      () => {},
      s => {
        s.instance.state[key] = undefined;
        return s.instance.validateConfigData();
      },
    );
});
check('real save preserves hide/save/share/callback/cache order, references and failure branches', () => {
  for (const success of [false, true])
    for (const tab of [1, 2])
      for (const requireAuth of [false, true])
        compare(
          d => {
            d.weChatSetting.isRequireAuth = requireAuth;
            d.weChatSetting.fieldMaps = { openId: 'field', nickName: 'other', extension: 'future' };
          },
          s => {
            s.instance.state.activeTab = tab;
            s.instance.state.ipControlId = 'replacement';
            const shareValue = { title: 'share', extension: { keep: true } };
            const card = {
              shareConfigValue: shareValue,
              onSave: (value, id) => {
                assert.equal(value, shareValue);
                s.events.push(['share', value, id]);
              },
            };
            s.instance.shareCardSetRef.current = card;
            s.instance.saveSetting(() => s.events.push(['callback', s.instance.cacheSettings === s.data]));
            const saved = s.events.find(e => e[0] === 'update')[1];
            assert.equal(saved.limitWriteTime, s.instance.state.limitWriteTime);
            assert.equal(Object.hasOwn(saved, 'smsVerificationFiled'), true);
            s.pending[0](success);
            return {
              cacheIsSaved: s.instance.cacheSettings === saved,
              cacheIsOriginal: s.instance.cacheSettings === s.data,
            };
          },
        );
  compare(
    () => {},
    s => {
      s.instance.shareCardSetRef.current = {
        onSave() {
          throw Error('share-fail');
        },
      };
      s.instance.state.activeTab = 2;
      s.instance.saveSetting(() => s.events.push(['callback']));
      return outcome(() => s.pending[0](true));
    },
  );
  compare(
    () => {},
    s => {
      const card = {
        get shareConfigValue() {
          s.events.push(['share-value']);
          return { title: 'Title' };
        },
        onSave(value, id) {
          assert.equal(this, card);
          s.events.push(['share', value, id]);
        },
      };
      s.instance.shareCardSetRef = {
        get current() {
          s.events.push(['ref-current']);
          return card;
        },
      };
      s.instance.state.activeTab = 2;
      s.instance.saveSetting();
      s.pending[0](true);
    },
  );
});
check('actual dropdowns preserve native values, selection filtering and add-field callback', () => {
  for (const key of ['ipControlId', 'browserControlId', 'deviceControlId', 'systemControlId', 'extendSourceId'])
    compare(
      d => {
        d.boundControlIds = ['field'];
      },
      s => {
        const options = s.instance.getDropdownControls(key);
        nodes(options.at(-1).text, 'style-1')[0].props.onClick();
        return tree(options);
      },
    );
});
check('actual close/tab/cancel/save dialog closures keep confirm and reset behavior', () => {
  for (const dirty of [false, true])
    compare(
      () => {},
      s => {
        s.instance.state.settingChanged = dirty;
        const root = s.instance.render();
        nodes(root, 'Tabs')[0].props.onChange({ value: 2 });
        nodes(root, 'Drawer')[0].props.onClose();
        if (s.instance.state.confirmDialog.visible) nodes(s.instance.render(), 'Dialog')[0].props.onCancel(false);
      },
    );
  for (const save of [false, true])
    compare(
      () => {},
      s => {
        s.instance.state.confirmDialog = { visible: true, tabValue: 2 };
        const dialog = nodes(s.instance.render(), 'Dialog')[0];
        if (save) {
          dialog.props.onOk();
          s.pending[0](true);
        } else dialog.props.handleClose();
      },
    );
});
check('unknown JSON readers retain lazy property access and reject wrong known fields', () => {
  const reads = [];
  const share = {
    get title() {
      reads.push('title');
      return 'share';
    },
    get extension() {
      throw Error('not consumed');
    },
  };
  const receipt = {
    get action() {
      reads.push('action');
      return 1;
    },
    get content() {
      throw Error('not consumed');
    },
  };
  const s = setup(current, () => {}, {
    parseValue: v => (v === 'share' ? share : v === 'receipt' ? receipt : h.safeParse(v)),
  });
  s.instance.state.extendDatas = { shareConfig: 'share', afterSubmit: 'receipt' };
  assert.equal(s.instance.validateConfigData(), true);
  assert.deepEqual(reads, ['title', 'action']);
  for (const key of ['title', 'content'])
    for (const value of [false, 2, {}, []])
      assert.throws(() => models.publicSettingText({ [key]: value }, key), /Invalid public form setting field/);
  for (const action of [undefined, null, '2', false, 1, 2])
    assert.equal(models.publicReceiptAction({ action }), action);
  for (const action of [{}, []]) assert.throws(() => models.publicReceiptAction({ action }), /setting field: action/);
  for (const value of [null, undefined]) assert.throws(() => models.publicSettingText(value, 'title'), TypeError);
  const bad = setup(current, d => {
    d.extendDatas.shareConfig = '{"title":8}';
  });
  assert.throws(() => bad.instance.validateConfigData(), /setting field: title/);
  assert.deepEqual(bad.events, []);
  assert.equal(
    setup(previous, d => {
      d.extendDatas.shareConfig = '{"title":8}';
    }).instance.validateConfigData(),
    true,
  );
});
check('real share-card imperative binding and save declaration match the parent ref protocol', () => {
  const rel = 'src/pages/FormSet/containers/Share/ShareCardSet/index.tsx';
  const historical = execFileSync('git', ['show', `${h.BASE}:${rel}`], { cwd: h.ROOT, encoding: 'utf8' });
  assert.equal(
    crypto.createHash('sha256').update(historical).digest('hex'),
    '63b25e50d8deaf04f1b375b0d64a9633a3d720b5026193649fe35f2b73042e14',
  );
  for (const source of [historical, fs.readFileSync(path.join(h.ROOT, rel), 'utf8')]) {
    const events = [];
    const info = { title: 'Title', desc: 'Desc', icon: 'icon', iconUrl: 'url', extension: { keep: true } };
    const onSave = new Function(
      'sheetSetAjax',
      '_',
      'appId',
      'worksheetId',
      'alert',
      '_l',
      `return (${h
        .compile('const actual = ' + h.expression(source, 'onSave') + ';', rel)
        .replace(/^.*?const actual=/, '')
        .replace(/;$/, '')})`,
    )(
      {
        shareCardSetting: payload => {
          events.push(payload);
          return Promise.resolve(true);
        },
      },
      require('lodash'),
      'app',
      'sheet',
      () => {},
      x => x,
    );
    onSave(info, 'sheet_5');
    assert.deepEqual(events[0], {
      title: 'Title',
      desc: 'Desc',
      icon: 'icon',
      extension: info.extension,
      appId: 'app',
      appItemId: 'sheet',
      shareCardId: 'sheet_5',
    });
    // Execute the actual imperative-handle expression with controlled hook/ref bindings.
    let bind;
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node.type === 'CallExpression' && node.callee.name === 'useImperativeHandle') bind = node;
      Object.values(node).forEach(walk);
    }
    walk(h.parse(source));
    assert.ok(bind);
    const ref = { current: null };
    new Function(
      'useImperativeHandle',
      'ref',
      'onSave',
      'shareConfigValue',
      h.compile(source.slice(bind.start, bind.end) + ';', rel),
    )(
      (r, make) => {
        r.current = make();
      },
      ref,
      onSave,
      info,
    );
    assert.equal(ref.current.shareConfigValue, info);
    assert.equal(ref.current.onSave, onSave);
    assert.deepEqual(Reflect.ownKeys(ref.current), ['onSave', 'shareConfigValue']);
  }
});
check('WeChat forwarding and time constants erase identically; binding/read-only changes are type-only', () => {
  for (const rel of [
    'src/pages/FormExtend/PublicWorksheetConfig/PublicConfig/WeChatEnhance.tsx',
    'src/pages/FormExtend/enum.ts',
    'src/pages/FormExtend/PublicWorksheetConfig/redux/types.ts',
  ]) {
    const historical = execFileSync('git', ['show', `${h.BASE}:${rel}`], { cwd: h.ROOT, encoding: 'utf8' });
    if (rel.includes('WeChatEnhance'))
      assert.equal(
        crypto.createHash('sha256').update(historical).digest('hex'),
        '64d6c908c983bfc73e23c7918d5e993b07b1bf24aae28a774bc0be6bf4159f25',
      );
    assert.equal(h.compile(fs.readFileSync(path.join(h.ROOT, rel), 'utf8'), rel), h.compile(historical, rel), rel);
  }
});
console.log(`${checks} public configuration checks passed`);
