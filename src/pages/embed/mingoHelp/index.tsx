import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router';
import preall from 'src/common/entries/preall';
import { GlobalStoreProvider } from 'src/common/providers/GlobalStore';
import HelpPage from './HelpPage';

// /public/mingo/help：对外嵌入的匿名智能客服页。免登录。
// GlobalStoreProvider：MingoWelcome 依赖 useGlobalStore（应用内取 appInfo），独立页需自带 Provider。
const container = document.getElementById('app');
if (!container) throw new Error('Mingo help root is missing');
const root = createRoot(container);
const WrappedComp = preall(
  () => (
    <Router>
      <GlobalStoreProvider>
        <HelpPage />
      </GlobalStoreProvider>
    </Router>
  ),
  { allowNotLogin: true },
);
if (!WrappedComp) throw new Error('Mingo help bootstrap did not return a component');

root.render(<WrappedComp />);
