const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('../../../scripts/spec-harness');

// 国际化函数由运行时全局注入（buildSteps 等模块在顶层就调用），测试里补一个恒等实现
global._l = s => s;

// 与 ui/MentionInput/index.spec.js 同一套加载方式：babel 转 ESM + stub 掉带副作用的依赖。
// streamEvents 直接/间接依赖 src/api/agent（浏览器环境），故把 ./agentService 整个 stub 掉，
// 只提供本用例真正用到的两个纯 helper。
function requireEsm(file, stubs = {}) {
  const module = { exports: {} };
  const { code } = transformFileSync(path.join(__dirname, file), {
    babelrc: false,
    presets: ['@babel/preset-react'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  function localRequire(request) {
    if (stubs[request]) return stubs[request];
    return require(request);
  }

  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}

// 与 agentService 真实实现同义：大小写不敏感取字段（后端 Pascal / camel 混用）
function readField(source, key) {
  if (!source || typeof source !== 'object') return undefined;
  if (key in source) return source[key];
  const target = key.toLowerCase();

  for (const [k, v] of Object.entries(source)) {
    if (k.toLowerCase() === target) return v;
  }

  return undefined;
}

const { restorePendingConfirmation } = requireEsm('streamEvents.js', {
  './agentService': {
    readField,
    stringValue: v => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
    summarizeUnknown: () => '',
  },
  // 模块顶层依赖，与本用例无关（且 partial-json 未必装在本地）——stub 掉只为让模块能加载
  'partial-json': { parse: () => ({}) },
});

const assistantAt = (id, parts = []) => ({ id, role: 'assistant', parts });
const userAt = (id, parts = []) => ({ id, role: 'user', parts });
const confirmPartOf = message => (message.parts || []).find(p => p.kind === 'rebuild-confirm');

// ① 挂到最后一条 assistant 消息，而不是数组末尾（末尾常是用户那条「继续」）
{
  const messages = [assistantAt('a1'), userAt('u1'), assistantAt('a2'), userAt('u2')];
  const next = restorePendingConfirmation(messages, { stepId: '__rebuild__', options: ['rebuild', 'none_of_these'] });
  const part = confirmPartOf(next[2]);

  assert.ok(part, '弹层应挂在最后一条 assistant 消息上');
  assert.strictEqual(part.stepId, '__rebuild__');
  assert.deepStrictEqual(part.options, ['rebuild', 'none_of_these']);
  assert.strictEqual(part.status, 'pending', '还原出来必须可点击');
  assert.ok(!confirmPartOf(next[0]), '不应挂到更早的 assistant 消息');
  assert.ok(!confirmPartOf(next[3]), '不应挂到用户消息');
}

// ② 后端字段若是 PascalCase 也要认（readField 大小写不敏感）
{
  const next = restorePendingConfirmation([assistantAt('a1')], { StepId: '__rebuild__', Options: ['rebuild'] });

  assert.deepStrictEqual(confirmPartOf(next[0]).options, ['rebuild']);
}

// ③ 无挂起 / 空历史：原样返回，不产生任何 part
{
  const messages = [assistantAt('a1')];

  assert.strictEqual(restorePendingConfirmation(messages, null), messages);
  assert.strictEqual(restorePendingConfirmation(messages, undefined), messages);
  assert.deepStrictEqual(restorePendingConfirmation([], { stepId: 'x', options: ['rebuild'] }), []);
}

// ④ 只有用户消息（无处安放）：不还原，也不得抛
{
  const messages = [userAt('u1')];

  assert.strictEqual(restorePendingConfirmation(messages, { stepId: '__rebuild__', options: ['rebuild'] }), messages);
}

// ⑤ 幂等：重复还原不会追加出第二张卡（upsert by kind）
{
  const once = restorePendingConfirmation([assistantAt('a1')], { stepId: '__rebuild__', options: ['rebuild'] });
  const twice = restorePendingConfirmation(once, { stepId: '__rebuild__', options: ['rebuild'] });

  assert.strictEqual(twice[0].parts.filter(p => p.kind === 'rebuild-confirm').length, 1);
}

// ⑥ 不破坏原消息已有的 parts
{
  const next = restorePendingConfirmation([assistantAt('a1', [{ kind: 'text', text: '已建到第 3 步' }])], {
    stepId: '__rebuild__',
    options: ['rebuild'],
  });

  assert.strictEqual(next[0].parts.length, 2);
  assert.strictEqual(next[0].parts[0].kind, 'text');
}

console.log('streamEvents tests passed');
