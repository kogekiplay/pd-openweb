import { createContext, useContext, useEffect, useState } from 'react';
import { emitter } from 'src/utils/common';
import type { GlobalStoreState, GlobalStoreValue } from './globalStoreTypes';

const GlobalStoreContext = createContext<GlobalStoreValue | undefined>(undefined);

export interface GlobalStoreProviderProps {
  children: React.ReactNode;
}

export const GlobalStoreProvider = ({ children }: GlobalStoreProviderProps) => {
  const [store, setStore] = useState<GlobalStoreState>({});

  const setValue = <Key extends keyof GlobalStoreState>(key: Key, value: GlobalStoreState[Key]) => {
    setStore(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    emitter.on('UPDATE_GLOBAL_STORE', setValue);
    return () => {
      emitter.off('UPDATE_GLOBAL_STORE', setValue);
    };
  }, []);

  return <GlobalStoreContext.Provider value={{ store, setValue }}>{children}</GlobalStoreContext.Provider>;
};

export function useGlobalStore(options: { optional: true }): GlobalStoreValue | undefined;
export function useGlobalStore(options?: { optional?: false | undefined }): GlobalStoreValue;
export function useGlobalStore(options?: { optional?: boolean | undefined }): GlobalStoreValue | undefined {
  const context = useContext(GlobalStoreContext);
  if (!context && !options?.optional) throw new Error('GlobalStoreProvider is required');
  return context;
}
