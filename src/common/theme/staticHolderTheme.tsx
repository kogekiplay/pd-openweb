import { ConfigProvider } from 'antd';
import { currentThemeSeed } from './applyThemeVars';
import { antdTheme } from './palette';

/**
 * 让 antd 的静态方法（message / notification / Modal.info 这些）也走主题。
 *
 * 【为什么需要】它们渲染在 React 树之外，三处 ConfigProvider（router / Application / FunctionWrap）都罩不住。
 * 全局 alert（ming-ui/functions/alert 的 antAlert）用的就是静态 message —— 页面上只要有 ConfigProvider
 * 带了 theme，antd 在 dev 下每弹一次提示都报
 * 「[antd: message] Static function can not consume context like dynamic theme. Please use 'App' component instead.」
 * antd 给这种场景留的口子就是 ConfigProvider.config({ holderRender })。
 *
 * 【为什么切应用之后也跟得上、不用订阅】message / notification 的全局 holder 只建一次，但每次调用前都会 sync
 * 让它重渲染，holderRender 也就每次重新执行；Modal 的静态方法则是每次调用各渲染一次。所以这里按【当时】的应用色
 * 现取 antdTheme，不缓存。暗色和别处一样靠 CSS 变量，不在这里另开算法 —— 与那三处 ConfigProvider 保持同一个入口。
 */
export function installStaticHolderTheme(): void {
  ConfigProvider.config({
    holderRender: children => <ConfigProvider theme={antdTheme(currentThemeSeed())}>{children}</ConfigProvider>,
  });
}
