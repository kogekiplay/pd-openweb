import type { ComponentProps, CSSProperties } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import './less/Splitter.less';

interface SplitterProps extends ComponentProps<'hr'> {
  /** Legacy attribute forwarded unchanged to the separator. */
  inlineStyle?: CSSProperties | undefined;
}

function Splitter(props: SplitterProps) {
  return <hr {...props} className={cx(props.className, 'ming Splitter')} />;
}

Splitter.propTypes = {
  /**
   * 分割线的类名
   */
  className: PropTypes.string,
};

export default Splitter;
