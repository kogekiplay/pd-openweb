import { useCallback, useEffect, useRef } from 'react';
import type { Ref } from 'react';
import { useComposeRef } from '@rc-component/util';
import { observeColorMix } from 'src/utils/platform/theme/colorMix';

export default function useColorMix<T extends HTMLElement>(
  mixes?: Record<string, { color: string; percent: number; mixColor?: string }> | null,
  forwardedRef: Ref<T> = null,
) {
  const elementRef = useRef<T | null>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  const setRef = useCallback(
    (element: T | null) => {
      cleanupRef.current?.();
      elementRef.current = element;
      cleanupRef.current = element ? observeColorMix(element, mixes) : undefined;
    },
    [mixes],
  );

  useEffect(() => {
    if (elementRef.current && !cleanupRef.current) {
      cleanupRef.current = observeColorMix(elementRef.current, mixes);
    }

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = undefined;
    };
  }, [mixes]);

  return useComposeRef(setRef, forwardedRef);
}