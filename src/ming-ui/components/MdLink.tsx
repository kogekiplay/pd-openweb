import { Link, type LinkProps } from 'react-router';
import cx from 'classnames';
import propTypes from 'prop-types';
import { pathCompletion } from 'src/utils/common';

interface MdLinkProps extends Omit<LinkProps, 'to'> {
  /** HAP pathCompletion accepts a URL string before handing it to the router. */
  to: string;
}

export default function MdLink(props: MdLinkProps) {
  const { to, children, onClick, className, ...rest } = props;
  return (
    <Link
      draggable="false"
      to={pathCompletion(to, { hasDomain: false })}
      onClick={onClick}
      className={cx('stopPropagation', className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

MdLink.propTypes = {
  to: propTypes.string,
  children: propTypes.any,
  onClick: propTypes.func,
};
