/**
 * TextMessage 渲染规格（持续目标·TextMessage 最小真实合同）。
 *
 * 真实调用链：containers/Message 按 Constant.MSGTYPE_TEXT(=1，utils/constant.ts:24) 渲染
 * <TextMessage message={message} />；TextMessage 只把 message.msg.con 原样交给
 * utils.messageContentParser，结果注入 span.Message-text 的 dangerouslySetInnerHTML.__html。
 *
 * 行为底线（与改动前逐条一致）：
 * - con 原样传入（不转义/不包裹/不兜底），getter 只读一次且 receiver 是原对象；
 * - msg 缺失保留原生 TypeError（改动前 message.msg.con 同样抛），且不调用 parser；
 * - con 缺失时仍传 undefined（不兜底成空串），真实 parser 对 undefined 原生失败；
 * - 真实 parser 的产物被原样注入。
 *
 * 自包含：不静态 import 产品模块，由 spec-harness 的 fixture 载入真实源码。
 */
import type { MakeMessageChain } from '../../../../../../scripts/spec-fixtures/messageReferKcLoader';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { makeMessageChain } = require('../../../../../../scripts/spec-fixtures/messageReferKcLoader.ts') as {
  makeMessageChain: MakeMessageChain;
};

type Data = Record<string, unknown>;
interface Rendered {
  type: unknown;
  props: Data;
}
interface ComponentInstance {
  render(): Rendered;
}
type MessageComponent = new (props: Data) => ComponentInstance;

const TEXT_LEAF = 'src/pages/chat/components/Message/TextMessage';
const TEXT_FILE = TEXT_LEAF + '/index.tsx';
const PARSER_FILE = 'src/pages/chat/utils/index.ts';

function chainWithStub(): { chain: ReturnType<MakeMessageChain>; calls: unknown[] } {
  const calls: unknown[] = [];
  const chain = makeMessageChain({
    moduleOverride(file: string, request: string) {
      if (file === TEXT_FILE && request === '../../../utils') {
        return {
          messageContentParser(value: unknown) {
            calls.push(value);
            return '<p>stub-html</p>';
          },
        };
      }
      return undefined;
    },
  });
  return { chain, calls };
}

function chainWithRealParser(): ReturnType<MakeMessageChain> {
  return makeMessageChain({
    moduleOverride(file: string, request: string) {
      // 表情模块是 UI 叶子：只把它换成恒等桩，tagConvert/toLink/replace 四级管道仍是真实源码。
      if (request === 'src/components/emotion/emotion') {
        return {
          __esModule: true,
          default: {
            parse(value: unknown) {
              return value;
            },
          },
        };
      }
      return undefined;
    },
  });
}

function loadComponent(chain: ReturnType<MakeMessageChain>): MessageComponent {
  const value = chain.load(TEXT_FILE)['default'];
  if (typeof value !== 'function') throw new TypeError('真实 TextMessage 默认导出缺失');
  return value as MessageComponent;
}

function innerHtml(element: Rendered): unknown {
  const holder = element.props['dangerouslySetInnerHTML'];
  if (!holder || typeof holder !== 'object') throw new TypeError('缺少 dangerouslySetInnerHTML');
  return (holder as Data)['__html'];
}

let passed = 0;
function check(name: string, run: () => void): void {
  run();
  passed += 1;
  console.log('  ✓ ' + name);
}

function main(): void {
  check('真实父组件按 MSGTYPE_TEXT 渲染 TextMessage 叶子并原样传同一个 message', () => {
    const { chain } = chainWithStub();
    const message: Data = { id: 'm1', type: 1, msg: { con: 'hello' } };
    const owner = chain.message(message, { id: 's', value: 's' });
    const leaf = chain.nodes(owner.renderUserMessage()).find(node => {
      const type = node.type as { fixturePath?: string } | null;
      return !!type && type.fixturePath === TEXT_LEAF;
    });
    assert.ok(leaf, '父组件没有渲染真实 TextMessage 叶子');
    assert.equal(leaf.props['message'], message);
  });

  check('真实组件把 con 原样交给 parser 一次，并原样注入 parser 产物', () => {
    const { chain, calls } = chainWithStub();
    const Type = loadComponent(chain);
    const trace: string[] = [];
    const receivers: string[] = [];
    const msg = Object.defineProperty({}, 'con', {
      get() {
        trace.push('con');
        receivers.push(this === msg ? 'msg-self' : 'msg-other');
        return 'a  b';
      },
    });
    const message = Object.defineProperty({}, 'msg', {
      get() {
        trace.push('msg');
        receivers.push(this === message ? 'message-self' : 'message-other');
        return msg;
      },
    });
    const element = new Type({ message }).render();
    assert.equal(element.type, 'span');
    assert.equal(element.props['className'], 'Message-text');
    assert.deepEqual(calls, ['a  b']);
    assert.equal(innerHtml(element), '<p>stub-html</p>');
    assert.deepEqual(trace, ['msg', 'con']);
    assert.deepEqual(receivers, ['message-self', 'msg-self']);
  });

  check('con 缺失时仍原样传 undefined，不兜底成空串', () => {
    const { chain, calls } = chainWithStub();
    const Type = loadComponent(chain);
    const element = new Type({ message: { msg: {} } }).render();
    assert.deepEqual(calls, [undefined]);
    assert.equal(innerHtml(element), '<p>stub-html</p>');
  });

  check('msg 缺失保留原生 TypeError，且不调用 parser', () => {
    const { chain, calls } = chainWithStub();
    const Type = loadComponent(chain);
    assert.throws(() => new Type({ message: {} }).render(), TypeError);
    assert.deepEqual(calls, []);
  });

  check('真实 messageContentParser 的产物被真实组件原样注入', () => {
    const chain = chainWithRealParser();
    const Type = loadComponent(chain);
    const parser = chain.load(PARSER_FILE)['messageContentParser'];
    if (typeof parser !== 'function') throw new TypeError('真实 messageContentParser 缺失');
    const con = '第一行\n第二行 <b>x</b>  a  b';
    const element = new Type({ message: { msg: { con } } }).render();
    const html = innerHtml(element);
    assert.equal(html, (parser as (value: unknown) => unknown)(con));
    assert.ok(String(html).includes('<br>'), '真实换行转换未生效');
    // 真实 tagConvert 用无分号的 &lt / &gt（utils/index.ts:542），所以转义结果是 &ltb&gt;。
    assert.ok(String(html).includes('&ltb&gt;'), '真实标签转义未生效');
    assert.ok(!String(html).includes('<b>'), '真实尖括号没有被转义');
  });

  check('真实 parser 对 con 缺失的原生失败经组件原样传播', () => {
    const chain = chainWithRealParser();
    const Type = loadComponent(chain);
    assert.throws(() => new Type({ message: { msg: {} } }).render(), TypeError);
  });

  console.log('chat/TextMessage 真实合同规格通过：' + passed + ' 项');
}

main();
