import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

// 导出文件名时间戳后缀：yyMMddHHmmss（年月日时分秒，各 2 位）
const pad2 = (n: number) => String(n).padStart(2, '0');

function fileStamp(d = new Date()) {
  return `${pad2(d.getFullYear() % 100)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

let _mermaid = null;
let _idCounter = 0;

async function getMermaid() {
  if (!_mermaid) {
    const m = (await import('mermaid')).default;

    m.initialize({
      startOnLoad: false,
      theme: 'neutral',
      /* 【layout / look 这两条是 mermaid 12 升级时补的，不能删】
         v12 把 ELK 换成了默认布局引擎（flowchart / state / class / ER / requirement 全部），
         并把默认外观换成了 neo —— 两者都不报错，只是**同一段图源会排出不一样的版面、
         画出不一样的配色**。历史对话里已经渲染过的图会跟着变样。
         显式钉回 dagre + classic，升级就只是升版本，不附带视觉变更。
         这两个键在 v11 里也存在（且就是当时的默认值），所以写上去是向下兼容的。 */
      layout: 'dagre',
      look: 'classic',
      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
      er: { useMaxWidth: true, diagramPadding: 16 },
      /* 【htmlLabels: false 只有一半生效，但保留——删掉会改变连线标签的渲染】
         这里原先的注释写着「否则导出 PNG 时 foreignObject 内的 HTML 画不出来、标签会丢失」，
         **那是错的**。2026-09-23 拿本文件下面 downloadDiagramPng 的真实导出路径实测过
         （mermaid 11.17.2 与 12.0.0 各一遍，同一段图源、同一份 config）：导出的 PNG 里
         6 个标签一个不少 —— Chromium 会把 data:URL 里的 foreignObject 照常画进 canvas。
         它只有一半生效的原因：mermaid 早已把 flowchart.htmlLabels 标成 deprecated
         （FLOWCHART_HTML_LABELS_DEPRECATED），真正的开关是**顶层** htmlLabels。
         下面这三个名字里只有 getEffectiveHtmlLabels 能在装好的包里搜到
         （node_modules/mermaid/dist/mermaid.core.mjs）；另两个是 mermaid 源码里的名字，
         压缩产物里已经没有了，别照着 grep node_modules 然后以为注释在瞎说。
         节点标签走 labelHelper()，那里只读 getConfig().htmlLabels，我们没设这个键，
         而 evaluate(undefined) 判定为 true —— 所以节点标签照旧是 foreignObject；
         只有连线标签走 getEffectiveHtmlLabels()（它才会回退到 flowchart.htmlLabels）变成 <text>。
         别把它"修"成顶层 htmlLabels: false：那不解决任何问题，却会把节点标签也换成 SVG 文本、改掉版面。 */
      flowchart: { useMaxWidth: true, htmlLabels: false },
      maxTextSize: 99999,
    });
    _mermaid = m;
  }

  return _mermaid;
}

// 把已渲染的 mermaid <svg> 导出为 PNG 下载：克隆 SVG 并补全尺寸 → 经 data URL 载入 Image →
// 按 scale 倍率绘制到铺白底的 canvas（避免透明背景）→ toBlob 触发下载。
// 用 data:URL（非外链）保证 canvas 不被污染，toBlob 可用。
function downloadDiagramPng(svgEl, { filename = 'diagram.png', scale = 2, background = '#ffffff' } = {}) {
  if (!svgEl) return;
  const viewBox = svgEl.viewBox && svgEl.viewBox.baseVal;
  const width = Math.round((viewBox && viewBox.width) || svgEl.clientWidth || 800);
  const height = Math.round((viewBox && viewBox.height) || svgEl.clientHeight || 600);
  const clone = svgEl.cloneNode(true);

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const svgString = new XMLSerializer().serializeToString(clone);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, width * scale);
    canvas.height = Math.max(1, height * scale);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    }, 'image/png');
  };

  img.src = svgUrl;
}

const Wrap = styled.div`
  position: relative;
  margin: var(--space-4) 0;
  padding: var(--space-5) var(--space-6);
  border-radius: 8px;
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-secondary);
  overflow-x: auto;
  text-align: center;

  svg {
    max-width: 100%;
    height: auto;
    font-size: var(--font-xs);
  }

  svg[width] {
    width: 100% !important;
    max-width: 100%;
  }

  &:hover .mermaid-toolbar {
    opacity: 1;
  }
`;

const Toolbar = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s;
`;

