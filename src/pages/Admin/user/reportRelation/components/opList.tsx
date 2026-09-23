import { Component } from 'react';
import PropTypes from 'prop-types';
import ClickAway from 'ming-ui/components/ClickAway';

const ClickAwayable = ClickAway;
interface ChecklistOperatorProps {
  // propTypes 里都没写 isRequired，但下面是直接调用的，缺了点击就崩 —— 按实际要求写成必填
  toggleList: () => void;
  showAddBtn?: boolean | undefined;
  add: () => void;
  remove: () => void;
  replace: () => void;
}

export default class ChecklistOperator extends Component<ChecklistOperatorProps> {
  static override propTypes = {
    toggleList: PropTypes.func,
    showAddBtn: PropTypes.bool,

    add: PropTypes.func,
    remove: PropTypes.func,
    replace: PropTypes.func,
  };

  override render() {
    return (
      <ClickAwayable component="ul" className="itemOpList" onClickAway={() => this.props.toggleList()}>
        {this.props.showAddBtn ? (
          <li className="hoverBgColorPrimaryDark Hand" onClick={() => this.props.add()}>
            {_l('添加下属')}
          </li>
        ) : null}
        <li className="hoverBgColorPrimaryDark Hand" onClick={() => this.props.replace()}>
          {_l('替换成员')}
        </li>
        <li className="hoverBgColorPrimaryDark Hand" onClick={() => this.props.remove()}>
          {_l('移出成员')}
        </li>
      </ClickAwayable>
    );
  }
}
