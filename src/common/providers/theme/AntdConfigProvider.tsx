import type { PropsWithChildren } from 'react';
import { ConfigProvider } from 'antd';
import { antdConfigProviderProps } from 'src/common/config/theme/antdConfig';
import { getAntdThemeConfig } from 'src/common/config/theme/antdTheme';

export const getCurrentAntdThemeConfig = getAntdThemeConfig;
export default function AntdConfigProvider({ children }: PropsWithChildren) {
  return (
    <ConfigProvider {...antdConfigProviderProps} theme={getCurrentAntdThemeConfig()}>
      {children}
    </ConfigProvider>
  );
}
