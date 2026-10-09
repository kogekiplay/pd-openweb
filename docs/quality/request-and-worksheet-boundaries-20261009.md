# 请求、筛选与工作表工具边界：2026-10-09

本批继续完成全仓严格化目标，基于提交 `878c540e3`。

- 请求层 `src/common/global.ts` 的请求、缓存 envelope、错误、AES、同步 XHR、SSE 与可取消 Promise 边界全部写成有限类型；接口业务 payload 仍在没有 schema 的地方保留 unknown。
- 安装官方 `@types/crypto-js`，移除该库的模块类型黑洞；负向 probe 拒绝错误 AES metadata、缓存 envelope、SSE/普通 Promise 混用和缺 abort 的伪请求类型。
- QuickFilter formatter、filter formatter 及看板调用链使用真实控件、实体、动态 URL 源和条件模型；动态源按 UI 实际 `{ cid, rcid, staticValue }` 及服务端可选字段建模，不要求 UI 没有的字段。
- `src/utils/worksheet.ts` 对缓存、列样式、按钮组、打印项、权限开关和记录操作结果使用 unknown 解码和有限 union；缺列样式/按钮配置不会被错误断言成已存在配置。表格 actions 共享列样式模型。
- 修复工作表缺失分组/控件/数据、空列宽、非法权限范围和字符串时间戳比较等真实边界；有效输入保持原生产行为。FormSet 权限范围缺少 viewIds 时 fail-closed，空数组仍表示全视图。

严格 CLI 由 62899 降至 62738，按路径/错误码无新增；fast 10255 无新增，工具类型通过，116 项行为规格通过。已有公开表单微信鉴权子路径失败仍隔离为 known failure。类型/运行审查证据在 `/private/tmp/hap-strong-20261009` 与 `/private/tmp/hap-worksheet-utils-strict-20261009`。

全仓严格目标仍未完成：严格欠债清单、全局声明下限、旧工作表筛选组件、ming-ui 组件和大量 UI 消费者仍有存量诊断。当前提交只是继续减少存量债，不宣称 strict 已正式启用。
