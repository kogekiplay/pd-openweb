import { useState } from 'react';
import cx from 'classnames';
import styled from 'styled-components';
import { Icon } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import { emitter, getDefaultThemeMode, setBodyThemeMode } from 'src/utils/common';

const Wrap = styled.div`
  background: var(--color-background-secondary);
  padding: 0px 5px;
  border-radius: var(--radius-sm);
  height: 36px;
  position: absolute;
  right: 10px;
  .item {
    color: var(--color-text-disabled);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
  }
  .active {
    color: var(--color-text-secondary);
    background: var(--color-background-card);
  }
`;

/**
 * picker 的真实值域：直接取既有全局声明 `window.themeMode?: 'light' | 'dark' | 'system'`
 * （types/global.d.ts:538；router/globalEvents 启动按 localStorage 写入、个人设置切换时改写）。
 * 注意：picker 含 `system`，而 `CHANGE_THEME_MODE` 事件 payload 只有 `dark`/`light`（下面两个
 * `if` 分支原样保留）——两个域不混用。
 */
export type ThemeModeValue = NonNullable<typeof window.themeMode>;

interface ThemeModeOption {
  value: ThemeModeValue;
  name: string;
  icon: string;
}

const themeModes: ThemeModeOption[] = [
  {
    value: 'light',
    name: _l('浅色'),
    icon: 'light_mode',
  },
  {
    value: 'dark',
    name: _l('深色'),
    icon: 'dark_mode',
  },
  {
    value: 'system',
    name: _l('跟随设备'),
    icon: 'computer',
  },
];

export default () => {
  const [themeMode, setThemeMode] = useState(localStorage.getItem('themeMode') || getDefaultThemeMode());

  const onChange = (value: ThemeModeValue) => {
    setThemeMode(value);
    setBodyThemeMode(value);
    window.themeMode = value;
    localStorage.setItem('themeMode', value);
    if (['dark', 'light'].includes(value)) {
      emitter.emit('CHANGE_THEME_MODE', value);
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      emitter.emit('CHANGE_THEME_MODE', isDark ? 'dark' : 'light');
    }
  };

  return (
    <Wrap className="flexRow alignItemsCenter">
      {themeModes.map(item => (
        <Tooltip title={item.name} placement="bottom" key={item.value}>
          <div
            className={cx('item flexRow alignItemsCenter justifyContentCenter pointer', {
              active: item.value === themeMode,
            })}
            onClick={() => onChange(item.value)}
          >
            <Icon icon={item.icon} className="Font18" />
          </div>
        </Tooltip>
      ))}
    </Wrap>
  );
};
