import type { SpecHarness } from '../../../../../scripts/spec-harness';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const harness: SpecHarness = require('../../../../../scripts/spec-harness.ts');
const path: typeof import('node:path') = require('node:path');
const root = path.resolve(__dirname, '../../../../../');
const emitter = {
  listeners: new Map<string, Array<(value: unknown) => void>>(),
  emit(name: string, value: unknown) {
    this.listeners.get(name)?.forEach(listener => listener(value));
  },
  addListener(name: string, listener: (value: unknown) => void) {
    this.listeners.set(name, (this.listeners.get(name) || []).concat(listener));
  },
  removeListener(name: string, listener: (value: unknown) => void) {
    this.listeners.set(
      name,
      (this.listeners.get(name) || []).filter(item => item !== listener),
    );
  },
};
const mod: { exports: unknown } = { exports: {} };
const file = harness.resolveSpecTarget(
  path.join(root, 'src/pages/worksheet/common/WorkSheetFilter/filterControlEvents.ts'),
);
const result = harness.transformFileSync(file);
if (!result?.code) throw new TypeError('Missing filter event source');
new Function('module', 'exports', 'require', result.code)(mod, mod.exports, (name: string) => {
  if (name === '../../../../utils/common') return { emitter };
  throw new Error('Unexpected filter event dependency ' + name);
});
function read(value: unknown, key: string): unknown {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function'))
    throw new TypeError('Invalid module');
  return (value as Record<string, unknown>)[key];
}
function call(name: string, args: unknown[]) {
  const fn = read(mod.exports, name);
  if (typeof fn !== 'function') throw new TypeError('Invalid event function');
  return Reflect.apply(fn, mod.exports, args);
}
const control = { controlId: 'field', type: 2, advancedSetting: { opaque: 'keep' } };
const received: unknown[] = [];
const off = call('subscribeFilterControl', ['FILTER', (value: unknown) => received.push(value)]);
call('publishFilterControl', ['FILTER', control]);
assert.equal(received[0], control);
const retained = received[0];
if (retained !== control) throw new TypeError('Publisher did not retain original object');
assert.equal(control.advancedSetting, control.advancedSetting);
assert.throws(() => emitter.emit('FILTER', { controlId: 'field', type: 2 }), /Unregistered/);
off();
call('publishFilterControl', ['FILTER', control]);
assert.equal(received.length, 1);
console.log(
  'Filter control publisher provenance, original object identity, malformed event rejection and unsubscribe passed',
);
