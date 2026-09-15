import qs from 'query-string';
import { browserIsMobile } from 'src/utils/common';
import renderPc from '../entrypoints/sharePc';
import render from '../shareMobile';

require.ensure([], () => {
  // query-string 的 parse 返回 string | string[] | null —— 只有同名参数在 URL 里
  // 出现多次才会是数组。分享链接一律由本仓生成，projectId 只带一个，按 string 用。
  const { projectId } = qs.parse(location.search.slice(1)) as { projectId: string };

  if (
    (browserIsMobile() || location.href.indexOf('kcsharelocal') > -1) &&
    location.href.indexOf('recordfile') < 0 &&
    location.href.indexOf('rowfile') < 0
  ) {
    render(projectId);
  } else {
    renderPc(projectId);
  }
});
