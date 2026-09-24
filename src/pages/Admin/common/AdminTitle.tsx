import PropTypes from 'prop-types';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import Config from '../config';

export interface AdminTitleProps {
  prefix?: string | undefined;
}

function AdminTitle({ prefix = '' }: AdminTitleProps) {
  const title = Config.getTitle(prefix);
  return <DocumentTitle title={title} />;
}

AdminTitle.propTypes = {
  prefix: PropTypes.string,
};

export default AdminTitle;
