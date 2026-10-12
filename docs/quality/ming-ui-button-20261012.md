# Button 事件与异步 action 严格化

Button 改用原生按钮属性加有限自有 props 合同，点击事件明确为 `MouseEvent<HTMLButtonElement>`。action 返回值保持 unknown，消费 then 前验证函数，并保留回调和 thenable 的真实 receiver；移除 DOM 透传中的自有 action/loading 属性及开放 any props。

同步返回和异常 action 会结束 loading；旧 Promise 完成不会关闭新 action 的 loading，卸载后不更新状态、不测量 DOM，复用生命周期不继承无效 action 的 loading。保留禁用行为、按钮宽度、视觉类名、回调顺序和受控 loading。OAuth 授权页把高度改为真正生效的 style；附件预览按钮把原有链接目标选项移到 window.open。

`BUTTON_BEFORE_REV=52eb2dae5 node src/ming-ui/components/Button.spec.ts` 通过 28 组正常渲染历史对照、7 种同步返回、4 种失败及 async 完成/拒绝、重叠 action、卸载/复用和 thenable receiver 规格。新规格自身在工具终点五开关下 0 诊断。

产品严格诊断 56,447 → 56,421，按文件/错误码新增 0；欠债 3,271 → 3,270 文件，strict-clean 1,462 → 1,463 / 4,733。语义差分为 9,061 条、2,452 key，无新增；工具和格式门禁通过。全量规格在并行编译负载下首次出现 customEvent 定时失败，降低并发至 4 后 207/207 通过；既有隔离项 PublicWorksheet weixinAuth 保留。全仓严格化尚未完成。

证据见 `/private/tmp/hap-button-before-strict.txt`、`hap-button-final-strict.txt`、`hap-button-tools-strict.txt`、`hap-button-specs-verified-20261012.log`。本批未部署，今天生产仍为 `e091d5f553`。
