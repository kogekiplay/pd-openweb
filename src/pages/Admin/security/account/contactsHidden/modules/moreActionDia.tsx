import React from 'react';
import ClickAway from 'ming-ui/components/ClickAway';

interface MoreActionDiaProps {
  showMoreAction?: boolean | undefined;
  addUser: () => void;
  addDept: () => void;
  addOrgRoles: () => void;
}

const UnwrappedMoreActionDia = class MoreActionDia extends React.Component<MoreActionDiaProps> {
  override render() {
    if (!this.props.showMoreAction) {
      return '';
    }

    return (
      <ul className="moreActionDia">
        <li onClick={() => this.props.addUser()}>{_l('添加成员')}</li>
        <li onClick={() => this.props.addDept()}>{_l('添加部门')}</li>
        <li onClick={() => this.props.addOrgRoles()}>{_l('组织角色')}</li>
      </ul>
    );
  }
};
const MoreActionDia = ClickAway.wrap(UnwrappedMoreActionDia);
export default MoreActionDia;
