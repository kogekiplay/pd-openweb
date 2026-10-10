# 工具链与规格严格类型小批次

基于已推送的 `5ad4e559a`，本批收口 13 个工具配置/审计脚本和行为规格中的边界类型：webpack compiler hook、ESLint 动态规则表、环境变量索引、正则捕获可空性、CSS import 图、主题颜色计算、门户/缓存/主题规格的 AST 与全局对象边界。

工具严格检查按诊断标题计数从 2,919 降到 2,884，减少 35 条；本批文件没有新增诊断。产品完整 strict 保持 57,816 条，未改变生产代码路径。`audit-radius --check`、agent API 规格、preall、staticLanguages、requestCache、CSS import graph、functionalTextTokens、portalIdentityRedirect、applyThemeVars 等专项规格通过。

随后又收口了 10 个规格边界文件（表单认证、移动打印、关联表打印、工作流代码工具及路由/门户小规格），工具严格诊断进一步降至 2,874，仍无新增诊断；184/184 全仓规格继续通过。

全仓正式严格开关仍未全部开启，剩余工具脚本、规格和产品模块债务继续推进。本批没有生产发布；生产仍为 `5cf1a7bbb`，按日常任务在下一个安全批次完成验证后再更新。
