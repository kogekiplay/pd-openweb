/** Real feedback component and API wrappers; UI leaves, hook scheduling and transport are local recording hosts. */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const React = require('react');
const h: import('../../../scripts/spec-harness').SpecHarness = require('../../../scripts/spec-harness.ts');
const UI = 'src/components/GetHelp/index.tsx';
const API = 'src/pages/workflow/apiV2/chatbot.ts';
const source = rel => fs.readFileSync(path.join(h.ROOT, rel), 'utf8');
const compile = (text, rel) => h.transformSync(text, { filename: path.join(h.ROOT, rel), comments: false }).code;

function leaf(name) {
  const component = () => null;
  component.displayName = name;
  return component;
}

function nodes(value, name): any[] {
  if (Array.isArray(value)) return value.flatMap(item => nodes(item, name));
  if (!React.isValidElement(value)) return [];
  const label = typeof value.type === 'string' ? value.type : value.type.displayName;
  return (label === name ? [value] : []).concat(...Object.values(value.props).map(item => nodes(item, name)));
}

const settle = () => new Promise(resolve => setImmediate(resolve));

function host(options = {}, mobile = false) {
  const state = [],
    refs = [],
    mounted = [],
    effects = [],
    timers = [],
    events = [],
    requests = [];
  let cursor = 0,
    component,
    props,
    syncError: Error | undefined;
  const hooks = {
    Fragment: React.Fragment,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        value => {
          state[index] = value;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect(effect) {
      const index = cursor++;

      if (!mounted[index]) {
        mounted[index] = true;
        effects.push(effect);
      }
    },
  };
  const base = { ajaxOptions: { url: '', type: '' }, server: () => '/local-workflow-host' };

  const transport = (controller, method, args, requestOptions) => {
    if (syncError) throw syncError;
    let resolve, reject;
    const promise = Object.assign(
      new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
      {
        abort: () => events.push(['abort']),
      },
    );
    requests.push({
      controller,
      method,
      args,
      options: requestOptions,
      url: base.ajaxOptions.url,
      type: base.ajaxOptions.type,
      resolve,
      reject,
      promise,
    });
    return promise;
  };

  const api = { exports: {} };
  new Function('module', 'exports', 'require', 'mdyAPI', '$', compile(source(API), API))(
    api,
    api.exports,
    name => {
      assert.equal(name, './base');
      return { __esModule: true, default: base, controllerName: 'workflow' };
    },
    transport,
    { extend: Object.assign },
  );
  const ui: { exports: { default?: (value: object) => void } } = { exports: {} };
  const leaves = Object.fromEntries(
    ['Button', 'Dialog', 'LoadDiv', 'MobilePersonalInfo', 'Textarea', 'UserName', 'Popup'].map(name => [
      name,
      leaf(name),
    ]),
  );

  const wrapped = (Comp, incoming) => {
    component = Comp;
    props = { ...incoming, onClose: () => events.push(['close']) };
  };

  new Function('module', 'exports', 'require', '_l', 'md', 'location', 'alert', 'setTimeout', compile(source(UI), UI))(
    ui,
    ui.exports,
    name => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'antd-mobile') return { Popup: leaves.Popup };
      if (name === 'styled-components') return { __esModule: true, default: { div: () => leaf('PopupWrapper') } };
      if (name === 'ming-ui') return { ...leaves, FunctionWrap: wrapped };
      if (name === 'src/pages/workflow/apiV2/chatbot') return api.exports;
      if (name === 'src/utils/common') return { browserIsMobile: () => mobile };
      throw Error('Unexpected GetHelp dependency ' + name);
    },
    value => value,
    { global: { Account: { accountId: 'user' } } },
    { href: '/chatbot' },
    (...args) => events.push(['alert', ...args]),
    (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
  );
  ui.exports.default(options);
  const render = () => {
    cursor = 0;
    return component(props);
  };

  return {
    render,
    state,
    events,
    requests,
    timers,
    effects: () => effects.splice(0).forEach(effect => effect()),
    syncFailure: (error: Error) => {
      syncError = error;
    },
    async ready(owner = { companyId: 'project', fullName: 'Owner', accountId: 'owner' }) {
      render();
      this.effects();
      const request = requests.find(item => item.method === 'chatbotgetOwner');
      if (request) request.resolve(owner);
      await settle();
      return render();
    },
  };
}

function change(s, value) {
  nodes(s.render(), 'Textarea')[0].props.onChange(value);
}

function submit(s) {
  nodes(s.render(), 'Dialog')[0].props.onOk();
}

let checks = 0;

async function check(name, run) {
  await run();
  checks++;
  console.log('PASS ' + name);
}

