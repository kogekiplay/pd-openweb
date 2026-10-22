import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import qs from 'query-string';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import ConnectChatWindow from 'src/pages/chat/containers/ChatWindow';
import { isChatWindowSession } from 'src/pages/chat/utils/windowSession';
import store from 'src/redux/configureStore';

export default class ChatWindowEntrypoint extends Component<any, any> {
  constructor(props) {
    super(props);
  }

  override render() {
    const data = qs.parse(location.search.slice(1));
    return (
      <DocumentTitle title={String(data['name'] || '')}>
        {isChatWindowSession(data) ? (
          <Provider store={store}>
            <ConnectChatWindow session={data} />
          </Provider>
        ) : (
          <div className="TxtCenter mTop20 textSecondary" role="alert">
            {_l('链接参数无效')}
          </div>
        )}
      </DocumentTitle>
    );
  }
}

const root = createRoot(document.getElementById('app'));

root.render(<ChatWindowEntrypoint />);
