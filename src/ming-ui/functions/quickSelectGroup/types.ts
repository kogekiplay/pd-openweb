/** Value emitted by SelectGroup and SelectGroupTrigger after selecting their finite id lists. */
export interface GroupSelectionValue {
  shareGroupIds?: string[] | undefined;
  shareProjectIds?: string[] | undefined;
  radioProjectIds?: string[] | undefined;
  isMe?: boolean | undefined;
}
