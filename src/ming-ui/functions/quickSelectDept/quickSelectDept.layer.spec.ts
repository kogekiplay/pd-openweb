/**
 * Regression for the department quick-select panel mount (HAP 7.5.4 bug).
 *
 * Production symptom: the search input received clicks, but document.activeElement
 * fell back to the drawer input (fill_focus_lost) because the panel was mounted on
 * document.body, outside the dialog that owns the anchor.
 *
 * CONTROL FLOW ONLY. This repo ships no jsdom, so the DOM below is a hand-rolled
 * stub (an injected Element constructor plus plain fixtures). It exercises the REAL
 * module loaded through the spec harness - Element narrowing, host resolution, mount
 * target, offset-parent rebasing (border + scroll), destroy cleanup - and proves
 * nothing about real layout, real focus traps or real stacking contexts.
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const { transformFileSync } = require('../../../../scripts/spec-harness.ts');

type Rect = { x: number; y: number; width: number; height: number };

/** Two fake realms so the cross-realm Element fallback can be exercised. */
function elementClass(label: string) {
  const Klass = class FakeElementClass { /* realm marker only */ };
  Object.defineProperty(Klass, 'name', { value: label });
  return Klass;
}
const ElementCtor = elementClass('FakeElement');
const Realm2ElementCtor = elementClass('FakeElementRealm2');

interface FakeElement {
  style: Record<string, string>;
  children: FakeElement[];
  parentNode: FakeElement | null;
  offsetParent: FakeElement | null;
  offsetParentForChildren: FakeElement | null;
  scrollLeft: number;
  scrollTop: number;
  clientLeft: number;
  clientTop: number;
  rect: Rect;
  selectors: string[];
  ownerDocument: { defaultView: { Element: unknown } };
  getBoundingClientRect(): Rect;
  appendChild(child: FakeElement): FakeElement;
  removeChild(child: FakeElement): void;
  contains(node: unknown): boolean;
  closest(selector: string): FakeElement | null;
}

function fakeElement(selectors: string[] = [], rect?: Rect, realm?: ReturnType<typeof elementClass>): FakeElement {
  const proto = (realm || ElementCtor).prototype;
  const element = Object.create(proto) as FakeElement;
  element.style = {};
  element.children = [];
  element.parentNode = null;
  element.offsetParent = null;
  element.offsetParentForChildren = null;
  element.scrollLeft = 0;
  element.scrollTop = 0;
  element.clientLeft = 0;
  element.clientTop = 0;
  element.rect = rect || { x: 0, y: 0, width: 0, height: 0 };
  element.selectors = selectors;
  element.ownerDocument = { defaultView: { Element: realm || ElementCtor } };
  element.getBoundingClientRect = () => element.rect;
  element.appendChild = (child: FakeElement) => {
    child.parentNode = element;
    child.offsetParent = element.offsetParentForChildren || element;
    element.children.push(child);
    return child;
  };
  element.removeChild = (child: FakeElement) => {
    const index = element.children.indexOf(child);
    if (index >= 0) element.children.splice(index, 1);
    child.parentNode = null;
  };
  element.contains = (node: unknown) => {
    let current = node && typeof node === 'object' ? (node as FakeElement) : null;
    while (current) {
      if (current === element) return true;
      current = current.parentNode;
    }
    return false;
  };
  element.closest = (selector: string) => {
    let current: FakeElement | null = element;
    while (current) {
      if (current.selectors.indexOf(selector) >= 0) return current;
      current = current.parentNode;
    }
    return null;
  };
  return element;
}

/** A drawer shaped like @rc-component/drawer: wrapper > role=dialog panel > body. */
function drawerFixture() {
  const body = fakeElement(['.ant-drawer-body'], { x: 0, y: 0, width: 400, height: 800 });
  const panel = fakeElement(['[role="dialog"]', '.ant-drawer-content', '.ant-drawer-section'], { x: 100, y: 200, width: 400, height: 800 });
  panel.appendChild(body);
  body.offsetParent = panel;
  const anchor = fakeElement([], { x: 150, y: 260, width: 200, height: 30 });
  body.appendChild(anchor);
  const root = fakeElement(['.ant-drawer']);
  root.appendChild(panel);
  return { root, panel, body, anchor };
}

