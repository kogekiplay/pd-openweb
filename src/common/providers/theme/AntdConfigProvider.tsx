import type { PropsWithChildren } from 'react';
import { StyleProvider, autoPrefixTransformer, legacyLogicalPropertiesTransformer } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';
import { antdConfigProviderProps } from 'src/common/config/theme/antdConfig';
import { getAntdThemeConfig } from 'src/common/config/theme/antdTheme';

/**
 * 官方 7.5.4 新增 `src/common/config/theme/antdStyle.js`（sha256 168253c7d0d7384350e4ac17bcc2b924d0a08edbce4406bc88c2a9f9ec562415）的 typed 移植。
 * 该文件是纯 .js，本仓 allowJs 已移除，直接 import 会产生 TS7016，故按原文逐行移植（行为必须一致）。
 */
const LOGICAL_PROPERTIES = [
  'inset',
  'margin-inline',
  'padding-inline',
  'border-inline',
  'border-start-start-radius',
] as const;
const PREFIX_TRANSFORMERS = [autoPrefixTransformer];
const LEGACY_TRANSFORMERS = [legacyLogicalPropertiesTransformer, autoPrefixTransformer];
type StyleCompatibilityProps = { hashPriority: 'low' | 'high'; transformers?: typeof PREFIX_TRANSFORMERS };
const MODERN_STYLE_PROPS: StyleCompatibilityProps = { hashPriority: 'low' };
const SELECTOR_FALLBACK_STYLE_PROPS: StyleCompatibilityProps = { hashPriority: 'high', transformers: PREFIX_TRANSFORMERS };
const LOGICAL_FALLBACK_STYLE_PROPS: StyleCompatibilityProps = { hashPriority: 'low', transformers: LEGACY_TRANSFORMERS };
const LEGACY_STYLE_PROPS: StyleCompatibilityProps = { hashPriority: 'high', transformers: LEGACY_TRANSFORMERS };

export const getAntdStyleProviderProps = (): StyleCompatibilityProps => {
  const canCheckSupport = typeof CSS !== 'undefined' && typeof CSS.supports === 'function';
  const supportsWhere = canCheckSupport && CSS.supports('selector(:where(*))');
  const supportsLogicalProperties = canCheckSupport && LOGICAL_PROPERTIES.every(property => CSS.supports(property, '0px'));

  if (supportsLogicalProperties) {
    return supportsWhere ? MODERN_STYLE_PROPS : SELECTOR_FALLBACK_STYLE_PROPS;
  }

  return supportsWhere ? LOGICAL_FALLBACK_STYLE_PROPS : LEGACY_STYLE_PROPS;
};

export const getCurrentAntdThemeConfig = getAntdThemeConfig;
export default function AntdConfigProvider({ children }: PropsWithChildren) {
  return (
    <StyleProvider {...getAntdStyleProviderProps()}>
      <ConfigProvider {...antdConfigProviderProps} theme={getCurrentAntdThemeConfig()}>
        {children}
      </ConfigProvider>
    </StyleProvider>
  );
}
