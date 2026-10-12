import type { UIEventHandler } from 'react';
import _ from 'lodash';
import { SortableList } from 'ming-ui';
import ClickAway from 'ming-ui/components/ClickAway';
import { canEditApp } from 'src/pages/worksheet/redux/actions/util';
import type { AppSection } from 'src/utils/appTypes';
import SortableAppItem from './SortableAppItem';

interface SortableAppListProps {
  items: AppSection[];
  onScroll: UIEventHandler<HTMLDivElement>;
  onSortEnd: (items: AppSection[]) => void;
  permissionType?: number | undefined;
  focusGroupId?: string | null | undefined;
  activeAppItemId?: string | null | undefined;
  isAppItemOverflow?: boolean | undefined;
  ensurePointerVisible?: (() => void) | undefined;
  onAppItemConfigClick?:
    | ((options: { id?: string | undefined; type?: number | undefined; appSectionId?: string | undefined }) => void)
    | undefined;
  renameAppGroup?: ((id: string, update: { name: string }, request: boolean) => void) | undefined;
  handleAddAppGroup?:
    ((options?: { appSectionId?: string | undefined; type?: number | undefined }) => void) | undefined;
  appPkg?: unknown;
  match?: unknown;
  isLock?: boolean | undefined;
  isUpgrade?: boolean | undefined;
}

export default ClickAway.wrap(({ items, onScroll, ...rest }: SortableAppListProps) => (
  <div className="appItemsWrap" onScroll={_.throttle(onScroll)}>
    <SortableList
      useDragHandle={false}
      dragPreviewImage={true}
      canDrag={canEditApp(rest.permissionType)}
      items={items}
      itemKey="appSectionId"
      renderItem={options => {
        const { index, item } = options;
        return <SortableAppItem index={index} value={item} {...rest} />;
      }}
      onSortEnd={rest.onSortEnd}
    />
  </div>
));
