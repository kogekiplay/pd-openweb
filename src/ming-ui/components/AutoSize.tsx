import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

function getElementSize(el) {
  return el
    ? {
        width: el.clientWidth,
        height: el.clientHeight,
      }
    : {};
}

function shouldUpdateSize(nextSize, prevSize, watchHeight, forceUpdate) {
  if (forceUpdate || !prevSize) {
    return true;
  }

  return (
    Math.abs(nextSize.width - prevSize.width) > 10 || (watchHeight && Math.abs(nextSize.height - prevSize.height) > 10)
  );
}

/**
 * ResizeObserver 报过来的尺寸【合并多久再提交】。
 *
 * 【为什么必须合并】被包裹的常常是极重的组件（工作表网格就是 autoSize(WorksheetTable)），
 * 每提交一次尺寸就是一整轮重渲染。而尺寸变化很多时候是【连续】的 —— 最典型的是
 * 分组面板折叠：面板上写着 `transition: width 0.2s`，这 200ms 里 ResizeObserver 会一路报，
 * 下面 shouldUpdateSize 的 10px 阈值只是把「每帧一次」削成「每 10px 一次」，
 * 200→32 这一程仍然是十几次重渲染。
 *
 * 实测（AGV测试问题清单，4013 行）：折叠一次，200ms 的过渡只渲染出 3 帧，
 * 随后主线程连续卡死 191ms / 133ms / 91ms；把窗口宽度换成纯 CSS 改变量、React 完全不参与，
 * 症状一模一样，说明代价不在 React 的 state 更新链路上，而在【每帧都重建一次网格】：
 * 同一段动画里网格子树发生 206 条 DOM 变更、9 个批次。而强制布局本身只要 0.4ms ——
 * 也就是说卡的不是布局，是被塞进每一帧的 JS。
 *
 * 合并之后，整段过渡只在结束时提交一次尺寸，动画期间主线程是空的。
 *
 * 【为什么 120ms 是安全的】这个组件自己在不支持 ResizeObserver 的退路上就是
 * setInterval 100ms 轮询（见下面那个 effect），也就是说「尺寸最多滞后 100ms 左右」
 * 本来就是它认可的精度。另外面板拖拽改宽走的是 DragMask（拖动时只移动遮罩，
 * 松手才回写宽度），不存在「拖动过程中要跟手」的诉求。
 * 显式调用的 updateSize()（forceUpdate）不受影响，仍然同步提交。
 */
const RESIZE_COMMIT_DELAY = 120;

function canReceiveRef(Comp) {
  return !!(
    Comp &&
    ((Comp.prototype && Comp.prototype.isReactComponent) || Comp.$$typeof === Symbol.for('react.forward_ref'))
  );
}

/**
 * AutoSizer 自己消费的三个 props；其余一律原样透传给被包裹组件，
 * 所以留一个索引签名。
 *
 * 这个标注不能省：不写的话 props 是隐式 any，@types/react 19 的
 * PropsWithoutRef<any> 会走 `'ref' extends keyof any ? Omit<P,'ref'> : P` 分支，
 * 把 any 【塌缩成具体对象类型】，于是外部传的几十个 props 全部"不在允许的 props 里"
 * （TableComp.tsx:432 报 not assignable to 'IntrinsicAttributes & …'）。
 * v18 不会，因为它的 LibraryManagedAttributes 还有 propTypes 分支兜着。
 */
interface AutoSizeProps {
  width?: number;
  height?: number;
  watchHeight?: boolean;
  [key: string]: unknown;
}

