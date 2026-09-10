import { useEffect } from 'react';

/**
 * <Prompt> 的替代品 —— react-router v6 起移除了 Prompt。
 *
 * 官方替代是 useBlocker / unstable_usePrompt，但它们【只在 data router
 * （createBrowserRouter）下可用】。实测在本仓用的 <BrowserRouter> 里调用会直接抛
 * 「useBlocker must be used within a data router」。整仓改用 data router 是另一件
 * 大工程，不在本次范围内，所以这里自己实现一个够用的版本。
 *
 * 覆盖两条离开路径：
 *   1. 应用内导航 —— 本仓的跳转集中走 src/router/navigateTo.ts，在那里询问
 *   2. 关闭 / 刷新标签页 —— beforeunload
 *
 * 【已知缺口，务必知情】浏览器的前进/后退（popstate）拦不住。
 * v4 的 <Prompt> 是通过 history.block 拦的，v7 的 history 不再暴露该能力，
 * 而不用 data router 就没有等价物。可靠地拦 popstate 需要压入哨兵历史记录再回退，
 * 那套做法很脆且会污染历史栈，权衡后没做。
 * 目前唯一的使用方是通讯录隐藏设置页（ContactsHidden），影响面是「编辑中按浏览器
 * 后退不再提示」。要补齐得整体迁到 data router。
 */
const blockers = new Set<() => string>();

/** 给 navigateTo 用：若当前有未保存的编辑，返回要提示的文案，否则返回空 */
export function getNavigationBlockMessage(): string {
  for (const get of blockers) {
    const msg = get();

    if (msg) return msg;
  }

  return '';
}

export default function NavigationPrompt({ when, message }: { when: boolean; message: string }) {
  useEffect(() => {
    if (!when) return;

    const getMessage = () => message;
    blockers.add(getMessage);

    const onBeforeUnload = e => {
      e.preventDefault();
      // 现代浏览器会忽略自定义文案、只显示自己的通用提示，设 returnValue 仍是触发它的必要条件
      e.returnValue = message;

      return message;
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      blockers.delete(getMessage);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [when, message]);

  return null;
}
