# 下班前生产更新

用户于 2026-10-10 将目标扩展为每天 17:30 前更新一版生产。已设置同一聊天的每日 16:45 更新任务（Asia/Shanghai），预留 45 分钟完成验证与发布；GitHub 的两小时同步任务继续运行。未验证工作树仍不能发布，后端、数据库、业务记录和授权不在日常前端发布范围。

2026-10-10 15:09:36 +0800 完成生产前端更新，版本 `cfd1fd4536339399d62c540332585dea5db3a093`。本次取自干净的 `/Users/kogeki/dev/pd-openweb-750` 整合分支，包含已验证的人员弹窗、Gantt、客户端协议和此前门户/人员搜索修复；同时进行的 ScrollView/Cascader/Dialog 新批次未提交，未混入生产。

构建用时 1 分 11 秒，165 项规格及构建前全部门禁通过；真实 publish 和 runtime 资源校验通过（1095 JS、387 CSS，3 个 runtime）。HTML revision 与提交一致，产物无 `.dev.js`。工作树在构建/publish 后干净。

通过当前 `script-app-1` 前端做种，增量传输并保留旧 chunk、50x.html 和已有额外静态资源，未删除生产资源。files 实传 67 个/287799 字节；dist 实传 693 个/291999806 字节。容器内新目录在 SHA、版本、主入口资源和 dev 产物检查后切换，并保留可回滚目录。五个 HAP 7.5.0 配套容器未重启，保持运行。

- 生产目录：`/usr/local/MDPrivateDeployment/www`
- 回滚目录：`/usr/local/MDPrivateDeployment/www-prev-20261010-cfd1fd453`
- 宿主暂存：`/data/mingdao/frontend-cfd1fd453-20261010`
- 新 index SHA256：`756d8864f79930caa0cde1b911e49ca4765adf5bd502342d331345efe0e97156`
- 回滚 index SHA256：`abdad0605c8d2d2bb9537a836f15a4dbeb71ab6a6cdc5cf9bf22ea2d2fecd368`

真实内置浏览器验收：`/app/my` 正常显示 17 个应用，MDPublishVersion 与本次发布一致，isWaiting=false、jQuery=4.0.0、isPortal=false。MOM 运维的 UAT 清单加载并显示 20 条记录；原 UAT-0013 验收人搜索输入“刘倩”，焦点保持 INPUT/searchInput，搜索返回刘倩/业务系统中心，Runtime.exceptionThrown 无新增事件。未选择人员、保存记录或发送讨论；记录弹窗显示的既有草稿提示未被处理。此轮没有重新登录真实外部身份，不将内部会话验收冒称外部账号端到端验收。

验收截图：`/private/tmp/hap-production-20261010/production-search.png`。构建、publish、资源校验、预检查和传输记录在 `/private/tmp/hap-production-20261010`。

下次发布先重新核对现场版本、资源及可用磁盘，再生成独立暂存与备份名称，不覆盖本次回滚目录。当天安全可发布批次优先于继续开发未验证的新代码；没有新验证提交时核验现网并保持安静，失败则保留或恢复已知正常版本并报告。
