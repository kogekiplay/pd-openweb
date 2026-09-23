import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import qs from 'query-string';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import ConnectChatWindow from 'src/pages/chat/containers/ChatWindow';
import store from 'src/redux/configureStore';

export default class ChatWindowEntrypoint extends Component<any, any> {
  constructor(props) {
    super(props);
  }

  override render() {
    const data = qs.parse(location.search.slice(1));
    return (
      <DocumentTitle title={String(data.name || '')}>
        {
          <Provider store={store}>
            <ConnectChatWindow session={data} />
          </Provider>
        }
      </DocumentTitle>
    );
  }
}

const root = createRoot(document.getElementById('app'));

root.render(<ChatWindowEntrypoint />);
