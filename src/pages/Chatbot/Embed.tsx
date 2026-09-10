import React, { Component, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { Route, BrowserRouter as Router, Routes } from 'react-router';
import { LoadDiv } from 'ming-ui';
import homeAppApi from 'src/api/homeApp';
import UnNormal from 'worksheet/views/components/UnNormal';
import preall from 'src/common/preall';
import store from 'src/redux/configureStore';
import { navigateTo } from 'src/router/navigateTo';
import { RouteElement } from 'src/router/routeProps';
import { addSubPathOfRoute, getPathWithoutSubPath } from 'src/utils/common';
import withRouter from '../../router/withRouter';
import Chatbot from './index';

const ChatbotWrap = withRouter(props => {
  const { match, history } = props;
  const { appId, chatbotId, conversationId } = match.params;
  const [state, setState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    homeAppApi
      .getPageInfo({
        appId,
        id: chatbotId,
      })
      .then(data => {
        if (data.resultCode === 1) {
          setState(true);
        }

        setLoading(false);
      });
    window.reactRouterHistory = history;
  }, []);

  if (loading) {
    return (
      <div className="h100 flexRow alignItemsCenter justifyContentCenter">
        <LoadDiv />
      </div>
    );
  }

  if (!state) {
    return <UnNormal type="sheet" resultCode={-10000} />;
  }

  return (
    <Provider store={store}>
      <Chatbot
        data={{ appId, chatbotId, conversationId }}
        isEmbed={true}
        navigateToConversation={(conversationId, isReplace = false) => {
          const pathname = getPathWithoutSubPath(location.pathname);
          const basePathName = pathname.startsWith('/embed/chatbot/s') ? '/embed/chatbot/s' : '/embed/chatbot';
          navigateTo(`${basePathName}/${appId}/${chatbotId}/${conversationId || ''}`, isReplace);
        }}
      />
    </Provider>
  );
});

class LandChatbot extends Component<any, any> {
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <Router>
        <Routes>
          {/* 两条都是非精确匹配，各补一条 /*；末尾无 path 的兜底对应 v7 的 path="*" */}
          {['/embed/chatbot/:appId/:chatbotId/:conversationId?', '/embed/chatbot/s/:appId/:chatbotId/:conversationId?']
            .flatMap(one => [addSubPathOfRoute(one), `${addSubPathOfRoute(one)}/*`])
            .map(p => (
              <Route key={p} path={p} element={<RouteElement component={ChatbotWrap} />} />
            ))}
          <Route path="*" element={null} />
        </Routes>
      </Router>
    );
  }
}

const Comp = preall(LandChatbot);
const root = createRoot(document.getElementById('app'));

root.render(<Comp />);
