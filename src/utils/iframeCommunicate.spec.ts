const assert = require('node:assert/strict');
const path = require('node:path');
const { transformFileSync } = require('../../scripts/spec-harness.ts');
interface Frame {
  window: Frame;
  postMessage(data: unknown, origin: string): void;
}
interface Event {
  data: unknown;
  source: Frame | null | object;
}
interface Pending {
  timestamp: number;
  resolve(value: unknown): void;
  reject(error: Error): void;
}
interface Bridge {
  timeout: number;
  tunnelId: string;
  pendingPromises: Map<string, Pending>;
  call(method: string, params?: unknown, decode?: (value: unknown) => unknown): Promise<unknown>;
  handleResponse(event: Event): void;
  cleanup(): void;
  destroy(): void;
}
interface Handler {
  handlers: Map<string, (params: unknown) => unknown>;
  processingRequests: Map<Frame, Set<string>>;
  register(method: string, handler: (params: unknown) => unknown, decode?: (params: unknown) => unknown): void;
  handleMessage(event: Event): Promise<void>;
  destroy(): void;
}
interface Api {
  ParentBridge: new (options?: { tunnelId?: string }) => Bridge;
  MessageHandler: new (options?: { tunnelId?: string; getSource?: () => Frame | null }) => Handler;
}
interface Wire {
  type: string;
  messageId: string;
  tunnelId?: string;
  methodName?: string;
  params?: unknown;
  success?: boolean;
  data?: unknown;
  error?: string;
}
const listeners = new Set<(event: Event) => void>();
const sent: Wire[] = [];
let postError: unknown;
let now = 100;
let nextTimer = 1;
const timers = new Map<number, { at: number; callback: () => void }>();
const parentFrame: Frame = {
  get window() {
    return parentFrame;
  },
  postMessage(data: Wire, origin: string) {
    assert.equal(origin, '*');
    if (postError) throw postError;
    sent.push(data);
  },
};
const localWindow = {
  parent: parentFrame,
  addEventListener(type: string, callback: (event: Event) => void) {
    assert.equal(type, 'message');
    listeners.add(callback);
  },
  removeEventListener(type: string, callback: (event: Event) => void) {
    assert.equal(type, 'message');
    listeners.delete(callback);
  },
};
const moduleLike: { exports: Partial<Api> } = { exports: {} };
const { code } = transformFileSync(path.join(__dirname, 'iframeCommunicate.ts'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'window', 'setTimeout', 'clearTimeout', 'Date', code)(
  moduleLike,
  moduleLike.exports,
  localWindow,
  (callback: () => void, delay: number) => {
    const id = nextTimer++;
    timers.set(id, { at: now + delay, callback });
    return id;
  },
  (id: number) => timers.delete(id),
  { now: () => now },
);
const api = moduleLike.exports as Api;
function advance(milliseconds: number): void {
  now += milliseconds;
  for (const [id, timer] of timers)
    if (timer.at <= now) {
      timers.delete(id);
      timer.callback();
    }
}
function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { resolve, reject, promise };
}
function lastSent(): Wire {
  const last = sent.at(-1);
  if (!last) throw new Error('Missing bridge wire');
  return last;
}
function frame(): { source: Frame; messages: Wire[] } {
  const messages: Wire[] = [];
  const source: Frame = {
    get window() {
      return source;
    },
    postMessage(data: Wire, origin: string) {
      assert.equal(origin, '*');
      messages.push(data);
    },
  };
  return { source, messages };
}
function request(
  messageId: string,
  methodName = 'echo',
  params: unknown = { text: 'value', extra: 1 },
  tunnelId = 'field',
): Wire {
  return { type: 'IFRAME_REQUEST', messageId, methodName, params, tunnelId };
}
async function run(): Promise<void> {
  const bridge = new api.ParentBridge({ tunnelId: 'field' });
  assert.equal(listeners.size, 1);
  const params = { pageIndex: 2, nested: { rowid: 7 }, extra: ['keep'] };
  const pending = bridge.call('getRowsForRelation', params);
  const wire = lastSent();
  assert.deepEqual(Object.keys(wire), ['type', 'tunnelId', 'methodName', 'params', 'messageId']);
  assert.equal(wire.params, params);
  assert.equal(wire.methodName, 'getRowsForRelation');
  assert.equal(wire.tunnelId, 'field');
  const other = frame();
  const response = {
    type: 'IFRAME_RESPONSE',
    messageId: wire.messageId,
    success: true,
    data: { data: [{ rowid: 'r', arbitrary: { rowid: 7 } }], count: 1, metadata: { keep: true } },
  };
  bridge.handleResponse({ source: other.source, data: response });
  assert.equal(bridge.pendingPromises.size, 1);
  bridge.handleResponse({ source: parentFrame, data: { ...response, tunnelId: 'different' } });
  assert.equal(bridge.pendingPromises.size, 1);
  bridge.handleResponse({ source: parentFrame, data: response });
  assert.equal(await pending, response.data);
  assert.equal(bridge.pendingPromises.size, 0);
  assert.equal(timers.size, 0);
  const decoded = bridge.call('title', {}, value => {
    if (typeof value !== 'string') throw new TypeError('Expected title');
    return value.toUpperCase();
  });
  bridge.handleResponse({
    source: parentFrame,
    data: { type: 'IFRAME_RESPONSE', messageId: lastSent().messageId, success: true, data: 'title' },
  });
  assert.equal(await decoded, 'TITLE');
  const invalidDecoded = bridge.call('title', {}, value => {
    if (typeof value !== 'string') throw new TypeError('Expected title');
    return value;
  });
  bridge.handleResponse({
    source: parentFrame,
    data: { type: 'IFRAME_RESPONSE', messageId: lastSent().messageId, success: true, data: 42 },
  });
  await assert.rejects(invalidDecoded, /Expected title/);
  assert.equal(bridge.pendingPromises.size, 0);
  assert.equal(timers.size, 0);
  for (const value of [null, 4, [], 'string', { type: 'IFRAME_RESPONSE', messageId: 4, success: true }])
    bridge.handleResponse({ source: parentFrame, data: value });
  for (const bad of [{ success: 'true' }, { success: false, error: {} }]) {
    const result = bridge.call('bad', undefined);
    const id = lastSent().messageId;
    bridge.handleResponse({ source: parentFrame, data: { type: 'IFRAME_RESPONSE', messageId: id, ...bad } });
    await assert.rejects(result, /Invalid iframe response/);
    assert.equal(timers.size, 0);
  }
  const failed = bridge.call('failed', undefined);
  bridge.handleResponse({
    source: parentFrame,
    data: { type: 'IFRAME_RESPONSE', messageId: lastSent().messageId, success: false, error: 'failed detail' },
  });
  await assert.rejects(failed, /failed detail/);
  postError = new Error('Cannot clone payload');
  await assert.rejects(bridge.call('clone', {}), /Cannot clone payload/);
  postError = undefined;
  assert.equal(bridge.pendingPromises.size, 0);
  assert.equal(timers.size, 0);
  bridge.timeout = 10;
  const expired = bridge.call('slow', 1);
  const expiredId = lastSent().messageId;
  advance(11);
  await assert.rejects(expired, /Call to slow timed out after 10ms/);
  assert.equal(bridge.pendingPromises.size, 0);
  assert.equal(timers.size, 0);
  bridge.handleResponse({
    source: parentFrame,
    data: { type: 'IFRAME_RESPONSE', messageId: expiredId, success: true, data: 'late' },
  });
  const cleaned = bridge.call('cleanup', {});
  now += 11;
  bridge.cleanup();
  await assert.rejects(cleaned, /Request timeout/);
  assert.equal(timers.size, 0);
  const abandoned = bridge.call('destroy', {});
  bridge.destroy();
  bridge.destroy();
  await assert.rejects(abandoned, /Parent bridge destroyed/);
  assert.equal(listeners.size, 0);
  assert.equal(timers.size, 0);
  await assert.rejects(bridge.call('after', {}), /Parent bridge destroyed/);
  const target = frame();
  const handler = new api.MessageHandler({ tunnelId: 'field', getSource: () => target.source });
  assert.equal(listeners.size, 1);
  let received: unknown;
  handler.register('echo', value => {
    received = value;
    return { extra: value, responseMetadata: ['keep'] };
  });
  const wireRequest = request('first');
  await handler.handleMessage({ source: target.source, data: wireRequest });
  assert.equal(received, wireRequest.params);
  assert.deepEqual(target.messages[0], {
    type: 'IFRAME_RESPONSE',
    messageId: 'first',
    success: true,
    data: { extra: wireRequest.params, responseMetadata: ['keep'] },
  });
  const beforeWrong = target.messages.length;
  for (const data of [
    null,
    [],
    5,
    request('wrong-tunnel', 'echo', {}, 'other'),
    { ...request('bad-id'), messageId: 5 },
    { ...request('bad-method'), methodName: false },
  ])
    await handler.handleMessage({ source: target.source, data });
  await handler.handleMessage({ source: null, data: request('null') });
  await handler.handleMessage({ source: { postMessage() {} }, data: request('port') });
  await handler.handleMessage({ source: other.source, data: request('wrong-frame') });
  assert.equal(target.messages.length, beforeWrong);
  assert.equal(handler.processingRequests.size, 0);
  await handler.handleMessage({ source: target.source, data: request('missing', 'missing') });
  assert.deepEqual(target.messages.at(-1), {
    type: 'IFRAME_RESPONSE',
    messageId: 'missing',
    success: false,
    error: 'Method missing not found',
  });
  handler.register('reject', () => Promise.reject({ message: 'asynchronous failure' }));
  await handler.handleMessage({ source: target.source, data: request('reject', 'reject') });
  assert.equal(target.messages.at(-1)?.error, 'asynchronous failure');
  handler.register('throw', () => {
    throw 'primitive failure';
  });
  await handler.handleMessage({ source: target.source, data: request('throw', 'throw') });
  assert.equal(target.messages.at(-1)?.error, 'primitive failure');
  handler.register(
    'decoded',
    value => value,
    value => {
      if (typeof value !== 'number') throw new TypeError('Expected number');
      return value * 2;
    },
  );
  await handler.handleMessage({ source: target.source, data: request('decode-bad', 'decoded', 'bad') });
  assert.equal(target.messages.at(-1)?.error, 'Expected number');
  await handler.handleMessage({ source: target.source, data: request('decode-good', 'decoded', 3) });
  assert.equal(target.messages.at(-1)?.data, 6);
  const wait = deferred<unknown>();
  let concurrentCalls = 0;
  handler.register('wait', () => {
    concurrentCalls++;
    return wait.promise;
  });
  const first = handler.handleMessage({ source: target.source, data: request('same', 'wait') });
  await handler.handleMessage({ source: target.source, data: request('same', 'wait') });
  assert.equal(concurrentCalls, 1);
  wait.resolve({ result: true });
  await first;
  assert.equal(handler.processingRequests.size, 0);
  await handler.handleMessage({ source: target.source, data: request('same', 'wait') });
  assert.equal(concurrentCalls, 2, 'Deduplication covers in-flight requests, preserving completed-ID reuse');
  const receiverThrows: Frame = {
    get window() {
      return receiverThrows;
    },
    postMessage() {
      throw new Error('Closed receiver');
    },
  };
  const permissive = new api.MessageHandler({ tunnelId: 'field' });
  permissive.register('echo', params => params);
  await assert.doesNotReject(() => permissive.handleMessage({ source: receiverThrows, data: request('closed') }));
  assert.equal(permissive.processingRequests.size, 0);
  const a = frame(),
    b = frame();
  const twoFrames = deferred<unknown>();
  let frameCalls = 0;
  permissive.register('wait', () => {
    frameCalls++;
    return twoFrames.promise;
  });
  const one = permissive.handleMessage({ source: a.source, data: request('same-id', 'wait') }),
    two = permissive.handleMessage({ source: b.source, data: request('same-id', 'wait') });
  assert.equal(frameCalls, 2, 'Message IDs belong to their actual source frame');
  twoFrames.resolve('done');
  await Promise.all([one, two]);
  assert.equal(a.messages.length, 1);
  assert.equal(b.messages.length, 1);
  const unmount = deferred<unknown>();
  handler.register('wait', () => unmount.promise);
  const active = handler.handleMessage({ source: target.source, data: request('unmount', 'wait') });
  const messagesBeforeUnmount = target.messages.length;
  handler.destroy();
  handler.destroy();
  unmount.resolve('after destroy');
  await active;
  assert.equal(target.messages.length, messagesBeforeUnmount);
  assert.equal(handler.handlers.size, 0);
  assert.equal(handler.processingRequests.size, 0);
  assert.throws(() => handler.register('after', () => {}), /destroyed/);
  permissive.destroy();
  const unavailableSource = new api.MessageHandler({
    tunnelId: 'field',
    getSource: () => {
      throw new Error('Frame unavailable');
    },
  });
  await assert.doesNotReject(() => unavailableSource.handleMessage({ source: target.source, data: request('getter') }));
  assert.equal(unavailableSource.processingRequests.size, 0);
  unavailableSource.destroy();
  assert.equal(listeners.size, 0);
  assert.equal(timers.size, 0);
  console.log(
    'Actual iframe bridge envelopes, source/tunnel filtering, unknown decoders, timeout/destroy and request error/clone/dedup behavior passed',
  );
}
run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
