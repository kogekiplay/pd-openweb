import type { SpecHarness } from '../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const harness: SpecHarness = require('../../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../../..');
const sourcePath = 'src/pages/worksheet/components/GenScanUploadQr.tsx';
const historical = process.env['SCAN_UPLOAD_BEFORE_REV'];

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function read(value: unknown, key: string): unknown {
  if (!object(value)) throw new TypeError('Invalid observation');
  return value[key];
}
function call(value: unknown, ...args: unknown[]): unknown {
  if (typeof value !== 'function') throw new TypeError('Missing observed function');
  return Reflect.apply(value, undefined, args);
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
function find(
  value: unknown,
  test: (type: unknown, props: Record<string, unknown>) => boolean,
): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = find(item, test);
      if (found) return found;
    }
  } else if (React.isValidElement<Record<string, unknown>>(value)) {
    if (test(value.type, value.props)) return value.props;
    return find(value.props['children'], test);
  }
  return undefined;
}

interface Hook {
  kind: string;
  value?: unknown;
  deps?: unknown[] | undefined;
  cleanup?: (() => unknown) | undefined;
}
class Host {
  hooks: Hook[] = [];
  effects: Array<() => void> = [];
  cursor = 0;
  writes = 0;
  result: unknown;
  hook(kind: string): Hook {
    const index = this.cursor++;
    let slot = this.hooks[index];
    if (!slot) {
      slot = { kind };
      this.hooks[index] = slot;
    }
    assert.equal(slot.kind, kind);
    return slot;
  }
  render(component: unknown, props: unknown) {
    this.cursor = 0;
    this.result = call(component, props);
    for (const effect of this.effects.splice(0)) effect();
    return this.result;
  }
  unmount() {
    for (const hook of this.hooks) {
      hook.cleanup?.();
      hook.cleanup = undefined;
    }
  }
}

