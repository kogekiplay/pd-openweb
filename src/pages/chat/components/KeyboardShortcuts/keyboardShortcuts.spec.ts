/**
 * KeyboardShortcuts 入口/Props 行为规格（task-6 最小切片）。
 *
 * 【为什么这样测】本切片只把入口 props 收成有限合同，不改行为：
 * `dialogKeyboardShortcuts()` 的唯一职责是把真实组件 + 调用方 props 交给 ming-ui `functionWrap`；
 * functionWrap 自己再注入 visible/onClose（src/ming-ui/components/FunctionWrap.tsx:88-100）。
 * 因此这里锁三件真实行为：
 * 1) 无参调用 → functionWrap 收到真实默认导出组件与空 props 对象；
 * 2) 调用方 props 原样转发（同一函数引用），且不修改入参对象；
 * 3) 未知额外键也原样透传（functionWrap 是真正的边界，入口不裁剪/不合成）。
 * 不测 LoadHostKeys 响应形态：服务端返回 dynamic（HotKeys.json），本轮无真实数据，属保留债务。
 *
 * 【自包含】按 tsconfig.tools.json 口径：不静态 import 产品模块，由 harness 读源码 + babel 载入；
 * 只把 functionWrap / styled-components / ming-ui / fixedData 四个真实边界换成记录桩。
 */
import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');

const TARGET = 'src/pages/chat/components/KeyboardShortcuts/index.tsx';

interface ForwardCall {
  Comp: unknown;
  props: Record<string, unknown>;
}
interface LoadedModule {
  default: unknown;
  dialogKeyboardShortcuts: (props?: Record<string, unknown>) => unknown;
}

const calls: ForwardCall[] = [];

function loadModule(): LoadedModule {
  const file = path.join(harness.ROOT, TARGET);
  const transformed = harness.transformFileSync(file);
  if (!transformed || typeof transformed.code !== 'string') throw new Error('babel 未能转换真实模块');
  const module = { exports: {} as Record<string, unknown> };
  const styled = () => () => 'StyledComponent';
  const localRequire = (name: string): unknown => {
    if (name === 'react') return require('react');
    if (name === 'react/jsx-runtime') return require('react/jsx-runtime');
    if (name === 'styled-components') return { __esModule: true, default: styled };
    if (name === 'ming-ui') return { Dialog: 'Dialog', LoadDiv: 'LoadDiv' };
    if (name === 'ming-ui/components/FunctionWrap') {
      return {
        __esModule: true,
        default: (Comp: unknown, props: Record<string, unknown>) => {
          calls.push({ Comp, props });
          return 'wrapped-handle';
        },
      };
    }
    if (name === 'src/api/fixedData') return { __esModule: true, default: { loadHostKeys: () => Promise.resolve([]) } };
    if (/\.(less|css|html)$/.test(name)) return '';
    return require(name);
  };
  new Function('module', 'exports', 'require', transformed.code)(module, module.exports, localRequire);
  return module.exports as unknown as LoadedModule;
}

let passed = 0;
function check(name: string, run: () => void): void {
  run();
  passed += 1;
  console.log('  ✓ ' + name);
}

function main(): void {
  const mod = loadModule();

  check('无参入口把真实默认导出组件与空 props 交给 functionWrap，并返回其返回值', () => {
    calls.length = 0;
    const returned = mod.dialogKeyboardShortcuts();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].Comp, mod.default);
    assert.deepEqual(Object.keys(calls[0].props), []);
    assert.equal(returned, 'wrapped-handle');
  });

  check('调用方 props 原样转发（函数同一性）且不修改入参对象', () => {
    calls.length = 0;
    const onClose = () => {};
    const input = { visible: false, onClose };
    mod.dialogKeyboardShortcuts(input);
    assert.equal(calls.length, 1);
    const forwarded = calls[0].props;
    assert.equal(forwarded.visible, false);
    assert.equal(forwarded.onClose, onClose);
    assert.notEqual(forwarded, input);
    assert.equal(input.visible, false);
    assert.equal(input.onClose, onClose);
  });

  check('未知额外键原样透传，入口不裁剪/不合成', () => {
    calls.length = 0;
    mod.dialogKeyboardShortcuts({ visible: true, extra: 'kept' });
    assert.deepEqual(calls[0].props, { visible: true, extra: 'kept' });
  });

  console.log('chat/KeyboardShortcuts 入口规格通过：' + passed + ' 项');
}

main();
