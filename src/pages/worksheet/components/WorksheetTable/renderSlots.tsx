import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

/**
 * 把「render prop」从单元格 memo 比较的数据里摘出去。
 *
 * 【要解决什么】工作表把一大包东西（tableData）通过 react-window 的 cellProps 发给每个单元格。
 * 只要这包东西每次渲染都是新对象，react-window 自带的单元格 memo 就必然落空 ——
 * 左侧分组面板一折叠、窗口一改宽，【全部单元格】重渲一遍
 * （实测 AGV测试问题清单：DOM 里 210 个格子，一次折叠 198~220 次渲染）。
 *
 * 【为什么不能简单地把它整包稳定化】试过，会出静默 bug。
 * renderColumnHead / renderRowHead 这些是 render prop，它们的输出依赖【没有经过 tableData
 * 的外部状态】—— 最典型的是 SheetView 里的 layoutChangeVisible（控制「你变更了表格样式，
 * 是否保存?」那个入口显不显示）。把它们换成标识固定的包装之后，那类状态一变，
 * tableData 的标识却不变，单元格不会重渲染，界面停在旧的一帧且不报任何错。
 * 真实症状：调完列宽点保存，服务端已经存好了，但保存入口不消失，用户必须再点一次保存。
 *
 * 【这里的做法】对外给一组【标识固定】的 renderFunctions，但它们返回的不是直接调用结果，
 * 而是一个订阅了「最新实现」的小组件 <RenderSlot>。
 *   · tableData 因此可以保持同一个标识 → 数据格子（占绝大多数）整批跳过重渲染；
 *   · 每次 WorksheetTable 渲染完，版本号 +1 并通知订阅者 → 挂载着的那几十个插槽
 *     （行头、列头、页脚、操作列、分组行）各自重渲一次，拿到的一定是最新的闭包。
 * 也就是把「全表重渲」换成「只重渲真正用到 render prop 的那几十个格子」。
 *
 * 用 useSyncExternalStore 而不是自己写订阅：并发渲染下它保证读到的版本号和渲染批次一致，
 * 不会出现一半新一半旧。
 */

type SlotKey = 'head' | 'foot' | 'rowHead' | 'operates' | 'groupTitle' | 'groupMore';

const SLOT_KEYS: SlotKey[] = ['head', 'foot', 'rowHead', 'operates', 'groupTitle', 'groupMore'];

interface SlotStore {
  fns: Partial<Record<SlotKey, any>>;
  version: number;
  listeners: Set<() => void>;
}

function RenderSlot({ store, slot, args }: { store: SlotStore; slot: SlotKey; args: any }) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      store.listeners.add(onChange);
      return () => {
        store.listeners.delete(onChange);
      };
    },
    [store],
  );

  useSyncExternalStore(
    subscribe,
    () => store.version,
    () => store.version,
  );

  const fn = store.fns[slot];
  return typeof fn === 'function' ? fn(args) : null;
}

/**
 * @param fns 每次渲染现建的那组 render prop（标识每次都变，这正是问题所在）
 * @returns 标识固定的 renderFunctions，可以安全地放进需要保持标识的 tableData 里
 */
export default function useRenderSlots(fns: Partial<Record<SlotKey, any>>) {
  // @types/react 19 的 useRef 必须给初值，不能写 useRef<SlotStore>()
  const storeRef = useRef<SlotStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = { fns: {}, version: 0, listeners: new Set() };
  }

  const store = storeRef.current;
  // 渲染期只是把最新实现放进 ref（不通知），真正的通知放在 effect 里，避免在渲染期触发订阅者更新
  store.fns = fns;

  useEffect(() => {
    store.version += 1;
    store.listeners.forEach(listener => listener());
  });

  return useMemo(() => {
    const out: Record<string, any> = {};
    SLOT_KEYS.forEach(key => {
      out[key] = (args: any) => <RenderSlot store={store} slot={key} args={args} />;
    });
    return out;
  }, [store]);
}
