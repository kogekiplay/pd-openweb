import { useRef } from 'react';

export function useRefCache<Cache extends object>(
  initial: Cache,
): [Cache, <Key extends keyof Cache>(key: Key, value: Cache[Key]) => void] {
  const cache = useRef(initial);
  function set<Key extends keyof Cache>(key: Key, value: Cache[Key]): void {
    if (value === undefined) delete cache.current[key];
    else cache.current[key] = value;
  }
  return [cache.current, set];
}
