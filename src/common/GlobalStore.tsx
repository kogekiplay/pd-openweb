import { createContext, useContext, useEffect, useState } from 'react';
import { emitter } from 'src/utils/common';

const GlobalStoreContext = createContext();

export interface GlobalStoreProviderProps {
  children: React.ReactNode;
}

export const GlobalStoreProvider = ({ children }: GlobalStoreProviderProps) => {
  const [store, setStore] = useState({});

  const setValue = (key, value) => {
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

export const useGlobalStore = () => {
  return useContext(GlobalStoreContext);
};
