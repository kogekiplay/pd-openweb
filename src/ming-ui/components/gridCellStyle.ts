// react-window 2 改了格子 style 的坐标契约：不再给 left / top 的数值，而是
// left 恒为 0（rtl 下换成 right: 0）、纵横位置全塞进 transform: translate(Xpx, Ypx)。
//
// 但本仓有多处代码把格子 style 里的 left / top 当数字参与计算，全部会因此拿到
// undefined / NaN：
//   - CellControls/index.tsx  checkCellFullVisible()：判断格子是否完整可见并算滚动目标
//   - WorksheetTable/components/Cell.tsx：记录颜色色条是格子的兄弟节点，自己算绝对坐标
//   - CellControls/CellWithPopupOperate.tsx：编辑态浮层要盖在格子原位上
//
// 与其改这些下游，不如在格子入口把坐标还原成 v1 的形状（left / top 数值 + 去掉
// transform），这样上面几处一行都不用动。
const TRANSLATE = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/;

export function normalizeGridCellStyle(style) {
  if (!style || !style.transform) return style;

  const matched = TRANSLATE.exec(style.transform);

  // rtl 下 v2 走的是 right + 负向 translate，本产品无 rtl；匹配不上就原样返回，
  // 至少不会算出 NaN 坐标。
  if (!matched) return style;

  const { transform, ...rest } = style;

  return { ...rest, left: Number(matched[1]), top: Number(matched[2]) };
}

// v1 的容器没有这三条，v2 加了。maxHeight / maxWidth 的百分比对绝对定位元素同样生效，
// 会把显式给了宽高的网格裁掉，所以必须解除；flexGrow 对绝对定位元素无效，但一并归零
// 免得将来某个网格改成非绝对定位时莫名被拉伸。
export const RESET_V2_CONTAINER_BOX = {
  maxHeight: 'none',
  maxWidth: 'none',
  flexGrow: 0,
} as const;
