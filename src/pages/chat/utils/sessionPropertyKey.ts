/** Preserve native indexing for the declared optional textual session ID. This is a property key, not a fabricated ID. */
export function sessionPropertyKey(id: string | undefined): string {
  return id === undefined ? 'undefined' : id;
}
