const assert = require('node:assert/strict');
const path = require('node:path');
const { jsxRuntimeFrom, transformFileSync } = require('../../../../../../scripts/spec-harness.ts');
interface NodeElement {
  type: string;
  props: Record<string, unknown>;
  children: NodeElement[];
}
interface NumberProps {
  type: number;
  dot: number;
  value: string | number;
  flag: number;
  onChange: (value: string | number) => void;
  onBlur: (value: string) => void;
  advancedSetting: { numshow?: string; showtype?: string; numinterval?: string; thousandth?: string };
}
let hookIndex = 0;
const state: unknown[] = [];
const hooks = {
  useState(initial: unknown) {
    const index = hookIndex++;
    if (!(index in state)) state[index] = initial;
    return [
      state[index],
      (value: unknown) => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      },
    ];
  },
  useRef(initial: unknown) {
    const index = hookIndex++;
    if (!(index in state)) state[index] = { current: initial };
    return state[index];
  },
  useEffect() {
    hookIndex++;
  },
};
function createElement(type: string, props: Record<string, unknown>, ...children: NodeElement[]): NodeElement {
  return { type, props: props || {}, children: children.flat().filter(value => value && typeof value === 'object') };
}
function find(node: NodeElement, type: string): NodeElement | undefined {
  if (node.type === type) return node;
  for (const child of node.children) {
    const match = find(child, type);
    if (match) return match;
  }
  return undefined;
}
const moduleLike: { exports: unknown } = { exports: {} };
let comparator: ((before: NumberProps, after: NumberProps) => boolean) | undefined;
const { code } = transformFileSync(process.env.NUMBER_DRAFT_SOURCE || path.join(__dirname, 'number.tsx'), {
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});
new Function('module', 'exports', 'require', code)(moduleLike, moduleLike.exports, (name: string) => {
  if (name === 'react/jsx-runtime') return jsxRuntimeFrom(createElement);
  if (name === 'react')
    return {
      ...hooks,
      memo: (component: unknown, compare: typeof comparator) => {
        comparator = compare;
        return component;
      },
    };
  if (name === 'lodash') return require('lodash');
  if (name === 'classnames') return (...values: unknown[]) => values.filter(Boolean).join(' ');
  if (name === 'prop-types') return { __esModule: true, default: new Proxy({}, { get: () => () => undefined }) };
  if (name === 'styled-components')
    return { __esModule: true, default: new Proxy({}, { get: (_target, tag) => () => tag }) };
  if (name.includes('CustomEvent/config')) return { ADD_EVENT_ENUM: { FOCUS: 'focus' } };
  if (name.includes('WidgetSecurity/util')) return { dealMaskValue: ({ value }: { value: string }) => value };
  if (name === 'src/utils/common')
    return {
      accAdd: (a: number, b: number) => a + b,
      accSub: (a: number, b: number) => a - b,
      accMul: (a: number, b: number) => a * b,
      accDiv: (a: number, b: number) => a / b,
    };
  if (name === 'src/utils/control')
    return {
      formatNumberThousand: (value: unknown) => value,
      formatStrZero: (value: unknown) => value,
      toFixed: (value: string | number) => String(value),
    };
  throw new Error(`Unexpected Number dependency ${name}`);
});
const NumberComp = (moduleLike.exports as { default: (props: NumberProps) => NodeElement }).default;
const changes: Array<string | number> = [];
let props: NumberProps = {
  type: 6,
  dot: 2,
  value: '0.15',
  flag: 1,
  advancedSetting: { numshow: '1', thousandth: '1' },
  onChange: value => {
    changes.push(value);
    props = { ...props, value };
  },
  onBlur: () => undefined,
};
function render(): NodeElement {
  hookIndex = 0;
  return NumberComp(props);
}
function input(): NodeElement {
  const found = find(render(), 'input');
  assert.ok(found);
  return found;
}
const display = render();
const target = display.children[0];
assert.ok(target);
(target.props['onClick'] as () => void)();
let field = input();
assert.equal(field.props['value'], 15, 'The editing field displays percentage units');
(field.props['onFocus'] as (event: unknown) => void)({ target: { value: '15' } });
field = input();
(field.props['onChange'] as (event: unknown) => void)({ target: { value: '12.50' } });
field = input();
assert.equal(changes.at(-1), 0.125, 'Percent drafts write their source fraction to the form');
assert.equal(field.props['value'], '12.50', 'The draft keeps the entered trailing zero while the source value matches');
props = { ...props, value: '0.25' };
field = input();
assert.equal(field.props['value'], 25, 'External values invalidate a focused stale draft');
props = { ...props, value: 0.125, flag: 2 };
field = input();
assert.equal(field.props['value'], 12.5, 'A reset flag invalidates a draft even when the value matches its old source');
assert.equal(comparator?.({ ...props, flag: 1 }, props), false, 'memo must observe form reset flags');
assert.equal(comparator?.(props, props), true);
console.log('Number controlled draft keeps percent units and invalidates stale input on external changes/reset');