/** Load the real module through the harness with the imports it actually pulls in. */
function load(options: { Element?: unknown; documentBody?: FakeElement } = {}) {
  const file = path.resolve(__dirname, 'index.tsx');
  const code = transformFileSync(file).code;
  const module = { exports: {} as Record<string, unknown> };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const document = {
    body: options.documentBody || fakeElement(['body']),
    createElement: () => fakeElement([]),
  };
  const requireStub = (name: string): unknown => {
    if (name === 'react') {
      return {
        useCallback: (fn: unknown) => fn,
        useEffect: () => undefined,
        useRef: (value: unknown) => ({ current: value }),
        useState: (value: unknown) => [value, () => undefined],
        createElement: jsx,
        Fragment: 'Fragment',
      };
    }
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name === 'react-dom/client') return { createRoot: () => ({ render: () => undefined, unmount: () => undefined }) };
    if (name === 'react-use') return { useSetState: (value: unknown) => [value, () => undefined], useClickAway: () => undefined };
    if (name === 'classnames') return require('classnames');
    if (name === 'lodash') return require('lodash');
    if (name === 'ming-ui') return { Icon: 'Icon', LoadDiv: 'LoadDiv', ScrollView: 'ScrollView' };
    if (name === 'ming-ui/functions/dialogSelectUser/GeneralSelect/NoData') return { __esModule: true, default: 'NoData' };
    if (name === 'src/components/checkPermission') return { checkPermission: () => true };
    if (name === 'src/pages/Admin/enum') return { PERMISSION_ENUM: {} };
    if (name === 'src/utils/typedStyled') return { __esModule: true, default: new Proxy({}, { get: () => () => 'Styled' }) };
    if (name === '../dialogSelectDept') return { __esModule: true, default: () => undefined };
    if (name === '../dialogSelectDept/boundary') {
      return {
        departmentTree: () => [],
        departmentChoices: () => [],
        rangeId: () => '',
        requestDepartments: () => ({ abort: () => undefined }),
        requestIds: () => ({ abort: () => undefined }),
        rootResult: () => undefined,
      };
    }
    throw new Error('Unstubbed module requested by real source: ' + name);
  };
  const factory = new Function('require', 'module', 'exports', 'window', 'document', 'Element', code);
  factory(
    requireStub,
    module,
    module.exports,
    { innerWidth: 1440, innerHeight: 900 },
    document,
    options.Element || ElementCtor,
  );
  return {
    exported: module.exports as { default: (target: unknown, props?: unknown) => { destory(): void } },
    document,
  };
}

// ---------------------------------------------- dialog owns the anchor (mount)
{
  const drawer = drawerFixture();
  const { exported, document } = load();
  const handle = exported.default(drawer.anchor, {});
  assert.equal(document.body.children.length, 0, 'nothing may be mounted on document.body while a dialog owns the anchor');
  assert.equal(drawer.panel.children.length, 2, 'panel must mount INSIDE the dialog panel');
  assert.equal(drawer.anchor.parentNode, drawer.body, 'the anchor itself must not move');
  handle.destory();
  assert.equal(drawer.panel.children.length, 1, 'destroy must remove the panel from the dialog');
}

// -------------------------------- rebase on the host when it IS the offset parent
{
  const drawer = drawerFixture();
  drawer.panel.clientLeft = 5;
  drawer.panel.clientTop = 7;
  drawer.panel.scrollLeft = 10;
  drawer.panel.scrollTop = 20;
  const { exported } = load();
  const handle = exported.default(drawer.anchor, {});
  const panel = drawer.panel.children[1];
  assert.equal(panel.style.position, 'absolute');
  // x 150 - base 100 - border 5 + scroll 10 = 55 ; y 290 - 200 - 7 + 20 = 103
  assert.equal(panel.style.left, '55px', 'border and scroll of the offset parent must be applied');
  assert.equal(panel.style.top, '103px', 'border and scroll of the offset parent must be applied');
  assert.equal(panel.style.zIndex, '1001');
  handle.destory();
}

// --------------------------- rebase on a DIFFERENT offset parent than the host
{
  const ancestor = fakeElement([], { x: 50, y: 60, width: 900, height: 900 });
  const drawer = drawerFixture();
  drawer.panel.offsetParentForChildren = ancestor;
  const { exported } = load();
  const handle = exported.default(drawer.anchor, {});
  const panel = drawer.panel.children[1];
  // x 150 - ancestor 50 = 100 ; y 290 - ancestor 60 = 230
  assert.equal(panel.style.left, '100px', 'coordinates follow offsetParent, not the host');
  assert.equal(panel.style.top, '230px', 'coordinates follow offsetParent, not the host');
  handle.destory();
}

// ------------------------------------- document body path stays byte-compatible
{
  const { exported, document } = load();
  const anchor = fakeElement([], { x: 10, y: 20, width: 100, height: 20 });
  const handle = exported.default(anchor, {});
  assert.equal(document.body.children.length, 1, 'without a dialog ancestor the panel keeps using document.body');
  assert.equal(document.body.children[0].style.position, 'absolute');
  assert.equal(document.body.children[0].style.left, '10px');
  assert.equal(document.body.children[0].style.top, '40px');
  handle.destory();
  assert.equal(document.body.children.length, 0, 'destroy must remove the body panel');
}

// ------------------------------------------ cross-realm anchor uses its own view
{
  const drawer = drawerFixture();
  const realm2Anchor = fakeElement([], { x: 150, y: 260, width: 200, height: 30 }, Realm2ElementCtor);
  drawer.body.appendChild(realm2Anchor);
  const { exported, document } = load();
  const handle = exported.default(realm2Anchor, {});
  assert.equal(document.body.children.length, 0, 'a cross-realm Element still resolves its dialog host');
  assert.equal(drawer.panel.children.length, 2, 'cross-realm panel mounts inside the dialog');
  handle.destory();
}

// ------------------------- a nodeType look-alike that is NOT an Element is refused
{
  const fakeHost = fakeElement(['[role="dialog"]']);
  let closestCalls = 0;
  const lookAlike = {
    nodeType: 1,
    closest(selector: string) {
      closestCalls++;
      return selector === '[role="dialog"]' ? fakeHost : null;
    },
    getBoundingClientRect: () => ({ x: 5, y: 6, width: 10, height: 10 }),
  };
  const { exported, document } = load();
  const handle = exported.default(lookAlike, {});
  assert.equal(closestCalls, 0, 'a non-Element look-alike must never reach closest()');
  assert.equal(fakeHost.children.length, 0, 'a non-Element look-alike must not become a host');
  assert.equal(document.body.children.length, 1, 'the look-alike falls back to the document body path');
  handle.destory();
}

console.log('quickSelectDept.layer.spec: OK');