/** Whole Window/entry/API/utility/action/reducer modules; only SDK, socket host and UI/bootstrap leaves are controlled. */
import type { SpecHarness } from '../spec-harness';
const harness: SpecHarness = require('../spec-harness.ts');
const path: typeof import('node:path') = require('node:path');
const fs: typeof import('node:fs') = require('node:fs');
type Data = Record<string, unknown>;
interface Element { type: unknown; key?: unknown; props: Data; }
interface Subject {
  props: Data; state: Data;
  componentDidMount(): void;
  setState(patch: Data): void;
  render(): Element;
}
type Constructor = new (props: Data) => Subject;
interface Call { controller: string; action: string; args: Data; options: Data; }
function makeFixture() {
  const cache = new Map<string, Data>();
  const calls: Call[] = [], trace: string[] = [], dispatched: Data[] = [];
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const listeners = new Map<string, () => void>();
  const storage = new Map<string, string>(), opened: unknown[][] = [];
  const contacts: unknown[] = [], children: Promise<unknown>[] = [];
  const md = { global: { Account: { accountId: 'self', isPortal: false, messageListShowType: 0 } } };
  const localStorage = { getItem: (key: string) => storage.get(key) ?? null, removeItem: (key: string) => { trace.push('remove:' + key); storage.delete(key); } };
  Reflect.set(globalThis, 'md', md); Reflect.set(globalThis, 'localStorage', localStorage);
  Reflect.set(globalThis, '_l', (text: string) => text);
  Reflect.set(globalThis, 'safeLocalStorageSetItem', (key: string, value: string) => { trace.push('store:' + key); storage.set(key, value); });
  Reflect.set(globalThis, 'window', { md, localStorage, innerHeight: 900, screen: { availHeight: 1000, availWidth: 1400 }, open: (...args: unknown[]) => { opened.push(args); }, addEventListener: (name: string, callback: () => void) => { trace.push('listen:' + name); listeners.set(name, callback); } });
  Reflect.set(globalThis, 'document', { getElementById: () => ({ id: 'app' }) });
  Reflect.set(globalThis, 'location', { search: '' });
  Reflect.set(globalThis, 'IM', { socket: { on: (name: string, callback: (...args: unknown[]) => void) => { trace.push('on:' + name); handlers.set(name, callback); } } });
  const Leaf = () => null;
  const contact = { Contact: { setCurrentChat: (value: unknown) => { trace.push('contact'); contacts.push(value); }, recordAction: () => { trace.push('record'); } } };
  let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
  const request = Object.assign(new Promise<unknown>((yes, no) => { resolve = yes; reject = no; }), { abort() { trace.push('abort'); } });
  const then = request.then.bind(request);
  Object.defineProperty(request, 'then', { value: (...args: Parameters<typeof then>) => { trace.push('then'); const child = then(...args); children.push(child); void child.catch(() => {}); return child; } });
  let sdkResult: unknown = request, sdkFailure: unknown;
  const sdk = (controller: string, action: string, args: Data, options: Data) => {
    trace.push('sdk:' + controller + '.' + action); calls.push({ controller, action, args, options });
    if (sdkFailure !== undefined) throw sdkFailure;
    return sdkResult;
  };
  function load(file: string): Data {
    if (cache.has(file)) return cache.get(file)!;
    const transformed = harness.transformFileSync(path.join(harness.ROOT, file));
    if (!transformed?.code) throw new Error('Missing compiled module ' + file);
    const module = { exports: {} as Data }; cache.set(file, module.exports);
    const localRequire = (name: string): unknown => {
      if (/\.(less|css|html)$/.test(name)) return '';
      if (name === 'src/common/preall') return (Type: unknown) => Type;
      if (name === 'src/socket') return { socketInit: () => { trace.push('socketInit'); } };
      if (name === 'src/redux/configureStore') return {};
      if (name === 'src/router/navigateTo') return { navigateToLogin: () => { trace.push('login'); } };
      if (name === 'react-dom/client') return { createRoot: (container: unknown) => { if (!container) throw new TypeError('Missing root'); return { render: () => { trace.push('root'); } }; } };
      if (name.startsWith('ming-ui/')) return Leaf;
      if (name === '../ChatPanelSession') return Leaf;
      if (name === 'src/components/emotion/emotion') return {};
      if (name === 'src/utils/common') return { pathCompletion: (value: unknown) => value, htmlDecodeReg: (value: unknown) => value || '' };
      if (name === 'src/utils/project') return { dateConvertToUserZone: (value: unknown) => value };
      if (name === 'src/utils/pssId') return { getPssId: () => null };
      if (/^(src\/pages\/chat\/)?(\.\.\/)*utils\/socket$/.test(name) || name === './socket') return contact;
      const base = name.startsWith('src/') ? name : name.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), name)) : undefined;
      if (base) {
        const found = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(ext => base + ext).find(p => fs.existsSync(path.join(harness.ROOT, p)) && fs.statSync(path.join(harness.ROOT, p)).isFile());
        if (found) return load(found);
      }
      return require(name);
    };
    new Function('module', 'exports', 'require', 'mdyAPI', transformed.code)(module, module.exports, localRequire, sdk);
    return module.exports;
  }
  const reducer = load('src/pages/chat/redux/reducers.ts')['default'] as (state: Data | undefined, action: Data) => Data;
  let state = reducer(undefined, { type: '@@fixture' });
  function dispatch(value: unknown): unknown {
    if (typeof value === 'function') return value(dispatch, () => ({ chat: state }));
    const action = value as Data; trace.push('dispatch:' + action['type']); dispatched.push(action); state = reducer(state, action); return action;
  }
  const Window = (load('src/pages/chat/containers/ChatWindow/index.tsx')['default'] as { WrappedComponent: Constructor }).WrappedComponent;
  const Entry = load('src/pages/chat/detail.tsx')['default'] as new (props: Data) => { render(): Element };
  function windowFor(session: Data): Subject {
    const instance = new Window({ ...state, session, dispatch });
    instance.setState = patch => { trace.push('state:' + Object.keys(patch).join(',')); Object.assign(instance.state, patch); };
    return instance;
  }
  function entryFor(search: string): Element {
    Reflect.set(globalThis, 'location', { search }); return new Entry({}).render();
  }
  function nodes(value: unknown): Element[] {
    if (!value || typeof value !== 'object' || !('props' in value)) return [];
    const node = value as Element, children = node.props['children'];
    return [node, ...(Array.isArray(children) ? children.flat() : [children]).flatMap(nodes)];
  }
  return { load, calls, trace, dispatched, handlers, listeners, storage, opened, contacts, children, request, resolve, reject,
    windowFor, entryFor, nodes, dispatch, getState: () => state,
    setSdkResult: (result: unknown) => { sdkResult = result; }, setSdkFailure: (failure: unknown) => { sdkFailure = failure; } };
}
module.exports = { makeFixture };
export type ChatWindowFixture = ReturnType<typeof makeFixture>;
