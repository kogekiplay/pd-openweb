import type { AgentBus, AgentEventHandler } from './agentEventBus';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const cp: typeof import('node:child_process') = require('node:child_process');
const harness: import('../../../scripts/spec-harness').SpecHarness = require('../../../scripts/spec-harness.ts');

const root = path.resolve(__dirname, '../../..');
const before = process.env['AGENT_BUS_BEFORE_REV'];
Reflect.set(globalThis, '_l', (value: string) => value);
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function load(relative: string, override?: string): Record<string, unknown> {
  const filename = path.join(root, relative);
  const module: { exports: unknown } = { exports: {} };
  const result = harness.transformSync(override || fs.readFileSync(filename, 'utf8'), { filename });
  assert.ok(result?.code);
  new Function('module', 'exports', 'require', '__dirname', result.code)(
    module,
    module.exports,
    (name: string) => {
      if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')));
      return require(name);
    },
    path.dirname(filename),
  );
  assert.ok(record(module.exports));
  return module.exports;
}
function invoke(module: Record<string, unknown>, key: string, ...args: unknown[]): unknown {
  const fn = module[key];
  if (typeof fn !== 'function') throw new TypeError('Missing actual function ' + key);
  return Reflect.apply(fn, undefined, args);
}
function busAbi(value: unknown): AgentBus {
  assert.ok(record(value));
  const on = value['on'],
    emit = value['emit'];
  if (typeof on !== 'function' || typeof emit !== 'function') throw new TypeError('Missing actual bus methods');
  return {
    on(topic, handler) {
      const unsub: unknown = Reflect.apply(on, value, [topic, handler]);
      if (typeof unsub !== 'function') throw new TypeError('Missing unsubscribe');
      return () => {
        Reflect.apply(unsub, undefined, []);
      };
    },
    emit(topic, payload) {
      Reflect.apply(emit, value, [topic, payload]);
    },
  };
}
const actual = load('src/components/Agent/agentEventBus.ts');
const codecs = load('src/components/Agent/agentEventPayloads.ts');
function makeBus(errors: unknown[] = []): AgentBus {
  return busAbi(invoke(actual, 'createAgentBus', (error: unknown, topic: string) => errors.push({ error, topic })));
}
function historicalBus(errors: unknown[] = []): AgentBus | undefined {
  if (!before) return undefined;
  const source = cp.execFileSync('git', ['show', before + ':src/components/Agent/agentBus.tsx'], {
    cwd: root,
    encoding: 'utf8',
  });
  const start = source.indexOf('  const listenersRef =');
  const end = source.indexOf('  const value = useMemo', start);
  assert.ok(start >= 0 && end > start);
  const block = 'module.exports={create(){' + source.slice(start, end) + 'return {on,emit};}};';
  const transformed = harness.transformSync(block, { filename: path.join(root, 'src/components/Agent/agentBus.tsx') });
  assert.ok(transformed?.code);
  const module: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', 'exports', 'useRef', 'useCallback', 'console', transformed.code)(
    module,
    module.exports,
    (current: unknown) => ({ current }),
    (fn: unknown) => fn,
    { error: (...args: unknown[]) => errors.push(args) },
  );
  return busAbi(invoke(module.exports, 'create'));
}
function ordinaryScenario(bus: AgentBus) {
  const calls: unknown[] = [];
  const data = { marker: 'same-object' };
  const listener: AgentEventHandler = (payload, topic) => calls.push({ payload, topic });
  const a = bus.on('extension:any-topic', listener);
  const duplicate = bus.on('extension:any-topic', listener);
  for (const payload of [data, null, undefined, false, 0, '']) bus.emit('extension:any-topic', payload);
  assert.equal(calls.length, 6, 'Repeated handler identity is not duplicated');
  assert.ok(record(calls[0]));
  assert.equal(calls[0]['payload'], data, 'Raw bus preserves payload identity');
  a();
  duplicate();
  bus.emit('extension:any-topic', 9);
  assert.equal(calls.length, 6);
  const order: string[] = [];
  let second: () => void = () => {};
  const first = bus.on('snapshot', () => {
    order.push('first');
    second();
    bus.on('snapshot', () => order.push('new'));
  });
  second = bus.on('snapshot', () => order.push('second'));
  bus.emit('snapshot');
  assert.deepEqual(order, ['first', 'second'], 'Unsubscribing during dispatch preserves the snapshot');
  first();
  bus.emit('snapshot');
  assert.deepEqual(order, ['first', 'second', 'new']);
  bus.on('inner', () => order.push('inner'));
  bus.on('outer', () => {
    order.push('before');
    bus.emit('inner');
    order.push('after');
  });
  bus.emit('outer');
  return { calls, order };
}
const normal = ordinaryScenario(makeBus());
const old = historicalBus();
if (old) assert.deepEqual(normal, ordinaryScenario(old));
function doubleUnsubscribe(bus: AgentBus): number {
  const stop = bus.on('replace', () => {});
  stop();
  let count = 0;
  bus.on('replace', () => {
    count += 1;
  });
  stop();
  bus.emit('replace');
  return count;
}
assert.equal(doubleUnsubscribe(makeBus()), 1);
if (old)
  assert.equal(doubleUnsubscribe(historicalBus() || old), 0, 'Old unsubscribe deleted the replacement listener set');
