import _ from 'lodash';
import { INBOXTYPES } from './constants';
import type { InboxType } from './constants';

/** Same fresh value membership as getIsInbox; inherited names are not inbox identities. */
export function isInboxType(value: unknown): value is InboxType {
  return _.toArray<unknown>(INBOXTYPES).includes(value);
}

export function requireInboxType(value: unknown): InboxType {
  if (!isInboxType(value)) throw new Error('type in options not recognized!');
  return value;
}

/** A finite table may be indexed only after proving the key belongs to that object. */
export function hasOwnKey<T extends object>(target: T, key: string): key is Extract<keyof T, string> {
  return Object.hasOwn(target, key);
}
