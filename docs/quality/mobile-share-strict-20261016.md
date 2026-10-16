# 移动分享与保存到知识库严格化验收

上海时间 2026-10-16，本批提交 `517838b80dc04cfc16695d4a12fdcc948b9b1d91` 并已普通推送 `origin/main`。

`src/pages/kc/shareMobile/shareMobile.ts`、`src/components/kc/saveToKnowledge/saveToKnowledge.ts` 和移动分享模型边界改为有限类型，接口回复、分享节点、微信签名/SDK、预览 URL、保存目标和失败路径都在使用前校验；原有预览、下载、iOS/Android、微信、权限、共享文件夹参数、保存载荷与定时提示行为保留。新增 `shareMobile.spec.ts` 使用真实 doT 模板、HTML/Cheerio 事件适配、实际表达式/文件大小/图标和保存辅助函数，覆盖 500 组历史 A/B、签名 URL、平台/权限分支、三类附件保存载荷、过期/失败/畸形边界；无网络写入、人员/权限变更或外部分享。

验证证据在 `/private/tmp/hap-mobile-share-strict-20261016/`：243/243 仓库规格通过（保留既有 `src/router/subPathNavigation.spec.ts` 1 项隔离 known-failure），工具、后缀、语法（4,753 文件）、fast（8,568 条、2,305 keys）、strict（51,522 条；3,110 个欠债文件，1,652/4,762 clean）、颜色、圆角、排版、JSX key 均通过。baseline 与 strict-debt 仅收紧。

此前已上线的“管理用户”无标题弹窗关闭按钮修正继续通过现网验收：关闭按钮距“添加用户”44px，垂直中心差 1px，点击可关闭；证据 `/private/tmp/hap-mobile-share-strict-20261016/manage-users-verified.jpg`。本批未再次发布生产；当天已有两版生产更新，现网仍为 `c1c74ba4d66e51972267c3fdda7c16917c417cdd`，上游 HEAD `5788d7d5d8d696dd0b969ce851570105934118b5` 无新变化。

旧回滚 `www-prev-20261015-ef0858d1b1` 已逐条比较后归档到 `/data/mingdao/hap-frontends-20261016/`，归档 SHA256 `20692ce6408af5f225811f14dfcffdf465c4aa5ae76884710f628f5e2358a2dd`，恢复脚本与 80,145 条目摘要保留；`/data` 可用约 18 GiB。当前生产回滚副本、后端回滚材料、doc 四个 external 卷及同步树原三项未提交改动均保留。

完整全仓 strict 目标仍未完成。
