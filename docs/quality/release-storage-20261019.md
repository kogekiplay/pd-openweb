# 完整回滚归档与发布空间（2026-10-19）

本轮将不活动目录 **/usr/local/MDPrivateDeployment/www-prev-20261018-ae026c501c** 归档到 **/Users/kogeki/dev/HAP-release-archives/20261019/**。当前生产9cd5和完整quick /usr/local/MDPrivateDeployment/www-prev-20261018-9cd5c15d08全程在服务器，五服务/完整Mounts/nginx/live/quick摘要受生产锁和实际快照守卫；未切换前端或升级微服务。

使用已验证固定工具scripts/deploy/offload-frontend-rollback.py（SHA **15059996f2b2c6711098ef7e0d3ded01e6933528af7dbcab07c592132a9df2e7**），完整导出后独立校验成员/文件SHA与元数据，和原目录tar compare；保持原raw清单守卫。随后实际完整恢复原目录、逐文件SHA/元数据和再次tar compare通过，校验持久材料未变后才最终释放已验证重复树。恢复投影仅忽略目录物理allocation，文件大小/名称/UID/GID/mtime/权限/类型/链接等未放宽。

终态 **phase=offloaded / restorationVerified=true / productionSwitched=false**，本机归档进程与SSH锁均已结束，不能按旧PID/阶段重启。共 **81632条目 / 81425普通文件 / 81425文件摘要**；包 **4252305742bytes**，SHA **2953f67d3f300b6da09c263760e656ff131a43e3ae3ca5f10b57f6be4cd330bf**，成员清单SHA **1e857f36eb44c65c71d19dfe3859a5e62e9bc5f8f8d144a7b55169554c3744d8**，文件清单SHA **d10c667280578f85bda6c4acb72942fade7dc807b902818e3b86080df448049b**，源入口SHA **206afdc245eeb18a7db299778c27935a633e9d998260786a9072b0d82c52cceb**。持久收据、包、两清单、固定工具、恢复脚本/摘要、完整日志与README俱在同目录；restore.sh语法与摘要通过，只重建指定不活动目录，生产切换走原流程。

归档原始锁内快照/data余10242658304bytes，完成后实测 **22736257024bytes**。最新冻结e6edc241cd的实际预算复核余 **22670716928bytes** > 全预算 **18591070253bytes**；预留4GiB及256MiB，复制live/两payload/包均计入。发布前仍需按实时状态重算。

20261017目录原7份63d/c1/23358/e494/3b/da/97f的完整实际恢复材料继续保留，累计8份；服务器索引 /data/mingdao/hap-offloaded-rollbacks/。a4c95恢复实现/目录、非completed051bfd/1ccf/7f198/b9e、当前/其他完整quick与历史链、厂商资源、doc四external卷保留。没有宽泛删除或降低发布门禁。

归档后按9cd5自身冻结清单复核六入口/34资源、5服务及完整挂载/nginx/当前与更旧quick摘要健康，无生产业务写入或新浏览器验收。证据 /private/tmp/hap-dynamic-render-20261019/archive*.json、production* 与 package-budget.json；固定材料入口 **/Users/kogeki/dev/HAP-release-archives/20261019/README.md**。
