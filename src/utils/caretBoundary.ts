/** The modern helpers consume these input/textarea methods, not an entire DOM element model. */
export interface CaretControl {
  focus(): void;
  selectionStart?: number | null | undefined;
  setSelectionRange?: ((start: number, end: number) => void) | undefined;
  createTextRange?: (() => unknown) | undefined;
}
export function invokeLegacyCaretMethod(receiver: unknown, name: string, args: unknown[] = []): unknown {
  if (receiver === null || (typeof receiver !== 'object' && typeof receiver !== 'function'))
    throw new TypeError('Invalid legacy caret object');
  const method: unknown = Reflect.get(receiver, name);
  if (typeof method !== 'function') throw new TypeError('Missing legacy caret method ' + name);
  return Reflect.apply(method, receiver, args);
}