const failures: unknown[] = [];
const protectedBus = makeBus(failures);
let reached = 0;
protectedBus.on('errors', () => {
  throw 'handler failure';
});
protectedBus.on('errors', () => {
  reached += 1;
});
protectedBus.emit('errors');
assert.equal(reached, 1);
assert.deepEqual(failures, [{ error: 'handler failure', topic: 'errors' }]);
const decoded: unknown[] = [];
const bus = makeBus();
invoke(actual, 'subscribeDecodedAgentEvent', bus, 'prompt', codecs['decodePromptEvent'], (payload: unknown) =>
  decoded.push(payload),
);
for (const value of [null, 1, [], { text: {} }]) bus.emit('prompt', value);
assert.deepEqual(decoded, []);
bus.emit('prompt', { text: 'hello' });
assert.deepEqual(decoded, [{ text: 'hello' }]);
const falsyDecoded: unknown[] = [];
invoke(
  actual,
  'subscribeDecodedAgentEvent',
  bus,
  'falsy',
  (value: unknown) =>
    typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' ? value : null,
  (value: unknown) => falsyDecoded.push(value),
);
for (const value of [false, 0, '']) bus.emit('falsy', value);
assert.deepEqual(falsyDecoded, [false, 0, '']);
const files = {
  '/plan.md': { content: '# Plan', parsed: '# Plan', status: 'ready' },
  '/jsons/roles.json': { parsed: [] },
};
const fileEvent = invoke(codecs, 'decodeFilesEvent', { files });
assert.ok(record(fileEvent));
assert.equal(fileEvent['files'], files);
for (const value of [
  null,
  [],
  { files: { p: null } },
  { files: { p: { content: 1 } } },
  { files: { p: Object.create({ content: 1 }) } },
])
  assert.equal(invoke(codecs, 'decodeFilesEvent', value), null);
