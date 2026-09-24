import cx from 'classnames';
import PropTypes from 'prop-types';
import './mdLeftNav.css';

export interface MDLeftNavProps {
  className: string;
  children: React.ReactNode;
}

function MDLeftNav(props: MDLeftNavProps) {
  return <div className={cx('Fixed mdLeftNav clearfix', props.className)}>{props.children}</div>;
}

MDLeftNav.propTypes = {
  className: PropTypes.string,
  children: PropTypes.any,
};

export default MDLeftNav;
