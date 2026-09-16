import React from 'react';
import PropTypes from 'prop-types';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import Config from '../config';

function AdminTitle({ prefix = '' }) {
  const title = Config.getTitle(prefix);
  return <DocumentTitle title={title} />;
}

AdminTitle.propTypes = {
  prefix: PropTypes.string,
};

export default AdminTitle;
