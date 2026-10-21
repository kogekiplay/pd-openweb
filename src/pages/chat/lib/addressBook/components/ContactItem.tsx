import cx from 'classnames';
import _ from 'lodash';

/** 联系人行 props（`ContactList` 传入；点击回调回传 `{accountId,isFriend,isContact}` 对象） */
interface ContactItemProps {
  avatar?: string | undefined;
  fullname?: string | undefined;
  accountId?: string | undefined;
  isSelected?: boolean | undefined;
  isFriend?: boolean | undefined;
  isContact?: boolean | undefined;
  /** 与父级 `ContactClickPayload` 同构（父级按对象接收选中信息） */
  itemClickHandler: (item: {
    accountId?: string | undefined;
    isFriend?: boolean | undefined;
    isContact?: boolean | undefined;
  }) => void;
  /** 部门搜索模式：行尾显示部门名 */
  searchDepartmentUsers?: boolean | undefined;
  departments?: string[] | undefined;
}

export default function ContactItem(props: ContactItemProps) {
  const {
    avatar,
    fullname,
    accountId,
    isSelected,
    isFriend,
    isContact,
    itemClickHandler,
    searchDepartmentUsers,
    departments = [],
  } = props;
  const cls = cx('list-item Hand Font13', { bgColorPrimaryTransparent: isSelected });
  let departmentName = (!_.isEmpty(departments) && departments[departments.length - 1]) || '';
  return (
    <div
      className={cls}
      onClick={() => {
        itemClickHandler({
          accountId,
          isFriend,
          isContact,
        });
      }}
    >
      <img src={avatar} placeholder={'/staticfiles/images/blank.gif'} className="list-item-avatar" />
      <span className="list-item-name" title={fullname}>
        {fullname}
      </span>
      {searchDepartmentUsers && <span className="list-item-department">{departmentName}</span>}
    </div>
  );
}
