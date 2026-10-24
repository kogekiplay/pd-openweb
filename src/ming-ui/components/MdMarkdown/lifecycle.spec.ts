/** Delayed SDK initialization must not revive a closed editor or ignore its current disabled policy. */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { loadMarkdownLifecycle }: import('../../../../scripts/spec-fixtures/mdMarkdownLifecycle').MarkdownLifecycleModule = require('../../../../scripts/spec-fixtures/mdMarkdownLifecycle.ts');
async function run() {
  {
    const scope = loadMarkdownLifecycle();
    scope.render({}); scope.unmount(); await scope.flushLoading();
    assert.equal(scope.editors.length, 0, 'An owner closed before module loading must not construct an editor');
  }
  {
    const scope = loadMarkdownLifecycle(), registrations: unknown[] = [];
    scope.render({ registerRef: value => registrations.push(value) }); await scope.flushLoading();
    assert.equal(scope.editors.length, 1);
    const editor = scope.editors[0]; assert.ok(editor);
    scope.unmount();
    assert.equal(editor.destroyed, 0, 'Native destroy is unsafe until its async initialization has completed');
    editor.after();
    assert.equal(editor.destroyed, 1, 'A completed abandoned native instance is released exactly once');
    assert.deepEqual(registrations, [], 'A closed owner must never be registered again');
  }
  {
    const scope = loadMarkdownLifecycle(), registrations: unknown[] = [];
    const props = { data: 'initial', registerRef: (value: unknown) => registrations.push(value) };
    scope.render(props); await scope.flushLoading();
    scope.render({ ...props, data: 'latest', disabled: true });
    const editor = scope.editors[0]; assert.ok(editor); editor.after();
    assert.equal(editor.value, 'latest'); assert.equal(editor.disabledCalls, 1);
    assert.equal(registrations[0], editor, 'Keep the exact native instance reference');
    scope.render({ ...props, data: 'latest', disabled: false });
    assert.equal(editor.enabledCalls, 1);
    scope.unmount(); assert.equal(editor.destroyed, 1);
  }
  {
    const scope = loadMarkdownLifecycle(), registrations: unknown[] = [];
    const props = { registerRef: (value: unknown) => registrations.push(value) };
    scope.render(props); await scope.flushLoading();
    scope.replayEffects(props); await scope.flushLoading();
    assert.equal(scope.editors.length, 2);
    const [abandoned, current] = scope.editors; assert.ok(abandoned && current);
    abandoned.after(); assert.equal(abandoned.destroyed, 1); assert.deepEqual(registrations, []);
    current.after(); assert.equal(registrations[0], current);
    scope.unmount(); assert.equal(current.destroyed, 1); assert.equal(abandoned.destroyed, 1);
  }
  {
    const scope = loadMarkdownLifecycle(), failure = new Error('native consumer failure');
    scope.render({ registerRef() { throw failure; } }); await scope.flushLoading();
    const editor = scope.editors[0]; assert.ok(editor);
    assert.throws(() => editor.after(), value => value === failure, 'Live consumer failures keep their original identity');
    scope.unmount();
  }
  console.log('MdMarkdown actual lifecycle: cancellation before construction and native readiness, current disabled/data, instance identity, effect replay, native consumer failure and cleanup');
}
run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
