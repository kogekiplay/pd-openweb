# 生产前端更新记录：2026-10-15

上海时间 09:15:38 将 `8889535fa5588b5f6d6355e3562f2ad143c471be` 发布生产，包含控件数据边界严格化和级联对象默认值兼容修正。源码已通过普通 pre-push 同步 GitHub main；正式 release、publish、Webpack 资源校验通过（1,095 JS、387 CSS、3 runtime），42 组真实 safeParse / 历史 A/B、231/231 行为规格、工具/语法/fast/strict 与颜色/圆角/字体/JSX key 门禁通过。保留既有 PublicWorksheet weixinAuth 隔离失败。全仓终点诊断 52,772→52,675，按文件/错误码无新增；data.tsx 89→0，欠债 3,128，strict-clean 1,628/4,756，fast 8,656 / 2,328 keys。正式全仓严格化尚未完成。

候选 17,098 个文件在服务器及容器内逐文件 SHA256 比对通过；入口 SHA256 `94970ec35b2d03edb29fec83edce5c56d3c70be29d937a73ea3736c676340bed`。基于完整现网副本覆盖候选，保留旧资源和厂商 50x.html，无 .dev.js。旧入口 `11f7208c943595c85d81f81103aeef0cd6dce8488a4bde2d35ae19747e60dee4` 保留在容器 `/usr/local/MDPrivateDeployment/www-prev-20261015-8889535fa5`；服务器 `/data/mingdao/frontend-8889535fa5-20261015/rollback.sh` 已做语法检查。五个容器 ID、镜像、端口及全部挂载字段前后一致，nginx 配置检查通过。

公网六入口均 200，五个产品入口含本次 revision，34 个 JS/CSS/静态与厂商资源通过校验。已登录内置浏览器重载工作台后审批列表、应用收藏、最近使用及应用导航正常显示，DOM revision 匹配，控制台 error/warn 为 0。上游仍为 `5788d7d5d`（7.5.1），无需追加微服务升级。每日 16:45 上海时间的 HAP heartbeat `hap` 已重建 ACTIVE。

过程记录：初候选在切换前停止，用真实 safeParse 补齐级联对象默认值兼容并重新验证。最终源码首次 release 的 16 项规格超时，原失败日志保留；独立重跑完整门禁通过。首次最终候选切换因服务快照比较失败自动回滚，旧入口摘要确认恢复；重新核验服务字段一致后，按 Destination/Source 规范化挂载数组顺序，保留全部检查字段，再次校验候选并成功切换。失败瞬间的快照未单独保存，因此不将数组顺序认定为唯一原因。

证据：本机 `/private/tmp/hap-data-release-20261015/`，服务器 `/data/mingdao/frontend-8889535fa5-20261015/`。同步树待合入 drag.ts 的 resetDisplay 空行/保存行号回归另有 A/B 复现，尚未整合。
