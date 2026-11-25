import type { MakeMessageChain } from '../../../../../../scripts/spec-fixtures/messageReferKcLoader';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { test }: typeof import('node:test') = require('node:test');
const { makeMessageChain } = require('../../../../../../scripts/spec-fixtures/messageReferKcLoader.ts') as {
  makeMessageChain: MakeMessageChain;
};

test('取消发送只移除当前附件，并清理该附件的上传回调', () => {
  const fixture = makeMessageChain();
  const files = { id: 'file', name: 'doc.txt', size: 7, url: '/doc' };
  const message = { isPrepare: true, msg: { files } };
  const item = fixture.instance(fixture.type('src/pages/chat/components/Message/FileMessage/index.tsx'), {
    message,
    session: { id: 's' },
  });
  item.componentDidMount();
  const win = Reflect.get(globalThis, 'window') as Record<string, unknown>;
  const before = win['chatBeforeUploadfile'];
  const progress = win['chatUploadProgressfile'];
  assert.equal(typeof before, 'function');
  assert.equal(typeof progress, 'function');
  (progress as (value: unknown) => void)('42');
  assert.equal(item.state['progress'], 42);

  const removed: unknown[] = [];
  (before as (uploader: unknown) => void)({
    stop: () => assert.fail('取消单个文件不应停止整个队列'),
    start: () => assert.fail('取消单个文件不应启动队列'),
    removeFile: (file: unknown) => removed.push(file),
  });
  item.handleStopFile?.();
  assert.deepEqual(removed, [{ id: files.id }]);
  assert.equal(item.state['cancel'], true);
  assert.equal(win['chatBeforeUploadfile'], undefined);
  assert.equal(win['chatUploadProgressfile'], undefined);
});
