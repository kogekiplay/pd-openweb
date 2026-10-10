# 构建与测试工具链严格化批次

本批从已推送的 `19c8b7548` 继续，收紧 CI 构建辅助、开发服务、HTML 生成、spec runner 和本地构建入口的类型边界。源码使用真实 Node、webpack、Babel、Cheerio、serve-handler、http-proxy-middleware 及 `@types/serve-handler` 类型；CJS `module.exports` 与命令行为保持。未知模块、配置、manifest、entry、网络和进程结果先按实际字段验证，未新增 any、忽略项或类型 shim。

完成的源码范围：`CI/utils.ts`、`CI/generate.ts`、`CI/serve.ts`、`CI/serveRuntime.spec.ts`、`CI/serve.spec.ts`、`CI/publishConfig.ts`、`scripts/build.ts`、`scripts/spec-harness.ts`、`scripts/run-specs.ts` 及两份专属规格。`scripts/build.ts` 还收紧了 Node 文件系统、子进程、webpack 任务、命令映射、阶段计时和环境变量访问；历史上从未存在的 `uploadFunctionFileToWorksheet` 导出改为明确失败信息，避免命令执行到 undefined。上传 transport 仍待单独实现，未假装上传成功。

行为验证覆盖路径递归、rewrite 替换、HTML entry hash、webpack callback/warning、开发 HTML、坏 manifest 拒绝、前后 HTML 对照、静态资源、JSON 代理重写、mdoc 保留、SSE 直通、502 收尾、非法代理 URL 400、WebSocket upgrade、CJS 直接加载和实际命令映射。179/179 规格通过，唯一保留的隔离失败是既有 PublicWorksheet weixinAuth subPath case。构建 release 用时 1 分 50 秒，1095 JS、387 CSS、3 runtime 资源校验通过；工作区在构建后保持干净（忽略构建产物除外）。

本批自有路径在五个 strict 目标开关下零诊断，普通工具门禁零诊断。全工具 strict 测量从此前约 3,632 条降至 3,391 条，剩余来自未纳入本批的 webpack 配置、其它 scripts/tools、既有 spec globals 和 typecheck 门禁等历史范围；不把自有批次零诊断冒称工具链全部完成。产品 strict 仍为 58,662 条存量诊断、3,397 个欠债文件，完整全仓目标继续推进。

证据：`/private/tmp/hap-ci-20261010`、`/private/tmp/hap-serve-freeze-report.json`、`/private/tmp/hap-spec-tools-20261010`、`/private/tmp/hap-tools-current5-*`。本批未部署生产；现网仍是已于 16:52 验收的 `9a1dd5378`，下一次下班前任务只发布经过同等门禁和构建验证的版本。
