import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

export default function TextPreview({ text }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current.innerText = text;
  }, [text]);
  return <div ref={ref} className="text-preview" />;
}

TextPreview.propTypes = {
  text: PropTypes.string.isRequired,
};