assert.equal(invoke(codecs, 'decodeGenerateEvent', { files: { p: { content: null } } }), null);
assert.deepEqual(invoke(codecs, 'decodeBuilderEdit', { text: 'extra' }), {
  module: undefined,
  card: undefined,
  text: 'extra',
});
assert.equal(invoke(codecs, 'decodeBuilderEdit', { text: {} }), null);
const answers = [{ questionId: 'q', value: ['A', 'B'] }];
const reply = invoke(codecs, 'decodeAskReply', { answers });
assert.ok(record(reply));
assert.equal(reply['answers'], answers);
publicContracts();
mobileControllerRegression();
chatReceiversRegression()
  .then(() =>
    console.log(
      JSON.stringify({
        rawHistoricalParity: !!before,
        opaqueIdentity: true,
        snapshotsAndNestedEvents: true,
        subscriberFailureIsolation: true,
        idempotentUnsubscribe: true,
        decodedFalsyValues: true,
        payloadFieldChecks: true,
        publicTypes: true,
        actualMobileController: true,
        actualChatReceivers: true,
      }),
    ),
  )
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
function publicContracts() {
  const dir = fs.mkdtempSync(path.join(root, 'node_modules/.cache/agent-bus-types-'));
  const source = path.join(dir, 'contract.ts'),
    config = path.join(dir, 'tsconfig.json');
  try {
    fs.writeFileSync(
      source,
      `import {createAgentBus,subscribeDecodedAgentEvent}from '${root}/src/components/Agent/agentEventBus';import{decodePromptEvent}from '${root}/src/components/Agent/agentEventPayloads';
const bus=createAgentBus();bus.emit('extension:any',{custom:true});bus.on('extension:any',payload=>{
// @ts-expect-error Unknown transport data must be decoded before member access.
payload.text;});
subscribeDecodedAgentEvent(bus,'prompt',decodePromptEvent,value=>{const text:string=value.text;void text;
// @ts-expect-error Decoded prompt text is not numeric.
const invalid:number=value.text;void invalid;});
// @ts-expect-error Codec output and callback input must agree.
subscribeDecodedAgentEvent(bus,'prompt',decodePromptEvent,(value:number)=>{void value;});
`,
    );
    fs.writeFileSync(
      config,
      JSON.stringify({
        extends: path.join(root, 'tsconfig.strict.json'),
        compilerOptions: { types: [], rootDir: root, noEmit: true },
        include: [source],
        exclude: [],
      }),
    );
    cp.execFileSync(
      process.execPath,
      [path.join(root, 'node_modules/@typescript/native/bin/tsc'), '-p', config, '--pretty', 'false'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
function mobileControllerRegression() {
  const registry = load('src/components/Agent/AppBuilder/fileRegistry.ts');
  const store = load('src/components/Agent/AppBuilder/fileStore.ts');
  const relative = 'src/pages/Mobile/Mingo/components/OverviewPopup.tsx';
  function controller(revision?: string) {
    const source = revision
      ? cp.execFileSync('git', ['show', revision + ':' + relative], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, relative), 'utf8');
    const start = source.indexOf('function tryParseFile('),
      end = source.indexOf('function GenerateBar(', start);
    assert.ok(start >= 0 && end > start);
    const code = harness.transformSync(source.slice(start, end) + '\nmodule.exports={OverviewController};', {
      filename: path.join(root, relative),
    });
    assert.ok(code?.code);
    const module: { exports: Record<string, unknown> } = { exports: {} };
    const bus = makeBus();
    let cleanup: unknown;
    const inputs = [
      'useAgentBus',
      'useEffect',
      'entryByPath',
      'parseFile',
      'serializeFile',
      'decodeFileEvent',
      'subscribeDecodedAgentEvent',
      'decodeBuilderOpenEvent',
    ];
    new Function('module', 'exports', ...inputs, code.code)(
      module,
      module.exports,
      () => bus,
      (effect: () => unknown) => {
        cleanup = effect();
      },
      registry['entryByPath'],
      registry['parseFile'],
      registry['serializeFile'],
      store['decodeFileEvent'],
      actual['subscribeDecodedAgentEvent'],
      codecs['decodeBuilderOpenEvent'],
    );
    const filesRef: { current: Record<string, unknown> } = { current: {} };
    let content = '',
      ready = false,
      visible = false,
      changes = 0;
    invoke(module.exports, 'OverviewController', {
      filesRef,
      setOverviewContent: (value: unknown) => {
        const next: unknown = typeof value === 'function' ? Reflect.apply(value, undefined, [content]) : value;
        if (typeof next !== 'string') throw new TypeError('Invalid controller text');
        content = next;
      },
      setOverviewReady: (value: boolean) => {
        ready = value;
      },
      setOverviewVisible: (value: boolean) => {
        visible = value;
      },
      onFilesChange: () => {
        changes += 1;
      },
    });
    return {
      bus,
      filesRef,
      snapshot: () => ({ files: JSON.stringify(filesRef.current), content, ready, visible, changes }),
      stop: () => {
        if (typeof cleanup !== 'function') throw new TypeError('Missing controller cleanup');
        Reflect.apply(cleanup, undefined, []);
      },
    };
  }
  function populate(value: ReturnType<typeof controller>) {
    const bus = value.bus;
    bus.emit('file:begin', { path: '/plan.md' });
    bus.emit('file:delta', { path: '/plan.md', delta: '# Plan' });
    bus.emit('file:delta', { path: '/plan.md', delta: '\nContent' });
    bus.emit('file:end', { path: '/plan.md' });
    bus.emit('file:begin', { path: '/jsons/roles.json' });
    bus.emit('file:delta', { path: '/jsons/roles.json', delta: '{"roles":[' });
    bus.emit('file:delta', { path: '/jsons/roles.json', delta: '{"name":"用户"}]}' });
    bus.emit('file:end', { path: '/jsons/roles.json' });
    bus.emit('app:meta', { versionLabel: 'v1' });
    return value.snapshot();
  }
  const current = controller(),
    currentSnapshot = populate(current);
  if (before)
    assert.deepEqual(
      currentSnapshot,
      populate(controller(before)),
      'Normal mobile controller events keep historical output',
    );
  for (const [topic, payload] of [
    ['file:delta', null],
    ['file:delta', { path: '/plan.md', delta: 42 }],
    ['file:begin', { path: '/unknown' }],
    ['app:meta', null],
  ] as const)
    current.bus.emit(topic, payload);
  assert.deepEqual(current.snapshot(), currentSnapshot, 'Malformed events do not corrupt mobile content or readiness');
  current.stop();
  current.bus.emit('file:write', { path: '/plan.md', content: 'ignored after cleanup' });
  assert.deepEqual(current.snapshot(), currentSnapshot);
  const falsy = controller();
  populate(falsy);
  falsy.bus.emit('file:begin', { path: '/jsons/roles.json' });
  falsy.bus.emit('file:delta', { path: '/jsons/roles.json', delta: 'false' });
  const role = falsy.filesRef.current['/jsons/roles.json'];
  assert.ok(record(role));
  assert.equal(role['parsed'], false, 'A complete falsy JSON value replaces earlier data');
  if (before) {
    const previous = controller(before);
    populate(previous);
    previous.bus.emit('file:begin', { path: '/jsons/roles.json' });
    previous.bus.emit('file:delta', { path: '/jsons/roles.json', delta: 'false' });
    const old = previous.filesRef.current['/jsons/roles.json'];
    assert.ok(record(old));
    assert.deepEqual(old['parsed'], [{ name: '用户' }]);
  }
}
async function chatReceiversRegression() {
  const relative = 'src/components/Agent/ChatPanel.tsx';
  function receiver(revision?: string) {
    const source = revision
      ? cp.execFileSync('git', ['show', revision + ':' + relative], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, relative), 'utf8');
    const start = source.indexOf(
      revision ? "  useAgentEvent('builder:request-prompt'" : "  useDecodedAgentEvent('builder:request-prompt'",
    );
    const end = source.indexOf('// 把 submitting 广播', start);
    assert.ok(start >= 0 && end > start);
    const code = harness.transformSync(source.slice(start, end), { filename: path.join(root, relative) });
    assert.ok(code?.code);
    const bus = makeBus();
    let draft = '',
      name = '',
      version = '',
      edits: unknown[] = [],
      prechecks = 0;
    let messages: unknown[] = [
      {
        role: 'assistant',
        agentName: 'planner',
        parts: [{ kind: 'plan-card', artifactId: 'a', versionId: 'v', name: 'old' }],
      },
    ];
    const filesRef: { current: unknown } = { current: {} };
    const appMetaRef = { current: { name: '' } };
    const submitted: unknown[][] = [];
    const kickoff = { current: false };
    let id = 0;
    const names = [
      'useAgentEvent',
      'useDecodedAgentEvent',
      'decodePromptEvent',
      'decodeAskReply',
      'decodeBuilderEdit',
      'decodeFilesEvent',
      'decodeAppNameEvent',
      'decodePlanMetaEvent',
      'decodeGenerateEvent',
      'setDraft',
      'submitPrompt',
      'messages',
      'buildEmbedFence',
      'ASK_REPLY_SUFFIX',
      'setPendingEdits',
      'uid',
      'filesRef',
      'appMetaRef',
      'setCurrentAppName',
      'setActiveVersionLabel',
      'setMessages',
      'anonymous',
      'onRequestBuild',
      'isSingleMingoPlan',
      'requireMobileOverviewBuildConfirm',
      'buildKickoffRef',
      'runBuildPrecheck',
      'bus',
      '_l',
    ];
    const applyArray = (value: unknown, current: unknown[]): unknown[] => {
      const next: unknown = typeof value === 'function' ? Reflect.apply(value, undefined, [current]) : value;
      if (!Array.isArray(next)) throw new TypeError('Expected actual array update');
      return next;
    };
    new Function(...names, code.code)(
      (topic: string, handler: AgentEventHandler) => bus.on(topic, handler),
      (topic: string, decode: unknown, handler: unknown) =>
        invoke(actual, 'subscribeDecodedAgentEvent', bus, topic, decode, handler),
      codecs['decodePromptEvent'],
      codecs['decodeAskReply'],
      codecs['decodeBuilderEdit'],
      codecs['decodeFilesEvent'],
      codecs['decodeAppNameEvent'],
      codecs['decodePlanMetaEvent'],
      codecs['decodeGenerateEvent'],
      (value: string) => {
        draft = value;
      },
      (...args: unknown[]) => submitted.push(args),
      messages,
      (suffix: string, data: unknown) => JSON.stringify({ suffix, data }),
      'ask_reply',
      (value: unknown) => {
        edits = applyArray(value, edits);
      },
      () => `edit-${++id}`,
      filesRef,
      appMetaRef,
      (value: string) => {
        name = value;
      },
      (value: string) => {
        version = value;
      },
      (value: unknown) => {
        messages = applyArray(value, messages);
      },
      false,
      () => {},
      false,
      false,
      kickoff,
      () => {
        prechecks += 1;
        return Promise.resolve(true);
      },
      bus,
      (value: string) => value,
    );
    return { bus, filesRef, snapshot: () => ({ draft, name, version, edits, messages, submitted, prechecks }) };
  }
  async function scenario(value: ReturnType<typeof receiver>) {
    value.bus.emit('builder:request-prompt', { text: 'draft' });
    value.bus.emit('builder:submit-prompt', { text: 'send' });
    value.bus.emit('ask:submit', { answers: [{ questionId: 'q', answer: 'A' }] });
    value.bus.emit('builder:add-edit', { module: '角色', card: '员工', text: 'first' });
    value.bus.emit('builder:add-edit', { module: '角色', card: '员工', text: 'replace' });
    value.bus.emit('builder:add-edit', { text: 'extra-only' });
    const files = { '/plan.md': { content: '# plan', parsed: '# plan', status: 'ready' } };
    value.bus.emit('builder:files-sync', { files });
    assert.equal(value.filesRef.current, files);
    value.bus.emit('app:meta', { name: 'new app', versionLabel: 'v1' });
    value.bus.emit('plan-card:meta', {
      artifactId: 'a',
      versionId: 'v',
      appIcon: 'sys_1',
      appColor: '#123',
      appName: 'resolved',
    });
    value.bus.emit('builder:generate', { files, source: 'mobile-overview' });
    value.bus.emit('builder:generate', { files, source: 'mobile-overview' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(value.snapshot().prechecks, 1, 'Repeated generate waits for the same kickoff');
    return value.snapshot();
  }
  const current = receiver();
  const snapshot = await scenario(current);
  if (before)
    assert.deepEqual(
      snapshot,
      await scenario(receiver(before)),
      'Normal chat subscriptions retain historical behavior',
    );
  for (const [topic, payload] of [
    ['builder:request-prompt', { text: {} }],
    ['builder:submit-prompt', null],
    ['builder:add-edit', { text: 3 }],
    ['builder:files-sync', { files: { p: null } }],
    ['app:meta', { name: [] }],
    ['plan-card:meta', null],
  ] as const)
    current.bus.emit(topic, payload);
  assert.deepEqual(current.snapshot(), snapshot, 'Malformed event payloads do not change chat receiver state');
  await openBuilderRegression();
}
async function openBuilderRegression() {
  const relative = 'src/components/Agent/ChatPanel.tsx';
  async function scenario(revision?: string, mobile = false) {
    const source = revision
      ? cp.execFileSync('git', ['show', revision + ':' + relative], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, relative), 'utf8');
    const start = source.indexOf(revision ? "  useAgentEvent('builder:open'" : "  useDecodedAgentEvent('builder:open'");
    const end = source.indexOf(
      revision ? "  useAgentEvent('builder:request-prompt'" : "  useDecodedAgentEvent('builder:request-prompt'",
      start,
    );
    assert.ok(start >= 0 && end > start);
    const code = harness.transformSync(source.slice(start, end), { filename: path.join(root, relative) });
    assert.ok(code?.code);
    const bus = makeBus(),
      wait = (() => {
        let finish: (() => void) | undefined;
        const promise = new Promise<void>(resolve => {
          finish = resolve;
        });
        if (!finish) throw new Error('Missing loader completion');
        return { promise, finish };
      })();
    const events: unknown[] = [];
    const loads: unknown[] = [];
    const selected: { current: unknown } = { current: undefined };
    let reveals = 0;
    for (const topic of ['app:meta', 'mobile:open-overview']) bus.on(topic, payload => events.push({ topic, payload }));
    const names = [
      'useAgentEvent',
      'useDecodedAgentEvent',
      'decodeBuilderOpenEvent',
      'deferCommittedAppMetaUntilFilesLoaded',
      'customLoadCommittedArtifactFiles',
      'selectedVerRef',
      'bus',
      'loadCommittedArtifactFilesOnce',
      'isMobile',
      'disableAppBuilder',
      'revealAppBuilder',
    ];
    new Function(...names, code.code)(
      (topic: string, handler: AgentEventHandler) => bus.on(topic, handler),
      (topic: string, decode: unknown, handler: unknown) =>
        invoke(actual, 'subscribeDecodedAgentEvent', bus, topic, decode, handler),
      codecs['decodeBuilderOpenEvent'],
      true,
      () => {},
      selected,
      bus,
      (options: unknown) => {
        loads.push(options);
        return wait.promise;
      },
      mobile,
      false,
      () => {
        reveals += 1;
      },
    );
    const payload = {
      artifactId: 'a',
      versionId: 'v',
      name: 'App',
      versionLabel: 'v1',
      source: 'plan-card',
      appId: 'app',
      built: true,
      appIcon: 'icon',
      appColor: '#123',
    };
    bus.emit('builder:open', payload);
    assert.equal(events.length, 0, 'Deferred metadata waits until committed files are loaded');
    assert.equal(reveals, mobile ? 0 : 1);
    wait.finish();
    await Promise.resolve();
    await Promise.resolve();
    // The mobile transport may include normalized fields, so compare its actual consumer fields.
    return {
      loads,
      selected: selected.current,
      reveals,
      events: events.map(event => {
        assert.ok(record(event));
        const value = event['payload'];
        assert.ok(record(value));
        return {
          topic: event['topic'],
          artifactId: value['artifactId'],
          versionId: value['versionId'],
          appId: value['appId'],
          built: value['built'],
          name: value['name'],
          versionLabel: value['versionLabel'],
        };
      }),
    };
  }
  for (const mobile of [false, true]) {
    const actual = await scenario(undefined, mobile);
    if (before)
      assert.deepEqual(
        actual,
        await scenario(before, mobile),
        'Committed builder open keeps loading, identity and mobile ordering',
      );
  }
}
