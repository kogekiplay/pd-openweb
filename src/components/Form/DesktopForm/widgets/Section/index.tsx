import type { ReactNode } from 'react';

const Section = (props: { children?: ReactNode | undefined }) => {
  const { children } = props;
  return <div className="customFieldsContainer">{children}</div>;
};

export default Section;
