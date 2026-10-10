import { Component } from 'react';
import PropTypes from 'prop-types';
import Button from 'ming-ui/components/Button';
import type { ConfirmButtonProps } from './types';

export interface ConfirmButtonState {
  loading: boolean;
}

class ConfirmButton extends Component<ConfirmButtonProps, ConfirmButtonState> {
  declare mounted: boolean | undefined;

  constructor(props: ConfirmButtonProps) {
    super(props);
    this.state = {
      loading: false,
    };
    this.handleClick = this.handleClick.bind(this);
  }

  override componentDidMount() {
    this.mounted = true;
  }

  override componentWillUnmount() {
    this.mounted = false;
  }

  handleClick() {
    const { action, onClose } = this.props;

    if (action) {
      const promise: unknown = action.apply(this);

      // A returned scalar can also expose `then` through its prototype. Keep the
      // original property-get receiver and call receiver when reading it.
      const returnedObject: object = Object(promise);
      const then: unknown = promise ? Reflect.get(returnedObject, 'then', promise) : undefined;

      if (promise && then) {
        this.setState({ loading: true });
        const stopLoading = (noClose: unknown) => {
          if (this.mounted) {
            this.setState({ loading: false });
          }

          if (!noClose) {
            onClose && onClose();
          }
        };

        // The original branch reads `then` again after setting loading. A
        // getter may return a different function on that second access.
        const invokeThen: unknown = Reflect.get(returnedObject, 'then', promise);
        if (typeof invokeThen !== 'function') throw new TypeError('Invalid dialog action promise');
        Reflect.apply(invokeThen, promise, [stopLoading, stopLoading]);
      } else {
        if (promise === false) return undefined;
        onClose && onClose();
      }
    } else {
      onClose && onClose();
    }

    return undefined;
  }

  override render() {
    return (
      <Button
        type={this.props.type}
        disabled={this.props.disabled}
        onClick={this.handleClick}
        loading={this.state.loading}
        className={this.props.className}
      >
        {this.props.children}
      </Button>
    );
  }
}

ConfirmButton.propTypes = {
  action: PropTypes.func,
  onClose: PropTypes.func,
  children: PropTypes.node,
  type: PropTypes.string,
  className: PropTypes.string,
};

export default ConfirmButton;
