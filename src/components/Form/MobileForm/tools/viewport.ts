/** 获取可视视口尺寸和偏移，优先使用移动端更准确的 Visual Viewport API。 */
export function getViewportSize() {
  const viewport = window.visualViewport;

  return {
    width: Math.round((viewport && viewport.width) || window.innerWidth || document.documentElement.clientWidth),
    height: Math.round((viewport && viewport.height) || window.innerHeight || document.documentElement.clientHeight),
    offsetTop: Math.round((viewport && viewport.offsetTop) || 0),
    offsetLeft: Math.round((viewport && viewport.offsetLeft) || 0),
  };
}

export function getTableScrollers(root: HTMLElement | null) {
  const scrollers = Array.from(root?.querySelectorAll<HTMLElement>('.ant-table-body, .ant-table-content, .hap-table-body, .hap-table-content') || []);
  return {
    horizontalScroller: scrollers.find(scroller => scroller.scrollWidth > scroller.clientWidth),
    verticalScroller: scrollers.find(scroller => scroller.scrollHeight > scroller.clientHeight),
  };
}
export function getTableBodyHeight(root: HTMLElement | null): number {
  if (!root?.clientHeight) return 0;
  const headerHeight = root.querySelector<HTMLElement>('.ant-table-thead, .hap-table-thead')?.offsetHeight || 40;
  const table = root.querySelector<HTMLElement>('.ant-table, .hap-table');
  const style = table ? window.getComputedStyle(table) : undefined;
  const borderHeight = (parseFloat(style?.borderTopWidth || '') || 0) + (parseFloat(style?.borderBottomWidth || '') || 0);
  return Math.max(root.clientHeight - headerHeight - borderHeight, 0);
}
