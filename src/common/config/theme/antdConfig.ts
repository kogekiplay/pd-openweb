import type { ConfigProviderProps } from 'antd';
import en from 'antd/es/locale/en_US';
import ja from 'antd/es/locale/ja_JP';
import zhCN from 'antd/es/locale/zh_CN';
import zhTW from 'antd/es/locale/zh_TW';

const language = typeof window === 'undefined' ? 'en' : getCurrentLang() || 'en';
const locales: Record<string, typeof en> = { en, ja, 'zh-Hans': zhCN, 'zh-Hant': zhTW };
export const antdConfigProviderProps: ConfigProviderProps = {
  locale: locales[language] || en,
  button: { autoInsertSpace: false },
};
