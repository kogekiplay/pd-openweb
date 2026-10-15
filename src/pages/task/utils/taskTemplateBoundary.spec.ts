const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const parser: typeof import('@babel/parser') = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const { transformSync } = require('../../../../scripts/spec-harness.ts');
const dot = require('dot');
const filename = path.join(__dirname, 'taskComm.tsx');
const source = fs.readFileSync(filename, 'utf8');
const ast = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const callbacks: import('@babel/types').ArrowFunctionExpression[] = [];
traverse(ast, {
  CallExpression(node: { node: import('@babel/types').CallExpression }) {
    const { callee, arguments: args } = node.node;
    if (
      callee.type !== 'MemberExpression' ||
      callee.property.type !== 'Identifier' ||
      callee.property.name !== 'then' ||
      !generate(callee.object).code.includes('taskTree/tpl/treeMaster.html')
    )
      return;
    const callback = args[0];
    assert.equal(callback?.type, 'ArrowFunctionExpression');
    if (callback?.type === 'ArrowFunctionExpression') callbacks.push(callback);
  },
});
assert.equal(callbacks.length, 2, 'Both real dynamic import consumers are covered');
const template = fs.readFileSync(path.join(__dirname, '../containers/taskTree/tpl/treeMaster.html'), 'utf8');
const task = {
  taskID: 'task',
  taskName: '<Task>',
  status: 0,
  auth: 2,
  stageID: 'stage',
  charge: { status: 1, avatar: 'face.png', accountID: 'owner' },
};
const fixtures = {
  deep: 0,
  pageIndex: 2,
  isNew: true,
  data: { stages: [{ id: 'stage', tasks: [task] }] },
  formatStatus: () => ({ style: 'open', tip: 'Open', auth: 2 }),
  formatTaskTime: () => '09:00',
};
Reflect.set(globalThis, '_l', (text: string) => text);
for (const callback of callbacks) {
  const writes: unknown[][] = [];
  const selection = {
    closest: () => selection,
    prepend: (value: unknown) => writes.push(['prepend', value]),
    remove: () => writes.push(['remove']),
  };
  const env = {
    doT: dot,
    folders: fixtures,
    newData: fixtures,
    taskId: 'task',
    parentId: 'parent',
    oldParentId: 'old',
    $: (value: string) => (value.trimStart().startsWith('<') ? value : selection),
    afterUpdateTaskParentComm: (...args: unknown[]) => writes.push(args),
  };
  const code = transformSync('const callback = ' + generate(callback).code, { filename }).code;
  const run = new Function(...Object.keys(env), code + '\nreturn callback;')(...Object.values(env));
  run({ default: template });
  const rendered = writes.flat().find(value => typeof value === 'string' && value.includes('data-taskid="task"'));
  assert.equal(typeof rendered, 'string', 'The imported namespace is unwrapped before real doT compilation');
  assert.match(String(rendered), /(?:&#60;|&lt;)Task(?:&#62;|&gt;)/, 'Names retain template escaping');
}

console.log('Both actual task tree import callbacks render and escape the default HTML export');
