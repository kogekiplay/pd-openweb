import { useRef } from 'react';

/**
 * 把「每次渲染现建的大 props 对象」稳定成：值没变就返回【同一个对象】。
 *
 * 【为什么需要它】工作表把一大包东西（tableData，五十多个键）通过 react-window 的 cellProps
 * 发给每个单元格。react-window 2 自己是做了 memo 的（cellProps 走
 * useMemo(() => e, Object.values(e))，单元格外面套 memo + 浅比较），
 * 但只要这包东西每次渲染都是新对象，这层 memo 就必然落空 —— 左侧分组面板一折叠，
 * 【全部单元格】都会重渲一遍（实测 DOM 里 210 个格子，一次折叠 198~220 次渲染）。
 *
 * 【函数为什么不能参与比较】那包东西里混着十几个当场写的回调（updateCell / onCellClick …），
 * 每次渲染都是新函数，按标识比一定不相等。所以这里把函数和值分开：
 *   · 值：逐键按标识比较，全都没变就复用上一次的对象；
 *   · 函数：对外只暴露一个【标识固定】的包装，内部转调 ref 里最新的实现。
 * 包装转调最新实现这一点很关键 —— 直接复用旧函数就会变成过期闭包：
 * 它捕获的 state 停在上一次渲染，点一下拿到的是旧值，这类 bug 不报错、极难查。
 *
 * 【只适用于「调用型」回调，不适用于 render prop】
 * 回调是「事件发生时才调用」，包装转调最新实现就够了。
 * 但 render prop（renderRowHead 这类）的【输出】依赖外部状态，标识固定就意味着
 * 那些状态变了也不会触发重渲染 —— 界面停在旧的一帧，不报任何错。
 * 这类必须走 renderSlots.tsx 的订阅式插槽，别往这里塞。
 *
 * 【注意】值是按【标识】比的。所以调用方要保证「内容没变时标识也别变」：
 * 默认值别写成 `x = {}`（每次渲染都是新对象），每次渲染现算的数组要 useMemo。
 */
export default function useStablePropsObject<T extends Record<string, any>>(next: T): T {
  const latest = useRef<T>(next);
  latest.current = next;

  const wrappers = useRef<{ sig: string; fns: Record<string, any> }>({ sig: '', fns: {} });
  const prev = useRef<{ obj: T; valueKeys: string[]; sig: string } | null>(null);

  const fnKeys: string[] = [];
  const valueKeys: string[] = [];

  for (const key of Object.keys(next)) {
    (typeof next[key] === 'function' ? fnKeys : valueKeys).push(key);
  }

  const sig = fnKeys.join(',');

  // 函数集合没变就一直用同一批包装；变了（极少）才重建
  if (wrappers.current.sig !== sig) {
    const fns: Record<string, any> = {};
    fnKeys.forEach(key => {
      fns[key] = (...args: any[]) => {
        const fn = latest.current[key];
        return typeof fn === 'function' ? fn(...args) : undefined;
      };
    });
    wrappers.current = { sig, fns };
  }

  const last = prev.current;
  const unchanged =
    !!last &&
    last.sig === sig &&
    last.valueKeys.length === valueKeys.length &&
    valueKeys.every(key => last.obj[key] === next[key]);

  if (unchanged) {
    return last.obj;
  }

  const obj = { ...next, ...wrappers.current.fns } as T;
  prev.current = { obj, valueKeys, sig };
  return obj;
}
