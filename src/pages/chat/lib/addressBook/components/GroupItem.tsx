import cx from 'classnames';
import type { CSSProperties } from 'react';

/** 群组行 props（`GroupList` 传入；点击回调只回传 groupId） */
interface GroupItemProps {
  avatar?: string | undefined;
  name?: string | undefined;
  /** 群是否开放（false 时置灰并显示「已关闭」） */
  isOpen?: boolean | undefined;
  groupId?: string | undefined;
  groupMemberCount?: number | string | undefined;
  isSelected?: boolean | undefined;
  itemClickHandler: (groupId: string) => void;
}

export default function GroupItem(props: GroupItemProps) {
  const { avatar, name, isOpen, groupId, groupMemberCount, isSelected, itemClickHandler } = props;
  const className = cx('list-item Font13 Hand', {
    'textDisabled disabled': !isOpen,
    bgColorPrimaryTransparent: isSelected,
  });
  // 擦除标记：关闭态置灰；null 由 React 忽略（原 any 直接传）。
  const style = (!isOpen ? { opacity: 0.5 } : null) as CSSProperties | undefined;
  return (
    <div
      className={className}
      onClick={() => {
        // 擦除标记：群组行必带 groupId（原 any 直接透传）。
        itemClickHandler(groupId as string);
      }}
    >
      <img src={avatar} placeholder={'/staticfiles/images/blank.gif'} className="list-item-avatar" style={style} />
      <span className="list-item-name" title={name}>
        {name}
      </span>
      {isOpen ? null : <span className="pLeft5 group-tip">{_l('(已关闭)')}</span>}
      <span className="textDisabled pLeft5">{groupMemberCount}</span>
    </div>
  );
}
