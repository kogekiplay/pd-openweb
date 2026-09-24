import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import roleApi from 'src/api/role';
import versionApi from 'src/api/version';
import { PERMISSION_ENUM, ROUTE_CONFIG } from 'src/pages/Admin/enum';

let cachePermission: Record<string, { data: number[]; time: string; version: string }> = {};

const setCacheData = (projectId: string, data: number[], version: string) => {
  cachePermission[projectId] = {
    data,
    time: moment().format('YYYY-MM-DD HH:mm:ss'),
    version,
  };
};

/**
 * 取权限版本（用于判断缓存是否还有效）。
 *
 * 【原先是同步 XHR】`{ ajaxOptions: { sync: true } }` —— 主线程同步请求已被废弃，
 * 控制台每次都报 "Synchronous XMLHttpRequest on the main thread is deprecated"。
 * 现在只在【后台刷新】里用它，拿不到就当版本变了、重新取权限，不影响调用方。
 */
const fetchVersion = (projectId: string): Promise<string> =>
  versionApi
    .getVersion({ moduleType: 50, sourceId: projectId }, { silent: true })
    .then(data => (data ? data.version : ''))
    .catch(() => '');

/** 后台刷新一个项目的权限，填回缓存。同一个项目并发调用只跑一次。 */
// 里面装的是 permissionIds（权限枚举值，见 Admin/enum 的 PERMISSION_ENUM）
const refreshing: Record<string, Promise<number[]>> = {};

export const prefetchMyPermissions = (projectId: string): Promise<number[]> => {
  if (!projectId) return Promise.resolve([]);
  if (refreshing[projectId]) return refreshing[projectId];

  refreshing[projectId] = fetchVersion(projectId)
    .then(version =>
      roleApi.getMyPermissions({ projectId }, { silent: true }).then(res => {
        const ids = (res && res.permissionIds) || [];
        setCacheData(projectId, ids, version);
        return ids;
      }),
    )
    .catch(() => [])
    .finally(() => {
      delete refreshing[projectId];
    });

  return refreshing[projectId];
};

//校验权限--已有用户权限
export const hasPermission = (userPermissionIds, needPermission) => {
  let checkResult = false;

  if (_.isArray(needPermission)) {
    //要检查的权限是数组时，用户权限包含数组中任一项则符合条件
    checkResult = needPermission.some(item => userPermissionIds.includes(item));
  } else {
    checkResult = userPermissionIds.includes(needPermission);
  }

  return checkResult;
};

/**
 * 取当前账号在某个项目下的权限 id 列表。
 *
 * 【isSync 的含义没变】调用方（20 处，多数在 render 里当条件用）仍然直接拿到数组。
 * 变的是拿不到缓存时的行为：
 *   · 缓存新鲜        -> 直接返回（和以前一样）
 *   · 缓存超过 5 分钟 -> 【先把旧值返回去】，同时在后台刷新（stale-while-revalidate）。
 *                        以前是同步请求版本号再决定，那正是废弃的同步 XHR 之一。
 *   · 完全没有缓存    -> 返回 []，并在后台取。以前是两次同步 XHR 把主线程卡住。
 *
 * 【为什么"没有缓存返回 []"是可接受的】preall 在启动时会 await 预取
 * md.global.Account.projects 里每个项目的权限（见 prefetchMyPermissions 的调用点），
 * 所以正常渲染时缓存一定是热的。会走到这一分支的只有【不属于本账号的项目】——
 * 那种情况下权限本来就该当成空。
 */
// 同步调用（默认）直接给权限 id 数组；传 false 时给 Promise（调用方一律写字面量 false）
export function getMyPermissions(projectId: string, isSync?: true): number[];
export function getMyPermissions(projectId: string, isSync: false): Promise<number[]>;
export function getMyPermissions(projectId: string, isSync = true) {
  const cache = cachePermission[projectId];

  if (cache) {
    // 超过 5 分钟就顺手在后台刷一次，但本次调用仍然用旧值
    if (moment().diff(moment(cache.time), 'm') > 5) {
      prefetchMyPermissions(projectId);
    }

    return isSync ? cache.data || [] : Promise.resolve(cache.data || []);
  }

  const pending = prefetchMyPermissions(projectId);

  return isSync ? [] : pending;
}

//校验权限--需要获取权限
export const checkPermission = (projectId: string, needPermission: number | number[]) => {
  return hasPermission(getMyPermissions(projectId), needPermission);
};

export const canPurchase = ({ projectId, myPermissions = [] }: { projectId?: string; [key: string]: any }) => {
  const permissionsExceptHr = Object.values(PERMISSION_ENUM)
    .map(item => parseInt(item))
    .filter(item => item);

  return projectId
    ? checkPermission(projectId, permissionsExceptHr)
    : hasPermission(myPermissions, permissionsExceptHr);
};

export const hasBackStageAdminAuth = ({
  projectId,
  myPermissions = [],
}: {
  projectId?: string;
  [key: string]: any;
}) => {
  const permissionArr = Object.keys(ROUTE_CONFIG)
    .map(item => parseInt(item))
    .filter(item => item);
  return projectId ? checkPermission(projectId, permissionArr) : hasPermission(myPermissions, permissionArr);
};

export default function PermissionContainer(props) {
  const { children, projectId, needPermission } = props;
  const [hasAuth, setHasAuth] = useState(false);

  useEffect(() => {
    const cache = cachePermission[projectId];

    // 有缓存就先按旧值渲染（超过 5 分钟时下面的 prefetch 会顺带刷新）
    if (cache) {
      setHasAuth(hasPermission(cache.data || [], needPermission));

      if (moment().diff(moment(cache.time), 'm') <= 5) {
        return;
      }
    }

    // 这里统一走异步取数（原先是先同步请求版本号再取，那是废弃的同步 XHR）
    prefetchMyPermissions(projectId)
      .then(ids => setHasAuth(hasPermission(ids, needPermission)))
      .catch(_.noop);
  }, []);

  return hasAuth ? <React.Fragment>{children}</React.Fragment> : null;
}
