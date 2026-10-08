import cx from 'classnames';
import { Icon } from 'ming-ui';
import type { AgentSession } from 'src/components/Agent/shareTypes';

export default function SessionRow({
  item,
  active,
  onSelect,
  onOpenActions,
}: {
  item: AgentSession;
  active?: boolean | undefined;
  onSelect: (session: AgentSession) => void;
  onOpenActions: (session: AgentSession) => void;
}) {
  return (
    <div className={cx('sessionItem flexRow alignItemsCenter', { active })} onClick={() => onSelect(item)}>
      <div className="name ellipsis flex">{item.title}</div>
      {!!item.updateTime && <div className="updateTime">{window.createTimeSpan(item.updateTime, 5)}</div>}
      <span
        className="operateIcon"
        onClick={event => {
          event.stopPropagation();
          onOpenActions(item);
        }}
      >
        <Icon icon="more_horiz" className="Font18" />
      </span>
    </div>
  );
}
