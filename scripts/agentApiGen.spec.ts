const assert = require('assert');
const path = require('path');
const { transformFileSync } = require('./spec-harness.ts');

function loadAgentApiGenInternals() {
  const filename = path.join(__dirname, 'agentApiGen.ts');
  // 【必须先转译】这里是拿源码文本喂 new Function，那是纯 JavaScript 解析器。
  // agentApiGen 从 .js 改名成 .ts 之后，源码里的类型标注对 new Function 就是语法错
  //（实测：`const grouped: Record<string, any[]> = …` -> Missing initializer in const declaration）。
  // 走 spec-harness 的 babel 转译把类型擦掉再 eval。
  const source = `${transformFileSync(filename).code}\nmodule.exports.__test = { parseSwagger };`;
  const moduleLike: { exports: Record<string, any> } = { exports: {} };

  new Function('require', 'module', 'exports', '__dirname', '__filename', source)(
    require,
    moduleLike,
    moduleLike.exports,
    __dirname,
    filename,
  );

  return moduleLike.exports.__test;
}

const { parseSwagger } = loadAgentApiGenInternals();
const fns = parseSwagger({
  paths: {
    '/api/chat/stream': {
      post: {
        summary: '以 SSE 协议执行请求',
        parameters: [],
      },
    },
  },
  components: {
    schemas: {},
  },
});

assert.strictEqual(fns.length, 1);
assert.strictEqual(fns[0].name, 'chatStream');
assert.strictEqual(fns[0].isStream, true);

console.log('agentApiGen tests passed');
