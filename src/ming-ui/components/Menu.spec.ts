import type { SpecHarness } from '../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const { execFileSync }: typeof import('node:child_process') = require('node:child_process');
const React: typeof import('react') = require('react');
const ReactDOM: typeof import('react-dom/server') = require('react-dom/server');
const harness: SpecHarness = require('../../../scripts/spec-harness.ts');
const root = path.resolve(__dirname, '../../..');
const before = process.env['MENU_BEFORE_REV'];

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function read(value: unknown, key: string): unknown {
  assert.ok(object(value));
  return value[key];
}
function invoke(receiver: unknown, fn: unknown, ...args: unknown[]): unknown {
  assert.equal(typeof fn, 'function');
  if (typeof fn !== 'function') throw new TypeError('Missing observed function');
  return Reflect.apply(fn, receiver, args);
}

const brands = new WeakSet<object>();
class DomNode {
  children = new Set<unknown>();
  parentElement: { scrollTop: number } | null = null;
  offsetTop = 25;
  rect: { left: number; top: number; width: number; height: number; bottom: number };
  constructor(rect = { left: 10, top: 10, width: 100, height: 30, bottom: 40 }) {
    this.rect = rect;
    brands.add(this);
  }
  get nodeType() {
    if (!brands.has(this)) throw new TypeError('Not a DOM node');
    return 1;
  }
  contains(target: unknown) {
    return target === this || this.children.has(target);
  }
  getBoundingClientRect() {
    return this.rect;
  }
}
class Collection {
  [index: number]: DomNode;
  length: number;
  nodes: DomNode[];
  constructor(nodes: DomNode[]) {
    this.nodes = nodes;
    this.length = nodes.length;
    nodes.forEach((node, i) => {
      this[i] = node;
    });
  }
  toArray() {
    return this.nodes;
  }
  closest(value: unknown) {
    const targets = value instanceof Collection ? value.nodes : [];
    return new Collection(this.nodes.filter(node => targets.some(target => target.contains(node))));
  }
}
const selectors = new Map<string, DomNode[]>();
function jquery(value: unknown) {
  return value instanceof Collection
    ? value
    : new Collection(typeof value === 'string' ? selectors.get(value) || [] : value instanceof DomNode ? [value] : []);
}
jquery.prototype = Collection.prototype;
const documentRoot = new DomNode();
const body = new DomNode({ left: 0, top: 0, width: 500, height: 300, bottom: 300 });
const listeners = new Set<unknown>();
Reflect.set(globalThis, 'Node', DomNode);
Reflect.set(globalThis, 'window', { jQuery: jquery, innerWidth: 500, innerHeight: 300 });
Reflect.set(globalThis, 'document', {
  documentElement: Object.assign(documentRoot, { clientWidth: 500 }),
  body,
  querySelector: (selector: string) => selectors.get(selector)?.[0] || null,
  addEventListener: (_event: string, listener: unknown) => listeners.add(listener),
  removeEventListener: (_event: string, listener: unknown) => listeners.delete(listener),
});

