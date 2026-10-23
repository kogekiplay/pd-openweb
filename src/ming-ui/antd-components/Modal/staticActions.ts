import type { ModalFuncProps } from 'antd';

export type ModalClose = (...args: unknown[]) => void;
/** Zero-argument callbacks and the native manual-close callback both fit this invocation surface. */
export type StaticAction = (close: ModalClose) => unknown;
export interface StaticModalProps extends Omit<ModalFuncProps, 'onOk' | 'onCancel'> {
  onOk?: StaticAction | undefined;
  onCancel?: StaticAction | undefined;
}
export type StaticConfigUpdate = StaticModalProps | ((previous: StaticModalProps) => StaticModalProps);
interface NativeControl {
  destroy: () => void;
  update: (next: ModalFuncProps | ((previous: ModalFuncProps) => ModalFuncProps)) => void;
}
export type GuardedControl<C extends NativeControl> = Omit<C, 'update'> & { update(next: StaticConfigUpdate): void };
const nativeCall: { apply(target: unknown, receiver: unknown, args: unknown[]): unknown } = Reflect;
/** SDK declarations exclude own undefined callbacks; its actual config spread accepts and retains them.
 * Reflective invocation preserves that JS input mode and derives only the native method's declared return. */
function invokeNative<R>(method: (...args: never[]) => R, receiver: unknown, args: unknown[]): R {
  return Reflect.apply(method, receiver, args);
}

/** New 7.5.2 execution lock, retaining native close-parameter consumers of this fork. */
export function getStaticAction(action: StaticAction | undefined): StaticAction | undefined {
  if (typeof action !== 'function') return action;
  let executing = false;
  return close => {
    // Read the original callable's arity only when the native button invokes it, not when configuring a modal.
    if (action.length) return nativeCall.apply(action, undefined, [close]);
    if (executing) return undefined;
    executing = true;
    try {
      const result = nativeCall.apply(action, undefined, []);
      if (result === false) { executing = false; return undefined; }
      const then: unknown = result === null || result === undefined ? undefined : Reflect.get(Object(result), 'then', result);
      if (typeof then === 'function') {
        return Promise.resolve(result).catch((error: unknown) => { executing = false; throw error; });
      }
      close();
      return undefined;
    } catch (error) {
      executing = false;
      throw error;
    }
  };
}

function actionCache() {
  const guards = new WeakMap<StaticAction, StaticAction>();
  const originals = new WeakMap<StaticAction, StaticAction>();
  return (action: StaticAction): StaticAction => {
    const original = originals.get(action) || action;
    const existing = guards.get(original); if (existing) return existing;
    const guarded = getStaticAction(original);
    // A callable input always yields its callable adapter; keep this intrinsic fact explicit without a DTO assertion.
    if (!guarded) throw new TypeError('Missing static action adapter');
    guards.set(original, guarded); originals.set(guarded, original);
    return guarded;
  };
}

/** One cache per modal and per action slot; updates retain locks while preserving native controller identity. */
export function wrapStaticMethod<C extends NativeControl>(method: (config: ModalFuncProps) => C) {
  function wrapped(this: unknown, input: StaticModalProps): GuardedControl<C> {
    const ok = actionCache(), cancel = actionCache();
    const config = (next: StaticModalProps): StaticModalProps => {
      const copied = { ...next };
      if (typeof copied.onOk === 'function') copied.onOk = ok(copied.onOk);
      if (typeof copied.onCancel === 'function') copied.onCancel = cancel(copied.onCancel);
      return copied;
    };
    const controller = invokeNative(method, this, [config(input)]);
    const nativeUpdate = controller.update;
    const update = function (this: unknown, next: StaticConfigUpdate): void {
      if (typeof next === 'function') {
        invokeNative(nativeUpdate, this, [(previous: ModalFuncProps) => {
          const current: StaticModalProps = previous;
          return config(next(current));
        }]);
      } else invokeNative(nativeUpdate, this, [config(next)]);
    };
    return Object.assign(controller, { update });
  }
  // Native static and hook methods have different reflection arities; this adapter changes neither.
  Object.defineProperty(wrapped, 'length', { value: method.length });
  return wrapped;
}
