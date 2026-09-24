import cx from 'classnames';
import Icon from 'ming-ui/components/Icon';
import './index.less';

export default ({ icon, explain, className, children }: { icon?: string; className?: string; [key: string]: any }) => (
  <div className={cx('workflowEmptyWrap flexColumn', className)}>
    <div className="iconWrap">
      <Icon icon={icon} />
    </div>
    <div className="emptyExplain">{explain}</div>
    {children}
  </div>
);
