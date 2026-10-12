/** Animate a scroll using the original ten-millisecond step calculation; return lifecycle cleanup. */
export function scrollTo(element: Pick<HTMLElement, 'scrollTop'>, to: number, duration = 200): () => void {
  let cancelled = false;
  let frame: number | undefined;
  const nativeFrame = typeof window.requestAnimationFrame === 'function';
  const schedule = (callback: FrameRequestCallback) =>
    nativeFrame ? window.requestAnimationFrame(callback) : window.setTimeout(() => callback(0), 10);
  function step(remaining: number) {
    if (cancelled) return;
    if (remaining <= 0) {
      element.scrollTop = to;
      return;
    }
    const perTick = ((to - element.scrollTop) / remaining) * 10;
    frame = schedule(() => {
      frame = undefined;
      if (cancelled) return;
      element.scrollTop += perTick;
      if (element.scrollTop !== to) step(remaining - 10);
    });
  }
  step(duration);
  return () => {
    cancelled = true;
    if (frame !== undefined) {
      if (nativeFrame) window.cancelAnimationFrame(frame);
      else window.clearTimeout(frame);
    }
  };
}
