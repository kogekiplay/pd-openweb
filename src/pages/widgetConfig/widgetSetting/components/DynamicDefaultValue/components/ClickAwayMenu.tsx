import { Component } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import { Menu, MenuItem } from 'ming-ui';
import ClickAway from 'ming-ui/components/ClickAway';

const ClearSelect = styled.div`
  padding: var(--space-1) var(--space-4) 6px var(--space-4);
  color: var(--color-text-secondary);
  cursor: pointer;
`;
interface ClickAwayMenuProps {
  types: { id: string; text?: string; value?: string }[];
  handleTimeSelect: (type: { id: string; text?: string; value?: string }) => void;
  dynamicValue?: import('../dynamicTypes').DynamicValueSource[] | undefined;
  showClear?: boolean | undefined;
}
const UnwrappedClickAwayMenu = class ClickAwayMenu extends Component<ClickAwayMenuProps, Record<string, never>> {
  override render() {
    const { types, handleTimeSelect, dynamicValue, showClear = true } = this.props;
    return (
      <Menu
        style={{
          width: 'calc(100% - 36px)',
        }}
      >
        {!_.isEmpty(dynamicValue) && showClear && (
          <ClearSelect
            key={'clear'}
            onClick={() =>
              handleTimeSelect({
                id: 'clear',
              })
            }
          >
            {_l('清除选择')}
          </ClearSelect>
        )}
        {types.map(type => (
          <MenuItem key={type.id} onClick={() => handleTimeSelect(type)}>
            {type.text}
          </MenuItem>
        ))}
      </Menu>
    );
  }
};
const ClickAwayMenu = ClickAway.wrap(UnwrappedClickAwayMenu);
export default ClickAwayMenu;
