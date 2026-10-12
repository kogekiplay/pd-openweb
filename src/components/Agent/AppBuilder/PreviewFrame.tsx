import { useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { pathCompletion } from 'src/utils/common';
import { navigateInFrame, withPreviewMode } from './previewNavigation';

// 预览外框呼吸：mingo 紫描边阴影在最浅 / 最深之间 3s 缓动循环（外扩光环，不遮挡预览内容）。
// 用 color-mix(var(--color-mingo)) 取各档透明度，兼容自定义品牌色，不写死色值。
const shadowBreath = keyframes`
  0%, 100% {
      /* 呼吸最浅点 */
      box-shadow:
          0 0 0px 3px rgba(110, 9, 249, 0.5),
          0 0 2px 0px rgba(110, 9, 249, 0.15);
  }
  50% {
      /* 呼吸最深点 */
      box-shadow:
          0 0 0px 5px rgba(110, 9, 249, 1),
          0 0 8px 4px rgba(110, 9, 249, 0.45);
  }
`;

// 实时预览框：appId 拿到后铺满 AppBuilder Content 区，跟随 build 进度切换页面
// 12px 圆角 + mingo 紫呼吸阴影是设计稿强调的展示外框风格；阴影直接作用在 iframe 上（外扩光环）
const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 12px;
    background: var(--color-background-primary);
    display: block;
    animation: ${shadowBreath} 3s ease-in-out infinite;
  }
`;

export interface PreviewFrameProps {
  src: string;
  refreshFirst?: boolean | undefined;
}

// 预览策略：iframe 只在首次冷启动一次整段 SPA；之后 src 变化全部走前端路由 history.push（软导航），
// 避免每次切页都整页 reload（慢 + 白屏闪烁）。SPA 尚未就绪时短暂轮询等待，超时兜底整页加载。
// refreshFirst：自定义页面这类「iframe 内 sheetList 还没有的新页面」，push 前先 await 刷新应用结构，
// 让 WorkSheet 能识别并渲染它（详见 navigateInFrame）——仍是软导航，不整页 reload。
export default function PreviewFrame({ src, refreshFirst = false }: PreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingRef = useRef<string | null>(null);
  // 用 ref 读最新 refreshFirst，避免把它加进 effect 依赖导致 src 未变时多余触发；
  // 同步写放在 effect 中（react-hooks/refs 禁止渲染期写 ref），且必须声明在下方主 effect 之前，
  // 保证同一次提交内主 effect 读到的是最新值
  const refreshFirstRef = useRef(refreshFirst);

  useEffect(() => {
    refreshFirstRef.current = refreshFirst;
  });

  useEffect(
    () => () => {
      iframeRef.current?.remove();
      iframeRef.current = null;
      pendingRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !src) return undefined;

    let cancelled = false;

    // 子路径部署下，iframe.src 与 reactRouterHistory.push 消费的都是站内绝对路径，
    // 必须像 navigateTo 一样先补子路径前缀，否则冷启动 404、软导航后路由不匹配、
    // 「已在目标页」对比（含子路径的 location.pathname）也永远不成立
    const targetSrc = pathCompletion(withPreviewMode(src), { hasDomain: false });

    // 首次：创建 iframe，整段 SPA 冷启动一次
    if (!iframeRef.current) {
      const iframe = document.createElement('iframe');

      iframe.src = targetSrc;
      iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');
      container.appendChild(iframe);
      iframeRef.current = iframe;
      return () => {
        cancelled = true;
      };
    }

    // 后续：尝试前端路由跳转（软导航）
    const iframe = iframeRef.current;

    pendingRef.current = targetSrc;

    const tryNavigate = () => {
      const path = pendingRef.current;

      if (!path) return true;
      if (navigateInFrame(iframe.contentWindow, path, refreshFirstRef.current, () => !cancelled)) {
        console.log('[preview-trace] 11.soft navigate', { path, refreshFirst: refreshFirstRef.current });
        pendingRef.current = null;
        return true;
      }

      return false;
    };

    if (tryNavigate())
      return () => {
        cancelled = true;
      };

    // SPA 还在冷启动（reactRouterHistory 未挂上）：轮询等待，~4s 超时兜底整页 reload
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tryNavigate() || tries > 40) {
        clearInterval(timer);
        if (pendingRef.current) {
          iframe.src = pendingRef.current;
          pendingRef.current = null;
        }
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [src]);

  return <Container ref={containerRef} />;
}
