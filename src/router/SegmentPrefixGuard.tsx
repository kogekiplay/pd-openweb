import React from 'react';
import _ from 'lodash';
import NotFoundRedirect from './NotFoundRedirect';

/**
 * 段内静态前缀的守卫。
 *
 * v4 的路径可以写 `/user_:id`、`/apps/task/task_:id`、`/apps/calendar/detail_:id`
 * 这种【段内】带静态前缀的形式，只有以该前缀开头的 URL 才会命中。
 * v7 【没有任何办法】表达它 —— * 必须跟在 / 后面，实测 '/user_*' 会被当成
 * '/user_/*' 处理、对 /user_abc 返回 null。
 *
 * 所以这几条只能退化成整段匹配（/:userSeg、/apps/task/:taskSeg …），
 * 代价是会多接住一批本不该它管的 URL。本组件把那批挡回去：
 *   - 前缀（或 allowExact 里的整段字面量）不匹配 → 交给 fallback，
 *     没给 fallback 就走全局兜底 404，与 v4 落到 <Route path="*"> 同效
 *   - 匹配则把前缀剥掉、按 v4 的参数名塞回 match.params.id，
 *     下游组件（读 match.params.id）一行不用改
 *
 * tools/verify-router-matching.cjs 的例外表放行这几条差异，前提就是这个守卫
 * 真的存在 —— 那里写了「没写守卫就是骗自己」。改这里之前先看那段注释。
 */
export default function SegmentPrefixGuard(props) {
  const { param, prefix, allowExact = [], component: Comp, fallback: Fallback, match, ...rest } = props;
  const seg = _.get(match, ['params', param]) || '';
  const hasPrefix = !!prefix && seg.startsWith(prefix);

  if (!hasPrefix && !allowExact.includes(seg)) {
    return Fallback ? <Fallback {...rest} match={match} /> : <NotFoundRedirect />;
  }

  const nextMatch = {
    ...match,
    params: { ...(match || {}).params, id: hasPrefix ? seg.slice(prefix.length) : undefined },
  };

  return <Comp {...rest} match={nextMatch} />;
}
