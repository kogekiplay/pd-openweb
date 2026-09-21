import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { GlobalStoreProvider } from 'src/common/GlobalStore';
import { onSolidPrimary, PLATFORM_PRIMARY } from 'src/common/theme';
import store from 'src/redux/configureStore';
import App from './App';

const root = createRoot(document.getElementById('app'));

// 全仓原先【没有】根级带 theme 的 ConfigProvider：113 处 ConfigProvider 几乎全是
// button={{ autoInsertSpace: false }} 这种局部配置，不带 theme，嵌套时会继承
// 父级 token，所以在这里加一层是安全的。
//
// 这里只给平台色。应用区域的 antd token 由 src/router/Application/index.tsx
// 里那层 ConfigProvider 覆盖。
root.render(
  <Provider store={store}>
    <GlobalStoreProvider>
      {/* colorTextLightSolid = 压在实心主色上的文字。antd 默认恒为白，
          而主色是用户可选的 —— 浅色主色配白字读不清。交给 onSolidPrimary 按
          明度决定黑白（够读就还是白）。理由和阈值见 common/theme/palette.ts。 */}
      <ConfigProvider
        theme={{
          token: { colorPrimary: PLATFORM_PRIMARY, colorTextLightSolid: onSolidPrimary(PLATFORM_PRIMARY) },
        }}
      >
        <Router>
          <App />
        </Router>
      </ConfigProvider>
    </GlobalStoreProvider>
  </Provider>,
);
