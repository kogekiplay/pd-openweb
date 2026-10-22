/** Native property Get on an opaque truthy card, including primitive boxing and getter/proxy receiver. */
export function referencedEntityId(card: NonNullable<unknown>): unknown {
  return Reflect.get(Object(card), 'entityid', card);
}