async function main() {
  await check('desktop owner lookup uses the real API wrapper and renders the returned identity', async () => {
    const s = host({ chatbotId: 'bot', messageId: 'message' });
    assert.equal(nodes(s.render(), 'LoadDiv').length, 1);
    await s.ready();
    const request = s.requests[0];
    assert.equal(request.controller, 'workflow');
    assert.equal(request.method, 'chatbotgetOwner');
    assert.equal(request.url, '/local-workflow-host/chatbot/getOwner');
    assert.equal(request.type, 'POST');
    assert.deepEqual(request.args, { chatbotId: 'bot' });
    const user = nodes(s.render(), 'UserName')[0].props;
    assert.deepEqual(user.user, { userName: '@Owner', accountId: 'owner' });
    assert.equal(user.projectId, 'project');
    assert.deepEqual(
      s.timers.map(timer => timer.delay),
      [100],
    );
    const reads = [];
    nodes(s.render(), 'Textarea')[0].props.manualRef({ focus: () => reads.push('focus') });
    s.timers[0].callback();
    assert.deepEqual(reads, ['focus']);
    nodes(s.render(), 'Textarea')[0].props.manualRef(null);
    assert.doesNotThrow(() => s.timers[0].callback());
  });
  await check('falsy owner responses retain missing fields and finish loading', async () => {
    for (const owner of [false, 0, '', null, undefined]) {
      const s = host({ chatbotId: 'bot' });
      s.render();
      s.effects();
      s.requests[0].resolve(owner);
      await settle();
      assert.equal(nodes(s.render(), 'LoadDiv').length, 0);
      assert.deepEqual(nodes(s.render(), 'UserName')[0].props.user, { userName: '@undefined', accountId: undefined });
    }
  });
  await check('user feedback trims its request and only truthy success alerts then closes', async () => {
    const s = host({ chatbotId: 'bot', messageId: 'message' });
    await s.ready();
    assert.equal(nodes(s.render(), 'Dialog')[0].props.okDisabled, true);
    change(s, '   ');
    assert.equal(nodes(s.render(), 'Dialog')[0].props.okDisabled, true);
    change(s, '  help please  ');
    submit(s);
    const request = s.requests.at(-1);
    assert.equal(request.method, 'chatbotfeedback');
    assert.equal(request.url, '/local-workflow-host/chatbot/feedback');
    assert.deepEqual(request.args, { chatbotId: 'bot', messageId: 'message', opinion: 'help please' });
    assert.equal(nodes(s.render(), 'Dialog')[0].props.okDisabled, true);
    request.resolve({ accepted: true });
    await settle();
    assert.equal(nodes(s.render(), 'Dialog')[0].props.okDisabled, false);
    assert.deepEqual(s.events, [['alert', '反馈成功'], ['close']]);
  });
  await check('platform feedback skips owner lookup and sends flow identifiers', async () => {
    const s = host({ type: 2, chatbotId: 'bot', instanceId: 'instance', flowNodeId: 'node' });
    await s.ready();
    assert.equal(s.requests.length, 0);
    assert.equal(nodes(s.render(), 'Dialog')[0].props.title, '反馈给平台');
    change(s, '  platform issue ');
    submit(s);
    assert.deepEqual(s.requests[0].args, {
      chatbotId: 'bot',
      instanceId: 'instance',
      flowNodeId: 'node',
      opinion: 'platform issue',
    });
    assert.equal(Object.hasOwn(s.requests[0].args, 'messageId'), false);
    s.requests[0].resolve(true);
    await settle();
    assert.deepEqual(s.events, [['alert', '反馈成功'], ['close']]);
  });
  await check('falsy feedback and transport rejection restore submitting without success', async () => {
    for (const response of [false, 0, '', null, undefined, Error('failed')]) {
      const s = host({ type: 2 });
      await s.ready();
      change(s, 'issue');
      submit(s);
      const request = s.requests[0];
      if (response instanceof Error) request.reject(response);
      else request.resolve(response);
      await settle();
      assert.equal(nodes(s.render(), 'Dialog')[0].props.okDisabled, false);
      assert.deepEqual(s.events, []);
    }
  });
  await check('mobile UI preserves textarea height, owner panel and mask close', async () => {
    const s = host({ chatbotId: 'bot' }, true);
    await s.ready();
    const textarea = nodes(s.render(), 'Textarea')[0];
    assert.equal(textarea.props.minHeight, 370);
    assert.equal(textarea.props.maxHeight, 370);
    nodes(s.render(), 'span')
      .find(node => typeof node.props.onClick === 'function')
      .props.onClick();
    const panel = nodes(s.render(), 'MobilePersonalInfo')[0];
    assert.equal(panel.props.accountId, 'owner');
    assert.equal(panel.props.projectId, 'project');
    panel.props.onClose();
    assert.equal(nodes(s.render(), 'MobilePersonalInfo').length, 0);
    nodes(s.render(), 'Popup')[0].props.onMaskClick();
    assert.deepEqual(s.events, [['close']]);
  });
  await check('synchronous transport failure retains the original pending prefix and native exception', async () => {
    const s = host({ type: 2 });
    await s.ready();
    change(s, 'issue');
    const error = Error('sync-feedback-failure');
    s.syncFailure(error);
    assert.throws(
      () => submit(s),
      value => value === error,
    );
    assert.equal(nodes(s.render(), 'Dialog')[0].props.okDisabled, true);
    assert.deepEqual(s.events, []);
  });
  await check('both type layers erase to exactly the previous complete runtime modules', () => {
    for (const rel of [UI, API]) {
      const old = cp.execFileSync('git', ['show', `8286bbd349f5d352f36ba97896f8826bfd6437fd:${rel}`], {
        cwd: h.ROOT,
        encoding: 'utf8',
      });
      assert.equal(compile(source(rel), rel), compile(old, rel), rel);
    }
  });
  console.log(`${checks} real GetHelp/API checks passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
