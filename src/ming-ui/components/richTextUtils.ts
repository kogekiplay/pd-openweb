export function preventWidgetResizeRedrawRecursion(widgetResize) {
  const originalRedrawSelectedResizer = widgetResize.redrawSelectedResizer;
  let isRedrawing = false;

  widgetResize.redrawSelectedResizer = function (...args) {
    if (isRedrawing) return;

    isRedrawing = true;
    try {
      return originalRedrawSelectedResizer.apply(this, args);
    } finally {
      isRedrawing = false;
    }
  };
}
