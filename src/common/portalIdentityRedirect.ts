interface PortalIdentity {
  isPortal?: boolean | undefined;
  appId?: string | undefined;
}

/** Identity switches cross site namespaces; pathCompletion intentionally stays in the current one. */
export function getPortalIdentityRedirect({
  href,
  account,
  mainSiteUrl,
  customSubPath = '',
}: {
  href: string;
  account: PortalIdentity;
  mainSiteUrl?: string | undefined;
  customSubPath?: string | undefined;
}): string | undefined {
  const current = new URL(href);
  const isPortalPage = current.pathname.includes('/portal/') || current.hostname.includes('theportal.cn');
  if (isPortalPage === Boolean(account.isPortal)) return undefined;

  const base = customSubPath.replace(/\/+$/, '');
  let target: URL;
  if (account.isPortal) {
    if (account.appId) {
      target = new URL(`${base}/portal/app/${encodeURIComponent(account.appId)}`, current.origin);
    } else {
      target = new URL(`${base}/portal/network`, current.origin);
      target.searchParams.set('ReturnUrl', current.href);
    }
  } else {
    target = new URL(mainSiteUrl || `${current.origin}${base}/`, current.origin);
    target.pathname = `${target.pathname.replace(/\/+$/, '').replace(/\/portal$/i, '')}/dashboard`;
    target.search = '';
    target.hash = '';
  }
  return target.href === current.href ? undefined : target.href;
}
