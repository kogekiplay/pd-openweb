
interface ListNullProps {
  /** 搜索态：显示「无匹配结果」 */
  isSearch?: boolean | undefined;
  /** 列表类型：groups / contacts / newfriends（决定空态文案） */
  type?: string | undefined;
}

export default function ListNull(props: ListNullProps) {
  const { isSearch, type } = props;

  if (isSearch) {
    return (
      <div className="list-null">
        <div className="list-null-icon search" />
        <div className="mTop15">{_l('无匹配结果')}</div>
      </div>
    );
  } else {
    if (type === 'groups') {
      return (
        <div className="list-null">
          <div>{_l('暂无群组')}</div>
        </div>
      );
    } else if (type === 'contacts') {
      return (
        <div className="list-null">
          <div>{_l('暂无成员')}</div>
        </div>
      );
    } else if (type === 'newfriends') {
      return (
        <div className="list-null">
          <div className="list-null-icon newfriends" />
          <div className="mTop20 Font17 textTertiary">{_l('暂无新的好友')}</div>
        </div>
      );
    }
  }
  return undefined;
}
