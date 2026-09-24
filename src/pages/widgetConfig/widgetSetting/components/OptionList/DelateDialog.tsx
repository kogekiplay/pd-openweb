import { useState } from 'react';
import _ from 'lodash';
import styled from 'styled-components';
import { Dialog, Icon } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import { OptionChip } from 'src/components/OptionChip';
import { MAX_OPTIONS_COUNT } from '../../../config';

const DelateDialogWrap = styled.ul`
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0px 8;
    border-bottom: 1px solid var(--color-border-primary);
    line-height: 36px;
    /* 同上：彩色选项是 24px 高的标签，保住原来的 36px 行高 */
    min-height: 36px;
    .name {
      display: flex;
      align-items: center;
    }
    i {
      font-size: var(--font-lg);
      margin-left: var(--space-3);
      cursor: pointer;
      color: var(--color-text-tertiary);
      &:hover {
        color: var(--color-primary-text);
      }
    }
  }
`;

const filterFn = (list = []) => list.filter(i => i.isDeleted);

export default function DelateDialog({ options = [], colorful, onOk, onCancel }) {
  const [deleteOptions, setOptions] = useState(filterFn(options));
  const noDelOptions = options.filter(o => !o.isDeleted);

  return (
    <Dialog
      width={480}
      visible={true}
      title={_l('已删除选项（%0）', deleteOptions.length)}
      footer={null}
      onCancel={onCancel}
    >
      <DelateDialogWrap>
        {deleteOptions.map((item, index) => {
          return (
            <li key={index}>
              <div className="name flex ellipsis">
                {colorful ? (
                  <OptionChip color={item.color} title={item.value}>
                    {item.value}
                  </OptionChip>
                ) : (
                  <div className="flex overflow_ellipsis">{item.value}</div>
                )}
              </div>
              <Tooltip title={_l('恢复')} placement="bottom">
                <Icon
                  icon="repeal-o"
                  onClick={() => {
                    if (options.length - deleteOptions.length >= MAX_OPTIONS_COUNT) {
                      alert(_l('选项不得超过1000个'), 3);
                      return;
                    }

                    if (_.find(noDelOptions, n => n.value === item.value)) {
                      alert(_l('与列表中选项重复'), 3);
                      return;
                    }

                    const newOptions = options.map(i => {
                      return i.key === item.key ? { ...i, isDeleted: false } : i;
                    });
                    onOk(newOptions);
                    setOptions(filterFn(newOptions));
                  }}
                />
              </Tooltip>
            </li>
          );
        })}
      </DelateDialogWrap>
    </Dialog>
  );
}
