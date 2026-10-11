import type { CSSProperties } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

interface LoadDivProps {
  size?: number | 'big' | 'middle' | 'small' | undefined;
  /** Legacy callers sometimes pass CSS strings such as `left!important`. */
  style?: CSSProperties | Record<string, string | number | undefined> | undefined;
  className?: string | undefined;
}

/**
 * 加载中
 */
function LoadDiv(props: LoadDivProps) {
  let { size, style } = props;

  if (size === 'big') {
    size = 36;
  } else if (!size || size === 'middle') {
    size = 24;
  } else if (size === 'small') {
    size = 16;
  }

  const strokeWidth = Math.floor(size / 8);
  const r = Math.floor(size / 2);
  const cx = r + strokeWidth;
  const cy = cx;
  const width = cx + cy;
  return (
    <div
      style={style as CSSProperties | undefined}
      className={classNames('divCenter TxtCenter TxtMiddle', props.className)}
    >
      <div className="MdLoader" style={{ width }}>
        <svg className="MdLoader-circular">
          <circle {...{ cx, cy, r, strokeWidth }} className="MdLoader-path" />
        </svg>
      </div>
    </div>
  );
}

LoadDiv.propTypes = {
  className: PropTypes.string,
  size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default LoadDiv;
