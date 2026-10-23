/** The external addMention operation always inserts @ targets, including the supported array form. */
export interface MentionTarget {
  id?: string | undefined;
  logo?: string | undefined;
  name?: string | undefined;
  fullname?: string | undefined;
  type?: string | undefined;
  chatAt?: boolean | undefined;
}
export type MentionInsertion = MentionTarget | MentionTarget[];
const nativeCall: { apply(target: unknown, receiver: unknown, args: unknown[]): unknown } = Reflect;
/** A missing enhancement is a normal lifecycle gap. Existing getters/callables and malformed methods keep native behavior. */
export function tryAddMention(element: unknown, mention: MentionInsertion): boolean {
  if (element === null || element === undefined) return false;
  const method: unknown = Reflect.get(Object(element), 'addMention', element);
  if (method === undefined || method === null) return false;
  nativeCall.apply(method, element, [mention]);
  return true;
}
