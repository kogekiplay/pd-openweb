/**
 * 把一条路由配置里的 path 展开成 react-router v7 需要的若干条具体路径。
 *
 * 只做两件事，都是 v4 → v7 语义差异的直接后果：
 *
 * 1. path 允许写成数组（同一个组件挂多条路径）。v4 的 <Route path={[...]}> 原生支持，
 *    v7 不支持，必须一条路径一个 <Route>。
 *
 * 2. **非精确路由要补 `/*`。** v4 的 <Route> 默认是【前缀匹配】——不写 exact 时
 *    path="/admin/:a/:b" 能匹配 /admin/x/y/还有更多/段；v7 默认精确匹配。
 *    要保留原语义就得显式加 `/*`。
 *    而且【必须同时保留不带 /* 的那条】：v7 里 "/a/*" 匹配不到 "/a" 本身。
 *    本仓 189 条路由里只有 1 条写了 exact，所以绝大多数都要走这条分支。
 *
 * 这里【不再处理】交替组 (a|b)、可选字面量组 (x)?、通配段 (.*) 这些 v4 正则语法：
 * 路由配置在迁移第①步已经全部改写成 v7 原生语法了。真混进来的话下面会直接抛，
 * 而不是静默生成一条永远匹配不上的路径。
 *
 * tools/verify-router-matching.cjs 直接 import 本函数做差分，
 * 所以这里的行为就是被 1292 个用例验证过的那个行为 —— 不要在别处再抄一份。
 */
export function expandRoutePaths(route: { path: string | string[]; exact?: boolean }): string[] {
  const paths = ([] as string[]).concat(route.path as any);
  const out: string[] = [];

  for (const raw of paths) {
    if (/[()]/.test(raw)) {
      throw new Error(
        `路由路径含 v4 的正则语法，v7 不支持：${raw}。` +
          '交替组请拆成多条路径，通配段请改成末尾的 /*（见 src/router/expandRoutePaths.ts 文件头）。',
      );
    }

    // 规整重复斜杠与尾斜杠；根路径 '/' 保持原样
    const p = raw.length > 1 ? raw.replace(/\/{2,}/g, '/').replace(/\/$/, '') : raw;
    out.push(p);

    if (!route.exact && !p.endsWith('*')) out.push(p === '/' ? '/*' : `${p}/*`);
  }

  return [...new Set(out)];
}

export default expandRoutePaths;