function fixture(revision?: string, hooks = false) {
  const cache = new Map<string, Record<string, unknown>>();
  const values: { current: unknown }[] = [];
  const cleanups: unknown[] = [];
  let cursor = 0;
  const fakeReact = {
    ...React,
    useRef: (value: unknown) => {
      const index = cursor++;
      return values[index] || (values[index] = { current: value });
    },
    useCallback: (callback: unknown) => callback,
    useEffect: (callback: unknown) => {
      const cleanup = invoke(undefined, callback);
      if (cleanup) cleanups.push(cleanup);
    },
  };
  function load(name: string): Record<string, unknown> {
    const cached = cache.get(name);
    if (cached) return cached;
    const file = `src/ming-ui/components/${name}.tsx`;
    let source = revision
      ? execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, encoding: 'utf8' })
      : fs.readFileSync(path.join(root, file), 'utf8');
    if (name === 'Menu') {
      source = revision
        ? source.replace('Menu = ClickAway.wrap(Menu);', 'export const CoreMenu = Menu;\nMenu = ClickAway.wrap(Menu);')
        : source + '\nexport { Menu as CoreMenu };';
    }
    if (name === 'ClickAway')
      source +=
        '\nexport const observations = { getDomNode, getClickAwayExceptions, shouldTriggerClickAway, assignRef, useClickAwayElement };';
    const compiled = harness.transformSync(source, {
      filename: path.join(root, file),
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    assert.ok(compiled?.code);
    const target: { exports: Record<string, unknown> } = { exports: {} };
    const imports = (request: string): unknown => {
      if (request === './List') return load('List');
      if (request === 'ming-ui/components/ClickAway') return load('ClickAway');
      if (request === 'react' && hooks) return { __esModule: true, default: fakeReact, ...fakeReact };
      if (request === 'react-use')
        return {
          useClickAway: (ref: unknown, callback: unknown) => {
            if (hooks)
              listeners.add((event: unknown) => {
                const el = read(ref, 'current');
                if (el && !invoke(el, read(el, 'contains'), read(event, 'target'))) invoke(undefined, callback, event);
              });
          },
        };
      if (request.endsWith('.less')) return {};
      return require(request);
    };
    new Function('module', 'exports', 'require', compiled.code)(target, target.exports, imports);
    cache.set(name, target.exports);
    return target.exports;
  }
  function instantiate(component: unknown, props: Record<string, unknown>) {
    assert.equal(typeof component, 'function');
    if (typeof component !== 'function') throw new TypeError('Missing class');
    const instance: unknown = Reflect.construct(component, [props]);
    assert.ok(object(instance));
    instance['setState'] = (patch: unknown) => {
      const state = read(instance, 'state');
      assert.ok(object(state));
      assert.ok(object(patch));
      instance['state'] = { ...state, ...patch };
    };
    return {
      instance,
      call(name: string, ...args: unknown[]) {
        return invoke(instance, read(instance, name), ...args);
      },
    };
  }
  return {
    load,
    instantiate,
    observe(name: string, ...args: unknown[]) {
      return invoke(undefined, read(load('ClickAway')['observations'], name), ...args);
    },
    render(props: Record<string, unknown>, ref?: unknown, wrapped = false) {
      cursor = 0;
      return this.observe('useClickAwayElement', props, ref, wrapped);
    },
    cleanup() {
      for (const cleanup of cleanups) invoke(undefined, cleanup);
    },
  };
}

