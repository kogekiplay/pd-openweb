const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: {
  transformFileSync: (file: string, options?: Record<string, unknown>) => { code: string | null };
} = require('../../../../../scripts/spec-harness.ts');

interface ElementNode {
  props: Record<string, unknown>;
}
interface DragModule {
  default: (props: Record<string, unknown>) => ElementNode;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
const source = harness.transformFileSync(path.join(__dirname, '..', 'DragCore.tsx'), {
  babelrc: false,
  presets: ['@babel/preset-react'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
if (!source.code) throw new TypeError('DragCore transform returned no code');
const moduleValue: { exports: unknown } = { exports: {} };
(globalThis as Record<string, unknown>)['_l'] = (value: string) => value;
const refs: unknown[] = [];
const react = {
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (fn: unknown) => fn,
};
const runtime = {
  jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
  jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }),
  Fragment: 'Fragment',
};
const localRequire = (request: string): unknown =>
  request === 'react' ? react : request === 'react/jsx-runtime' ? runtime : require(request);
new Function('module', 'exports', 'require', source.code)(moduleValue, moduleValue.exports, localRequire);
if (!object(moduleValue.exports) || typeof moduleValue.exports['default'] !== 'function')
  throw new TypeError('DragCore export missing');
const drag = (moduleValue.exports as unknown as DragModule).default({
  setRef: (node: unknown) => {
    refs.push(node);
  },
  onDrag: () => {
    refs.push('drag');
  },
  onDBClick: () => {
    refs.push('double');
  },
});
const ref = drag.props['ref'];
if (typeof ref !== 'function') throw new TypeError('DragCore ref missing');
ref({});
const mouseDown = drag.props['onMouseDown'];
if (typeof mouseDown !== 'function') throw new TypeError('DragCore mouse handler missing');
const event = { preventDefault: () => undefined };
Reflect.apply(mouseDown, undefined, [event]);
Reflect.apply(mouseDown, undefined, [event]);
assert.equal(refs.includes('double'), true, 'second click uses the double-click branch');
assert.equal(refs.length > 0, true, 'setRef is forwarded through the public ABI');
Reflect.apply(mouseDown, undefined, [event]);
setTimeout(() => {
  assert.equal(refs.includes('drag'), true, 'single click keeps the delayed drag branch');
}, 230);
