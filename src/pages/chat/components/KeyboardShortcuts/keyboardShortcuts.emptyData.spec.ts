/** Actual component function, response effect and React elements; UI leaves/hooks are controlled. */
import type { ReactElement } from 'react';
import type { SpecHarness } from '../../../../../scripts/spec-harness';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const React: typeof import('react') = require('react');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const TARGET = 'src/pages/chat/components/KeyboardShortcuts/index.tsx';
const sourcePath = process.env.R52_SHORTCUTS_SOURCE || path.join(harness.ROOT, TARGET);
const source = fs.readFileSync(sourcePath, 'utf8');
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function walk(value: unknown, visit: (node: ReactElement<Record<string, unknown>>) => void): void {
  if (Array.isArray(value)) { for (const item of value) walk(item, visit); return; }
  if (React.isValidElement<Record<string, unknown>>(value)) { visit(value); walk(value.props['children'], visit); }
}
function text(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (React.isValidElement<Record<string, unknown>>(value)) return text(value.props['children']);
  throw new TypeError('unexpected React child');
}
function mount(response: unknown, platform: string, reject = false) {
  const state: unknown[] = [], effects: Array<() => unknown> = [], requests: unknown[] = [];
  let cursor = 0, first = true;
  function useState(initial: unknown): [unknown, (next: unknown) => void] {
    const index = cursor++;
    if (!Object.hasOwn(state, index)) state[index] = initial;
    return [state[index], next => { state[index] = typeof next === 'function' ? Reflect.apply(next, undefined, [state[index]]) : next; }];
  }
  function useEffect(effect: () => unknown): void { if (first) effects.push(effect); }
  const styled = () => () => 'DialogLeaf';
  const localRequire = (id: string): unknown => {
    if (id === 'react') return { ...React, useState, useEffect };
    if (id === 'react/jsx-runtime') return require('react/jsx-runtime');
    if (id === 'styled-components') return { __esModule: true, default: styled };
    if (id === 'ming-ui') return { Dialog: 'DialogLeaf', LoadDiv: 'LoadDivLeaf' };
    if (id === 'ming-ui/components/FunctionWrap') return { __esModule: true, default: () => undefined };
    if (id === 'src/api/fixedData') return { __esModule: true, default: { loadHostKeys: (request: unknown) => {
      requests.push(request); return reject ? Promise.reject(new Error('test request rejection')) : Promise.resolve(response);
    } } };
    throw new Error('uncontrolled module: ' + id);
  };
  const compiled = harness.transformSync(source, { filename: path.join(harness.ROOT, TARGET) }).code;
  const module: { exports: unknown } = { exports: {} };
  new Function('module', 'exports', 'require', 'navigator', '_l', 'getCurrentLangCode', compiled)(
    module, module.exports, localRequire, { platform }, (value: string) => value, () => 'en');
  assert.ok(record(module.exports));
  const Comp = module.exports['default'];
  assert.equal(typeof Comp, 'function');
  function render(active?: number): unknown {
    cursor = 0;
    if (active !== undefined) state[0] = active;
    if (typeof Comp !== 'function') throw new TypeError('missing actual component');
    const rendered: unknown = Reflect.apply(Comp, undefined, [{ visible: true }]); first = false; return rendered;
  }
  async function settle(): Promise<void> {
    assert.equal(effects.length, 1);
    for (const effect of effects) effect();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(requests, [{ langType: 'en' }]);
    assert.equal(state[2], false);
  }
  return { render, settle, state, requests };
}
function countSections(tree: unknown): number {
  let count = 0;
  walk(tree, node => { if (node.props['className'] === 'shortcutSection') count++; });
  return count;
}
async function main(): Promise<void> {
  let cases = 0;
  for (const platform of ['MacIntel', 'Win32']) {
    const data: object[] = [];
    const instance = mount(data, platform);
    const loading = instance.render();
    let spinners = 0; walk(loading, node => { if (node.type === 'LoadDivLeaf') spinners++; });
    assert.equal(spinners, 1);
    await instance.settle();
    assert.equal(instance.state[1], data, 'forward the actual API response by reference');
    const loaded = instance.render();
    assert.equal(countSections(loaded), 0, 'empty sections render no content instead of dereferencing undefined');
    assert.ok(text(loaded).includes('键盘快捷键'));
    cases++;
  }
  const populated = [{ section: 'Editing', description: 'Edit actions', unknownMetadata: 'keep', shortcuts: [
    { action: 'Save', 'shortcut-mac': 'Cmd S', 'shortcut-win': 'Ctrl S' },
    { action: 'No keys' },
  ], children: [{ section: 'Nested', shortcuts: [{ action: 'Copy', 'shortcut-mac': 'Cmd C', 'shortcut-win': 'Ctrl C' }] }] }];
  const snapshot = JSON.stringify(populated);
  for (const platform of ['MacIntel', 'Win32']) {
    const instance = mount(populated, platform); instance.render(); await instance.settle();
    const loaded = instance.render(); assert.equal(countSections(loaded), 1);
    const labels = text(loaded);
    for (const value of ['Editing', 'Edit actions', 'Save', 'No keys', 'Nested', 'Copy', platform === 'MacIntel' ? 'Cmd' : 'Ctrl']) assert.ok(labels.includes(value), value);
    assert.equal(JSON.stringify(populated), snapshot);
    assert.equal(instance.state[1], populated);
    assert.equal(countSections(instance.render(99)), 0, 'out-of-range active selection does not crash');
    assert.equal(JSON.stringify(populated), snapshot);
    cases += 2;
  }
  const failed = mount([], 'MacIntel', true); failed.render(); await failed.settle();
  assert.equal(countSections(failed.render()), 0, 'rejected requests stop loading without crashing on the retained empty array'); cases++;
  const malformed = mount(undefined, 'MacIntel'); malformed.render(); await malformed.settle();
  assert.throws(() => malformed.render(), TypeError, 'this local guard is not a dynamic payload validator'); cases++;
  console.log('KeyboardShortcuts empty-data regression passed: ' + cases + ' cases; actual component, response identity, normal tree, platform keys, rejection and invalid payload boundary');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