function publicContracts() {
  const temporary = fs.mkdtempSync(path.join(root, 'node_modules/.cache/hap-menu-contract-'));
  try {
    const file = path.join(temporary, 'contract.tsx');
    fs.writeFileSync(
      file,
      `import React from 'react';
import ClickAway, { type ClickAwayProps } from '${root}/src/ming-ui/components/ClickAway';
import Menu from '${root}/src/ming-ui/components/Menu';
import List from '${root}/src/ming-ui/components/List';
function Custom(props: { required: number }) { return <p>{props.required}</p>; }
const Wrapped = ClickAway.wrap(Custom);
class Defaults extends React.Component<{ value: number }> { static defaultProps = { value: 1 }; override render() { return <p>{this.props.value}</p>; } }
const WithDefaults = ClickAway.wrap(Defaults);
const Native = ClickAway.wrap('button');
export const defaultClassProps = <WithDefaults />;
export const native = <Native type="button" ref={node => { const button: HTMLButtonElement | null = node; void button; }} />;
export const valid = <Wrapped required={1} ref={node => { const span: HTMLSpanElement | null = node; void span; }} onClickAway={node => { const target: Node = node; void target; }} />;
export const explicit = <ClickAway component={Custom} required={1} />;
export const intrinsic = <ClickAway component="button" type="button" onClick={event => { const button: HTMLButtonElement = event.currentTarget; void button; }} />;
export const defaultRef = <ClickAway ref={node => { const div: HTMLDivElement | null = node; void div; }} />;
// @ts-expect-error Required custom props survive wrapping.
export const missing = <Wrapped />;
// @ts-expect-error Arbitrary custom fields are rejected.
export const extra = <Wrapped required={1} arbitrary={true} />;
// @ts-expect-error Custom prop types survive the direct generic component path.
export const wrongCustom = <ClickAway component={Custom} required="wrong" />;
// @ts-expect-error A div has no value property.
export const wrongDiv = <ClickAway value="wrong" />;
// @ts-expect-error DOM event targets retain their actual type.
export const wrongEvent = <ClickAway onClick={(event: React.MouseEvent<HTMLButtonElement>) => { void event; }} />;
export const menu = <Menu style={{ width: 120 }} setRef={React.createRef<HTMLDivElement>()} onClickAway={() => {}} />;
// @ts-expect-error Width belongs in the style contract.
export const wrongMenu = <Menu width={{ width: 120 }} />;
// @ts-expect-error List height uses a finite numeric protocol.
export const wrongList = <List bodyMaxHeight="tall" />;
export const props: ClickAwayProps = { specialFilter: target => target.parentNode };
`,
    );
    const styles = path.join(temporary, 'styles.d.ts');
    fs.writeFileSync(styles, "declare module '*.less';\n");
    const config = path.join(temporary, 'tsconfig.json');
    fs.writeFileSync(
      config,
      JSON.stringify({
        extends: path.join(root, 'tsconfig.strict.json'),
        compilerOptions: { types: [], rootDir: root, noEmit: true },
        include: [file, styles, path.join(root, 'types/global.d.ts')],
        exclude: [],
      }),
    );
    execFileSync(
      process.execPath,
      [path.join(root, 'node_modules/@typescript/native/bin/tsc'), '-p', config, '--pretty', 'false'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' },
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function main() {
  const current = fixture(),
    old = before ? fixture(before) : undefined;
  const core = current.load('Menu')['CoreMenu'];
  const list = current.load('List')['default'];
  const appearances: Record<string, unknown>[] = [
    {},
    { className: 'custom', style: { width: 140 }, children: React.createElement('li', null, 'A') },
    {
      isAppendToBody: true,
      fixedHeader: React.createElement('header', null, 'Search'),
      children: React.createElement('li', null, 'A'),
    },
    {
      header: React.createElement('header', { className: 'custom' }, 'Header'),
      footer: React.createElement('footer', null, 'Footer'),
      bodyMaxHeight: 150,
    },
  ];
  for (const props of appearances) {
    const markup = ReactDOM.renderToStaticMarkup(React.createElement(core as React.ComponentType, props));
    if (old)
      assert.equal(
        markup,
        ReactDOM.renderToStaticMarkup(React.createElement(old.load('Menu')['CoreMenu'] as React.ComponentType, props)),
      );
    assert.ok(typeof markup === 'string');
  }
  function Item(props: Record<string, unknown>) {
    return React.createElement('li', null, props['children'] as import('react').ReactNode);
  }
  const listCases = [
    {},
    appearances[1] || {},
    appearances[3] || {},
    { className: 'empty' },
    {
      children: [
        null,
        'plain',
        React.createElement(Item, { key: 'a', icon: 'x' }, 'A'),
        React.createElement(Item, { key: 'b', icon: 'y', iconAtEnd: true }, 'B'),
      ],
    },
  ];
  for (const props of listCases) {
    const markup = ReactDOM.renderToStaticMarkup(React.createElement(list as React.ComponentType, props));
    if (old)
      assert.equal(
        markup,
        ReactDOM.renderToStaticMarkup(React.createElement(old.load('List')['default'] as React.ComponentType, props)),
      );
  }
  const positions = [
    { rect: { left: 10, top: 10, width: 100, height: 30, bottom: 40 }, props: {} },
    { rect: { left: 450, top: 10, width: 100, height: 30, bottom: 40 }, props: {} },
    { rect: { left: 10, top: 250, width: 100, height: 80, bottom: 330 }, props: {} },
    { rect: { left: 10, top: 250, width: 100, height: 80, bottom: 330 }, props: { isAppendToBody: true } },
    { rect: { left: 10, top: 10, width: 100, height: 30, bottom: 40 }, props: { renderToTop: true } },
  ];
  for (const scenario of positions) {
    const node = new DomNode(scenario.rect);
    const menu = current.instantiate(core, scenario.props);
    menu.call('setMenuNode', node);
    menu.call('calcPos');
    if (old) {
      const historical = old.instantiate(old.load('Menu')['CoreMenu'], scenario.props);
      historical.call('setMenuNode', node);
      historical.call('calcPos');
      assert.deepEqual(read(menu.instance, 'state'), read(historical.instance, 'state'));
    }
  }
  const parent = new DomNode();
  parent.parentElement = { scrollTop: 10 };
  const submenu = current.instantiate(core, { isSubMenu: true, parentMenuItemNode: parent });
  submenu.call('calcPos');
  assert.deepEqual(read(read(submenu.instance, 'state'), 'pos'), { left: '100%', top: 15 });
  parent.parentElement = null;
  submenu.call('calcPos');
  assert.equal(read(read(read(submenu.instance, 'state'), 'pos'), 'top'), 25);
  const ref = { current: null };
  const menu = current.instantiate(core, { setRef: ref });
  menu.call('setListRef', parent);
  assert.equal(read(ref, 'current'), parent);
  menu.call('setListRef', null);
  assert.equal(read(ref, 'current'), null);

  const inside = new DomNode(),
    outside = new DomNode(),
    exempt = new DomNode(),
    detached = new DomNode();
  documentRoot.children.add(outside);
  documentRoot.children.add(exempt);
  documentRoot.children.add(inside);
  selectors.set('.exempt', [exempt]);
  for (const factory of old ? [current, old] : [current]) {
    assert.equal(factory.observe('shouldTriggerClickAway', { el: inside, target: outside, exceptions: [] }), true);
    assert.equal(factory.observe('shouldTriggerClickAway', { el: inside, target: inside, exceptions: [] }), false);
    assert.equal(factory.observe('shouldTriggerClickAway', { el: inside, target: detached, exceptions: [] }), false);
    assert.equal(
      factory.observe('shouldTriggerClickAway', { el: inside, target: exempt, exceptions: [exempt] }),
      false,
    );
    assert.equal(
      factory.observe('shouldTriggerClickAway', {
        el: inside,
        target: outside,
        exceptions: [],
        specialFilter: () => ({}),
      }),
      false,
    );
    assert.deepEqual(
      factory.observe('getClickAwayExceptions', ['.exempt', jquery(exempt), { current: exempt }, null]),
      before && factory === old ? [[exempt], [exempt], exempt] : [exempt, exempt, exempt],
    );
  }
  const cyclic: Record<string, unknown> = {};
  cyclic['current'] = cyclic;
  assert.equal(current.observe('getDomNode', cyclic), null);
  const foreign = new DomNode();
  Object.setPrototypeOf(foreign, {});
  assert.equal(foreign instanceof DomNode, false);
  assert.equal(current.observe('getDomNode', foreign), foreign, 'Native node brands survive a different realm');
  assert.equal(current.observe('getDomNode', { nativeElement: exempt }), exempt);
  assert.equal(current.observe('getDomNode', { nodeType: 1 }), null);
  listeners.clear();
  const runtime = fixture(undefined, true);
  const changes: unknown[] = [],
    forwarded: unknown[] = [];
  const element = runtime.render(
    { className: 'boundary', onClickAway: (node: unknown) => changes.push(node) },
    (node: unknown) => forwarded.push(node),
  );
  assert.ok(React.isValidElement<Record<string, unknown>>(element));
  invoke(undefined, element.props['ref'], inside);
  assert.deepEqual(forwarded, [inside]);
  for (const listener of listeners) invoke(undefined, listener, { target: outside });
  assert.deepEqual([...changes], [outside]);
  listeners.clear();
  runtime.render({
    onClickAway: (node: unknown) => changes.push(['latest', node]),
    onClickAwayExceptions: ['.exempt'],
  });
  for (const listener of listeners) invoke(undefined, listener, { target: exempt });
  assert.deepEqual([...changes], [outside]);
  for (const listener of listeners) invoke(undefined, listener, { target: outside });
  assert.deepEqual([...changes], [outside, ['latest', outside]]);
  runtime.cleanup();
  assert.equal(listeners.size, 0);
  let cleanups = 0;
  const cleaned = fixture(undefined, true);
  const cleanedElement = cleaned.render({}, () => () => cleanups++);
  assert.ok(React.isValidElement<Record<string, unknown>>(cleanedElement));
  const cleanup = invoke(undefined, cleanedElement.props['ref'], inside);
  invoke(undefined, cleanup);
  assert.equal(cleanups, 1);
  cleaned.cleanup();
  publicContracts();
  console.log(
    JSON.stringify({
      menuRenderings: appearances.length,
      listRenderings: appearances.length + 1,
      positions: positions.length,
      historicalAB: !!old,
      clickAwayAndExceptions: true,
      latestCallback: true,
      nativeRefsAndCleanup: true,
      publicTypeContracts: true,
    }),
  );
}
try {
  main();
} catch (error: unknown) {
  if (object(error) && typeof error['stdout'] === 'string') console.error(error['stdout']);
  console.error(error);
  process.exitCode = 1;
}