const ToolBtn = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border-secondary);
  border-radius: 6px;
  background: var(--color-background-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--color-background-hover);
    color: var(--color-text-primary);
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(3px);
`;

const FullscreenBox = styled.div`
  position: relative;
  width: 90vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--color-background-primary);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const FullscreenContent = styled.div`
  flex: 1;
  overflow: auto;
  padding: var(--space-5) var(--space-6) var(--space-6);
  text-align: center;

  svg {
    width: 100% !important;
    height: auto !important;
    max-width: none;
  }
`;

const FullscreenHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: 10px var(--space-3) 0;
  flex-shrink: 0;
`;

const CloseBtn = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--color-background-hover);
  color: var(--color-text-secondary);
  font-size: var(--font-lg);
  cursor: pointer;
  line-height: 1;

  &:hover {
    background: var(--color-background-tertiary);
    color: var(--color-text-primary);
  }
`;

const ErrorWrap = styled.div`
  margin: var(--space-3) 0;
  padding: 10px 14px;
  border-radius: 6px;
  background: var(--color-error-bg, rgba(255, 77, 79, 0.06));
  border: 1px solid var(--color-error-border, rgba(255, 77, 79, 0.2));
  color: var(--color-error);
  font-size: var(--font-xs);
  font-family: 'SFMono-Regular', 'SF Mono', Menlo, Consolas, monospace;
  text-align: left;
`;

const Skeleton = styled.div`
  height: 120px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--color-background-tertiary) 25%,
    var(--color-background-hover) 50%,
    var(--color-background-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: mermaid-shimmer 1.4s infinite;

  @keyframes mermaid-shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

function IconFullscreen() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 1v9M4.5 6.5 8 10l3.5-3.5M2 14h12" />
    </svg>
  );
}

const handleDownload = containerRef => () => {
  const svgEl = containerRef.current && containerRef.current.querySelector('svg');

  downloadDiagramPng(svgEl, { filename: `diagram_${fileStamp()}.png` });
};

export function MermaidBlock({ code, isStreaming }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // 内嵌 / 全屏两处 SVG 容器，下载时从中取真实 <svg> 节点导出
  const inlineRef = useRef(null);
  const fullscreenRef = useRef(null);

  useEffect(() => {
    if (!code) return undefined;

    let cancelled = false;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const doRender = () => {
      if (cancelled) return;
      const id = `mermaid-${++_idCounter}`;

      getMermaid()
        .then(m => m.render(id, code))
        .then(result => {
          if (cancelled) return;
          // 移除固定 height 属性，让 SVG 随容器宽度自适应缩放
          const cleaned = result.svg.replace(/(<svg[^>]*)\sheight="[^"]*"/, '$1');
          setSvg(cleaned);
          setError(null);
        })
        .catch(e => {
          if (cancelled) return;
          // streaming 时语法不完整，静默忽略错误，保留上一次有效渲染
          if (!isStreaming) setError(e.message || String(e));
        });
    };

    if (isStreaming) {
      // streaming 期间防抖，避免每个字符都触发渲染
      timerRef.current = setTimeout(doRender, 400);
    } else {
      setSvg('');
      setError(null);
      doRender();
    }

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [code, isStreaming]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // code 为空且 streaming 已结束：不渲染任何内容（避免骨架屏永远挂着）
  if (!code && !isStreaming) return null;

  if (error) return <ErrorWrap>{error}</ErrorWrap>;

  return (
    <>
      <Wrap>
        {svg ? (
          <>
            <div ref={inlineRef} dangerouslySetInnerHTML={{ __html: svg }} />
            <Toolbar className="mermaid-toolbar">
              <ToolBtn type="button" title={_l('下载 PNG')} onClick={handleDownload(inlineRef)}>
                <IconDownload />
              </ToolBtn>
              <ToolBtn type="button" title={_l('全屏查看')} onClick={() => setFullscreen(true)}>
                <IconFullscreen />
              </ToolBtn>
            </Toolbar>
          </>
        ) : (
          <Skeleton />
        )}
      </Wrap>
      {fullscreen &&
        createPortal(
          <Overlay onClick={() => setFullscreen(false)}>
            <FullscreenBox onClick={e => e.stopPropagation()}>
              <FullscreenHeader>
                <ToolBtn type="button" title={_l('下载 PNG')} onClick={handleDownload(fullscreenRef)}>
                  <IconDownload />
                </ToolBtn>
                <CloseBtn type="button" onClick={() => setFullscreen(false)}>
                  ✕
                </CloseBtn>
              </FullscreenHeader>
              <FullscreenContent ref={fullscreenRef}>
                <div dangerouslySetInnerHTML={{ __html: svg }} />
              </FullscreenContent>
            </FullscreenBox>
          </Overlay>,
          document.body,
        )}
    </>
  );
}
