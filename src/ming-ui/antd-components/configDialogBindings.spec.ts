const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('../../../scripts/spec-harness.ts');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const generate = require('@babel/generator').default;
const React = require('react');
const moment = require('moment');
const ROOT = path.resolve(__dirname, '../../..');
const DATE_PATH = 'src/pages/widgetConfig/widgetSetting/components/WidgetHighSetting/ControlSetting/DateConfig.tsx';
const SCORE_PATH = 'src/pages/widgetConfig/widgetSetting/components/WidgetHighSetting/ControlSetting/ScoreConfig.tsx';
interface Tree {
  type: unknown;
  props: Record<string, unknown>;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function isTree(value: unknown): value is Tree {
  return record(value) && 'type' in value && record(value['props']);
}
function find(value: unknown, match: (node: Tree) => boolean): Tree | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = find(item, match);
      if (result) return result;
    }
  } else if (isTree(value)) {
    if (match(value)) return value;
    return find(value.props['children'], match);
  }
  return undefined;
}
function invoke(node: Tree, key: string, ...args: unknown[]): unknown {
  const callback = node.props[key];
  if (typeof callback !== 'function') throw new Error(`Missing actual ${key}`);
  return Reflect.apply(callback, undefined, args);
}
class Hooks {
  states: unknown[] = [];
  index = 0;
  begin() {
    this.index = 0;
  }
  useState = (initial: unknown) => {
    const index = this.index++;
    if (!(index in this.states)) this.states[index] = initial;
    return [
      this.states[index],
      (value: unknown) => {
        this.states[index] = value;
      },
    ];
  };
}
function source(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function select(file: string, names: string[], dependencies: Record<string, unknown>): Record<string, unknown> {
  const tree = parser.parse(source(file), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const nodes = tree.program.body.flatMap((node): import('@babel/types').Statement[] => {
    const item =
      node.type === 'ExportDefaultDeclaration' || node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (!item) return [];
    if (
      (item.type === 'FunctionDeclaration' || item.type === 'ClassDeclaration') &&
      item.id &&
      names.includes(item.id.name)
    )
      return [item];
    if (
      item.type === 'VariableDeclaration' &&
      item.declarations.some(declaration => declaration.id.type === 'Identifier' && names.includes(declaration.id.name))
    )
      return [item];
    return [];
  });
  const code = transformSync(
    generate({ type: 'File', program: { type: 'Program', sourceType: 'module', body: nodes } }).code,
    {
      filename: path.join(ROOT, file),
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    },
  ).code;
  const parameters = Object.entries(dependencies).filter(([key]) => !names.includes(key));
  return new Function('require', ...parameters.map(([key]) => key), `${code}\nreturn {${names.join(',')}};`)(
    require,
    ...parameters.map(([_key, value]) => value),
  );
}
const settings = { showvalue: '1', max: '5' };
const itemnames = [{ key: '1', value: 'Original' }];
const writes: unknown[] = [],
  confirmed: unknown[] = [];
const settingsDeps = (hooks: Hooks): Record<string, unknown> => ({
  ...React,
  useState: hooks.useState,
  useEffect: () => {},
  moment,
  _l: (text: string) => text,
  ConfigWrap: 'ConfigWrap',
  SettingItem: 'SettingItem',
  Support: 'Support',
  Input: { TextArea: 'TextArea' },
  Dialog: 'Dialog',
  Checkbox: 'Checkbox',
  EditInfo: 'EditInfo',
  ItemName: 'ItemName',
  getDateToEn: (value: string) => value,
  getAdvanceSetting: (_data: unknown, key?: string) => (key === 'itemnames' ? itemnames : settings),
  handleAdvancedSettingChange: (_data: unknown, patch: unknown) => patch,
  getStringBytes: (value: string) => value.length,
  getStrBytesLength: (value: string, size: number) => value.slice(0, size),
});
const nativeDeps: Record<string, unknown> = {
  ...React,
  React,
  PropTypes: require('prop-types'),
  cx: require('classnames'),
  Icon: 'Icon',
  DialogBase: 'DialogBase',
  DialogHeader: 'DialogHeader',
  DialogFooter: 'DialogFooter',
  _l: (value: string) => value,
  Button: 'MingButton',
};
interface RenderClass {
  new (props: Record<string, unknown>): { render(): unknown };
  defaultProps?: Record<string, unknown>;
}
const Dialog = select('src/ming-ui/components/Dialog/Dialog.tsx', ['Dialog'], nativeDeps)['Dialog'] as RenderClass;
const Footer = select('src/ming-ui/components/Dialog/DialogFooter.tsx', ['DialogFooter'], nativeDeps)[
  'DialogFooter'
] as RenderClass;
const Button = select(
  'src/ming-ui/components/Button.tsx',
  ['BUTTON_TYPE_LIST', 'BUTTON_SIZE_LIST', 'Button'],
  nativeDeps,
)['Button'] as RenderClass;
function renderedDialog(props: Record<string, unknown>): unknown {
  return new Dialog({ ...Dialog.defaultProps, ...props }).render();
}
function confirmButton(props: Record<string, unknown>): Tree {
  const rendered = renderedDialog(props);
  const footer = find(rendered, node => node.type === 'DialogFooter');
  assert.ok(footer, 'Actual Dialog render passes props to actual footer');
  const renderedFooter = new Footer(footer.props).render();
  const button = find(renderedFooter, node => node.type === 'MingButton' && node.props['data-id'] === 'confirmBtn');
  assert.ok(button);
  const dom = new Button({ ...Button.defaultProps, ...button.props }).render();
  assert.ok(isTree(dom));
  return dom;
}
function dateState(format: string, type: number) {
  const hooks = new Hooks();
  const module = select(DATE_PATH, ['CUSTOM_SHOW_FORMAT', 'ERROR_OPTIONS', 'ShowFormatDialog'], settingsDeps(hooks));
  const component = module['ShowFormatDialog'];
  assert.equal(typeof component, 'function');
  if (typeof component !== 'function') throw new Error('Missing actual date component');
  hooks.begin();
  const tree = component({ showformat: format, type, onOk: (value: unknown) => confirmed.push(value), onClose() {} });
  const dialog = find(tree, node => node.type === 'Dialog');
  assert.ok(dialog);
  const dom = confirmButton(dialog.props);
  return { hooks, component, dialog, dom };
}
function scoreState() {
  const hooks = new Hooks();
  const module = select(SCORE_PATH, ['defaultNames', 'ScoreConfig'], settingsDeps(hooks));
  const component = module['ScoreConfig'];
  if (typeof component !== 'function') throw new Error('Missing actual score component');
  const render = () => {
    hooks.begin();
    return component({ data: { controlId: 'score' }, onChange: (value: unknown) => writes.push(value) });
  };
  return { hooks, render };
}

for (const [format, type, disabled] of [
  ['', 15, true],
  ['YYYY-MM-DD', 15, false],
  ['HH:mm', 15, true],
  ['?', 15, true],
  ['HH:mm', 16, false],
] as const) {
  const { dialog, dom } = dateState(format, type);
  assert.equal(typeof dialog.props['okDisabled'], 'boolean');
  assert.equal(
    Boolean(dom.props['disabled']),
    disabled,
    'Actual disabled binding preserves the numeric-state truth table',
  );
  assert.equal(
    typeof dom.props['onClick'] === 'function',
    !disabled,
    'Disabled validation prevents the real button click handler',
  );
  const html = require('react-dom/server').renderToStaticMarkup(
    React.createElement('button', { disabled: dom.props['disabled'] }, 'Save'),
  );
  assert.equal(html.includes('disabled=""'), disabled, 'Actual React DOM boolean attribute follows the same state');
}
const formatState = dateState('YYYY-MM-DD', 15);
invoke(formatState.dialog, 'onOk');
assert.equal(confirmed.at(-1), 'YYYY-MM-DD');
const invalidFormat = dateState('HH:mm', 15);
invoke(invalidFormat.dialog, 'onOk');
assert.equal(confirmed.at(-1), '');

const score = scoreState();
let tree = score.render();
let dialog = find(tree, node => node.type === 'Dialog');
assert.ok(dialog);
assert.equal(dialog.props['visible'], false);
assert.equal(renderedDialog(dialog.props), null);
const edit = find(tree, node => node.type === 'EditInfo');
assert.ok(edit);
invoke(edit, 'onClick');
tree = score.render();
dialog = find(tree, node => node.type === 'Dialog');
assert.ok(dialog);
assert.equal(dialog.props['visible'], true, 'The producer stores the actual boolean, not a useState object');
assert.ok(isTree(renderedDialog(dialog.props)));
invoke(dialog, 'onCancel');
tree = score.render();
dialog = find(tree, node => node.type === 'Dialog');
assert.ok(dialog);
assert.equal(dialog.props['visible'], false);
assert.equal(renderedDialog(dialog.props), null, 'Cancel closes the real Dialog branch');
const checkbox = find(tree, node => node.type === 'Checkbox' && node.props['text'] === '自定义等级文案');
assert.ok(checkbox);
invoke(checkbox, 'onClick', false);
tree = score.render();
dialog = find(tree, node => node.type === 'Dialog');
assert.ok(dialog);
assert.equal(dialog.props['visible'], true);
invoke(dialog, 'onOk');
tree = score.render();
dialog = find(tree, node => node.type === 'Dialog');
assert.ok(dialog);
assert.equal(dialog.props['visible'], false);
assert.deepEqual(writes.at(-1), { itemnames: JSON.stringify(itemnames) });
assert.equal(renderedDialog(dialog.props), null);
console.log(
  'Actual date disabled numeric states and Score boolean edit/checkbox/save/cancel flow through Dialog/Footer/Button and React DOM passed',
);