export default function autoSize(Comp, { onlyWidth }: { onlyWidth?: boolean } = {}) {
  const AutoSizer = memo(
    forwardRef(function AutoSizer(props: AutoSizeProps, ref) {
      const { height, width, watchHeight, ...rest } = props;
      const controlledSize = width && height ? { width, height } : undefined;
      const conRef = useRef(null);
      const tableRef = useRef(null);
      // 容器节点单独放 state，只为让下面那个 effect 知道该观察谁；挂载时只会变一次。
      const [conEl, setConEl] = useState<HTMLElement | null>(null);
      const [size, setSize] = useState(controlledSize);
      const supportResizeObserver = typeof window !== 'undefined' && typeof window.ResizeObserver !== 'undefined';

      const setConRef = useCallback(con => {
        conRef.current = con;
        setConEl(con);
      }, []);

      const commitSize = useCallback(
        (nextSize, forceUpdate: boolean) => {
          setSize(prevSize => (shouldUpdateSize(nextSize, prevSize, watchHeight, forceUpdate) ? nextSize : prevSize));
        },
        [watchHeight],
      );

      // 等待中的「合并提交」。下面 ResizeObserver 那个 effect 每次拿到新尺寸都会重排它，
      // 连续变化期间就一直往后推，停下来 RESIZE_COMMIT_DELAY 才真正提交一次。
      const pendingCommit = useRef<ReturnType<typeof setTimeout> | null>(null);
      const cancelPendingCommit = useCallback(() => {
        if (pendingCommit.current) {
          clearTimeout(pendingCommit.current);
          pendingCommit.current = null;
        }
      }, []);

      const updateSize = useCallback(() => {
        // 显式要求同步：把待提交的那次丢掉，免得它稍后拿旧尺寸把这次盖回去
        cancelPendingCommit();
        commitSize(getElementSize(conRef.current), true);
      }, [cancelPendingCommit, commitSize]);

      const childRefProps = useMemo(() => {
        return canReceiveRef(Comp)
          ? {
              ref: tableRef,
            }
          : {};
      }, []);

      useImperativeHandle(
        ref,
        () => ({
          get con() {
            return conRef.current;
          },
          get table() {
            return tableRef.current;
          },
          updateSize,
        }),
        [updateSize],
      );

      useEffect(() => {
        if (controlledSize) {
          setSize(controlledSize);
        }
      }, [controlledSize && controlledSize.width, controlledSize && controlledSize.height]);

      useEffect(() => {
        if (controlledSize) {
          return undefined;
        }

        const initSize = () => updateSize();

        if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined' && !window.sheetAutoSized) {
          const timer = setTimeout(initSize, 300);
          window.sheetAutoSized = true;
          return () => clearTimeout(timer);
        }

        initSize();
        return undefined;
      }, [controlledSize, updateSize]);

      /* 【这里原先用的是 react-use 的 useMeasure，必须换掉】
         useMeasure 把量到的 rect 存成【组件 state】：ResizeObserver 每报一次尺寸，
         AutoSizer 就重渲染一次。而下面渲染的 <Comp> 没有 memo，于是 AutoSizer 每重渲染一次，
         被包的组件（工作表网格）就跟着全量重渲染一次。

         关键在于：这条路径【绕开了 commitSize 的合并】。光给 commitSize 做防抖是没用的 ——
         size 确实只提交一次，但 rect 仍然每帧变、AutoSizer 仍然每帧重渲染。
         实测就是这样翻车的：加了防抖之后，折叠一次仍有 473ms 主线程阻塞，
         分成 7~8 段各约 60ms【均匀铺满 400ms】—— 典型的「每帧渲染一次、每帧 60ms」。

         所以改成自己起 ResizeObserver：回调里【不往 state 写任何东西】，只安排一次合并提交。
         这样 AutoSizer 只在 size 真正变化时重渲染，动画期间它一次都不渲染。 */
      useEffect(() => {
        if (controlledSize || !supportResizeObserver || !conEl) {
          return undefined;
        }

        const observer = new ResizeObserver(() => {
          cancelPendingCommit();
          pendingCommit.current = setTimeout(() => {
            pendingCommit.current = null;
            commitSize(getElementSize(conRef.current), false);
          }, RESIZE_COMMIT_DELAY);
        });

        observer.observe(conEl);

        return () => {
          observer.disconnect();
          cancelPendingCommit();
        };
      }, [cancelPendingCommit, commitSize, conEl, controlledSize, supportResizeObserver]);

      useEffect(() => {
        if (controlledSize || supportResizeObserver) {
          return undefined;
        }

        const watcher = setInterval(() => {
          commitSize(getElementSize(conRef.current), false);
        }, 100);

        return () => clearInterval(watcher);
      }, [commitSize, controlledSize, supportResizeObserver]);

      const currentSize = controlledSize || size;

      return (
        <div className="autosize" ref={setConRef} style={{ width: '100%', height: onlyWidth ? 'auto' : '100%' }}>
          {currentSize && (
            <Comp
              {...rest}
              {...childRefProps}
              updateSize={updateSize}
              watchHeight={watchHeight}
              width={currentSize.width}
              height={height || currentSize.height}
            />
          )}
        </div>
      );
    }),
  );

  AutoSizer.displayName = `autoSize(${Comp.displayName || Comp.name || 'Component'})`;

  return AutoSizer;
}
