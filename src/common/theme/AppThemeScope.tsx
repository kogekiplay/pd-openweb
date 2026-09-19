import { useEffect } from 'react';
import { applyAppTheme, resetToPlatformTheme } from './applyThemeVars';

interface Props {
  /** 应用主题色，取自 state.appPkg.iconColor。 */
  seed?: string;
}

/**
 * 进入应用时把调色板换成应用色，离开时还原成平台色。渲染 null。
 *
 * 【为什么挂在 Application 里而不是按路径判断】/app/my/* 和 /app/lib/
 * 走的是 AppHomepage/AppCenter（应用中心），不是 Application
 * —— 见 src/router/config.ts:224-231 与 :240。react-router v7 里
 * 静态段排序恒高于动态段，所以「挂在 Application 内部」这件事本身
 * 就已经把应用中心排除掉了，不需要再写一个 /^\/app\// 的谓词
 * （写了反而会把应用中心误判成应用）。
 *
 * 【为什么不靠 state.appPkg.id 判断在不在应用里】CLEAR_APP_DETAIL
 * 只在 AppDetail 卸载时派发一次（AppPkgHeader/AppDetail/index.tsx:248），
 * 不是所有应用路由都挂了它。组件自身的卸载才是可靠信号。
 */
export default function AppThemeScope({ seed }: Props) {
  useEffect(() => {
    if (!seed) return;
    applyAppTheme(seed);
    // 明暗切换【不】在这里处理：主题引擎自己盯着 documentElement 的 data-theme，
    // 重算时会用当前记住的应用色。见 applyThemeVars.ts 的 activeSeed。
  }, [seed]);

  // 卸载时还原。单独一个 effect 且依赖为空，是因为它要在【组件消失时】跑，
  // 而不是在 seed 变化时跑 —— 合进上面那个 effect 的话，改应用色会先还原成
  // 平台色再套新色，中间闪一帧平台蓝。
  useEffect(() => resetToPlatformTheme, []);

  return null;
}
