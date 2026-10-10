import type { CSSProperties } from 'react';
import { ScrollView } from 'ming-ui';
import type { ScrollBarProps } from './types';

export default function ScrollBar(props: ScrollBarProps) {
  const { type = 'y', barWidth, setRef, onScroll = () => {}, setScrollY = () => {}, setScrollX = () => {} } = props;
  let style: CSSProperties = { ...props.style };
  let contentStyle: CSSProperties = { ...props.contentStyle };
  style.position = 'absolute';
  style.overflow = 'hidden';
  if (type === 'y') {
    style.overflowY = 'auto';
    style.width = barWidth;
    contentStyle.width = barWidth;
  } else if (type === 'x') {
    style.overflowX = 'auto';
    style.height = barWidth;
    contentStyle.height = barWidth;
  }

  return (
    <ScrollView
      className={'scroll-' + type}
      style={{
        ...style,
        ...(type === 'y' ? { right: 1 } : {}),
      }}
      setViewPortRef={setRef}
      tabIndex={-1}
      customScroll={instance => {
        onScroll(instance);
        const { scrollOffsetElement } = instance.elements();
        const { scrollTop, scrollLeft } = scrollOffsetElement;

        if (type === 'x') {
          setScrollX(scrollLeft);
        } else if (type === 'y') {
          setScrollY(scrollTop);
        }
      }}
    >
      <div className="content" style={contentStyle}></div>
    </ScrollView>
  );
}
