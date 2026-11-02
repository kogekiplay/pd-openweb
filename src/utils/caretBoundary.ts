/** The modern helpers consume these input/textarea methods, not an entire DOM element model. */
export interface CaretControl {
  focus(): void;
  selectionStart?: number | null | undefined;
  setSelectionRange?: ((start: number, end: number) => void) | undefined;
  createTextRange?: (() => unknown) | undefined;
}
/** Checks the existing caret capabilities, without asserting a whole DOM element shape. */
export function isCaretControl(value: unknown): value is CaretControl {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  const focus: unknown = Reflect.get(value, 'focus');
  const selectionStart: unknown = Reflect.get(value, 'selectionStart');
  const setSelectionRange: unknown = Reflect.get(value, 'setSelectionRange');
  const createTextRange: unknown = Reflect.get(value, 'createTextRange');
  return (
    typeof focus === 'function' &&
    (selectionStart == null || typeof selectionStart === 'number') &&
    (setSelectionRange === undefined || typeof setSelectionRange === 'function') &&
    (createTextRange === undefined || typeof createTextRange === 'function')
  );
}

export function invokeLegacyCaretMethod(receiver: unknown, name: string, args: unknown[] = []): unknown {
  if (receiver === null || (typeof receiver !== 'object' && typeof receiver !== 'function'))
    throw new TypeError('Invalid legacy caret object');
  const method: unknown = Reflect.get(receiver, name);
  if (typeof method !== 'function') throw new TypeError('Missing legacy caret method ' + name);
  return Reflect.apply(method, receiver, args);
}
