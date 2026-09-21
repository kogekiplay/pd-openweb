import React from 'react';
import { Collapse } from 'antd';
import { arrayOf, func, shape, string } from 'prop-types';
import styled from 'styled-components';
import { getIconByType } from 'src/pages/widgetConfig/util';
import { SearchFn } from 'src/pages/widgetConfig/util';
import { checkTypeSupportForFunction } from 'src/utils/control';
import type { FormControl } from 'src/utils/controlTypes';

const Con = styled.div`
  padding: 10px 0;
  .ant-collapse,
  .ant-collapse-borderless {
    background-color: transparent !important;
  }
  .fnTitle {
    font-weight: bold;
    color: var(--color-text-primary);
  }
  .ant-collapse-header {
    padding: var(--space-3) 14px !important;
  }
  .ant-collapse > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow {
    margin-right: var(--space-1);
    vertical-align: middle;
  }
  .ant-collapse-item {
    border-bottom: none !important;
  }
  .ant-collapse-arrow {
    top: 15px !important;
    padding: 0px !important;
    left: 14px !important;
  }
  .ant-collapse-body {
    padding: 0px !important;
  }
`;

const ControlItem = styled.div`
  display: flex;
  height: 36px;
  line-height: 36px;
  font-size: var(--font-sm);
  padding: 0 var(--space-5);
  cursor: pointer;
  &:hover {
    background: var(--color-border-secondary);
  }
`;

const ExpandIcon = styled.i`
  display: inline-block;
  font-size: var(--font-lg);
  color: var(--color-text-tertiary);
  vertical-align: middle !important;
  transform: ${({ isActive }) => `rotate(${isActive ? 0 : -90}deg)`};
`;

const Icon = styled.i`
  font-size: var(--font-xl);
  color: var(--color-text-tertiary);
  margin-right: var(--space-2);
  line-height: 36px;
`;

export function getControlType(control: FormControl) {
  if (control.type === 30) {
    return control.sourceControlType;
  } else if (control.type === 53) {
    return control.enumDefault2;
  } else {
    return control.type;
  }
}

export default function ControlList(props) {
  const { keywords, controls, controlGroups, insertTagToEditor }: { controls: FormControl[]; [key: string]: any } = props;
  const visibleControls: FormControl[] = controls.filter(c => c.controlName && checkTypeSupportForFunction(c));

  if (controlGroups && controlGroups.length) {
    return (
      <Con>
        <Collapse
          defaultActiveKey="commonly"
          bordered={false}
          expandIcon={({ isActive }) => (
            <span>
              <ExpandIcon isActive={isActive} className="icon icon-worksheet_fall" />
            </span>
          )}
          // {...(keywords
          //   ? {
          //       // activeKey: types,
          //     }
          //   : {})}
        >
          {controlGroups.map(group => (
            <Collapse.Panel key={group.id} header={<span className="fnTitle">{group.name}</span>}>
              {group.controls
                .filter(c => c.controlName && checkTypeSupportForFunction(c))
                .filter(c => SearchFn(keywords, c.controlName))
                .map((c, i) => (
                  <ControlItem
                    key={i}
                    onClick={() => {
                      insertTagToEditor({
                        value: group.id + '-' + c.controlId,
                        text: c.controlName,
                      });
                    }}
                  >
                    <Icon className={`icon icon-${getIconByType(c.type || 6)}`} />
                    <span className="ellipsis" title={c.controlName}>
                      {c.controlName}
                    </span>
                  </ControlItem>
                ))}
            </Collapse.Panel>
          ))}
        </Collapse>
      </Con>
    );
  } else {
    return (
      <Con>
        {(keywords ? visibleControls.filter(c => SearchFn(keywords, c.controlName)) : visibleControls).map((c, i) => (
          <ControlItem
            key={i}
            onClick={() => {
              insertTagToEditor({
                value: c.controlId,
                text: c.controlName,
              });
            }}
          >
            <Icon className={`icon icon-${getIconByType(getControlType(c) || 6)}`} />
            <span className="ellipsis" title={c.controlName}>
              {c.controlName}
            </span>
          </ControlItem>
        ))}
      </Con>
    );
  }
}

ControlList.propTypes = {
  insertTagToEditor: func,
  keywords: string,
  controls: arrayOf(shape({})),
  controlGroups: arrayOf(shape({})),
};
