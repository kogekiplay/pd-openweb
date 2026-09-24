export const ITEM_TYPE = 'VIEW_CUSTOM_BTN_LAYOUT';
export const ITEM_TYPE_GROUP = 'VIEW_CUSTOM_BTN_GROUP_SEGMENT';

/**
 * 拖拽时携带的 item。两种拖法共用一个形状（react-dnd 的 accept 可以同时收两种 type，
 * 见 dropTargets 里 `accept: [ITEM_TYPE_GROUP, ITEM_TYPE]`），
 * 所以按钮独有的 idIndex / btnId 是可选的。
 * 构造点：GroupHeader.tsx（拖整组）、ActionRow.tsx（拖单个按钮）。
 */
export interface CustomBtnDragItem {
  type: typeof ITEM_TYPE | typeof ITEM_TYPE_GROUP;
  /** 第几个分组 */
  segmentIndex: number;
  /** 组内第几个按钮，只有拖按钮时有 */
  idIndex?: number;
  btnId?: string;
  /** 同一页可能有多套布局，拖拽只在同一个 layoutId 内生效 */
  layoutId: string;
}

/** IconTabs 选图后约 200ms 才 onModify；关窗时 onChange 先到，延后读 iconDraftRef 再 commit（不改 ming-ui） */
export const GROUP_ICON_DIALOG_REF_FLUSH_MS = 250;

/** 同一时间只允许一个「更多」菜单展开，避免多个 Dropdown portal 叠在一起 */
export function getNextOpenMoreKey(prevKey, visible: boolean, moreKey) {
  if (visible) {
    return moreKey;
  }

  return prevKey === moreKey ? null : prevKey;
}
