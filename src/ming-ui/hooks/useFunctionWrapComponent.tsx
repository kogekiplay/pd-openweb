import { type ComponentType, type ReactNode, useCallback, useState } from 'react';

export interface FunctionWrapCloseProps {
  onClose: () => void;
}
export default function useFunctionWrapComponent<P extends FunctionWrapCloseProps>(Component: ComponentType<P>) {
  const [props, setProps] = useState<Omit<P, 'onClose'> | undefined>();
  const close = useCallback(() => setProps(undefined), []);
  const open = useCallback((next: Omit<P, 'onClose'>) => setProps(next), []);
  const holder: ReactNode = props === undefined ? null : <Component {...({ ...props, onClose: close } as P)} />;
  return { open, holder };
}
