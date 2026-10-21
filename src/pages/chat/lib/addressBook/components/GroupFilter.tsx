import React from 'react';
import PropTypes from 'prop-types';
import Dropdown from 'ming-ui/components/Dropdown';
import Icon from 'ming-ui/components/Icon';
import MenuItem from 'ming-ui/components/MenuItem';
import { GROUP_STATUS, SEARCH_GROUP_TYPES } from '../constants';

interface GroupFilterProps {
  /** 群组类型筛选变化（SEARCH_GROUP_TYPES） */
  /** Dropdown 的回调签名是 (value: number | undefined)（原实参同形态） */
  changeGroupFilter: (value: number | undefined) => void;
  /** 是否显示已关闭群组 */
  changeGroupStatus: () => void;
  searchGroupType?: number | undefined;
  groupStatus?: number | undefined;
  /** 项目内群组只给「我加入的 / 我创建的 / 所有群组」 */
  isProject?: boolean | undefined;
}

function GroupFilter(props: GroupFilterProps) {
  const { changeGroupFilter, changeGroupStatus, searchGroupType, groupStatus, isProject } = props;

  const dropDownData = isProject
    ? [
        {
          text: _l('我加入的群组'),
          value: SEARCH_GROUP_TYPES.JOINED,
        },
        {
          text: _l('我创建的群组'),
          value: SEARCH_GROUP_TYPES.CREATED,
        },
        {
          text: _l('所有群组'),
          value: SEARCH_GROUP_TYPES.ALL,
        },
      ]
    : [
        {
          text: _l('所有群组'),
          value: SEARCH_GROUP_TYPES.JOINED,
        },
        {
          text: _l('我创建的群组'),
          value: SEARCH_GROUP_TYPES.CREATED,
        },
      ];
  const item = <MenuItem onClick={changeGroupStatus}>{_l('显示已关闭的群组')}</MenuItem>;
  return (
    <div className="pLeft10 textSecondary">
      <Dropdown data={dropDownData} onChange={changeGroupFilter} value={searchGroupType} className="hoverColorPrimary">
        <div className="ming Dividor" />
        {React.cloneElement(
          item,
          groupStatus === GROUP_STATUS.ALL
            ? { icon: <Icon icon="hr_ok" />, iconAtEnd: true, className: 'colorPrimary' }
            : { className: 'textTertiary' },
        )}
      </Dropdown>
    </div>
  );
}

GroupFilter.propTypes = {
  changeGroupFilter: PropTypes.func.isRequired,
  changeGroupStatus: PropTypes.func.isRequired,
  searchGroupType: PropTypes.number,
  groupStatus: PropTypes.number,
};

export default GroupFilter;
