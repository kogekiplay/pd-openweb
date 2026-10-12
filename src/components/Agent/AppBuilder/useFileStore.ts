import { useCallback, useEffect, useReducer } from 'react';
import type { SetStateAction } from 'react';
import { useAgentBus, useAgentEvent } from '../agentBus';
import { decodeFileEvent, initialFileStore, reduceFileStore, sidebarItemsOf } from './fileStore';
import type { FileTopic } from './fileStore';

export function useFileStore() {
  const bus = useAgentBus();
  const [state, dispatch] = useReducer(reduceFileStore, undefined, initialFileStore);
  const handle = useCallback(
    (topic: FileTopic) => (payload: unknown) => {
      const event = decodeFileEvent(topic, payload);
      if (event) dispatch(event);
    },
    [],
  );
  useAgentEvent('file:begin', handle('file:begin'));
  useAgentEvent('file:delta', handle('file:delta'));
  useAgentEvent('file:end', handle('file:end'));
  useAgentEvent('file:write', handle('file:write'));
  useAgentEvent('file:focus', handle('file:focus'));
  const setFocus = useCallback((value: SetStateAction<string | null>) => dispatch({ topic: 'focus', value }), []);
  const { files, focus } = state;
  useEffect(() => {
    bus.emit('builder:files-sync', { files, focus });
  }, [bus, files, focus]);
  return { files, focus, setFocus, sidebarItems: sidebarItemsOf(state) };
}
