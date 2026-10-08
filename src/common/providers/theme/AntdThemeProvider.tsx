import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { ConfigProvider } from 'antd';
import { antdConfigProviderProps } from 'src/common/config/theme/antdConfig';
import { getAntdThemeConfig, getCurrentAntdThemeMode } from 'src/common/config/theme/antdTheme';

export default function AntdThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState(getCurrentAntdThemeMode);
  useEffect(() => {
    const observer = new MutationObserver(() => setMode(getCurrentAntdThemeMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return (
    <ConfigProvider {...antdConfigProviderProps} theme={getAntdThemeConfig(mode)}>
      {children}
    </ConfigProvider>
  );
}
