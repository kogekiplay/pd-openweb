export { getRequest, browserIsMobile } from 'src/utils/common';

import { browserIsMobile } from 'src/utils/common';
export const isBioVerifyAvailable = (): boolean => {
  const sdk: unknown = window['md_js'];
  return Boolean(browserIsMobile() && window.isMingDaoApp && sdk && typeof sdk === 'object' && 'bioVerify' in sdk && typeof sdk.bioVerify === 'function');
};
