import { entryByPath, hasData, makeInitialFiles, META_FILE_PATH, parseFile, SIDEBAR_ITEMS } from './fileRegistry';
import { isFileRecord } from './fileTypes';
import type { FileEntry, FileMap, FileState, SidebarItem } from './fileTypes';

export type FileTopic = 'file:begin' | 'file:delta' | 'file:end' | 'file:write' | 'file:focus';
export type FileEvent =
  | { topic: 'file:begin'; path: string }
  | { topic: 'file:delta'; path: string; delta: string }
  | { topic: 'file:end'; path: string }
  | { topic: 'file:write'; path: string; content: string }
  | { topic: 'file:focus'; path: string };
export interface FileStoreState {
  files: FileMap;
  focus: string | null;
  pathOrder: string[];
  generationId: string | number | undefined;
  metaBuffer: string;
  regenFired: boolean;
}
export type FileStoreAction =
  FileEvent | { topic: 'focus'; value: string | null | ((previous: string | null) => string | null) };
export function initialFileStore(): FileStoreState {
  return {
    files: makeInitialFiles(),
    focus: null,
    pathOrder: [],
    generationId: undefined,
    metaBuffer: '',
    regenFired: false,
  };
}
export function decodeFileEvent(topic: FileTopic, payload: unknown): FileEvent | null {
  if (!isFileRecord(payload)) return null;
  const path = payload['path'];
  if (typeof path !== 'string' || !entryByPath(path)) return null;
  if (topic === 'file:delta') {
    const delta = payload['delta'];
    if (typeof delta === 'string') return { topic, path, delta };
    return delta === null || delta === undefined ? { topic, path, delta: '' } : null;
  }
  if (topic === 'file:write') {
    const content = payload['content'];
    if (typeof content === 'string') return { topic, path, content };
    return content === null || content === undefined ? { topic, path, content: '' } : null;
  }
  return { topic, path };
}
function tryParse(entry: FileEntry, content: string): unknown {
  try {
    return parseFile(entry, content);
  } catch {
    return undefined;
  }
}

// A partial parser returns unfinished strings too. Compare only complete top-level ID values.
export function readGenerationId(content: string): string | number | undefined {
  let depth = 0;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '{' || char === '[') {
      depth += 1;
      continue;
    }
    if (char === '}' || char === ']') {
      depth -= 1;
      continue;
    }
    if (char !== '"') continue;
    const start = index;
    let end = index + 1;
    while (end < content.length) {
      if (content[end] === '\\') {
        end += 2;
        continue;
      }
      if (content[end] === '"') break;
      end += 1;
    }
    if (end >= content.length) return undefined;
    index = end;
    if (depth !== 1) continue;
    let key: unknown;
    try {
      key = JSON.parse(content.slice(start, end + 1));
    } catch {
      return undefined;
    }
    if (key !== 'planGenerationId') continue;
    // A string value may equal the key name; only a property is followed by a colon.
    if (!/^\s*:/.test(content.slice(end + 1))) continue;
    const match = content
      .slice(end + 1)
      .match(/^\s*:\s*("(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?=\s*[,}]))/);
    if (!match?.[1]) return undefined;
    try {
      const value: unknown = JSON.parse(match[1]);
      return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) ? value : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
function track(order: string[], path: string): string[] {
  return order.includes(path) ? order : [...order, path];
}
export function reduceFileEvent(state: FileStoreState, event: FileEvent): FileStoreState {
  const entry = entryByPath(event.path);
  if (!entry) return state;
  if (event.topic === 'file:focus') return state.focus === event.path ? state : { ...state, focus: event.path };
  let next = state;
  if (event.path === META_FILE_PATH) {
    if (event.topic === 'file:begin') next = { ...state, metaBuffer: '', regenFired: false };
    if (event.topic === 'file:delta') {
      const metaBuffer = state.metaBuffer + event.delta;
      const generationId = readGenerationId(metaBuffer);
      next = { ...state, metaBuffer };
      if (generationId !== undefined && generationId !== '' && !state.regenFired) {
        const changed = state.generationId !== undefined && generationId !== state.generationId;
        const files = changed ? makeInitialFiles() : state.files;
        const metadata = state.files[META_FILE_PATH];
        if (changed && metadata) files[META_FILE_PATH] = metadata;
        next = {
          ...next,
          files,
          generationId,
          regenFired: changed,
          pathOrder: changed ? state.pathOrder.filter(path => path === META_FILE_PATH) : state.pathOrder,
          focus: changed ? null : state.focus,
        };
      }
    }
    if (event.topic === 'file:write') {
      const generationId = readGenerationId(event.content);
      if (generationId !== undefined && generationId !== '') next = { ...state, generationId };
    }
  }
  const current: FileState = next.files[event.path] || { content: '', parsed: null, status: 'idle' };
  let file: FileState;
  switch (event.topic) {
    case 'file:begin':
      file = {
        ...current,
        content: '',
        parsed: entry.type === 'markdown' ? '' : (current.parsed ?? null),
        status: 'streaming',
      };
      break;
    case 'file:delta': {
      const content = current.content + event.delta;
      const parsed = entry.type === 'markdown' ? content : tryParse(entry, content);
      file = { ...current, content, parsed: parsed === undefined ? current.parsed : parsed, status: 'streaming' };
      break;
    }
    case 'file:end': {
      const parsed = tryParse(entry, current.content);
      file = { ...current, parsed: parsed === undefined ? current.parsed : parsed, status: 'ready' };
      break;
    }
    case 'file:write': {
      const parsed = tryParse(entry, event.content);
      file = {
        ...current,
        content: event.content,
        parsed: parsed === undefined ? current.parsed : parsed,
        status: 'ready',
      };
      break;
    }
  }
  return {
    ...next,
    files: { ...next.files, [event.path]: file },
    pathOrder:
      event.topic === 'file:begin' || event.topic === 'file:write' ? track(next.pathOrder, event.path) : next.pathOrder,
    focus: event.topic === 'file:begin' ? event.path : next.focus,
  };
}
export function reduceFileStore(state: FileStoreState, action: FileStoreAction): FileStoreState {
  if (action.topic !== 'focus') return reduceFileEvent(state, action);
  const focus = typeof action.value === 'function' ? action.value(state.focus) : action.value;
  if (focus !== null && !entryByPath(focus)) return state;
  return focus === state.focus ? state : { ...state, focus };
}
export function countSidebarItems(key: string, parsed: readonly unknown[]): number {
  return key === 'customActions'
    ? parsed.reduce<number>(
        (count, group) =>
          count + (isFileRecord(group) && Array.isArray(group['actions']) ? group['actions'].length : 0),
        0,
      )
    : parsed.length;
}
export function sidebarItemsOf(state: FileStoreState): SidebarItem[] {
  return state.pathOrder.flatMap(path => {
    const item = SIDEBAR_ITEMS.find(candidate => candidate.file === path);
    const file = state.files[path];
    if (!item || !file || (!hasData(file) && file.status !== 'streaming')) return [];
    return [
      {
        ...item,
        ...(Array.isArray(file.parsed) ? { count: countSidebarItems(item.key, file.parsed) } : {}),
        ...(file.status === 'streaming' ? { streaming: true } : {}),
      },
    ];
  });
}
