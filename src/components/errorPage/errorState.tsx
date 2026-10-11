import { Component } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import './errorPage.less';

interface ErrorStateProps {
  text?: string | undefined;
  showBtn?: boolean | undefined;
  className?: string | undefined;
  iconClassName?: string | undefined;
  btnText?: string | undefined;
  callback?: (() => void) | undefined;
}

export default class ErrorState extends Component<ErrorStateProps, Record<string, never>> {
  static override propTypes = {
    text: PropTypes.string,
    showBtn: PropTypes.bool,
    className: PropTypes.string,
    iconClassName: PropTypes.string,
    btnText: PropTypes.string,
    callback: PropTypes.func,
  };

  static defaultProps = {
    text: '',
    btnText: _l('申请加入'),
    showBtn: false,
    callback: () => {},
  };

  constructor(props: ErrorStateProps) {
    super(props);
  }

  override render() {
    const { text, btnText, showBtn, callback, className, iconClassName } = this.props;

    return (
      <div className={cx('flexColumn noAuthContentBox', className)}>
        <i className={cx('icon-error1', iconClassName)} />
        <div className="Font17 mTop20">{text}</div>
        {showBtn ? (
          <span className="Font14 bgColorPrimary hoverBgColorPrimaryDark noAuthJoin mTop25 pointer" onClick={callback}>
            {btnText}
          </span>
        ) : undefined}
      </div>
    );
  }
}
