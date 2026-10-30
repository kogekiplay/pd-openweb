/** 分组拖放「落点」相关的共享类型：由 R11 的私有 alias 移出，供 hook 与 dropTargets 复用。
 *  仅描述拖拽命中语义，不涉及布局 segment 的完整数据，也不涉及 onSaveLayout 的 wire。 */
import type { CustomBtnDragItem } from './constants';

/** 命中高亮用的落点描述。两种形状由 createBoundaryPlacement / createInsidePlacement 产出，
 *  消费点按 kind 收窄（applyActivePlacement、SegmentBlockDropTarget / EmptyGroupDropTarget 的 drop）。 */
export type DropPlacement =
  | { kind: 'boundary'; layoutId: string; itemType: CustomBtnDragItem['type']; insertBefore: number }
  | { kind: 'inside'; layoutId: string; itemType: CustomBtnDragItem['type']; segmentIndex: number; gapIndex: number };

/** activeGap 的真实生产值：dropTargets 里 setActiveGap({ segmentIndex, gapIndex }) 或 null。
 *  另有一处**内部**用法 `isOver ? { segmentIndex, gapIndex: 0 } : activeGap`（EmptyGroupDropTarget），形状一致。 */
export type ActiveGap = { segmentIndex: number; gapIndex: number };

/** activeDropPlacementRef 只需要读写 `.current` —— 用结构化形状，避免与 React ref 的类型版本耦合。 */
export type DropPlacementRef = { current: DropPlacement | null };