interface Request {
  args: Record<string, unknown>;
  pending: ReturnType<typeof deferred>;
}
function fixture(old = false, context: unknown = {}) {
  const links: Request[] = [],
    polls: Request[] = [],
    stopped: unknown[] = [],
    emitted: unknown[] = [],
    visibility: unknown[] = [];
  const timers = new Map<number, () => unknown>();
  const moduleCache = new Map<string, unknown>();
  let timerId = 0;
  let host = new Host();
  const hooks = {
    ...React,
    useState(initial: unknown) {
      const slot = host.hook('state');
      if (!('value' in slot)) slot.value = typeof initial === 'function' ? call(initial) : initial;
      const owner = host;
      return [
        slot.value,
        (next: unknown) => {
          slot.value = typeof next === 'function' ? call(next, slot.value) : next;
          owner.writes++;
        },
      ];
    },
    useRef(initial: unknown) {
      const slot = host.hook('ref');
      if (!('value' in slot)) slot.value = { current: initial };
      return slot.value;
    },
    useContext() {
      return context;
    },
    useCallback(fn: unknown, deps: unknown[]) {
      const slot = host.hook('callback');
      if (!slot.deps || deps.some((dep, i) => !Object.is(dep, slot.deps?.[i]))) {
        slot.value = fn;
        slot.deps = deps;
      }
      return slot.value;
    },
    useEffect(effect: () => unknown, deps: unknown[]) {
      const slot = host.hook('effect');
      if (!slot.deps || deps.some((dep, i) => !Object.is(dep, slot.deps?.[i]))) {
        slot.deps = deps;
        host.effects.push(() => {
          slot.cleanup?.();
          const cleanup = effect();
          slot.cleanup = typeof cleanup === 'function' ? () => call(cleanup) : undefined;
        });
      }
    },
  };
  const api = {
    getAttachmentScanUrl(args: Record<string, unknown>) {
      const request = { args, pending: deferred() };
      links.push(request);
      return request.pending.promise;
    },
    getScanAttachments(args: Record<string, unknown>) {
      const request = { args, pending: deferred() };
      polls.push(request);
      return request.pending.promise;
    },
    stopAttachmentScanUrl(args: unknown) {
      stopped.push(args);
      return Promise.resolve();
    },
  };
  function load(file: string): unknown {
    const cached = moduleCache.get(file);
    if (cached) return cached;
    let source =
      old && historical && file === sourcePath
        ? execFileSync('git', ['show', historical + ':' + file], { cwd: root, encoding: 'utf8' })
        : fs.readFileSync(path.join(root, file), 'utf8');
    if (file === 'src/utils/common.ts') {
      // Run the real converter without loading unrelated browser side effects.
      const tree = harness.parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
      const names = ['getTemporaryAttachmentFromUrl', 'generateFileOId'];
      const functions = tree.program.body.filter(node => {
        const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
        if (declaration?.type === 'FunctionDeclaration') return names.includes(declaration.id?.name || '');
        return (
          declaration?.type === 'VariableDeclaration' &&
          declaration.declarations.some(item => item.id.type === 'Identifier' && names.includes(item.id.name))
        );
      });
      assert.equal(functions.length, 2);
      const original = source;
      source =
        "import { validateTemporaryAttachment } from 'src/utils/commonRequestBoundary';\n" +
        functions
          .map(node => {
            if (typeof node.start !== 'number' || typeof node.end !== 'number')
              throw new TypeError('Missing source offsets');
            return original.slice(node.start, node.end);
          })
          .join('\n');
    }
    const compiled = harness.transformSync(source, {
      filename: path.join(root, file),
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    assert.ok(compiled?.code);
    const target: { exports: unknown } = { exports: {} };
    const imports = (name: string): unknown => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime' || name === 'lodash' || name === 'prop-types') return require(name);
      if (name === '@rc-component/trigger') return { __esModule: true, default: 'Trigger' };
      if (name === 'styled-components' || name === 'src/utils/typedStyled')
        return { __esModule: true, default: { div: () => 'Popup' } };
      if (name === 'ming-ui') return { LoadDiv: 'LoadDiv', Qr: 'Qr' };
      if (name === 'src/api/attachment') return { __esModule: true, default: api };
      if (name === 'worksheet/common/recordInfo/RecordInfoContext') return { __esModule: true, default: {} };
      if (name === 'worksheet/constants/enum') return { UPLOAD_TYPE: { ATTACHMENT: 1, SIGNATURE: 2 } };
      if (name === 'src/utils/common') return load('src/utils/common.ts');
      if (name === 'src/utils/commonRequestBoundary') return load('src/utils/commonRequestBoundary.ts');
      if (name === './scanUploadBoundary') return load('src/pages/worksheet/components/scanUploadBoundary.ts');
      throw new Error('Unexpected import: ' + name);
    };
    new Function('module', 'exports', 'require', '_l', 'md', 'window', 'setInterval', 'clearInterval', compiled.code)(
      target,
      target.exports,
      imports,
      (text: string) => text,
      { global: { Config: { WebUrl: 'https://oa.example/' } } },
      { innerHeight: 800, getCurrentLang: () => 'zh-Hans' },
      (fn: () => unknown) => {
        timers.set(++timerId, fn);
        return timerId;
      },
      (id: number) => timers.delete(id),
    );
    moduleCache.set(file, target.exports);
    return target.exports;
  }
  const component = read(load(sourcePath), 'default');
  const base = {
    worksheetId: 'sheet',
    viewId: 'view',
    controlId: 'control',
    rowId: 'row',
    children: React.createElement('div', { className: 'button' }),
    onScanResultUpdate: (value: unknown) => emitted.push(value),
  };
  const outerHost = host;
  let popupComponent: unknown,
    popupProps: Record<string, unknown> = {};
  return {
    links,
    polls,
    stopped,
    emitted,
    visibility,
    timers,
    outerHost,
    get host() {
      return host;
    },
    outer(overrides: Record<string, unknown> = {}) {
      host = outerHost;
      outerHost.render(component, { ...base, ...overrides });
      const trigger = find(outerHost.result, type => type === 'Trigger');
      assert.ok(trigger);
      return trigger;
    },
    mount(overrides: Record<string, unknown> = {}) {
      const trigger = this.outer(overrides);
      const popup = trigger['popup'];
      assert.ok(React.isValidElement<Record<string, unknown>>(popup));
      popupComponent = popup.type;
      popupProps = { ...popup.props, setPopupVisible: (value: unknown) => visibility.push(value) };
      host = new Host();
      this.render();
    },
    render(overrides: Record<string, unknown> = {}) {
      popupProps = { ...popupProps, ...overrides };
      return host.render(popupComponent, popupProps);
    },
    tick() {
      for (const timer of [...timers.values()]) timer();
    },
    refresh() {
      this.render();
      const refresh = find(host.result, (_type, props) => props['className'] === 'refresh Hand');
      assert.ok(refresh);
      call(refresh['onClick']);
    },
  };
}

const id1 = 'abcdefghijklmnop',
  id2 = '1234567890123456';
function link(id = id1) {
  return { scanUrl: 'https://oa.example/recordfileupload/' + id };
}
function response(url = 'https://files.example/a.png?token=first') {
  return { status: 1, attachmentScanSimpleDetail: [{ fileUrl: url, fileName: 'a.png', fileSize: 12 }] };
}
function latest(requests: Request[]): Request {
  const request = requests.at(-1);
  assert.ok(request);
  return request;
}

async function main() {
  for (const old of historical ? [false, true] : [false]) {
    for (const [overrides, context, sourceType, getType] of [
      [{}, {}, 1, undefined],
      [{ worksheetId: undefined }, {}, 3, undefined],
      [{ from: 'workflow' }, { recordBaseInfo: { fromIsWorkflow: true } }, 2, 9],
      [{}, { recordBaseInfo: { fromIsDraft: true, fromIsWorkflow: true } }, 1, 21],
    ] as const) {
      const f = fixture(old, context);
      f.mount(overrides);
      assert.deepEqual(latest(f.links).args, {
        sourceType,
        getType,
        fileType: 1,
        worksheetId: overrides.worksheetId === undefined && 'worksheetId' in overrides ? undefined : 'sheet',
        controlId: 'control',
        viewId: 'view',
        rowId: '',
      });
      latest(f.links).pending.resolve(link());
      await flush();
      f.render();
      const qr = find(f.host.result, type => type === 'Qr');
      assert.ok(qr);
      assert.equal(qr['content'], 'https://oa.example/recordfileupload/' + id1 + '?sys_lang=zh-Hans');
      f.tick();
      latest(f.polls).pending.resolve(response());
      await flush();
      assert.equal(f.emitted.length, 1);
      const delivered = f.emitted[0];
      assert.ok(Array.isArray(delivered));
      assert.equal(delivered.length, 1);
      assert.equal(read(delivered[0], 'url'), 'https://files.example/a.png?token=first');
      assert.equal(read(delivered[0], 'fileSize'), 12);
      assert.equal(read(delivered[0], 'originalFileName'), 'a');
      assert.equal(read(delivered[0], 'fileExt'), '.png');
      assert.match(String(read(delivered[0], 'fileID')), /^o_[a-z0-9]+$/);
      f.render();
      f.tick();
      latest(f.polls).pending.resolve(response('https://files.example/a.png?token=changed'));
      await flush();
      assert.equal(f.emitted.length, 1, 'URL query changes do not duplicate attachments');
      f.host.unmount();
      assert.equal(f.timers.size, 0);
      assert.ok(f.stopped.some(value => read(value, 'scanId') === id1));
    }
  }

  const placements = fixture();
  let outer = placements.outer();
  const child = outer['children'];
  assert.ok(React.isValidElement<Record<string, unknown>>(child));
  const ref = child.props['ref'];
  assert.ok(object(ref));
  call(outer['onPopupVisibleChange'], true);
  assert.equal(placements.outer()['popupVisible'], false, 'Missing anchor is safe');
  ref['current'] = { getBoundingClientRect: () => ({ bottom: 600 }) };
  call(outer['onPopupVisibleChange'], true);
  outer = placements.outer();
  assert.equal(outer['popupVisible'], true);
  assert.deepEqual(read(outer['popupAlign'], 'points'), ['bc', 'tc']);
  call(outer['onPopupVisibleChange'], false);
  outer = placements.outer();
  assert.equal(outer['popupVisible'], false);
  ref['current'] = { getBoundingClientRect: () => ({ bottom: 100 }) };
  call(outer['onPopupVisibleChange'], true);
  assert.deepEqual(read(placements.outer()['popupAlign'], 'points'), ['tc', 'bc']);

  for (const invalid of [
    null,
    {},
    { scanUrl: 3 },
    { scanUrl: 'https://oa.example/short' },
    { scanUrl: 'file:///abcdefghijklmnop' },
  ]) {
    const f = fixture();
    f.mount();
    latest(f.links).pending.resolve(invalid);
    await flush();
    f.render();
    assert.equal(f.timers.size, 0);
    assert.ok(find(f.host.result, (_type, props) => props['className'] === 'expired error'));
    assert.equal(
      find(f.host.result, type => type === 'LoadDiv'),
      undefined,
    );
    f.refresh();
    latest(f.links).pending.resolve(link());
    await flush();
    f.render();
    assert.ok(find(f.host.result, type => type === 'Qr'));
    assert.equal(f.timers.size, 1);
    f.host.unmount();
  }
  const linkFailure = fixture();
  linkFailure.mount();
  latest(linkFailure.links).pending.reject(new Error('offline'));
  await flush();
  linkFailure.render();
  assert.ok(find(linkFailure.host.result, (_type, props) => props['className'] === 'refresh Hand'));
  linkFailure.host.unmount();

  for (const invalid of [
    null,
    { status: '1' },
    { status: 1, attachmentScanSimpleDetail: {} },
    { status: 1, attachmentScanSimpleDetail: [null] },
    { status: 1, attachmentScanSimpleDetail: [{ fileUrl: 'bad' }] },
    { status: 1, attachmentScanSimpleDetail: [{ fileUrl: 'https://files.example/a', fileName: {} }] },
    { status: 1, attachmentScanSimpleDetail: [{ fileUrl: 'https://files.example/a', fileSize: Infinity }] },
  ]) {
    const f = fixture();
    f.mount();
    latest(f.links).pending.resolve(link());
    await flush();
    f.tick();
    latest(f.polls).pending.resolve(invalid);
    await flush();
    f.render();
    assert.equal(f.emitted.length, 0);
    assert.equal(f.timers.size, 0);
    assert.ok(find(f.host.result, (_type, props) => props['className'] === 'expired error'));
    f.host.unmount();
  }

  const concurrency = fixture();
  concurrency.mount();
  latest(concurrency.links).pending.resolve(link());
  await flush();
  concurrency.tick();
  concurrency.tick();
  assert.equal(concurrency.polls.length, 1, 'No overlapping polling requests');
  latest(concurrency.polls).pending.resolve(response());
  await flush();
  concurrency.tick();
  assert.equal(concurrency.polls.length, 2);
  latest(concurrency.polls).pending.reject(new Error('offline'));
  await flush();
  assert.equal(concurrency.timers.size, 0);
  concurrency.refresh();
  latest(concurrency.links).pending.resolve(link(id2));
  await flush();
  assert.equal(concurrency.timers.size, 1);
  concurrency.host.unmount();

  const signature = fixture();
  signature.mount({ type: 2 });
  latest(signature.links).pending.resolve(link());
  await flush();
  signature.tick();
  latest(signature.polls).pending.resolve(response());
  await flush();
  assert.deepEqual(signature.visibility, [false]);
  assert.equal(signature.timers.size, 0);
  signature.host.unmount();

  const expiry = fixture();
  expiry.mount();
  latest(expiry.links).pending.resolve(link());
  await flush();
  expiry.tick();
  latest(expiry.polls).pending.resolve({ status: 2 });
  await flush();
  expiry.render();
  assert.equal(expiry.timers.size, 0);
  assert.ok(find(expiry.host.result, (_type, props) => props['className'] === 'qrExpired'));
  expiry.refresh();
  latest(expiry.links).pending.resolve(link(id2));
  await flush();
  assert.equal(expiry.timers.size, 1);
  assert.ok(expiry.stopped.some(value => read(value, 'scanId') === id1));
  expiry.host.unmount();

  const lateLink = fixture();
  lateLink.mount();
  lateLink.host.unmount();
  const linkWrites = lateLink.host.writes;
  latest(lateLink.links).pending.resolve(link());
  await flush();
  assert.equal(lateLink.timers.size, 0);
  assert.equal(lateLink.host.writes, linkWrites);
  assert.ok(lateLink.stopped.some(value => read(value, 'scanId') === id1));
  const latePoll = fixture();
  latePoll.mount();
  latest(latePoll.links).pending.resolve(link());
  await flush();
  latePoll.tick();
  latePoll.host.unmount();
  const pollWrites = latePoll.host.writes;
  latest(latePoll.polls).pending.resolve(response());
  await flush();
  assert.equal(latePoll.emitted.length, 0);
  assert.equal(latePoll.host.writes, pollWrites);
  const changed = fixture();
  changed.mount();
  const stale = latest(changed.links);
  changed.render({ worksheetId: 'new-sheet' });
  latest(changed.links).pending.resolve(link(id2));
  await flush();
  stale.pending.resolve(link());
  await flush();
  changed.render();
  assert.equal(changed.timers.size, 1);
  assert.ok(changed.stopped.some(value => read(value, 'scanId') === id1));
  assert.equal(
    read(
      find(changed.host.result, type => type === 'Qr'),
      'content',
    ),
    'https://oa.example/recordfileupload/' + id2 + '?sys_lang=zh-Hans',
  );
  changed.host.unmount();
  const rerender = fixture();
  rerender.mount();
  latest(rerender.links).pending.resolve(link());
  await flush();
  const updated: unknown[] = [];
  rerender.render({ onScanResultUpdate: (value: unknown) => updated.push(value) });
  assert.equal(rerender.links.length, 1, 'Changing callbacks keeps the current scan');
  rerender.tick();
  latest(rerender.polls).pending.resolve(response());
  await flush();
  assert.equal(updated.length, 1);
  assert.equal(rerender.emitted.length, 0);
  rerender.host.unmount();

  const refreshRace = fixture();
  refreshRace.mount();
  latest(refreshRace.links).pending.resolve(link());
  await flush();
  refreshRace.tick();
  latest(refreshRace.polls).pending.resolve({ status: 2 });
  await flush();
  refreshRace.render();
  const refreshButton = find(refreshRace.host.result, (_type, props) => props['className'] === 'refresh Hand');
  assert.ok(refreshButton);
  call(refreshButton['onClick']);
  const firstRefresh = latest(refreshRace.links);
  call(refreshButton['onClick']);
  latest(refreshRace.links).pending.resolve(link(id2));
  await flush();
  firstRefresh.pending.resolve(link());
  await flush();
  assert.equal(refreshRace.timers.size, 1, 'Only the newest refresh owns a polling timer');
  refreshRace.host.unmount();

  const oldPoll = fixture();
  oldPoll.mount();
  latest(oldPoll.links).pending.resolve(link());
  await flush();
  oldPoll.tick();
  const pendingOldPoll = latest(oldPoll.polls);
  oldPoll.render({ rowId: 'different-row' });
  latest(oldPoll.links).pending.resolve(link(id2));
  await flush();
  pendingOldPoll.pending.resolve(response());
  await flush();
  assert.equal(oldPoll.emitted.length, 0, 'A previous record cannot deliver attachments to the new record');
  assert.equal(oldPoll.timers.size, 1);
  oldPoll.host.unmount();

  const callbackFailure = fixture();
  callbackFailure.mount({
    onScanResultUpdate: () => {
      throw new Error('consumer rejected attachment');
    },
  });
  latest(callbackFailure.links).pending.resolve(link());
  await flush();
  callbackFailure.tick();
  latest(callbackFailure.polls).pending.resolve(response());
  await flush();
  callbackFailure.render();
  assert.equal(callbackFailure.timers.size, 0);
  assert.ok(find(callbackFailure.host.result, (_type, props) => props['className'] === 'expired error'));
  callbackFailure.host.unmount();

  const boundary = fixture();
  boundary.mount();
  latest(boundary.links).pending.resolve(link());
  await flush();
  boundary.tick();
  const sparse = new Array<unknown>(1);
  latest(boundary.polls).pending.resolve({ status: 1, attachmentScanSimpleDetail: sparse });
  await flush();
  assert.equal(boundary.emitted.length, 0, 'Sparse attachment arrays are rejected before conversion');
  assert.equal(boundary.timers.size, 0);
  boundary.host.unmount();
  console.log(
    JSON.stringify({
      sourceModes: 4,
      invalidLinks: 5,
      invalidPolls: 7,
      lifecycleAndRetry: true,
      historicalAB: !!historical,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
