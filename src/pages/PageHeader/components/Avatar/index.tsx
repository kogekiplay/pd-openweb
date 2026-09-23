import cx from 'classnames';
import './index.less';

export default ({ shape = 'circle', src, size = 36, className, onClick = () => {} }: { className?: string; [key: string]: any }) => (
  <div className={cx(className, 'avatarWrap', `avatar-${shape}`)} onClick={onClick}>
    <img src={src} style={{ width: size, height: size }} />
  </div>
);
