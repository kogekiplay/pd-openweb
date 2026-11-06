import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';
import { antdConfigProviderProps } from 'src/common/config/theme/antdConfig';
import { getAntdThemeConfig, getCurrentAntdThemeMode } from 'src/common/config/theme/antdTheme';
import { getAntdStyleProviderProps } from './AntdConfigProvider';

export default function AntdThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState(getCurrentAntdThemeMode);
  useEffect(() => {
    const observer = new MutationObserver(() => setMode(getCurrentAntdThemeMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return (
    <StyleProvider {...getAntdStyleProviderProps()}>
      <ConfigProvider {...antdConfigProviderProps} theme={getAntdThemeConfig(mode)}>
        {children}
      </ConfigProvider>
    </StyleProvider>
  );
}
