import cx from 'classnames';

export type ProcessState = 'noStart' | 'noEnd';
export type ProcessStatus = 'inAdvance' | 'normal';
interface ProcessBarProps {
  width: number;
  left: number;
  state?: ProcessState | undefined;
  className?: string | undefined;
  status?: ProcessStatus | undefined;
}

export default ({ width, left, state, className, status }: ProcessBarProps) => {
  return (
    <div style={{ marginLeft: left }} className={cx('processBar flexRow', className, state)}>
      {state === 'noStart' && <div className={cx('before', status, state)} />}
      <div className={cx('day', status, state, { tooShort: width < 24 })} style={{ width }} />
      {state === 'noEnd' && <div className={cx('after', status, state)} />}
    </div>
  );
};
