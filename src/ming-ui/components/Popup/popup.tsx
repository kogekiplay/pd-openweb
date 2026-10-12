import React from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import ClickAway from 'ming-ui/components/ClickAway';
import './popup.less';

export interface PopupProps {
  children?: ReactNode;
  withMask?: boolean | undefined;
  onClickAwayExceptions?: readonly unknown[] | undefined;
  className?: string | undefined;
  onClickAway?: ((target: Node | MouseEvent<HTMLParagraphElement>) => void) | undefined;
  style?: CSSProperties | undefined;
  arrowStyle?: CSSProperties | undefined;
}
interface PopupState {
  style: CSSProperties | undefined;
  arrowStyle: CSSProperties | undefined;
}

class Popup extends React.Component<PopupProps, PopupState> {
  declare popup: HTMLDivElement | null | undefined;

  static override propTypes = {
    children: PropTypes.element,
    withMask: PropTypes.bool,
    onClickAwayExceptions: PropTypes.array,
    className: PropTypes.string,
    onClickAway: PropTypes.func,
    style: PropTypes.object,
    arrowStyle: PropTypes.object,
  };

  override state: PopupState = {
    style: this.props.style,
    arrowStyle: this.props.arrowStyle,
  };

  override componentDidMount() {
    this.adjustPosition();
  }

  override componentDidUpdate(previous: PopupProps) {
    if (
      previous.style !== this.props.style ||
      previous.arrowStyle !== this.props.arrowStyle ||
      previous.withMask !== this.props.withMask
    ) {
      this.setState({ style: this.props.style, arrowStyle: this.props.arrowStyle }, () => this.adjustPosition());
    }
  }

  private adjustPosition() {
    if (!this.popup) return;
    const $popup = $(this.popup);
    const position = $popup.offset();
    const width = $popup.width();
    if (!position || width === undefined) return;
    const outerOffset = position.left + width - document.body.clientWidth;

    if (outerOffset > 0) {
      this.setState({
        style: _.assign({}, this.state.style, {
          left: -1 * (outerOffset + 10),
        }),
        arrowStyle: {
          ...this.props.arrowStyle,
          marginLeft: outerOffset + 10,
        },
      });
    }
  }

  override render() {
    const withMask = this.props.withMask;
    const popup = withMask ? (
      <div>
        <div
          className={cx('mingPopup', this.props.className)}
          ref={ref => {
            this.popup = ref;
          }}
          style={this.state.style}
        >
          <span className="arrow" style={this.state.arrowStyle} />
          {this.props.children}
        </div>
        <p className="mingPopupMask" onClick={this.props.onClickAway} />
      </div>
    ) : (
      <ClickAway
        className={cx('mingPopup', this.props.className)}
        ref={popup => {
          this.popup = popup;
        }}
        style={this.state.style}
        onClickAwayExceptions={this.props.onClickAwayExceptions}
        onClickAway={this.props.onClickAway}
      >
        <span className="arrow" style={this.state.arrowStyle} />
        {this.props.children}
      </ClickAway>
    );
    return popup;
  }
}

export default Popup;
