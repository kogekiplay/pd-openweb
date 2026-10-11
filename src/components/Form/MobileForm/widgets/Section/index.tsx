import type { ReactNode } from 'react';

const Section = ({ children }: { children?: ReactNode | undefined }) => {
  return <div className="customMobileFormContainer">{children}</div>;
};

export default Section;
