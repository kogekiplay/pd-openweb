import React from 'react';
import { Menu } from 'antd';
import { Icon } from 'ming-ui';

const HIDDEN_MENU = [
  {
    text: _l('全隐藏%05011'),
    textShow: _l('全显示%05008'),
    key: ['hide', 'show'],
  },
  {
    text: _l('仅在PC端隐藏%05010'),
    textShow: _l('仅在PC端显示%05007'),
    key: ['hpc&sapp', 'spc&happ'],
  },
  {
    text: _l('仅在移动端隐藏%05009'),
    textShow: _l('仅在移动端显示%05006'),
    key: ['spc&happ', 'hpc&sapp'],
  },
];

export default function HiddenMenu(props) {
  const { onClick, showhide, ...rest } = props;
  let type = showhide === 'hide' ? 1 : 0;

  return (
    // children 写法在 antd 5 起已弃用，改用 items（详见 viewDisplayMenu.tsx 的注释）。
    // DOM 结构与选择器不变，className / onClick 在 items 里同样可用。
    <Menu
      className="hiddenMenu"
      {...rest}
      items={HIDDEN_MENU.map((item, index) => ({
        key: 'hiddenMenu' + index,
        className: `hiddenMenuItem ${showhide === HIDDEN_MENU[index].key[type] ? 'current' : ''}`,
        onClick: () => onClick(showhide === HIDDEN_MENU[index].key[type] ? '' : HIDDEN_MENU[index].key[type]),
        label: (
          <React.Fragment>
            {item[showhide !== 'hide' ? 'text' : 'textShow']}
            {showhide === HIDDEN_MENU[index].key[type] && <Icon icon="done" />}
          </React.Fragment>
        ),
      }))}
    />
  );
}
