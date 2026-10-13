# Workflow API v2 请求边界

`flowNode.ts` 与 `process.ts` 是由同一 API 模板生成的请求封装。此前每个方法的 `args/options` 都是隐式 any，TS7 严格检查为每个方法重复报错。现在统一使用 `Record<string, unknown>` 的请求参数和 `base.server` 的 options 合同，保留 URL、HTTP method、controllerName、mdyAPI 和 $.extend 的运行时行为；调用方仍可传入各自的字段集合，未知 API 字段保持开放。

本批在前一组 flowNode/process 基础上再覆盖同目录 20 个生成式 API 文件，共移除 350 条严格诊断，按文件/错误码新增 0；语义基线仍为 8,935 条 / 2,403 key。语法、工具及完整 221/221 规格门禁通过。生成式 API 没有独立业务 UI，验证重点是 TypeScript 编译、构建门禁和封装源码的请求路径/方法不变。全仓剩余债务继续处理。

GitHub 只同步 main；本批进入下一次 release 候选，生产仍按上海时间 16:45–17:30 窗口执行。
