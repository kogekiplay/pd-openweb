# 外部门户转圈与清单空白修复

2026-10-09。生产后台 7.5.0，前端最终修复版本 `ad1d10be9dec7b92fd1306e414d5ee712a8fd1eb`。

## 原因与修复

1. 邮箱认证成功的 `goApp` 调用会话写入器时没有启用其 verification 参数。普通私有部署域名、非 HttpOnly 且顶层页面下，写入器不写 Cookie 或 localStorage，旧主站 Cookie 可能继续生效。门户登录成功现在明确写入后端返回的会话，再跳回应用；未改变一般会话读写策略。
2. 门户路径加载到主站身份后，原身份切换用命名空间保留的 pathCompletion('/dashboard')，结果仍在 /portal/dashboard，自我重载。现在跨身份跳转明确构造目标站点路径，正确退出当前命名空间，合法门户身份继续留在原应用。
3. 门户顶栏校验读取 v4 专用 computedMatch，Router 8 的包装实际传入 match。合法应用被误判为另一应用，调用 logout，形成不断嵌套 ReturnUrl 的重载。现在优先读取真实 match.params，并兼容旧 computedMatch；真实应用不匹配仍会拒绝。
4. Application 的嵌套路由已改为相对路径，却继续使用 addSubPathOfRoutes。门户 /portal 被拼到相对路径前，清单主体不匹配。嵌套配置现在保持相对，门户与部署前缀由父路由处理。
5. 门户消息数量接口返回非数组时 find 会抛异常。读取前检查数组，失败不阻断主体页面。

## 验证

四个关键路径规格验证实际 preall 启动、goApp + 会话写入器、门户顶栏检查及 React Router 的实际配置匹配。对修改前源码执行同一规格均失败；新实现通过。完整行为规格 107/107，保留既有微信公开表单子路径隔离失败。语法、基础语义差分、严格类型棘轮及工具类型通过；完整 release/publish 成功，1094 个 JS / 387 个 CSS chunk 校验通过。

localhost:30001 使用相同生产构建代理现有 HAP。用户在内置浏览器填写验证码，代理点击登录/注册。第一版复测发现仍多次退出、清单空白，继续定位上述 3、4 项后重新构建。最终用已验证的真实外部用户刷新，观测到一次 Document 加载、正常工作表 API 请求、没有 logout 请求、isPortal=true、isWaiting=false，清单显示总计 19 条且控制台无错误。未创建、修改、删除清单记录。

生产于 2026-10-09 11:33:11 更新完成。首页 SHA256 `11c23f37038db372dba4c4e4bb874a467d8043be9a16b9c83430c4e6ea794045` 与本地产物一致，门户入口 HTTP 200。内置浏览器的生产主站身份正确一次跳到 /dashboard，isWaiting=false，前端版本与上述提交一致，无控制台错误。真实外部身份完整路径在 localhost 完成验收，未冒充生产门户身份。

回滚副本：容器 `/usr/local/MDPrivateDeployment/www-prev-20261009-portal`（首页哈希仍为升级版本 `86e94955...`）。新产物宿主目录 `/data/mingdao/frontend-portal-fix-20261009/new`。发布保留旧静态 chunk 和 50x.html，无后端重启。GitHub main 和 types-strict-diagnose 均已同步。

本地验收截图：`/private/tmp/hap-portal-20261009/portal-local-fixed.jpg`。本地预览保持运行供复核。
