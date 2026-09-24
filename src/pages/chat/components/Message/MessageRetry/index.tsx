import { Component } from 'react';
import LoadDiv from 'ming-ui/components/LoadDiv';
import './index.less';

export interface MessageRetryState {
  status: string | false;
}

export default class MessageRetry extends Component<any, MessageRetryState> {
  declare loadingTime: NodeJS.Timeout | undefined;
  declare errorTime: NodeJS.Timeout | undefined;
  declare retry: HTMLDivElement | null | undefined;

  constructor(props) {
    super(props);
    this.state = {
      status: false, // 'loading' & 'error'
    };
  }
  override componentDidMount() {
    this.setStatus();
  }
  override componentWillUnmount() {
    this.loadingTime && clearTimeout(this.loadingTime);
    this.errorTime && clearTimeout(this.errorTime);
  }
  setStatus() {
    const { message } = this.props;

    if (message.waitingId) {
      this.loadingTime = setTimeout(() => {
        this.setState({
          status: 'loading',
        });
      }, 200);
      this.errorTime = setTimeout(() => {
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
    this.props.onRetry();
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
