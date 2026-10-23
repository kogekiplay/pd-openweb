import { Component } from 'react';
import type { ChatMessage } from '../../../redux/types';
import LoadDiv from 'ming-ui/components/LoadDiv';
import './index.less';

export interface MessageRetryState {
  status: 'loading' | 'error' | false;
}

export interface MessageRetryProps {
  message: ChatMessage;
  onRetry: () => void | Promise<void>;
}
export default class MessageRetry extends Component<MessageRetryProps, MessageRetryState> {
  private mounted = false;
  private retryVersion = 0;
  declare loadingTime: NodeJS.Timeout | undefined;
  declare errorTime: NodeJS.Timeout | undefined;
  declare retry: HTMLDivElement | null | undefined;

  constructor(props: MessageRetryProps) {
    super(props);
    this.state = {
      status: false, // 'loading' & 'error'
    };
  }
  override componentDidMount() {
    this.mounted = true;
    this.setStatus();
  }
  override componentDidUpdate(previous: MessageRetryProps) {
    if (previous.message.waitingId !== this.props.message.waitingId) {
      this.retryVersion += 1;
      this.setState({ status: false });
      this.setStatus();
    }
  }
  override componentWillUnmount() {
    this.mounted = false;
    this.retryVersion += 1;
    this.clearStatusTimers();
  }
  clearStatusTimers() {
    this.loadingTime && clearTimeout(this.loadingTime);
    this.errorTime && clearTimeout(this.errorTime);
  }
  setStatus() {
    this.clearStatusTimers();
    const { message } = this.props;

    if (message.waitingId) {
      this.loadingTime = setTimeout(() => {
        if (!this.mounted) return;
        this.setState({
          status: 'loading',
        });
      }, 200);
      this.errorTime = setTimeout(() => {
        if (!this.mounted) return;
        const { status } = this.state;

        if (status === 'loading') {
          this.setState({
            status: 'error',
          });
        }
      }, 1000 * 10);
    }
  }
  handleRetry() {
    this.setStatus();
    const version = ++this.retryVersion;
    const request = this.props.onRetry();
    if (request) {
      request.catch(() => {
        if (!this.mounted || version !== this.retryVersion) return;
        this.clearStatusTimers();
        this.setState({ status: 'error' });
      });
    }
  }
  override render() {
    const { status } = this.state;
    return (
      <div
        className="Message-retry-wrapper"
        ref={retry => {
          this.retry = retry;
        }}
      >
        {status === 'error' ? (
          <div onClick={this.handleRetry.bind(this)} className="Message-retry-btn">
            !
          </div>
        ) : undefined}
        {status === 'loading' ? (
          <div className="Message-retry-loading">
            <LoadDiv size="small" />
          </div>
        ) : undefined}
      </div>
    );
  }
}
