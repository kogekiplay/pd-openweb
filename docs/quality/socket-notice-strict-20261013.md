# Socket 通知边界严格化

Socket 初始化、移动 socket 初始化、自定义通知和市场/系统通知链已统一到明确 payload 边界。新增 socket.io-client 最小声明只描述本仓使用的 connect/options/on 合同；通知数据在进入 UI 前由 decoder 验证必填 id/status/title/msg 或 noticeId，再保留 link、时间、类型和展示选项的可选性。自定义通知 action 使用有限分支调用 info/success/warning/error，避免字符串索引 antd 通知对象。

保留既有行为：worksheet Excel 下载、错误页、应用语言跳转、附件错误页、API 升级成功刷新、工作流引用刷新、市场弹窗/底部通知、系统刷新按钮、跨页面关闭以及 mobile/desktop socket 连接参数。antd 通知的 `duration: null` 在当前版本用 `0` 表示持久通知；socket 载荷不符合合同时忽略，避免一条坏消息中断监听器。

严格诊断 54,519 → 54,503，按文件/错误码新增 0；socket 目录五开关零诊断。语义基线收紧为 8,935 条 / 2,403 key；221/221 规格、语法和工具门禁通过。`socketTypes.spec.ts` 覆盖真实 decoder 的完整/可选/非法通知数据，确保字符串、数字、缺省值和错误对象的边界稳定。

全仓严格化仍未完成，剩余债务继续处理。GitHub 只同步 main；本批待正式 release 及资源校验后合入远端 main，生产发布遵循上海时间 16:45–17:30 窗口。
