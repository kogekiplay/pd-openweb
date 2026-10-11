import { emitter } from '../../../../utils/common';
import type { FormControl } from '../../../../utils/controlTypes';

/** Internal typed producers register the actual object; this is provenance, not an external JSON decoder. */
const published = new WeakMap<object, FormControl>();
export function publishFilterControl(eventName: string, control: FormControl): void {
  published.set(control, control);
  emitter.emit(eventName, control);
}
export function subscribeFilterControl(eventName: string, listener: (control: FormControl) => void): () => void {
  const receive = (payload: unknown): void => {
    if (payload === null || typeof payload !== 'object')
      throw new TypeError('Unregistered worksheet filter control event');
    const control = published.get(payload);
    if (!control) throw new TypeError('Unregistered worksheet filter control event');
    listener(control);
  };
  emitter.addListener(eventName, receive);
  return () => {
    emitter.removeListener(eventName, receive);
  };
}
